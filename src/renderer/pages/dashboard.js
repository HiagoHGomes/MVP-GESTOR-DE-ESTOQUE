function movementRows(items, app) {
  if (!items.length) return '<tr><td colspan="4" class="empty-state">Nenhuma movimentação registrada.</td></tr>'

  return items.map(item => {
    const product = item.produtos || {}
    return `<tr>
      <td><span class="product-name">${app.escapeHtml(product.nome || 'Produto')}</span><br><span class="muted">${app.escapeHtml(product.sku || '')}</span></td>
      <td><span class="badge ${item.tipo === 'entrada' ? 'badge-entry' : item.tipo === 'saida' ? 'badge-exit' : 'badge-adjustment'}">${item.tipo}</span></td>
      <td>${app.formatNumber(item.quantidade)} ${app.escapeHtml(product.unidade || '')}</td>
      <td>${app.formatDate(item.criado_em)}</td>
    </tr>`
  }).join('')
}

export async function mount(root, app) {
  root.innerHTML = '<div class="loading-state">Carregando painel...</div>'

  try {
    const data = await window.api.dashboard.get()
    const lowStock = data.estoqueBaixo
    root.innerHTML = `
      <div class="page-heading">
        <div><h2>Resumo do estoque</h2><p>Acompanhe os indicadores e a atividade recente.</p></div>
        <div class="page-actions">
          <a class="button button-secondary" href="#produtos" data-route="produtos">Ver produtos</a>
          <a class="button button-primary" href="#movimentacoes" data-route="movimentacoes">Registrar movimentação</a>
        </div>
      </div>
      <div class="stats-grid">
        <article class="stat-card"><span class="stat-label">Produtos ativos</span><strong class="stat-value">${app.formatNumber(data.totalProdutos)}</strong></article>
        <article class="stat-card warning"><span class="stat-label">Abaixo do mínimo</span><strong class="stat-value">${app.formatNumber(lowStock.length)}</strong></article>
        <article class="stat-card"><span class="stat-label">Movimentações recentes</span><strong class="stat-value">${app.formatNumber(data.movimentacoesRecentes.length)}</strong></article>
      </div>
      <div class="dashboard-grid">
        <section class="panel">
          <div class="panel-heading"><h3>Estoque baixo</h3><a class="panel-link" href="#produtos" data-route="produtos">Ver produtos</a></div>
          <div class="table-scroll">
            <table><thead><tr><th>Produto</th><th>Saldo</th><th>Mínimo</th></tr></thead>
              <tbody>${lowStock.length ? lowStock.slice(0, 8).map(item => `
                <tr class="stock-low"><td><span class="product-name">${app.escapeHtml(item.nome)}</span><br><span class="muted">${app.escapeHtml(item.sku)}</span></td>
                <td>${app.formatNumber(item.estoque_atual)} ${app.escapeHtml(item.unidade)}</td><td>${app.formatNumber(item.estoque_minimo)} ${app.escapeHtml(item.unidade)}</td></tr>
              `).join('') : '<tr><td colspan="3" class="empty-state">Nenhum produto abaixo do mínimo.</td></tr>'}</tbody>
            </table>
          </div>
        </section>
        <section class="panel">
          <div class="panel-heading"><h3>Últimas movimentações</h3><a class="panel-link" href="#movimentacoes" data-route="movimentacoes">Ver histórico</a></div>
          <div class="table-scroll">
            <table><thead><tr><th>Produto</th><th>Tipo</th><th>Quantidade</th><th>Data</th></tr></thead>
              <tbody>${movementRows(data.movimentacoesRecentes, app)}</tbody>
            </table>
          </div>
        </section>
      </div>`
  } catch (error) {
    root.innerHTML = `<div class="error-state" role="alert">${app.escapeHtml(error.message || 'Não foi possível carregar o painel.')}</div>`
  }
}
