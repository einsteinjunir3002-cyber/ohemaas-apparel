import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://plctcjxlyhzbufybpatq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_hrYtHIzuHF6SDuttKivmRw_YmZjPfI-';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req, res) {
  try {
    const { count, error } = await supabase.from('ohemaa_products').select('*', { count: 'exact', head: true });
    if (error) throw error;
    return res.status(200).json({
      status: 'healthy',
      database: 'connected',
      supabaseUrl: SUPABASE_URL,
      productCount: count,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
