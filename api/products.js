import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://plctcjxlyhzbufybpatq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_hrYtHIzuHF6SDuttKivmRw_YmZjPfI-';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('ohemaa_products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.status(200).json({ success: true, count: data.length, products: data });
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const { id, price, in_stock, badge, name, description } = req.body;
      if (!id) {
        return res.status(400).json({ success: false, error: 'Product id is required' });
      }

      const updates = {};
      if (price !== undefined) updates.price = price === '' || price === null ? null : parseFloat(price);
      if (in_stock !== undefined) updates.in_stock = Boolean(in_stock);
      if (badge !== undefined) updates.badge = badge;
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      updates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('ohemaa_products')
        .update(updates)
        .eq('id', id)
        .select();

      if (error) throw error;
      return res.status(200).json({ success: true, updated: data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API products error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
