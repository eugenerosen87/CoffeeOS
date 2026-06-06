import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://kpunbnszfcikmqmwbrwq.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwdW5ibnN6ZmNpa21xbXdicndxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NjIxNTUsImV4cCI6MjA5NjEzODE1NX0.hyfLgCbOjpEvLC-pLM5uUYFZfnp54SEiFfxdBWjDgcM'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
