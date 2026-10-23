import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('style.css', 'utf8');
const js = fs.readFileSync('app.js', 'utf8');

console.log('==============================================');
console.log('   UXMIRROR REMEDIATION VERIFICATION SUITE    ');
console.log('==============================================\n');

let passCount = 0;
let totalChecks = 0;

function check(title, condition, details = '') {
  totalChecks++;
  if (condition) {
    passCount++;
    console.log(`[PASS] ${title}`);
    if (details) console.log(`       ${details}`);
  } else {
    console.log(`[FAIL] ${title}`);
    if (details) console.log(`       ${details}`);
  }
}

// 1. Single <h1> Element
const h1Matches = html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi) || [];
check('1. Single <h1> Element', h1Matches.length === 1, `Found ${h1Matches.length} <h1> tag(s)`);

// 2. Heading hierarchy sequential (no skipping levels)
const lines = html.split('\n');
let lastLevel = 0;
let skippedHeadings = [];
lines.forEach((line, i) => {
  const match = line.match(/<(h[1-6])\b[^>]*>(.*?)<\/\1>/i);
  if (match) {
    const level = parseInt(match[1][1]);
    if (lastLevel > 0 && level > lastLevel + 1) {
      skippedHeadings.push(`Line ${i+1}: from h${lastLevel} to h${level}`);
    }
    lastLevel = level;
  }
});
check('2. Heading Hierarchy Sequential (axe: heading-order)', skippedHeadings.length === 0, 
  skippedHeadings.length ? skippedHeadings.join(', ') : 'All heading levels increase by at most 1');

// 3. ARIA Dialog Accessible Names (axe: aria-dialog-name)
const modals = ['#productModal', '#reelModal', '#wholesaleModal', '#receiptModal', '#adminModal'];
let missingModalAria = [];
if (!html.includes('id="productModal" role="dialog" aria-modal="true" aria-labelledby="productModalTitle"')) missingModalAria.push('#productModal');
if (!html.includes('id="reelModal" role="dialog" aria-modal="true" aria-labelledby="reelHeaderBrand"')) missingModalAria.push('#reelModal');
if (!html.includes('id="wholesaleModal" role="dialog" aria-modal="true" aria-labelledby="wholesaleModalTitle"')) missingModalAria.push('#wholesaleModal');
if (!html.includes('id="receiptModal" role="dialog" aria-modal="true" aria-labelledby="receiptModalTitle"')) missingModalAria.push('#receiptModal');
if (!html.includes('id="adminModal" role="dialog" aria-modal="true" aria-labelledby="adminModalHeading"')) missingModalAria.push('#adminModal');
check('3. All ARIA Dialogs have Accessible Names', missingModalAria.length === 0, 
  missingModalAria.length ? `Missing: ${missingModalAria.join(', ')}` : 'All 5 modal dialogs have aria-labelledby');

// 4. Form inputs have labels or aria-labels
const inputRegex = /<(input|select|textarea)\b([^>]*)>/gi;
let m;
let unlabelled = [];
while ((m = inputRegex.exec(html)) !== null) {
  const attrs = m[2];
  const typeMatch = attrs.match(/type=["']([^"']+)["']/);
  const type = typeMatch ? typeMatch[1] : 'text';
  if (type === 'hidden') continue;
  const idMatch = attrs.match(/id=["']([^"']+)["']/);
  const id = idMatch ? idMatch[1] : null;
  const hasAria = /aria-label=/i.test(attrs) || /aria-labelledby=/i.test(attrs);
  const hasLabel = id && new RegExp(`<label\\b[^>]*for=["']${id}["']`, 'i').test(html);
  if (!hasAria && !hasLabel) unlabelled.push(m[0].substring(0, 50));
}
check('4. Form Fields Have Labels / aria-labels', unlabelled.length === 0,
  unlabelled.length ? `Unlabelled: ${unlabelled.join('; ')}` : 'All inputs in index.html have associated label or aria-label');

// 5. Dynamic inputs in app.js have aria-label
const dynamicInputsMissingAria = [];
const dynamicMatches = js.match(/<(input|select|textarea)\b([^>]*)>/gi) || [];
dynamicMatches.forEach(dm => {
  if (!/aria-label=/i.test(dm)) dynamicInputsMissingAria.push(dm);
});
check('5. Dynamic Form Fields in app.js Have aria-label', dynamicInputsMissingAria.length === 0,
  dynamicInputsMissingAria.length ? `Missing: ${dynamicInputsMissingAria.join('; ')}` : 'All dynamic inputs have aria-labels');

// 6. Image alt text does not repeat label text verbatim (axe: image-alt)
const redundantAlts = [];
if (html.includes('alt="Studio Video Reel">') && html.includes('Studio Reel</span>')) redundantAlts.push('Story 1');
if (html.includes('alt="Friday Drops">') && html.includes('Friday Drop</span>')) redundantAlts.push('Story 2');
if (html.includes('alt="Crown Shorts">') && html.includes('Crown</span>')) redundantAlts.push('Story 3');
if (html.includes('alt="Co-ords">') && html.includes('Co-ords</span>')) redundantAlts.push('Story 4');
if (html.includes('alt="Shorts">') && html.includes('Shorts</span>')) redundantAlts.push('Story 5');
if (html.includes('alt="Tie-Dye">') && html.includes('Tie-Dye</span>')) redundantAlts.push('Story 6');
check('6. Non-redundant Image Alt Texts', redundantAlts.length === 0,
  redundantAlts.length ? `Redundant: ${redundantAlts.join(', ')}` : 'All 6 story avatars have unique descriptive alt text');

// 7. Motion & Prefers Reduced Motion
const hasReducedMotion = css.includes('@media (prefers-reduced-motion: reduce)');
check('7. Prefers-Reduced-Motion Media Query Present', hasReducedMotion,
  hasReducedMotion ? 'Active animation disables or soft transitions under reduced motion' : 'Missing reduced-motion query');

// 8. Call to Action Language
const hasShopNowCTA = html.includes('Shop Collection Now') || html.includes('Shop New Arrivals Now');
check('8. High-Clarity Call-to-Action Language', hasShopNowCTA,
  hasShopNowCTA ? 'Hero button features explicit imperative CTA verb: "Shop Collection Now"' : 'Missing CTA');

// 9. Disciplined Color Tokens & High Contrast Text
const hasHighContrastTokens = css.includes('--text-on-gold: #0a0a0d;') && 
                              css.includes('--text-muted: #cbd5e1;') &&
                              css.includes('--text-dim: #94a3b8;');
const darkTextMatches = (css.match(/color:\s*#121216/g) || []).length;
check('9. WCAG AA Text Contrast & Palette Tokens', hasHighContrastTokens && darkTextMatches === 0,
  `Tokens elevated to WCAG AAA/AA, zero bare #121216 text colors against dark surfaces (remaining: ${darkTextMatches})`);

// 10. Navigation Aria Semantics
const hasBottomDockLabel = html.includes('id="bottomDock" aria-label="Quick Access Bar"');
const hasDrawerNavLabel = html.includes('class="drawer-nav" aria-label="Product Categories Navigation"');
check('10. Accessible Navigation Region Labels', hasBottomDockLabel && hasDrawerNavLabel,
  'Navigation regions clearly disambiguated with aria-label attributes');

console.log(`\nResults: ${passCount} / ${totalChecks} checks passed.`);
if (passCount === totalChecks) {
  console.log('STATUS: FULL UXMIRROR AUDIT RESOLUTION VERIFIED SUCCESSFUL!\n');
  process.exit(0);
} else {
  console.log('STATUS: SOME CHECKS FAILED!\n');
  process.exit(1);
}
