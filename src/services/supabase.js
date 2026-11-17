require('dotenv').config()

const { createClient } = require('@supabase/supabase-js')

let client

function getSupabase() {
  if (client) return client

  const url = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error('Configure SUPABASE_URL e SUPABASE_ANON_KEY no arquivo .env.')
  }

  client = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: false,
      detectSessionInUrl: false
    }
  })

  return client
}

module.exports = { getSupabase }
