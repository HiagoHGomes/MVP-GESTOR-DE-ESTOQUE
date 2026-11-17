import * as loginPage from './pages/login.js'
import * as dashboardPage from './pages/dashboard.js'
import * as produtosPage from './pages/produtos.js'
import * as movimentacoesPage from './pages/movimentacoes.js'

const pageMap = {
  dashboard: { title: 'Visão geral', module: dashboardPage },
  produtos: { title: 'Produtos', module: produtosPage },
  movimentacoes: { title: 'Movimentações', module: movimentacoesPage }
}

let currentUser = null
let toastTimer

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character])
}

function formatNumber(value) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(Number(value) || 0)
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date)
}

function notify(message, type = 'success') {
  let toast = document.querySelector('.toast')
  if (!toast) {
    toast = document.createElement('div')
    toast.className = 'toast'
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status')
    document.body.append(toast)
  }
  toast.textContent = message
  toast.classList.toggle('error', type === 'error')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toast.remove(), 5000)
}

function pageContext() {
  return {
    escapeHtml,
    formatNumber,
    formatDate,
    notify,
    navigate,
    onLogin: user => {
      currentUser = user
      return showPage('dashboard')
    }
  }
}

async function showPage(name, initialError = '') {
  if (name !== 'login' && !currentUser) name = 'login'

  const app = document.getElementById('app')
  if (name === 'login') {
    app.innerHTML = '<main class="auth-layout"><section id="page-content"></section></main>'
    await loginPage.mount(document.getElementById('page-content'), {
      ...pageContext(),
      initialError
    })
    return
  }

  const page = pageMap[name] || pageMap.dashboard
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="sidebar-brand">
          <span class="brand-mark" aria-hidden="true">E</span>
          <span><strong>Estoque</strong><small>Gestão simples</small></span>
        </div>
        <nav class="nav-list" aria-label="Navegação principal">
          <a class="nav-link ${name === 'dashboard' ? 'active' : ''}" href="#dashboard" data-route="dashboard"><span class="nav-icon" aria-hidden="true">⌂</span>Visão geral</a>
          <a class="nav-link ${name === 'produtos' ? 'active' : ''}" href="#produtos" data-route="produtos"><span class="nav-icon" aria-hidden="true">▦</span>Produtos</a>
          <a class="nav-link ${name === 'movimentacoes' ? 'active' : ''}" href="#movimentacoes" data-route="movimentacoes"><span class="nav-icon" aria-hidden="true">↕</span>Movimentações</a>
        </nav>
        <div class="sidebar-footer">
          <div class="user-email" title="${escapeHtml(currentUser.email)}">${escapeHtml(currentUser.email)}</div>
          <button class="button button-secondary button-small" type="button" data-action="logout">Sair</button>
        </div>
      </aside>
      <main class="main-area">
        <header class="topbar"><div><h1>${page.title}</h1><p>Controle de estoque da sua empresa</p></div></header>
        <section class="content" id="page-content"><div class="loading-state">Carregando...</div></section>
      </main>
    </div>`

  await page.module.mount(document.getElementById('page-content'), pageContext())
}

async function navigate(name) {
  if (name === 'login') {
    currentUser = null
  }
  await showPage(name)
}

document.getElementById('app').addEventListener('click', async event => {
  const routeLink = event.target.closest('[data-route]')
  if (routeLink) {
    event.preventDefault()
    await navigate(routeLink.dataset.route)
    return
  }

  if (event.target.closest('[data-action="logout"]')) {
    const button = event.target.closest('[data-action="logout"]')
    button.disabled = true
    try {
      await window.api.auth.logout()
      currentUser = null
      await showPage('login')
    } catch (error) {
      button.disabled = false
      notify(error.message || 'Não foi possível encerrar a sessão.', 'error')
    }
  }
})

async function start() {
  try {
    currentUser = await window.api.auth.session()
    await showPage(currentUser ? 'dashboard' : 'login')
  } catch (error) {
    await showPage('login', error.message || 'Não foi possível verificar a sessão.')
  }
}

start()
