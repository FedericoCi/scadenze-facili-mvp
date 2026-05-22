import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tfblweruifyjsnzylqyh.supabase.co';
const supabaseAnonKey = 'sb_publishable_zcR-8owV_BM16iPiEpWrBg_bpeu3gAh';

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);