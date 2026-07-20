import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://jdxtlxpvimjvcfrmeeap.supabase.co'
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkeHRseHB2aW1qdmNmcm1lZWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MjI3MjMsImV4cCI6MjA5NDE5ODcyM30.bM2UrDjohZMAPubrLQWFIr39pkh0vYlhz1KQPmAzDsI'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
