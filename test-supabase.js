import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://plctcjxlyhzbufybpatq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_hrYtHIzuHF6SDuttKivmRw_YmZjPfI-';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testConnection() {
  console.log('Testing Supabase connection...');
  try {
    const { data, error } = await supabase.from('products').select('*').limit(1);
    console.log('Products query result:', { data, error });
  } catch (err) {
    console.error('Error querying Supabase:', err);
  }
}

testConnection();
