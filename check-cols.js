import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://plctcjxlyhzbufybpatq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_hrYtHIzuHF6SDuttKivmRw_YmZjPfI-';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkCols() {
  const { data, error } = await supabase.from('ohemaa_products').select('*').limit(1);
  console.log('Columns sample query:', { data, error });
}

checkCols();
