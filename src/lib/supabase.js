import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Kiểm tra xem đã có đủ Key chưa
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Thiếu biến môi trường Supabase! Hãy kiểm tra .env.local")
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder-url.supabase.co', // URL giả để không crash lúc build
  supabaseAnonKey || 'placeholder-key'
)