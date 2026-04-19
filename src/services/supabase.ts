import { createClient } from 'supabase-js'

const supabaseUrl = 'https://ndiacwlgncuicfvjzqbr.supabase.co'
const supabaseKey = 'sb_secret_kt4rNe9N0MBFvOmkD4Ng5Q_8hupr_QX'

export const supabase = createClient(supabaseUrl, supabaseKey)
