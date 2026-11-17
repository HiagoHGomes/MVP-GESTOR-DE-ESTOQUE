const { randomUUID } = require('crypto')
const { getSupabase } = require('./supabase')
const { getTenantId } = require('./tenant')
const { isLocalTestSession } = require('./auth')
const localStore = require('./local-store')

function matchesProduct(product, { busca = '', categoria = '' } = {}) {
  const normalizedSearch = busca.trim().toLocaleLowerCase('pt-BR')
  const matchesSearch = !normalizedSearch
    || `${product.nome} ${product.sku}`.toLocaleLowerCase('pt-BR').includes(normalizedSearch)
  return matchesSearch && (!categoria || product.categoria === categoria)
}

async function listar({ busca = '', categoria = '' } = {}) {
  if (isLocalTestSession()) {
    const store = await localStore.read()
    return store.produtos
      .filter(product => product.ativo && matchesProduct(product, { busca, categoria }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }

  const tenantId = await getTenantId()
  let query = getSupabase()
    .from('produtos')
    .select('id, nome, sku, categoria, unidade, estoque_minimo, estoque_atual, ativo, criado_em')
    .eq('tenant_id', tenantId)
    .eq('ativo', true)
    .order('nome')

  if (busca.trim()) query = query.or(`nome.ilike.%${busca.trim()}%,sku.ilike.%${busca.trim()}%`)
  if (categoria) query = query.eq('categoria', categoria)

  const { data, error } = await query
  if (error) throw error
  return data
}

async function listarTodos({ busca = '', categoria = '', ativos = true } = {}) {
  if (isLocalTestSession()) {
    const store = await localStore.read()
    return store.produtos
      .filter(product => (ativos === null || product.ativo === ativos)
        && matchesProduct(product, { busca, categoria }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }

  const tenantId = await getTenantId()
  let query = getSupabase()
    .from('produtos')
    .select('id, nome, sku, categoria, unidade, estoque_minimo, estoque_atual, ativo, criado_em')
    .eq('tenant_id', tenantId)
    .order('nome')

  if (ativos !== null) query = query.eq('ativo', ativos)
  if (busca.trim()) query = query.or(`nome.ilike.%${busca.trim()}%,sku.ilike.%${busca.trim()}%`)
  if (categoria) query = query.eq('categoria', categoria)

  const { data, error } = await query
  if (error) throw error
  return data
}

async function criar(produto) {
  if (isLocalTestSession()) {
    return localStore.update(store => {
      const sku = produto.sku.trim()
      if (store.produtos.some(item => item.sku === sku)) {
        throw new Error('produtos_tenant_id_sku_key')
      }

      const created = {
        id: randomUUID(),
        nome: produto.nome.trim(),
        sku,
        categoria: produto.categoria.trim() || null,
        unidade: produto.unidade.trim(),
        estoque_minimo: produto.estoque_minimo,
        estoque_atual: 0,
        ativo: true,
        criado_em: new Date().toISOString()
      }
      store.produtos.push(created)
      return created
    })
  }

  const tenantId = await getTenantId()
  const { data, error } = await getSupabase()
    .from('produtos')
    .insert({
      tenant_id: tenantId,
      nome: produto.nome.trim(),
      sku: produto.sku.trim(),
      categoria: produto.categoria.trim() || null,
      unidade: produto.unidade.trim(),
      estoque_minimo: produto.estoque_minimo
    })
    .select('id, nome, sku, categoria, unidade, estoque_minimo, estoque_atual, ativo, criado_em')
    .single()

  if (error) throw error
  return data
}

async function atualizar(id, produto) {
  if (isLocalTestSession()) {
    return localStore.update(store => {
      const existing = store.produtos.find(item => item.id === id)
      if (!existing) throw new Error('Produto não encontrado.')

      const sku = produto.sku.trim()
      if (store.produtos.some(item => item.id !== id && item.sku === sku)) {
        throw new Error('produtos_tenant_id_sku_key')
      }

      Object.assign(existing, {
        nome: produto.nome.trim(),
        sku,
        categoria: produto.categoria.trim() || null,
        unidade: produto.unidade.trim(),
        estoque_minimo: produto.estoque_minimo
      })
      return existing
    })
  }

  const tenantId = await getTenantId()
  const { data, error } = await getSupabase()
    .from('produtos')
    .update({
      nome: produto.nome.trim(),
      sku: produto.sku.trim(),
      categoria: produto.categoria.trim() || null,
      unidade: produto.unidade.trim(),
      estoque_minimo: produto.estoque_minimo
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select('id, nome, sku, categoria, unidade, estoque_minimo, estoque_atual, ativo, criado_em')
    .single()

  if (error) throw error
  return data
}

async function desativar(id) {
  if (isLocalTestSession()) {
    return localStore.update(store => {
      const product = store.produtos.find(item => item.id === id)
      if (!product) throw new Error('Produto não encontrado.')
      product.ativo = false
    })
  }

  const tenantId = await getTenantId()
  const { error } = await getSupabase()
    .from('produtos')
    .update({ ativo: false })
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) throw error
}

module.exports = { listar, listarTodos, criar, atualizar, desativar }
