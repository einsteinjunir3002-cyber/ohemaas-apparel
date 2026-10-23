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

if (escaped === expected && corsPassed) {
  console.log('\nALL SECURITY CHECKS PASSED!');
  process.exit(0);
} else {
  console.error('\nSECURITY CHECKS FAILED!');
  process.exit(1);
}
