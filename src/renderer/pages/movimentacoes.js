let products = []

function renderMovements(root, records, app) {
  const body = root.querySelector('#movements-body')
  body.innerHTML = records.length ? records.map(item => {
    const product = item.produtos || {}
    const quantity = item.tipo === 'entrada'
      ? `+${app.formatNumber(item.quantidade)}`
      : item.tipo === 'saida'
        ? `−${app.formatNumber(item.quantidade)}`
        : app.formatNumber(item.quantidade)

    return `<tr>
      <td><span class="product-name">${app.escapeHtml(product.nome || 'Produto')}</span><br><span class="muted">${app.escapeHtml(product.sku || '')}</span></td>
      <td><span class="badge ${item.tipo === 'entrada' ? 'badge-entry' : item.tipo === 'saida' ? 'badge-exit' : 'badge-adjustment'}">${item.tipo}</span></td>
      <td>${quantity} ${app.escapeHtml(product.unidade || '')}${item.tipo === 'ajuste' ? '<br><span class="muted">saldo definido</span>' : ''}</td>
      <td>${app.escapeHtml(item.observacao || '—')}</td>
      <td>${app.formatDate(item.criado_em)}</td>
    </tr>`
  }).join('') : '<tr><td colspan="5" class="empty-state">Nenhuma movimentação para os filtros selecionados.</td></tr>'
}

function openForm(root, app) {
  root.querySelector('#movement-modal')?.remove()
  root.insertAdjacentHTML('beforeend', `
    <div class="modal-backdrop" id="movement-modal">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="movement-modal-title">
        <h3 id="movement-modal-title">Registrar movimentação</h3>
        <p class="modal-subtitle">O saldo do produto será atualizado automaticamente.</p>
        <form id="movement-form" novalidate>
          <div class="field"><label for="movement-product">Produto *</label><select id="movement-product" name="produto_id" required><option value="">Selecione</option>${products.map(product => `<option value="${app.escapeHtml(product.id)}">${app.escapeHtml(product.nome)} (${app.escapeHtml(product.sku)})</option>`).join('')}</select></div>
          <div class="field"><label for="movement-type">Tipo *</label><select id="movement-type" name="tipo" required><option value="entrada">Entrada</option><option value="saida">Saída</option><option value="ajuste">Ajuste de saldo</option></select></div>
          <div class="field"><label for="movement-quantity" id="movement-quantity-label">Quantidade *</label><input id="movement-quantity" name="quantidade" type="number" min="0.001" step="0.001" required></div>
          <div class="field"><label for="movement-note">Observação</label><textarea id="movement-note" name="observacao" maxlength="500" placeholder="Opcional"></textarea></div>
          <p class="form-error" id="movement-form-error" role="alert"></p>
          <div class="modal-actions"><button class="button button-secondary" type="button" data-action="close-modal">Cancelar</button><button class="button button-primary" type="submit">Registrar</button></div>
        </form>
      </section>
    </div>`)
  root.querySelector('#movement-product').focus()
}

async function loadHistory(root, app) {
  const filters = {
    produtoId: root.querySelector('#movement-filter-product').value,
    de: root.querySelector('#movement-filter-from').value,
    ate: root.querySelector('#movement-filter-to').value
  }

  if (filters.de && filters.ate && filters.de > filters.ate) {
    app.notify('A data inicial não pode ser posterior à data final.', 'error')
    return
  }

  const body = root.querySelector('#movements-body')
  body.innerHTML = '<tr><td colspan="5" class="loading-state">Carregando histórico...</td></tr>'
  try {
    const records = await window.api.movimentacoes.list(filters)
    renderMovements(root, records, app)
  } catch (error) {
    body.innerHTML = `<tr><td colspan="5" class="error-state" role="alert">${app.escapeHtml(error.message || 'Não foi possível carregar o histórico.')}</td></tr>`
  }
}

export async function mount(root, app) {
  root.innerHTML = '<div class="loading-state">Carregando movimentações...</div>'
  try {
    products = await window.api.produtos.list()
    root.innerHTML = `
      <div class="page-heading">
        <div><h2>Movimentações</h2><p>Registre entradas, saídas e ajustes, e consulte o histórico.</p></div>
        <div class="page-actions"><button class="button button-primary" type="button" data-action="new">+ Nova movimentação</button></div>
      </div>
      <div class="toolbar">
        <select class="filter-field" id="movement-filter-product" aria-label="Filtrar por produto">
          <option value="">Todos os produtos</option>${products.map(product => `<option value="${app.escapeHtml(product.id)}">${app.escapeHtml(product.nome)} (${app.escapeHtml(product.sku)})</option>`).join('')}
        </select>
        <label class="filter-field"><span class="muted">De</span><input id="movement-filter-from" type="date" aria-label="Data inicial"></label>
        <label class="filter-field"><span class="muted">Até</span><input id="movement-filter-to" type="date" aria-label="Data final"></label>
        <button class="button button-secondary" type="button" data-action="filter">Filtrar</button>
      </div>
      <div class="table-card"><div class="table-scroll"><table>
        <thead><tr><th>Produto / SKU</th><th>Tipo</th><th>Quantidade</th><th>Observação</th><th>Data</th></tr></thead>
        <tbody id="movements-body"><tr><td colspan="5" class="loading-state">Carregando...</td></tr></tbody>
      </table></div></div>`

    root.onclick = async event => {
      const button = event.target.closest('[data-action]')
      if (!button) return
      if (button.dataset.action === 'new') openForm(root, app)
      if (button.dataset.action === 'close-modal') root.querySelector('#movement-modal')?.remove()
      if (button.dataset.action === 'filter') await loadHistory(root, app)
    }
    root.onchange = event => {
      if (event.target.id === 'movement-type') {
        const adjustment = event.target.value === 'ajuste'
        root.querySelector('#movement-quantity-label').textContent = adjustment ? 'Saldo final *' : 'Quantidade *'
        root.querySelector('#movement-quantity').min = adjustment ? '0' : '0.001'
      }
    }
    root.onsubmit = async event => {
      if (event.target.id !== 'movement-form') return
      event.preventDefault()
      const form = event.target
      const errorNode = form.querySelector('#movement-form-error')
      if (!form.reportValidity()) return

      const values = new FormData(form)
      const type = String(values.get('tipo'))
      const quantity = Number(values.get('quantidade'))
      if (!Number.isFinite(quantity) || quantity < 0 || (type !== 'ajuste' && quantity <= 0)) {
        errorNode.textContent = type === 'ajuste'
          ? 'Informe um saldo final igual ou maior que zero.'
          : 'Informe uma quantidade maior que zero.'
        return
      }

      const submit = form.querySelector('[type="submit"]')
      submit.disabled = true
      submit.textContent = 'Registrando...'
      try {
        await window.api.movimentacoes.create({
          produto_id: String(values.get('produto_id')),
          tipo: type,
          quantidade,
          observacao: String(values.get('observacao')).trim()
        })
        app.notify('Movimentação registrada e saldo atualizado.')
        root.querySelector('#movement-modal')?.remove()
        await loadHistory(root, app)
      } catch (error) {
        submit.disabled = false
        submit.textContent = 'Registrar'
        errorNode.textContent = error.message || 'Não foi possível registrar a movimentação.'
      }
    }

    await loadHistory(root, app)
  } catch (error) {
    root.innerHTML = `<div class="error-state" role="alert">${app.escapeHtml(error.message || 'Não foi possível carregar os dados de movimentação.')}</div>`
  }
}
