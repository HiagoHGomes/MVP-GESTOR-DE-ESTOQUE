export async function mount(root, app) {
  root.innerHTML = `
    <div class="login-card">
      <span class="brand-mark" aria-hidden="true">E</span>
      <h1>Gestor de Estoque</h1>
      <p>Entre para acompanhar produtos e movimentações da sua empresa.</p>
      <p class="muted">Acesso local de teste: <strong>teste@teste.com</strong> / <strong>teste123</strong>. Produtos e movimentações ficam salvos neste computador.</p>
      <p class="auth-error" role="alert" id="login-error">${app.escapeHtml(app.initialError)}</p>
      <form id="login-form">
        <div class="field">
          <label for="login-email">E-mail</label>
          <input id="login-email" name="email" type="email" autocomplete="username" required maxlength="254" placeholder="voce@empresa.com" value="teste@teste.com">
        </div>
        <div class="field">
          <label for="login-password">Senha</label>
          <input id="login-password" name="password" type="password" autocomplete="current-password" required minlength="6" value="teste123">
        </div>
        <button class="button button-primary" type="submit">Entrar</button>
      </form>
    </div>`

  root.onsubmit = async event => {
    if (event.target.id !== 'login-form') return
    event.preventDefault()

    const form = event.target
    const button = form.querySelector('button[type="submit"]')
    const error = root.querySelector('#login-error')
    const email = form.elements.email.value.trim()
    const password = form.elements.password.value

    error.textContent = ''
    button.disabled = true
    button.textContent = 'Entrando...'

    try {
      const user = await window.api.auth.login(email, password)
      app.onLogin(user)
    } catch (loginError) {
      error.textContent = loginError.message || 'Não foi possível entrar. Verifique seus dados.'
      button.disabled = false
      button.textContent = 'Entrar'
    }
  }
}
