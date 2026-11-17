const { getSupabase } = require('./supabase')
const { getSession } = require('./auth')

async function getTenantId() {
  const user = await getSession()
  if (!user) throw new Error('Sua sessão expirou. Entre novamente.')

  const { data, error } = await getSupabase()
    .from('user_tenants')
    .select('tenant_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) {
    throw new Error('Sua conta ainda não está vinculada a uma empresa. Verifique a configuração do banco.')
  }

  return data.tenant_id
}

module.exports = { getTenantId }
