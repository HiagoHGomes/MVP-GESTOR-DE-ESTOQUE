const { getSupabase } = require('./supabase')
const { getSession, isLocalTestSession } = require('./auth')
const { getTenantId } = require('./tenant')
const { randomUUID } = require('crypto')
const localStore = require('./local-store')

async function listar({ produtoId = '', de = '', ate = '', limite = 100 } = {}) {
  if (isLocalTestSession()) {
    const store = await localStore.read()
    const start = de ? new Date(`${de}T00:00:00`).getTime() : null
    const endDate = ate ? new Date(`${ate}T00:00:00`) : null
    if (endDate) endDate.setDate(endDate.getDate() + 1)
    const end = endDate ? endDate.getTime() : null
    const maxItems = Math.min(Math.max(Number(limite) || 100, 1), 500)

    return store.movimentacoes
      .filter(item => {
        const createdAt = new Date(item.criado_em).getTime()
        return (!produtoId || item.produto_id === produtoId)
          && (start === null || createdAt >= start)
          && (end === null || createdAt < end)
      })
      .sort((a, b) => b.criado_em.localeCompare(a.criado_em))
      .slice(0, maxItems)
      .map(item => ({
        ...item,
        produtos: (() => {
          const product = store.produtos.find(candidate => candidate.id === item.produto_id)
          return product
            ? { nome: product.nome, sku: product.sku, unidade: product.unidade }
            : null
        })()
      }))
  }

  const tenantId = await getTenantId()
  let query = getSupabase()
    .from('movimentacoes')
    .select('id, produto_id, tipo, quantidade, observacao, usuario_id, criado_em, produtos(nome, sku, unidade)')
    .eq('tenant_id', tenantId)
    .order('criado_em', { ascending: false })
    .limit(Math.min(Math.max(Number(limite) || 100, 1), 500))

  if (produtoId) query = query.eq('produto_id', produtoId)
  if (de) query = query.gte('criado_em', new Date(`${de}T00:00:00`).toISOString())
  if (ate) {
    const diaSeguinte = new Date(`${ate}T00:00:00`)
    diaSeguinte.setDate(diaSeguinte.getDate() + 1)
    query = query.lt('criado_em', diaSeguinte.toISOString())
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

async function criar(movimentacao) {
  if (isLocalTestSession()) {
    return localStore.update(store => {
      const product = store.produtos.find(item => item.id === movimentacao.produto_id)
      if (!product || !product.ativo) throw new Error('Produto não encontrado ou inativo.')

      const { tipo, quantidade } = movimentacao
      if (!['entrada', 'saida', 'ajuste'].includes(tipo)
        || !Number.isFinite(quantidade)
        || quantidade < 0
        || (tipo !== 'ajuste' && quantidade === 0)) {
        throw new Error('Dados inválidos para a movimentação.')
      }

      const nextStock = tipo === 'entrada'
        ? product.estoque_atual + quantidade
        : tipo === 'saida'
          ? product.estoque_atual - quantidade
          : quantidade
      if (nextStock < 0) throw new Error('Estoque insuficiente para registrar esta saída.')

      const created = {
        id: randomUUID(),
        produto_id: product.id,
        tipo,
        quantidade,
        observacao: movimentacao.observacao.trim() || null,
        usuario_id: 'local-test-user',
        criado_em: new Date().toISOString()
      }
      product.estoque_atual = nextStock
      store.movimentacoes.push(created)
      return created
    })
  }

  const tenantId = await getTenantId()
  const user = await getSession()
  const { data, error } = await getSupabase()
    .from('movimentacoes')
    .insert({
      tenant_id: tenantId,
      produto_id: movimentacao.produto_id,
      tipo: movimentacao.tipo,
      quantidade: movimentacao.quantidade,
      observacao: movimentacao.observacao.trim() || null,
      usuario_id: user.id
    })
    .select('id, produto_id, tipo, quantidade, observacao, usuario_id, criado_em')
    .single()

  if (error) throw error
  return data
}

async function painel() {
  if (isLocalTestSession()) {
    const store = await localStore.read()
    const products = store.produtos
      .filter(item => item.ativo)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    const movements = store.movimentacoes
      .slice()
      .sort((a, b) => b.criado_em.localeCompare(a.criado_em))
      .slice(0, 10)
      .map(item => {
        const product = store.produtos.find(candidate => candidate.id === item.produto_id)
        return {
          ...item,
          produtos: product
            ? { nome: product.nome, sku: product.sku, unidade: product.unidade }
            : null
        }
      })

    return {
      totalProdutos: products.length,
      estoqueBaixo: products.filter(item => item.estoque_atual <= item.estoque_minimo),
      movimentacoesRecentes: movements
    }
  }

  const tenantId = await getTenantId()
  const supabase = getSupabase()

  const [produtos, movimentacoes] = await Promise.all([
    supabase
      .from('produtos')
      .select('id, nome, sku, estoque_atual, estoque_minimo, unidade')
      .eq('tenant_id', tenantId)
      .eq('ativo', true)
      .order('nome'),
    supabase
      .from('movimentacoes')
      .select('id, produto_id, tipo, quantidade, observacao, criado_em, produtos(nome, sku, unidade)')
      .eq('tenant_id', tenantId)
      .order('criado_em', { ascending: false })
      .limit(10)
  ])

  if (produtos.error) throw produtos.error
  if (movimentacoes.error) throw movimentacoes.error

  return {
    totalProdutos: produtos.data.length,
    estoqueBaixo: produtos.data.filter(item => item.estoque_atual <= item.estoque_minimo),
    movimentacoesRecentes: movimentacoes.data
  }
}

module.exports = { listar, criar, painel }
