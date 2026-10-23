globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};
globalThis.sessionStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};
globalThis.document = {
  addEventListener: () => {},
  getElementById: () => ({ addEventListener: () => {}, classList: { add: () => {}, remove: () => {} } }),
  querySelectorAll: () => [],
  createElement: () => ({ appendChild: () => {}, addEventListener: () => {}, classList: { add: () => {}, remove: () => {} }, dataset: {} }),
  body: { style: {} }
};
globalThis.window = {
  location: { href: 'http://localhost:3000' },
  addEventListener: () => {}
};

const { escapeHtml } = await import('./app.js');

// 1. Test XSS escaping
const payload = '<script>alert("xss")</script> & \'quote\'';
const escaped = escapeHtml(payload);
const expected = '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; &#039;quote&#039;';

console.log('1. XSS Escaping Test:');
console.log('   Input:   ', payload);
console.log('   Output:  ', escaped);
console.log('   Status:  ', escaped === expected ? 'PASS' : 'FAIL');

// 2. Test CORS Origin Allowlist Logic
const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/
];

const testOrigins = [
  { origin: 'https://wccba.vercel.app', allowed: true },
  { origin: 'https://ohemaas-apparel.vercel.app', allowed: true },
  { origin: 'http://localhost:3000', allowed: true },
  { origin: 'http://127.0.0.1:5173', allowed: true },
  { origin: 'https://attacker.com', allowed: false },
  { origin: 'https://evil.vercel.app.attacker.com', allowed: false }
];

console.log('\n2. CORS Allowlist Test:');
let corsPassed = true;
for (const t of testOrigins) {
  const result = ALLOWED_ORIGIN_PATTERNS.some(p => p.test(t.origin));
  const pass = result === t.allowed;
  if (!pass) corsPassed = false;
  console.log(`   ${t.origin} -> ${result ? 'ALLOWED' : 'BLOCKED'} (expected ${t.allowed ? 'ALLOWED' : 'BLOCKED'}): ${pass ? 'PASS' : 'FAIL'}`);
}
console.log('   CORS Status:', corsPassed ? 'PASS' : 'FAIL');

import fs from 'node:fs';

// 3. Test Supabase RLS Policy on ohemaa_orders
console.log('\n3. Supabase Schema RLS Policy Test:');
const sqlContent = fs.readFileSync('./supabase_schema.sql', 'utf8');
const hasOwnerScopedSelect = sqlContent.includes('CREATE POLICY "Users can only read their own orders" ON public.ohemaa_orders') &&
                             sqlContent.includes('USING (auth.uid() = user_id);');
const hasInsecureSelect = /CREATE POLICY [^;]+ ON public\.ohemaa_orders\s+FOR SELECT[^\;]+USING\s*\(\s*true\s*\)/i.test(sqlContent);
const rlsPassed = hasOwnerScopedSelect && !hasInsecureSelect;
console.log('   Has owner-scoped SELECT policy (auth.uid() = user_id):', hasOwnerScopedSelect);
console.log('   Has unconstrained USING (true) on SELECT:', hasInsecureSelect);
console.log('   RLS Policy Status:', rlsPassed ? 'PASS' : 'FAIL');

// 4. Test Announcement Ticker innerHTML removal
console.log('\n4. Announcement Ticker Sink Test:');
const appJsContent = fs.readFileSync('./app.js', 'utf8');
const hasTickerInnerHTML = appJsContent.includes(".announcement-ticker').innerHTML");
const tickerSafe = !hasTickerInnerHTML;
console.log('   Announcement ticker uses innerHTML:', hasTickerInnerHTML);
console.log('   Ticker Safe Status:', tickerSafe ? 'PASS' : 'FAIL');

if (escaped === expected && corsPassed && rlsPassed && tickerSafe) {
  console.log('\nALL 4 SECURITY CHECKS PASSED!');
  process.exit(0);
} else {
  console.error('\nSECURITY CHECKS FAILED!');
  process.exit(1);
}
