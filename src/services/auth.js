const { getSupabase } = require('./supabase')

const testCredentials = {
  email: 'teste@teste.com',
  password: 'teste123'
}

let testSession = null

async function login(email, password) {
  testSession = null

  if (email === testCredentials.email && password === testCredentials.password) {
    testSession = { id: 'local-test-user', email: testCredentials.email }
    return testSession
  }

  const { data, error } = await getSupabase().auth.signInWithPassword({
    email,
    password
  })

  if (error) throw error
  return { id: data.user.id, email: data.user.email }
}

async function logout() {
  if (testSession) {
    testSession = null
    return
  }

  const { error } = await getSupabase().auth.signOut()
  if (error) throw error
}

async function getSession() {
  if (testSession) return testSession

  const { data, error } = await getSupabase().auth.getSession()
  if (error) throw error

  const user = data.session?.user
  return user ? { id: user.id, email: user.email } : null
}

function isLocalTestSession() {
  return testSession !== null
}

module.exports = { login, logout, getSession, isLocalTestSession }
