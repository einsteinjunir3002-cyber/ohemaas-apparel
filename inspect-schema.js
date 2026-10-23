import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://plctcjxlyhzbufybpatq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_hrYtHIzuHF6SDuttKivmRw_YmZjPfI-';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectSchema() {
  const tables = ['Product', 'Order', 'User', 'Shop', 'Category', 'products', 'orders', 'settings', 'ohemaa_products', 'ohemaa_orders'];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (!error) {
      console.log(`Table '${t}' exists! Sample:`, data);
    } else {
      console.log(`Table '${t}' error: ${error.message} (${error.code})`);
    }
  }
}

inspectSchema();
