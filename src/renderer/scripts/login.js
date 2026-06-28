require('dotenv').config()
const supabase = require('../supabase')

async function login() {
  const email = document.getElementById('email').value
  const senha = document.getElementById('senha').value
  const erro = document.getElementById('erro')

  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha })

  if (error) {
    erro.textContent = 'E-mail ou senha inválidos.'
    return
  }

  // Login ok — redireciona para o dashboard
  window.location.href = 'index.html'
}