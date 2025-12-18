
import { createClient } from '@supabase/supabase-js';

// --- HƯỚNG DẪN SỬA LỖI KẾT NỐI ---
// 1. Vào Supabase Dashboard -> Project Settings -> API
// 2. So sánh "Project URL" của bạn với dòng bên dưới.
// 3. Nếu khác nhau (đặc biệt là đoạn mã ID như 'tiwbcztyyctoprpyskly'), hãy thay thế bằng cái mới của bạn.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://tiwbcztyyctoprpyskly.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpd2JjenR5eWN0b3BycHlza2x5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NTk5MTksImV4cCI6MjA4MDQzNTkxOX0.yYSHW9SaB-CueEU5efJd2g70LbvueNNYMl-eKjBWCN0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
