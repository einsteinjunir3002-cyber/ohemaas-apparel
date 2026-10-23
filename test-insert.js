import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://plctcjxlyhzbufybpatq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_hrYtHIzuHF6SDuttKivmRw_YmZjPfI-';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testInsertMinimal() {
  const { data, error } = await supabase.from('ohemaa_products').insert([{
    id: 'test-1',
    name: 'Test Dress'
  }]).select();
  console.log('Minimal insert:', { data, error });
}

testInsertMinimal();
