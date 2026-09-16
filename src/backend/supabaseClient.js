import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://benbfhpxgjiqmgcruwqv.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_IQJcRKgo5VaTX5QqOQx-Nw_rvlP0YLk';

const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) || DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(
    supabaseUrl,
    supabaseAnonKey
);

