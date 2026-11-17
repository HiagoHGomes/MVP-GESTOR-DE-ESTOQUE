let products = []
let categories = []

function filteredProducts(root) {
  const search = root.querySelector('#product-search').value.trim().toLocaleLowerCase('pt-BR')
  const category = root.querySelector('#product-category').value
  const status = root.querySelector('#product-status').value

  return products.filter(product => {
    const matchesSearch = !search || `${product.nome} ${product.sku}`.toLocaleLowerCase('pt-BR').includes(search)
    const matchesCategory = !category || product.categoria === category
    const matchesStatus = status === 'all' || (status === 'active' ? product.ativo : !product.ativo)
    return matchesSearch && matchesCategory && matchesStatus
  })
}

function renderRows(root, app) {
  const filtered = filteredProducts(root)
  const body = root.querySelector('#products-body')
  root.querySelector('#product-count').textContent = `${filtered.length} ${filtered.length === 1 ? 'produto' : 'produtos'}`

  body.innerHTML = filtered.length ? filtered.map(product => {
    const low = product.ativo && Number(product.estoque_atual) <= Number(product.estoque_minimo)
    return `<tr class="${low ? 'stock-low' : ''}">
      <td><span class="product-name">${app.escapeHtml(product.nome)}</span><br><span class="muted">${app.escapeHtml(product.sku)}</span></td>
      <td>${app.escapeHtml(product.categoria || '—')}</td>
      <td>${app.formatNumber(product.estoque_atual)} ${app.escapeHtml(product.unidade)}</td>
      <td>${app.formatNumber(product.estoque_minimo)} ${app.escapeHtml(product.unidade)}</td>
      <td><span class="badge ${product.ativo ? (low ? 'badge-low' : '') : 'status-inactive'}">${product.ativo ? (low ? 'Estoque baixo' : 'Ativo') : 'Inativo'}</span></td>
      <td><div class="row-actions">
        <button class="button button-secondary button-small" type="button" data-action="edit" data-id="${app.escapeHtml(product.id)}">Editar</button>
        ${product.ativo ? `<button class="button button-danger button-small" type="button" data-action="deactivate" data-id="${app.escapeHtml(product.id)}">Desativar</button>` : ''}
      </div></td>
    </tr>`
  }).join('') : '<tr><td colspan="6" class="empty-state">Nenhum produto encontrado.</td></tr>'
}

function openForm(root, app, product = null) {
  root.querySelector('#product-modal')?.remove()
  root.insertAdjacentHTML('beforeend', `
    <div class="modal-backdrop" id="product-modal">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title">
        <h3 id="product-modal-title">${product ? 'Editar produto' : 'Novo produto'}</h3>
        <p class="modal-subtitle">Preencha as informações do produto. O saldo é atualizado por movimentações.</p>
        <form id="product-form" novalidate>
          <input type="hidden" name="id" value="${app.escapeHtml(product?.id || '')}">
          <div class="field"><label for="product-name">Nome *</label><input id="product-name" name="nome" required maxlength="120" value="${app.escapeHtml(product?.nome || '')}"></div>
          <div class="field"><label for="product-sku">SKU *</label><input id="product-sku" name="sku" required maxlength="80" value="${app.escapeHtml(product?.sku || '')}"></div>
          <div class="field"><label for="product-category-input">Categoria</label><input id="product-category-input" name="categoria" maxlength="80" value="${app.escapeHtml(product?.categoria || '')}" list="product-categories"><datalist id="product-categories">${categories.map(category => `<option value="${app.escapeHtml(category)}">`).join('')}</datalist></div>
          <div class="field"><label for="product-unit">Unidade *</label><input id="product-unit" name="unidade" required maxlength="24" value="${app.escapeHtml(product?.unidade || 'un')}"></div>
          <div class="field"><label for="product-minimum">Estoque mínimo *</label><input id="product-minimum" name="estoque_minimo" type="number" min="0" step="0.001" required value="${app.escapeHtml(product?.estoque_minimo ?? 0)}"></div>
          <p class="form-error" id="product-form-error" role="alert"></p>
          <div class="modal-actions"><button class="button button-secondary" type="button" data-action="close-modal">Cancelar</button><button class="button button-primary" type="submit">Salvar produto</button></div>
        </form>
      </section>
    </div>`)
  root.querySelector('#product-name').focus()
}

async function loadProducts(root, app) {
  root.innerHTML = '<div class="loading-state">Carregando produtos...</div>'
  try {
    products = await window.api.produtos.listAll({ ativos: null })
    categories = [...new Set(products.map(product => product.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
    root.innerHTML = `
      <div class="page-heading">
        <div><h2>Produtos</h2><p>Cadastre e acompanhe os itens do seu estoque.</p></div>
        <div class="page-actions"><button class="button button-primary" type="button" data-action="new">+ Novo produto</button></div>
      </div>
      <div class="toolbar">
        <input class="search-field" id="product-search" type="search" placeholder="Buscar por nome ou SKU" aria-label="Buscar produtos">
        <select class="filter-field" id="product-category" aria-label="Filtrar por categoria"><option value="">Todas as categorias</option>${categories.map(category => `<option value="${app.escapeHtml(category)}">${app.escapeHtml(category)}</option>`).join('')}</select>
        <select class="filter-field" id="product-status" aria-label="Filtrar por situação"><option value="active">Ativos</option><option value="inactive">Inativos</option><option value="all">Todos</option></select>
        <span class="muted" id="product-count"></span>
      </div>
      <div class="table-card"><div class="table-scroll"><table>
        <thead><tr><th>Produto / SKU</th><th>Categoria</th><th>Saldo atual</th><th>Estoque mínimo</th><th>Situação</th><th></th></tr></thead>
        <tbody id="products-body"></tbody>
      </table></div></div>`

    root.oninput = event => {
      if (event.target.id === 'product-search') renderRows(root, app)
    }
    root.onchange = event => {
      if (event.target.id === 'product-category' || event.target.id === 'product-status') renderRows(root, app)
    }
    root.onclick = async event => {
      const button = event.target.closest('[data-action]')
      if (!button) return
      if (button.dataset.action === 'new') openForm(root, app)
      if (button.dataset.action === 'close-modal') root.querySelector('#product-modal')?.remove()
      if (button.dataset.action === 'edit') {
        const product = products.find(item => item.id === button.dataset.id)
        if (product) openForm(root, app, product)
      }
      if (button.dataset.action === 'deactivate') {
        const product = products.find(item => item.id === button.dataset.id)
        if (!product || !window.confirm(`Desativar "${product.nome}"? O histórico será mantido.`)) return
        button.disabled = true
        try {
          await window.api.produtos.deactivate(product.id)
          app.notify('Produto desativado.')
          await loadProducts(root, app)
        } catch (error) {
          button.disabled = false
          app.notify(error.message || 'Não foi possível desativar o produto.', 'error')
        }
      }
    }
    root.onsubmit = async event => {
      if (event.target.id !== 'product-form') return
      event.preventDefault()
      const form = event.target
      const errorNode = form.querySelector('#product-form-error')
      if (!form.reportValidity()) return

      const values = new FormData(form)
      const estoqueMinimo = Number(values.get('estoque_minimo'))
      if (!Number.isFinite(estoqueMinimo) || estoqueMinimo < 0) {
        errorNode.textContent = 'Informe um estoque mínimo igual ou maior que zero.'
        return
      }
      const product = {
        nome: String(values.get('nome')).trim(),
        sku: String(values.get('sku')).trim(),
        categoria: String(values.get('categoria')).trim(),
        unidade: String(values.get('unidade')).trim(),
        estoque_minimo: estoqueMinimo
      }
      if (!product.nome || !product.sku || !product.unidade) {
        errorNode.textContent = 'Preencha nome, SKU e unidade.'
        return
      }

      const submit = form.querySelector('[type="submit"]')
      submit.disabled = true
      submit.textContent = 'Salvando...'
      try {
        const id = String(values.get('id'))
        if (id) await window.api.produtos.update(id, product)
        else await window.api.produtos.create(product)
        app.notify(id ? 'Produto atualizado.' : 'Produto cadastrado.')
        await loadProducts(root, app)
      } catch (error) {
        submit.disabled = false
        submit.textContent = 'Salvar produto'
        errorNode.textContent = String(error.message || '').includes('produtos_tenant_id_sku_key')
          ? 'Já existe um produto com esse SKU nesta empresa.'
          : error.message || 'Não foi possível salvar o produto.'
      }
    }

    renderRows(root, app)
  } catch (error) {
    root.innerHTML = `<div class="error-state" role="alert">${app.escapeHtml(error.message || 'Não foi possível carregar os produtos.')}</div>`
  }
}

export async function mount(root, app) {
  await loadProducts(root, app)
}
