import { createClient } from '@supabase/supabase-js';
import { INITIAL_PRODUCTS, DEFAULT_SETTINGS } from './data.js';

const SUPABASE_URL = 'https://plctcjxlyhzbufybpatq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_hrYtHIzuHF6SDuttKivmRw_YmZjPfI-';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function syncCatalogToSupabase() {
  console.log('--- 1. Testing ohemaa_products ---');
  const { data: existing, error: fetchErr } = await supabase.from('ohemaa_products').select('id');
  if (fetchErr) {
    console.error('Error fetching ohemaa_products:', fetchErr);
  } else {
    console.log(`Current items in ohemaa_products: ${existing ? existing.length : 0}`);
    
    // Seed initial products if empty
    if (!existing || existing.length === 0) {
      console.log('Seeding initial products to Supabase...');
      const records = INITIAL_PRODUCTS.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        image: p.image,
        price: p.price,
        suggested_price: p.suggestedPrice,
        sizes: p.sizes,
        colors: p.colors,
        badge: p.badge,
        description: p.description,
        in_stock: p.inStock,
        is_featured: p.isFeatured
      }));

      const { data: inserted, error: insertErr } = await supabase.from('ohemaa_products').upsert(records);
      if (insertErr) {
        console.error('Error seeding products:', insertErr);
      } else {
        console.log('Successfully seeded 33 products to Supabase!');
      }
    }
  }

  console.log('\n--- 2. Testing ohemaa_orders ---');
  const { data: orders, error: ordersErr } = await supabase.from('ohemaa_orders').select('*').limit(3);
  if (ordersErr) {
    console.error('Error fetching ohemaa_orders:', ordersErr);
  } else {
    console.log(`Orders in database: ${orders ? orders.length : 0}`);
  }

  console.log('\n--- 3. Testing ohemaa_settings ---');
  const { data: settings, error: setErr } = await supabase.from('ohemaa_settings').select('*');
  if (setErr) {
    console.error('Error fetching ohemaa_settings:', setErr);
  } else {
    console.log(`Settings in database: ${settings ? settings.length : 0}`);
  }
}

syncCatalogToSupabase();
