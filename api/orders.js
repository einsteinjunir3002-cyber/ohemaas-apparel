import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://plctcjxlyhzbufybpatq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_hrYtHIzuHF6SDuttKivmRw_YmZjPfI-';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('ohemaa_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.status(200).json({ success: true, count: data.length, orders: data });
    }

    if (req.method === 'POST') {
      const { order_id, customer_name, customer_phone, delivery_method, address, notes, items, total_amount, is_wholesale } = req.body;

      if (!customer_name || !customer_phone || !items) {
        return res.status(400).json({ success: false, error: 'Customer name, phone, and items are required' });
      }

      const orderRecord = {
        order_id: order_id || `OHE-${Math.floor(1000 + Math.random() * 9000)}`,
        customer_name,
        customer_phone,
        delivery_method: delivery_method || 'friday-delivery',
        address: address || (delivery_method === 'store-pickup' ? 'Store Pick-Up' : 'Accra, Ghana'),
        notes: notes || '',
        items: items,
        total_amount: total_amount ? parseFloat(total_amount) : null,
        is_wholesale: Boolean(is_wholesale),
        status: 'Pending Confirmation',
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('ohemaa_orders')
        .insert([orderRecord])
        .select();

      if (error) throw error;
      return res.status(201).json({ success: true, order: data[0] });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API orders error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
