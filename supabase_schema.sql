-- Ohemaa's Apparel Supabase Schema
-- Create dedicated tables for products, orders, and store settings

-- 1. Products Table
CREATE TABLE IF NOT EXISTS public.ohemaa_products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  image TEXT NOT NULL,
  price NUMERIC,
  suggested_price NUMERIC,
  sizes JSONB DEFAULT '["S", "M", "L", "XL", "Free Size"]'::jsonb,
  colors JSONB DEFAULT '["As Pictured"]'::jsonb,
  badge TEXT,
  description TEXT,
  in_stock BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Orders Table
CREATE TABLE IF NOT EXISTS public.ohemaa_orders (
  id BIGSERIAL PRIMARY KEY,
  order_id TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  delivery_method TEXT NOT NULL,
  address TEXT,
  notes TEXT,
  items JSONB NOT NULL,
  total_amount NUMERIC,
  is_wholesale BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'Pending Confirmation',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Store Settings Table
CREATE TABLE IF NOT EXISTS public.ohemaa_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS and add public access policies for anon client
ALTER TABLE public.ohemaa_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ohemaa_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ohemaa_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read/write for ohemaa tables so the storefront & admin work seamlessly
DROP POLICY IF EXISTS "Public full access to ohemaa_products" ON public.ohemaa_products;
CREATE POLICY "Public full access to ohemaa_products" ON public.ohemaa_products FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access to ohemaa_orders" ON public.ohemaa_orders;
-- Allow public visitors to submit new orders only
CREATE POLICY "Allow public order insertion" ON public.ohemaa_orders 
  FOR INSERT 
  WITH CHECK (true);

-- Restrict order reads and management to authenticated administrative sessions
CREATE POLICY "Allow authenticated reads on ohemaa_orders" ON public.ohemaa_orders 
  FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Allow authenticated updates on ohemaa_orders" ON public.ohemaa_orders 
  FOR UPDATE 
  TO authenticated 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "Allow authenticated deletes on ohemaa_orders" ON public.ohemaa_orders 
  FOR DELETE 
  TO authenticated 
  USING (true);

DROP POLICY IF EXISTS "Public full access to ohemaa_settings" ON public.ohemaa_settings;
CREATE POLICY "Public full access to ohemaa_settings" ON public.ohemaa_settings FOR ALL USING (true) WITH CHECK (true);
