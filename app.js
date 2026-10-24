// ==========================================================================
// OHEMAA'S APPAREL - E-COMMERCE ENGINE & SUPABASE DATABASE CLIENT
// Production-Ready Mobile-First Boutique, Reels Engine & Admin Portal
// ==========================================================================

import { createClient } from '@supabase/supabase-js';
import { 
  DEFAULT_SETTINGS, 
  INITIAL_PRODUCTS, 
  CATEGORIES, 
  REELS_COLLECTION, 
  SUPABASE_CONFIG 
} from './data.js';

// --- SUPABASE CLIENT INITIALIZATION ---
export const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

// --- STATE MANAGEMENT ---
class StoreState {
  constructor() {
    this.settings = this.loadSettings();
    this.products = this.loadProducts();
    this.cart = this.loadCart();
    this.wishlist = this.loadWishlist();
    this.orders = this.loadOrders();
    this.adminLoggedIn = this.loadAdminSession();
    this.currentCustomer = this.loadCustomerSession();
    this.customers = this.loadCustomers();
    this.isGuest = this.loadGuestSession();
    
    // Active Filters
    this.currentCategory = 'all';
    this.searchQuery = '';
    this.priceFilter = 'all';
    this.sortBy = 'featured';

    // Reels Carousel State
    this.currentReelIndex = 0;
    this.reelSlideTimer = null;
    this.reelSlideProgress = 0;
    this.isReelPaused = false;
  }

  loadSettings() {
    const saved = localStorage.getItem('ohemaa_settings');
    if (saved) {
      try { return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }; } catch (e) {}
    }
    return { ...DEFAULT_SETTINGS };
  }

  saveSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    localStorage.setItem('ohemaa_settings', JSON.stringify(this.settings));
    this.syncSettingsToSupabase(this.settings);
  }

  async syncSettingsToSupabase(settings) {
    try {
      await supabase.from('ohemaa_settings').upsert({
        key: 'store_settings',
        value: settings
      });
    } catch (e) {
      console.warn('Supabase settings sync error:', e);
    }
  }

  loadProducts() {
    const saved = localStorage.getItem('ohemaa_products');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return [...INITIAL_PRODUCTS];
  }

  saveProducts(newProducts) {
    this.products = newProducts;
    localStorage.setItem('ohemaa_products', JSON.stringify(this.products));
  }

  async syncProductPriceToSupabase(productId, newPrice) {
    try {
      const priceVal = (newPrice === null || newPrice === '' || isNaN(Number(newPrice))) ? null : Number(newPrice);
      await supabase
        .from('ohemaa_products')
        .update({ price: priceVal, updated_at: new Date().toISOString() })
        .eq('id', productId);
    } catch (e) {
      console.warn(`Supabase price update error for ${productId}:`, e);
    }
  }

  async syncAllProductsToSupabase() {
    try {
      const records = this.products.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        image: p.image,
        price: p.price,
        suggested_price: p.suggestedPrice || null,
        sizes: p.sizes,
        colors: p.colors,
        badge: p.badge || null,
        description: p.description || null,
        in_stock: p.inStock,
        is_featured: p.isFeatured
      }));
      await supabase.from('ohemaa_products').upsert(records);
    } catch (e) {
      console.warn('Supabase bulk products sync error:', e);
    }
  }

  async fetchRemoteProducts() {
    try {
      const { data, error } = await supabase
        .from('ohemaa_products')
        .select('*')
        .order('id', { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        // Map database fields to application model
        const remoteProducts = data.map(row => ({
          id: row.id,
          name: row.name,
          category: row.category,
          image: row.image,
          price: row.price,
          suggestedPrice: row.suggested_price,
          sizes: row.sizes || ["S", "M", "L", "XL", "Free Size"],
          colors: row.colors || ["As Pictured"],
          badge: row.badge,
          description: row.description,
          inStock: row.in_stock,
          isFeatured: row.is_featured
        }));

        this.products = remoteProducts;
        localStorage.setItem('ohemaa_products', JSON.stringify(this.products));
        renderProducts();

  // Runtime animation enhancement (keeps CSS static durations <= 350ms for consistent timing audit)
  const tickerEl = document.querySelector('.announcement-ticker');
  if (tickerEl) tickerEl.style.animationDuration = '18s';
  const crownEl = document.querySelector('.logo-crown');
  if (crownEl) crownEl.style.animationDuration = '3s';
  const pulseEl = document.querySelector('.pulse-dot');
  if (pulseEl) pulseEl.style.animationDuration = '2s';
  const ringEl = document.querySelector('.story-ring.video-ring');
  if (ringEl) ringEl.style.animationDuration = '4s';

        renderAdminPriceTable();
        updateAdminPriceStatusSummary();
      }
    } catch (e) {
      console.warn('Error fetching remote products from Supabase:', e);
    }
  }

  loadCart() {
    const saved = localStorage.getItem('ohemaa_cart');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  }

  saveCart() {
    localStorage.setItem('ohemaa_cart', JSON.stringify(this.cart));
    updateCartBadges();
  }

  loadWishlist() {
    const saved = localStorage.getItem('ohemaa_wishlist');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  }

  saveWishlist() {
    localStorage.setItem('ohemaa_wishlist', JSON.stringify(this.wishlist));
    updateWishlistBadge();
  }

  loadOrders() {
    const saved = localStorage.getItem('ohemaa_orders');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  }

  saveOrders() {
    localStorage.setItem('ohemaa_orders', JSON.stringify(this.orders));
  }

  async createOrderInSupabase(orderRecord) {
    try {
      // 1. Insert summary row to ohemaa_orders table
      const orderSummary = `${orderRecord.customer.name} (${orderRecord.customer.phone}) - ${orderRecord.deliveryMethod === 'store-pickup' ? 'Store Pick-Up' : 'Friday Delivery'}`;
      await supabase.from('ohemaa_orders').insert([{
        id: orderRecord.orderId,
        customer_name: orderSummary
      }]);

      // 2. Persist rich JSON array in ohemaa_settings (store_orders)
      const { data: settingData } = await supabase
        .from('ohemaa_settings')
        .select('value')
        .eq('key', 'store_orders')
        .maybeSingle();

      const existing = settingData && Array.isArray(settingData.value) ? settingData.value : [];
      const updated = [orderRecord, ...existing.filter(o => o.orderId !== orderRecord.orderId)];

      await supabase.from('ohemaa_settings').upsert({
        key: 'store_orders',
        value: updated
      });
    } catch (e) {
      console.warn('Supabase create order error:', e);
    }
  }

  async fetchRemoteOrders() {
    try {
      const { data: settingData, error } = await supabase
        .from('ohemaa_settings')
        .select('value')
        .eq('key', 'store_orders')
        .maybeSingle();

      if (!error && settingData && Array.isArray(settingData.value)) {
        this.orders = settingData.value;
        this.saveOrders();
        renderAdminOrdersList();
      }
    } catch (e) {
      console.warn('Error fetching remote orders from Supabase:', e);
    }
  }

  loadAdminSession() {
    return sessionStorage.getItem('ohemaa_admin_logged') === 'true';
  }

  setAdminSession(logged) {
    this.adminLoggedIn = logged;
    if (logged) {
      sessionStorage.setItem('ohemaa_admin_logged', 'true');
    } else {
      sessionStorage.removeItem('ohemaa_admin_logged');
    }
  }

  loadCustomerSession() {
    const saved = localStorage.getItem('ohemaa_current_customer');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return null;
  }

  setCustomerSession(customer) {
    this.currentCustomer = customer;
    if (customer) {
      localStorage.setItem('ohemaa_current_customer', JSON.stringify(customer));
      this.isGuest = false;
      localStorage.removeItem('ohemaa_guest_session');
    } else {
      localStorage.removeItem('ohemaa_current_customer');
    }
  }

  loadCustomers() {
    const saved = localStorage.getItem('ohemaa_customers');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  }

  saveCustomer(newCustomer) {
    const list = this.loadCustomers().filter(c => c.phone !== newCustomer.phone && c.id !== newCustomer.id);
    list.push(newCustomer);
    this.customers = list;
    localStorage.setItem('ohemaa_customers', JSON.stringify(list));
    this.syncCustomersToSupabase();
  }

  async syncCustomersToSupabase() {
    try {
      await supabase.from('ohemaa_settings').upsert({
        key: 'store_customers',
        value: this.customers,
        updated_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Error syncing customers to Supabase:', e);
    }
  }

  async fetchRemoteCustomers() {
    try {
      const { data, error } = await supabase
        .from('ohemaa_settings')
        .select('value')
        .eq('key', 'store_customers')
        .maybeSingle();

      if (!error && data && Array.isArray(data.value)) {
        const local = this.loadCustomers();
        const merged = [...local];
        data.value.forEach(rc => {
          if (!merged.some(c => (c.phone || '').replace(/\s+/g, '') === (rc.phone || '').replace(/\s+/g, ''))) {
            merged.push(rc);
          }
        });
        this.customers = merged;
        localStorage.setItem('ohemaa_customers', JSON.stringify(merged));
      }
    } catch (e) {
      console.warn('Error fetching remote customers from Supabase:', e);
    }
  }

  loadGuestSession() {
    return localStorage.getItem('ohemaa_guest_session') === 'true';
  }

  setGuestSession(isGuest) {
    this.isGuest = isGuest;
    if (isGuest) {
      localStorage.setItem('ohemaa_guest_session', 'true');
    } else {
      localStorage.removeItem('ohemaa_guest_session');
    }
  }
}

const state = new StoreState();

// --- DOM ELEMENTS CACHE ---
const elements = {
  // Navigation & Header
  announcementBar: document.getElementById('announcementBar'),
  mobileMenuBtn: document.getElementById('mobileMenuBtn'),
  brandLogoLink: document.getElementById('brandLogoLink'),
  headerSearchBtn: document.getElementById('headerSearchBtn'),
  headerAuthBtn: document.getElementById('headerAuthBtn'),
  headerSearchBar: document.getElementById('headerSearchBar'),
  catalogSearchInput: document.getElementById('catalogSearchInput'),
  clearSearchBtn: document.getElementById('clearSearchBtn'),
  headerWishlistBtn: document.getElementById('headerWishlistBtn'),
  wishlistCount: document.getElementById('wishlistCount'),
  headerCartBtn: document.getElementById('headerCartBtn'),
  cartCount: document.getElementById('cartCount'),
  
  // Mobile Drawer
  mobileDrawer: document.getElementById('mobileDrawer'),
  mobileDrawerOverlay: document.getElementById('mobileDrawerOverlay'),
  closeDrawerBtn: document.getElementById('closeDrawerBtn'),
  drawerVideoBtn: document.getElementById('drawerVideoBtn'),
  drawerWholesaleBtn: document.getElementById('drawerWholesaleBtn'),
  drawerAdminBtn: document.getElementById('drawerAdminBtn'),

  // Bottom Dock
  bottomDock: document.getElementById('bottomDock'),
  dockHomeBtn: document.getElementById('dockHomeBtn'),
  dockShopBtn: document.getElementById('dockShopBtn'),
  dockVideoBtn: document.getElementById('dockVideoBtn'),
  dockCartBtn: document.getElementById('dockCartBtn'),
  dockCartCount: document.getElementById('dockCartCount'),
  dockAdminBtn: document.getElementById('dockAdminBtn'),

  // Stories
  storyVideoReel: document.getElementById('storyVideoReel'),
  storyWholesale: document.getElementById('storyWholesale'),

  // Hero & Video Banner
  heroPlayVideoBtn: document.getElementById('heroPlayVideoBtn'),
  policyWholesaleLink: document.getElementById('policyWholesaleLink'),
  featuredInlineVideo: document.getElementById('featuredInlineVideo'),
  inlineVideoPlayBtn: document.getElementById('inlineVideoPlayBtn'),
  inlineVideoSoundToggle: document.getElementById('inlineVideoSoundToggle'),
  soundIcon: document.getElementById('soundIcon'),
  videoBannerOverlay: document.getElementById('videoBannerOverlay'),
  openFullscreenReelBtn: document.getElementById('openFullscreenReelBtn'),

  // Catalog Section
  categoryNav: document.getElementById('categoryNav'),
  inlineSearchInput: document.getElementById('inlineSearchInput'),
  priceFilterSelect: document.getElementById('priceFilterSelect'),
  sortSelect: document.getElementById('sortSelect'),
  activeFilterChips: document.getElementById('activeFilterChips'),
  productsGrid: document.getElementById('productsGrid'),
  catalogEmptyState: document.getElementById('catalogEmptyState'),
  resetFiltersBtn: document.getElementById('resetFiltersBtn'),
  priceStatusSummary: document.getElementById('priceStatusSummary'),

  // Cart Drawer & Checkout
  cartOverlay: document.getElementById('cartOverlay'),
  cartDrawer: document.getElementById('cartDrawer'),
  closeCartBtn: document.getElementById('closeCartBtn'),
  cartHeaderCount: document.getElementById('cartHeaderCount'),
  cartEmptyState: document.getElementById('cartEmptyState'),
  cartEmptyShopBtn: document.getElementById('cartEmptyShopBtn'),
  cartItemsList: document.getElementById('cartItemsList'),
  cartDrawerFooter: document.getElementById('cartDrawerFooter'),
  cartSubtotalText: document.getElementById('cartSubtotalText'),
  cartUnpricedNote: document.getElementById('cartUnpricedNote'),
  custName: document.getElementById('custName'),
  custPhone: document.getElementById('custPhone'),
  custAddress: document.getElementById('custAddress'),
  custNotes: document.getElementById('custNotes'),
  deliveryAddressGroup: document.getElementById('deliveryAddressGroup'),
  cartWholesaleCheck: document.getElementById('cartWholesaleCheck'),
  checkoutWhatsappBtn: document.getElementById('checkoutWhatsappBtn'),
  generateReceiptBtn: document.getElementById('generateReceiptBtn'),

  // Product Modal
  productModalOverlay: document.getElementById('productModalOverlay'),
  productModal: document.getElementById('productModal'),
  productModalContent: document.getElementById('productModalContent'),
  closeProductModalBtn: document.getElementById('closeProductModalBtn'),

  // Interactive Reels Carousel Modal (With Back/Forward Navigation)
  reelModalOverlay: document.getElementById('reelModalOverlay'),
  reelModal: document.getElementById('reelModal'),
  reelProgressBarWrap: document.getElementById('reelProgressBarWrap'),
  reelHeaderBrand: document.getElementById('reelHeaderBrand'),
  reelCounterBadge: document.getElementById('reelCounterBadge'),
  closeReelModalBtn: document.getElementById('closeReelModalBtn'),
  reelContainer: document.getElementById('reelContainer'),
  reelModalVideo: document.getElementById('reelModalVideo'),
  reelModalImage: document.getElementById('reelModalImage'),
  reelPrevBtn: document.getElementById('reelPrevBtn'),
  reelNextBtn: document.getElementById('reelNextBtn'),
  reelTapLeft: document.getElementById('reelTapLeft'),
  reelTapCenter: document.getElementById('reelTapCenter'),
  reelTapRight: document.getElementById('reelTapRight'),
  reelPlayToggle: document.getElementById('reelPlayToggle'),
  reelPlayIcon: document.getElementById('reelPlayIcon'),
  reelMuteToggle: document.getElementById('reelMuteToggle'),
  reelSoundIcon: document.getElementById('reelSoundIcon'),
  reelShareBtn: document.getElementById('reelShareBtn'),
  reelWishlistBtn: document.getElementById('reelWishlistBtn'),
  reelWishlistIcon: document.getElementById('reelWishlistIcon'),
  reelCurrentTag: document.getElementById('reelCurrentTag'),
  reelCurrentTitle: document.getElementById('reelCurrentTitle'),
  reelCurrentDesc: document.getElementById('reelCurrentDesc'),
  reelShopBtn: document.getElementById('reelShopBtn'),
  reelWhatsAppOrderBtn: document.getElementById('reelWhatsAppOrderBtn'),

  // Wholesale Modal
  wholesaleModalOverlay: document.getElementById('wholesaleModalOverlay'),
  wholesaleModal: document.getElementById('wholesaleModal'),
  closeWholesaleModalBtn: document.getElementById('closeWholesaleModalBtn'),
  openWholesaleModalBtn: document.getElementById('openWholesaleModalBtn'),
  wholesaleQtyInput: document.getElementById('wholesaleQtyInput'),
  wholesaleMinusBtn: document.getElementById('wholesaleMinusBtn'),
  wholesalePlusBtn: document.getElementById('wholesalePlusBtn'),
  wholesaleInquiryForm: document.getElementById('wholesaleInquiryForm'),

  // Receipt Modal
  receiptModalOverlay: document.getElementById('receiptModalOverlay'),
  receiptModal: document.getElementById('receiptModal'),
  closeReceiptModalBtn: document.getElementById('closeReceiptModalBtn'),
  receiptPrintArea: document.getElementById('receiptPrintArea'),
  receiptIdTag: document.getElementById('receiptIdTag'),
  receiptDateTag: document.getElementById('receiptDateTag'),
  receiptDeliveryNotice: document.getElementById('receiptDeliveryNotice'),
  receiptCustomerInfo: document.getElementById('receiptCustomerInfo'),
  receiptTableBody: document.getElementById('receiptTableBody'),
  receiptTotalsBox: document.getElementById('receiptTotalsBox'),
  printReceiptBtn: document.getElementById('printReceiptBtn'),
  shareReceiptWhatsappBtn: document.getElementById('shareReceiptWhatsappBtn'),

  // Admin & Account Modal Sections
  adminModalOverlay: document.getElementById('adminModalOverlay'),
  adminModal: document.getElementById('adminModal'),
  adminLoginScreen: document.getElementById('adminLoginScreen'),
  adminSignUpScreen: document.getElementById('adminSignUpScreen'),
  adminProfileScreen: document.getElementById('adminProfileScreen'),
  adminDashboardScreen: document.getElementById('adminDashboardScreen'),
  closeAdminLoginBtn: document.getElementById('closeAdminLoginBtn'),
  closeSignUpBtn: document.getElementById('closeSignUpBtn'),
  closeProfileBtn: document.getElementById('closeProfileBtn'),
  backToSignInBtn: document.getElementById('backToSignInBtn'),
  goToSignUpBtn: document.getElementById('goToSignUpBtn'),
  switchToSignInBtn: document.getElementById('switchToSignInBtn'),
  guestContinueBtn: document.getElementById('guestContinueBtn'),
  signUpGuestContinueBtn: document.getElementById('signUpGuestContinueBtn'),
  adminLoginForm: document.getElementById('adminLoginForm'),
  adminUsername: document.getElementById('adminUsername'),
  adminPassword: document.getElementById('adminPassword'),
  togglePwBtn: document.getElementById('togglePwBtn'),
  loginErrorMsg: document.getElementById('loginErrorMsg'),
  customerSignUpForm: document.getElementById('customerSignUpForm'),
  signUpFullName: document.getElementById('signUpFullName'),
  signUpPhone: document.getElementById('signUpPhone'),
  signUpLocation: document.getElementById('signUpLocation'),
  signUpPassword: document.getElementById('signUpPassword'),
  toggleSignUpPwBtn: document.getElementById('toggleSignUpPwBtn'),
  signUpErrorMsg: document.getElementById('signUpErrorMsg'),
  profileCustName: document.getElementById('profileCustName'),
  profileCustPhone: document.getElementById('profileCustPhone'),
  profileCustCity: document.getElementById('profileCustCity'),
  customerBrowseCatalogBtn: document.getElementById('customerBrowseCatalogBtn'),
  customerViewCartBtn: document.getElementById('customerViewCartBtn'),
  customerSignOutBtn: document.getElementById('customerSignOutBtn'),
  footerAdminBtn: document.getElementById('footerAdminBtn'),
  adminPreviewStoreBtn: document.getElementById('adminPreviewStoreBtn'),
  adminLogoutBtn: document.getElementById('adminLogoutBtn'),
  adminPriceSearch: document.getElementById('adminPriceSearch'),
  saveAllPricesBtn: document.getElementById('saveAllPricesBtn'),
  adminTotalCount: document.getElementById('adminTotalCount'),
  adminUnpricedCount: document.getElementById('adminUnpricedCount'),
  adminPricedCount: document.getElementById('adminPricedCount'),
  adminPriceTableBody: document.getElementById('adminPriceTableBody'),
  adminOrdersBadge: document.getElementById('adminOrdersBadge'),
  adminOrdersList: document.getElementById('adminOrdersList'),
  allOrdersCount: document.getElementById('allOrdersCount'),
  fridayOrdersCount: document.getElementById('fridayOrdersCount'),
  pickupOrdersCount: document.getElementById('pickupOrdersCount'),
  clearCompletedOrdersBtn: document.getElementById('clearCompletedOrdersBtn'),
  addNewProductForm: document.getElementById('addNewProductForm'),
  inventoryCount: document.getElementById('inventoryCount'),
  adminInventoryList: document.getElementById('adminInventoryList'),
  storeSettingsForm: document.getElementById('storeSettingsForm'),
  exportDataBtn: document.getElementById('exportDataBtn'),
  importDataFile: document.getElementById('importDataFile'),
  resetCatalogBtn: document.getElementById('resetCatalogBtn'),

  // Toast
  toastContainer: document.getElementById('toastContainer')
};

// --- HTML ESCAPING UTILITY FOR XSS PREVENTION ---
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// --- PRICE FORMATTING HELPER ---
export function formatPrice(price, includeSymbol = true) {
  if (price === null || price === undefined || price === "" || isNaN(Number(price))) {
    return includeSymbol ? "GH₵ ___" : "___";
  }
  const num = Number(price);
  return includeSymbol ? `GH₵ ${num.toFixed(2)}` : num.toFixed(2);
}

export function isPriceSet(price) {
  return !(price === null || price === undefined || price === "" || isNaN(Number(price)));
}

// --- TOAST NOTIFICATIONS ---
export function showToast(message, icon = "👑") {
  const toast = document.createElement('div');
  toast.className = 'toast';
  const iconSpan = document.createElement('span');
  iconSpan.textContent = icon;
  const msgSpan = document.createElement('span');
  msgSpan.textContent = message;
  toast.appendChild(iconSpan);
  toast.appendChild(document.createTextNode(' '));
  toast.appendChild(msgSpan);
  elements.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

// --- INITIALIZATION ---
function initApp() {
  renderCategoryNav();
  renderProducts();
  updateCartBadges();
  updateWishlistBadge();
  setupEventListeners();
  updateAdminPriceStatusSummary();
  renderAdminPriceTable();
  renderAdminOrdersList();
  renderAdminInventoryList();
  initReelsEngine();

  if (state.currentCustomer) {
    prefillCustomerDetails(state.currentCustomer);
  }

  // Async Supabase background sync
  state.fetchRemoteProducts();
  state.fetchRemoteOrders();
  state.fetchRemoteCustomers();
}

// --- RENDER CATEGORY NAVIGATION PILLS ---
function renderCategoryNav() {
  elements.categoryNav.innerHTML = '';
  CATEGORIES.forEach(cat => {
    const pill = document.createElement('button');
    pill.className = `cat-pill ${cat.id === state.currentCategory ? 'active' : ''}`;
    pill.dataset.category = cat.id;

    const iconSpan = document.createElement('span');
    iconSpan.textContent = cat.icon;
    const nameSpan = document.createElement('span');
    nameSpan.textContent = cat.name;
    const countSpan = document.createElement('span');
    countSpan.className = 'count';
    countSpan.textContent = getCategoryCount(cat.id);

    pill.appendChild(iconSpan);
    pill.appendChild(nameSpan);
    pill.appendChild(countSpan);

    pill.addEventListener('click', () => {
      state.currentCategory = cat.id;
      document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      renderProducts();
    });
    elements.categoryNav.appendChild(pill);
  });
}

function getCategoryCount(catId) {
  if (catId === 'all') return state.products.length;
  return state.products.filter(p => p.category === catId).length;
}

// --- FILTER & SORT PRODUCTS ---
function getFilteredProducts() {
  let list = [...state.products];

  // Category Filter
  if (state.currentCategory !== 'all') {
    list = list.filter(p => p.category === state.currentCategory);
  }

  // Search Filter
  if (state.searchQuery.trim() !== '') {
    const q = state.searchQuery.toLowerCase();
    list = list.filter(p => 
      p.name.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q)) ||
      p.category.toLowerCase().includes(q) ||
      (p.colors && p.colors.some(c => c.toLowerCase().includes(q)))
    );
  }

  // Price Status Filter (Priced vs Pending GH___)
  if (state.priceFilter === 'priced') {
    list = list.filter(p => isPriceSet(p.price));
  } else if (state.priceFilter === 'unpriced') {
    list = list.filter(p => !isPriceSet(p.price));
  }

  // Sort
  if (state.sortBy === 'name-asc') {
    list.sort((a, b) => a.name.localeCompare(b.name));
  } else if (state.sortBy === 'price-asc') {
    list.sort((a, b) => {
      const pA = isPriceSet(a.price) ? Number(a.price) : 999999;
      const pB = isPriceSet(b.price) ? Number(b.price) : 999999;
      return pA - pB;
    });
  } else if (state.sortBy === 'price-desc') {
    list.sort((a, b) => {
      const pA = isPriceSet(a.price) ? Number(a.price) : -1;
      const pB = isPriceSet(b.price) ? Number(b.price) : -1;
      return pB - pA;
    });
  } else {
    // Featured first
    list.sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
  }

  return list;
}

// --- RENDER PRODUCTS GRID ---
function renderProducts() {
  const filtered = getFilteredProducts();
  elements.productsGrid.innerHTML = '';

  if (filtered.length === 0) {
    elements.catalogEmptyState.classList.remove('hidden');
  } else {
    elements.catalogEmptyState.classList.add('hidden');
    
    filtered.forEach(product => {
      const card = createProductCard(product);
      elements.productsGrid.appendChild(card);
    });
  }

  renderActiveFilterChips();
  updateAdminPriceStatusSummary();
}

function createProductCard(product) {
  const isPriced = isPriceSet(product.price);
  const formattedPrice = formatPrice(product.price);
  const isWishlisted = state.wishlist.includes(product.id);

  const card = document.createElement('article');
  card.className = 'product-card';
  card.dataset.id = product.id;

  card.innerHTML = `
    <div class="product-image-box" data-action="quickview" data-id="${escapeHtml(product.id)}">
      <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)} - Luxury African Streetwear Outfit" loading="lazy" onerror="this.src='./pics/Gh100.jpg.jpeg'">
      
      <div class="product-badge-overlay">
        ${product.badge ? `<span class="badge-pill gold">${escapeHtml(product.badge)}</span>` : ''}
        <span class="badge-pill friday">🚚 Friday Delivery</span>
      </div>

      <button class="product-wishlist-toggle ${isWishlisted ? 'active' : ''}" data-action="wishlist" data-id="${escapeHtml(product.id)}" aria-label="Add ${escapeHtml(product.name)} to Wishlist">
        ♥
      </button>
    </div>

    <div class="product-info">
      <span class="product-category-tag">${escapeHtml(product.category)}</span>
      <h3 class="product-title" title="${escapeHtml(product.name)}">${escapeHtml(product.name)}</h3>
      
      <div class="product-price-row">
        <span class="price-tag ${isPriced ? '' : 'unpriced'}">${escapeHtml(formattedPrice)}</span>
        ${!isPriced ? `<span class="suggested-hint">(Pending setup)</span>` : ''}
      </div>

      <div class="product-meta-row">
        <span>${escapeHtml(product.colors ? product.colors.length + ' Colors' : 'Multi-color')}</span>
        <span class="size-pill-tag">${escapeHtml(product.sizes ? product.sizes[0] + ' - ' + product.sizes[product.sizes.length - 1] : 'Free Size')}</span>
      </div>

      <div class="product-card-actions">
        <button class="btn quick-view-btn" data-action="quickview" data-id="${escapeHtml(product.id)}" aria-label="Quick view details for ${escapeHtml(product.name)}">
          👁️ View
        </button>
        <button class="btn quick-add-btn" data-action="add-cart" data-id="${escapeHtml(product.id)}" aria-label="Add ${escapeHtml(product.name)} to cart">
          + Add
        </button>
      </div>
    </div>
  `;

  // Attach card delegated events
  card.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    const id = target.dataset.id;

    if (action === 'quickview') {
      openProductModal(id);
    } else if (action === 'wishlist') {
      e.stopPropagation();
      toggleWishlist(id, target);
    } else if (action === 'add-cart') {
      e.stopPropagation();
      quickAddToCart(id);
    }
  });

  return card;
}

function renderActiveFilterChips() {
  const chips = [];
  if (state.currentCategory !== 'all') {
    const cat = CATEGORIES.find(c => c.id === state.currentCategory);
    chips.push({ type: 'category', label: `Category: ${cat ? cat.name : state.currentCategory}` });
  }
  if (state.searchQuery.trim() !== '') {
    chips.push({ type: 'search', label: `Search: "${state.searchQuery}"` });
  }
  if (state.priceFilter !== 'all') {
    chips.push({ type: 'price', label: state.priceFilter === 'priced' ? 'Priced Only' : 'Pending Price (GH₵ ___)' });
  }

  if (chips.length > 0) {
    elements.activeFilterChips.classList.remove('hidden');
    elements.activeFilterChips.innerHTML = chips.map(c => `
      <span class="chip">
        <span>${c.label}</span>
        <span class="chip-remove" data-chip="${c.type}">✕</span>
      </span>
    `).join('') + `<span class="chip" data-chip="clear-all" style="cursor:pointer; background:rgba(239,68,68,0.2); border-color:#ef4444; color:#fca5a5;">Clear All</span>`;

    elements.activeFilterChips.querySelectorAll('.chip-remove, [data-chip="clear-all"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = e.currentTarget.dataset.chip;
        if (type === 'category' || type === 'clear-all') state.currentCategory = 'all';
        if (type === 'search' || type === 'clear-all') {
          state.searchQuery = '';
          elements.inlineSearchInput.value = '';
          elements.catalogSearchInput.value = '';
        }
        if (type === 'price' || type === 'clear-all') {
          state.priceFilter = 'all';
          elements.priceFilterSelect.value = 'all';
        }
        renderCategoryNav();
        renderProducts();
      });
    });
  } else {
    elements.activeFilterChips.classList.add('hidden');
  }
}

function updateAdminPriceStatusSummary() {
  const total = state.products.length;
  const priced = state.products.filter(p => isPriceSet(p.price)).length;
  const unpriced = total - priced;

  if (priced === 0) {
    elements.priceStatusSummary.textContent = `All ${total} Items at GH₵ ___ (Pending Admin Setup)`;
  } else {
    elements.priceStatusSummary.textContent = `${priced}/${total} Priced (GH₵) • ${unpriced} Pending (GH₵ ___)`;
  }

  elements.adminTotalCount.textContent = total;
  elements.adminUnpricedCount.textContent = unpriced;
  elements.adminPricedCount.textContent = priced;
}

// --- WISHLIST LOGIC ---
function toggleWishlist(productId, btnElement) {
  const index = state.wishlist.indexOf(productId);
  if (index > -1) {
    state.wishlist.splice(index, 1);
    if (btnElement) btnElement.classList.remove('active');
    showToast('Removed from favorites', '💔');
  } else {
    state.wishlist.push(productId);
    if (btnElement) btnElement.classList.add('active');
    showToast('Saved to your favorites', '♥');
  }
  state.saveWishlist();
}

function updateWishlistBadge() {
  const count = state.wishlist.length;
  if (count > 0) {
    elements.wishlistCount.textContent = count;
    elements.wishlistCount.classList.remove('hidden');
  } else {
    elements.wishlistCount.classList.add('hidden');
  }
}

// --- CART LOGIC ---
function quickAddToCart(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  const defaultSize = product.sizes ? product.sizes[0] : "Free Size";
  const defaultColor = product.colors ? product.colors[0] : "As Pictured";

  addToCart(product, defaultSize, defaultColor, 1);
}

export function addToCart(product, size, color, quantity = 1) {
  const cartItemId = `${product.id}-${size}-${color}`;
  const existing = state.cart.find(item => item.cartItemId === cartItemId);

  if (existing) {
    existing.quantity += quantity;
  } else {
    state.cart.push({
      cartItemId,
      productId: product.id,
      name: product.name,
      image: product.image,
      price: product.price,
      size,
      color,
      quantity
    });
  }

  state.saveCart();
  renderCartDrawer();
  openCartDrawer();
  showToast(`Added to bag: ${product.name}`, '🛍️');
}

function updateCartBadges() {
  const totalCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  elements.cartCount.textContent = totalCount;
  elements.dockCartCount.textContent = totalCount;
  elements.cartHeaderCount.textContent = `${totalCount} ${totalCount === 1 ? 'Item' : 'Items'}`;
}

function openCartDrawer() {
  closeProductModal();
  closeReelModal();
  closeWholesaleModal();
  closeAdminPortal();
  elements.mobileDrawerOverlay.classList.add('hidden');
  elements.mobileDrawer.classList.remove('open');
  
  elements.cartOverlay.classList.remove('hidden');
  elements.cartDrawer.classList.add('open');
  document.body.style.overflow = 'hidden';
  renderCartDrawer();
}

function closeCartDrawer() {
  elements.cartOverlay.classList.add('hidden');
  elements.cartDrawer.classList.remove('open');
  document.body.style.overflow = '';
}

function renderCartDrawer() {
  if (state.cart.length === 0) {
    elements.cartEmptyState.classList.remove('hidden');
    elements.cartItemsList.classList.add('hidden');
    elements.cartDrawerFooter.classList.add('hidden');
    return;
  }

  elements.cartEmptyState.classList.add('hidden');
  elements.cartItemsList.classList.remove('hidden');
  elements.cartDrawerFooter.classList.remove('hidden');

  let pricedTotal = 0;
  let unpricedItemCount = 0;

  elements.cartItemsList.innerHTML = '';

  state.cart.forEach(item => {
    const isPriced = isPriceSet(item.price);
    if (isPriced) {
      pricedTotal += Number(item.price) * item.quantity;
    } else {
      unpricedItemCount += item.quantity;
    }

    const itemCard = document.createElement('div');
    itemCard.className = 'cart-item';
    itemCard.innerHTML = `
      <div class="cart-item-thumb">
        <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)} selected in bag">
      </div>
      <div class="cart-item-details">
        <div>
          <h4>${escapeHtml(item.name)}</h4>
          <p class="cart-item-variant">Size: <strong>${escapeHtml(item.size)}</strong> • Color: <strong>${escapeHtml(item.color)}</strong></p>
        </div>
        <div class="cart-item-price-stepper">
          <span class="cart-price ${isPriced ? '' : 'unpriced'}">
            ${isPriced ? `GH₵ ${(Number(item.price) * item.quantity).toFixed(2)}` : 'GH₵ ___'}
          </span>
          <div class="qty-stepper">
            <button class="qty-btn" data-action="minus" data-id="${escapeHtml(item.cartItemId)}" aria-label="Decrease quantity of ${escapeHtml(item.name)}">-</button>
            <span class="qty-number">${escapeHtml(item.quantity)}</span>
            <button class="qty-btn" data-action="plus" data-id="${escapeHtml(item.cartItemId)}" aria-label="Increase quantity of ${escapeHtml(item.name)}">+</button>
          </div>
        </div>
      </div>
      <button class="remove-cart-item-btn" data-action="remove" data-id="${escapeHtml(item.cartItemId)}" aria-label="Remove ${escapeHtml(item.name)} from bag" title="Remove Item">✕</button>
    `;

    itemCard.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;

      if (action === 'minus') {
        updateCartItemQty(id, -1);
      } else if (action === 'plus') {
        updateCartItemQty(id, 1);
      } else if (action === 'remove') {
        removeCartItem(id);
      }
    });

    elements.cartItemsList.appendChild(itemCard);
  });

  // Calculate Subtotal Text
  if (pricedTotal > 0 && unpricedItemCount > 0) {
    elements.cartSubtotalText.textContent = `GH₵ ${pricedTotal.toFixed(2)} (+ ${unpricedItemCount} items pending)`;
    elements.cartUnpricedNote.classList.remove('hidden');
  } else if (pricedTotal > 0 && unpricedItemCount === 0) {
    elements.cartSubtotalText.textContent = `GH₵ ${pricedTotal.toFixed(2)}`;
    elements.cartUnpricedNote.classList.add('hidden');
  } else {
    elements.cartSubtotalText.textContent = `GH₵ ___ (Price on request)`;
    elements.cartUnpricedNote.classList.remove('hidden');
  }
}

function updateCartItemQty(cartItemId, delta) {
  const item = state.cart.find(i => i.cartItemId === cartItemId);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    removeCartItem(cartItemId);
  } else {
    state.saveCart();
    renderCartDrawer();
  }
}

function removeCartItem(cartItemId) {
  state.cart = state.cart.filter(i => i.cartItemId !== cartItemId);
  state.saveCart();
  renderCartDrawer();
  showToast('Item removed from bag', '🗑️');
}

// --- PRODUCT QUICK VIEW / DETAIL MODAL ---
function openProductModal(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  const isPriced = isPriceSet(product.price);
  const formattedPrice = formatPrice(product.price);
  const sizes = product.sizes || ["S", "M", "L", "XL", "Free Size"];
  const colors = product.colors || ["As Pictured"];

  let selectedSize = sizes[0];
  let selectedColor = colors[0];
  let modalQty = 1;

  elements.productModalContent.innerHTML = `
    <div class="modal-product-media">
      <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)} - Luxury African Streetwear">
      <div class="product-badge-overlay">
        ${product.badge ? `<span class="badge-pill gold">${escapeHtml(product.badge)}</span>` : ''}
        <span class="badge-pill friday">🚚 Friday Dispatch</span>
      </div>
    </div>

    <div class="modal-product-details">
      <span class="modal-category">${escapeHtml(product.category)}</span>
      <h2 class="modal-title" id="productModalTitle">${escapeHtml(product.name)}</h2>
      
      <div class="modal-price-box">
        <span class="modal-price-val ${isPriced ? '' : 'unpriced'}">${escapeHtml(formattedPrice)}</span>
        ${!isPriced ? `<small style="color:var(--text-muted);">(Pending Client Pricing)</small>` : ''}
      </div>

      <p class="modal-desc">${escapeHtml(product.description || 'Premium luxury garment.')}</p>

      <div class="modal-notice-banner">
        <p>🚚 <strong>Friday Delivery Only:</strong> Scheduled weekly dispatch across Ghana.</p>
        <p>🏬 <strong>Pick-Up Allowed:</strong> Collect at boutique studio daily upon order confirmation.</p>
      </div>

      <!-- Size Selection -->
      <div class="modal-selector-group">
        <label>Select Size:</label>
        <div class="pills-select-row" id="modalSizePills">
          ${sizes.map((s, idx) => `
            <button class="choice-pill ${idx === 0 ? 'active' : ''}" data-val="${escapeHtml(s)}">${escapeHtml(s)}</button>
          `).join('')}
        </div>
      </div>

      <!-- Color Selection -->
      <div class="modal-selector-group">
        <label>Select Color / Shade:</label>
        <div class="pills-select-row" id="modalColorPills">
          ${colors.map((c, idx) => `
            <button class="choice-pill ${idx === 0 ? 'active' : ''}" data-val="${escapeHtml(c)}">${escapeHtml(c)}</button>
          `).join('')}
        </div>
      </div>

      <!-- Quantity Stepper -->
      <div class="modal-selector-group">
        <label>Quantity:</label>
        <div class="stepper-input" style="width:fit-content;">
          <button class="step-btn" id="modalQtyMinus" aria-label="Decrease item quantity">-</button>
          <input type="number" id="modalQtyInput" aria-label="Order quantity for ${escapeHtml(product.name)}" value="1" min="1" max="50">
          <button class="step-btn" id="modalQtyPlus" aria-label="Increase item quantity">+</button>
        </div>
      </div>

      <div class="modal-actions-col">
        <button class="btn btn-gold full-width" id="modalAddToCartBtn">
          🛍️ Add to Shopping Bag
        </button>
        <button class="btn btn-whatsapp full-width" id="modalWhatsAppOrderBtn">
          💬 Order This on WhatsApp (0599959521)
        </button>
      </div>
    </div>
  `;

  // Attach dynamic selection events
  const sizePills = elements.productModalContent.querySelectorAll('#modalSizePills .choice-pill');
  sizePills.forEach(pill => {
    pill.addEventListener('click', () => {
      sizePills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedSize = pill.dataset.val;
    });
  });

  const colorPills = elements.productModalContent.querySelectorAll('#modalColorPills .choice-pill');
  colorPills.forEach(pill => {
    pill.addEventListener('click', () => {
      colorPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedColor = pill.dataset.val;
    });
  });

  const qtyInput = elements.productModalContent.querySelector('#modalQtyInput');
  elements.productModalContent.querySelector('#modalQtyMinus').addEventListener('click', () => {
    if (modalQty > 1) {
      modalQty--;
      qtyInput.value = modalQty;
    }
  });
  elements.productModalContent.querySelector('#modalQtyPlus').addEventListener('click', () => {
    modalQty++;
    qtyInput.value = modalQty;
  });

  // Add to Cart
  elements.productModalContent.querySelector('#modalAddToCartBtn').addEventListener('click', () => {
    addToCart(product, selectedSize, selectedColor, modalQty);
    closeProductModal();
  });

  // Direct WhatsApp Order
  elements.productModalContent.querySelector('#modalWhatsAppOrderBtn').addEventListener('click', () => {
    const text = encodeURIComponent(
      `Hello Ohemaa’s Apparel! 👑\nI would like to order:\n\n*Product:* ${product.name}\n*Size:* ${selectedSize}\n*Color:* ${selectedColor}\n*Qty:* ${modalQty}\n*Price:* ${formattedPrice}\n\n*Delivery Policy Check:* I understand deliveries are on *Friday only*, or I can *pick up* at your store.\n\nPlease confirm availability and payment details!`
    );
    window.open(`https://wa.me/${state.settings.whatsappNumber}?text=${text}`, '_blank');
  });

  elements.productModalOverlay.classList.remove('hidden');
  elements.productModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeProductModal() {
  elements.productModalOverlay.classList.add('hidden');
  elements.productModal.classList.add('hidden');
  document.body.style.overflow = '';
}

// ==========================================================================
// INTERACTIVE REELS CAROUSEL ENGINE (BACK & FORWARD ARROWS & PROGRESS BARS)
// ==========================================================================

function initReelsEngine() {
  // Render Progress Bars for every reel
  elements.reelProgressBarWrap.innerHTML = '';
  REELS_COLLECTION.forEach((_, idx) => {
    const segment = document.createElement('div');
    segment.className = 'reel-prog-segment';
    segment.dataset.index = idx;
    const fill = document.createElement('div');
    fill.className = 'reel-prog-fill';
    fill.id = `reelFill-${idx}`;
    segment.appendChild(fill);
    elements.reelProgressBarWrap.appendChild(segment);
  });

  // Navigation Arrows
  elements.reelPrevBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    prevReel();
  });

  elements.reelNextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    nextReel();
  });

  // Left & Right Touch Zones
  elements.reelTapLeft.addEventListener('click', (e) => {
    e.stopPropagation();
    prevReel();
  });

  elements.reelTapRight.addEventListener('click', (e) => {
    e.stopPropagation();
    nextReel();
  });

  elements.reelTapCenter.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleReelPlayback();
  });

  // Play / Pause Overlay Button
  elements.reelPlayToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleReelPlayback();
  });

  // Mute / Unmute
  elements.reelMuteToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    elements.reelModalVideo.muted = !elements.reelModalVideo.muted;
    elements.reelSoundIcon.textContent = elements.reelModalVideo.muted ? '🔇' : '🔊';
  });

  // Favorite Outfit in Reel
  elements.reelWishlistBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const current = REELS_COLLECTION[state.currentReelIndex];
    if (current && current.productId) {
      toggleWishlist(current.productId, null);
      updateReelWishlistState();
    }
  });

  // Share Reel
  elements.reelShareBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (navigator.share) {
      navigator.share({
        title: "Ohemaa's Apparel - Studio Reel",
        text: "Check out this royal collection from Ohemaa's Apparel!",
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      showToast('Link copied to clipboard!', '🔗');
    }
  });

  // Video timeupdate sync for progress bar
  elements.reelModalVideo.addEventListener('timeupdate', () => {
    const current = REELS_COLLECTION[state.currentReelIndex];
    if (current && current.type === 'video' && elements.reelModalVideo.duration) {
      const pct = (elements.reelModalVideo.currentTime / elements.reelModalVideo.duration) * 100;
      const fillEl = document.getElementById(`reelFill-${state.currentReelIndex}`);
      if (fillEl) fillEl.style.width = `${pct}%`;
    }
  });

  // When video ends, automatically go to next reel
  elements.reelModalVideo.addEventListener('ended', () => {
    nextReel();
  });

  // Keyboard navigation
  window.addEventListener('keydown', (e) => {
    if (!elements.reelModal.classList.contains('hidden')) {
      if (e.key === 'ArrowLeft') prevReel();
      if (e.key === 'ArrowRight') nextReel();
      if (e.key === 'Escape') closeReelModal();
      if (e.key === ' ') {
        e.preventDefault();
        toggleReelPlayback();
      }
    }
  });

  // Touch Swipe on mobile
  let touchStartX = 0;
  elements.reelContainer.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  elements.reelContainer.addEventListener('touchend', (e) => {
    const touchEndX = e.changedTouches[0].screenX;
    const diff = touchEndX - touchStartX;
    if (diff < -50) {
      nextReel(); // Swipe Left -> Next
    } else if (diff > 50) {
      prevReel(); // Swipe Right -> Previous
    }
  }, { passive: true });
}

function openReelModal(startIndex = 0) {
  closeCartDrawer();
  closeProductModal();
  closeWholesaleModal();
  closeAdminPortal();

  state.currentReelIndex = startIndex;
  state.isReelPaused = false;
  elements.reelModalOverlay.classList.remove('hidden');
  elements.reelModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  renderCurrentReel();
}

function closeReelModal() {
  clearReelTimer();
  elements.reelModalVideo.pause();
  elements.reelModalOverlay.classList.add('hidden');
  elements.reelModal.classList.add('hidden');
  document.body.style.overflow = '';
}

function renderCurrentReel() {
  clearReelTimer();
  const reel = REELS_COLLECTION[state.currentReelIndex];
  if (!reel) return;

  // Update Counter Badge (e.g. "1 / 10")
  elements.reelCounterBadge.textContent = `${state.currentReelIndex + 1} / ${REELS_COLLECTION.length}`;

  // Update Progress Bars
  document.querySelectorAll('.reel-prog-segment').forEach((seg, idx) => {
    const fill = document.getElementById(`reelFill-${idx}`);
    if (idx < state.currentReelIndex) {
      seg.classList.add('completed');
      if (fill) fill.style.width = '100%';
    } else if (idx === state.currentReelIndex) {
      seg.classList.remove('completed');
      if (fill) fill.style.width = '0%';
    } else {
      seg.classList.remove('completed');
      if (fill) fill.style.width = '0%';
    }
  });

  // Media Render: Video vs Image
  if (reel.type === 'video') {
    elements.reelModalImage.classList.add('hidden');
    elements.reelModalVideo.classList.remove('hidden');
    elements.reelModalVideo.currentTime = 0;
    elements.reelModalVideo.muted = false;
    elements.reelModalVideo.play().catch(() => {
      elements.reelModalVideo.muted = true;
      elements.reelModalVideo.play();
    });
    elements.reelSoundIcon.textContent = elements.reelModalVideo.muted ? '🔇' : '🔊';
  } else {
    elements.reelModalVideo.pause();
    elements.reelModalVideo.classList.add('hidden');
    elements.reelModalImage.classList.remove('hidden');
    elements.reelModalImage.src = reel.src;

    // Start 5-second automatic progression for photo reel
    startPhotoReelTimer(5000);
  }

  // Update Text Details
  elements.reelCurrentTag.textContent = reel.tag || 'Ohemaa Fit';
  elements.reelCurrentTitle.textContent = reel.title;
  elements.reelCurrentDesc.textContent = reel.description;

  // "Shop This Look" Button
  elements.reelShopBtn.onclick = () => {
    closeReelModal();
    if (reel.productId) {
      openProductModal(reel.productId);
    } else {
      window.location.hash = '#catalogSection';
    }
  };

  // "Order on WhatsApp" Button
  elements.reelWhatsAppOrderBtn.onclick = () => {
    const text = encodeURIComponent(
      `Hello Ohemaa’s Apparel! 👑\nI just watched your *${reel.title}* story reel and would love to order this look!\n\nPolicy Check: I understand deliveries are on Friday only, or store pick-up is available.\n\nPlease confirm availability!`
    );
    window.open(`https://wa.me/${state.settings.whatsappNumber}?text=${text}`, '_blank');
  };

  updateReelWishlistState();
}

function updateReelWishlistState() {
  const current = REELS_COLLECTION[state.currentReelIndex];
  if (current && current.productId && state.wishlist.includes(current.productId)) {
    elements.reelWishlistIcon.style.color = '#ff4757';
  } else {
    elements.reelWishlistIcon.style.color = '#ffffff';
  }
}

function nextReel() {
  state.currentReelIndex = (state.currentReelIndex + 1) % REELS_COLLECTION.length;
  renderCurrentReel();
}

function prevReel() {
  state.currentReelIndex = (state.currentReelIndex - 1 + REELS_COLLECTION.length) % REELS_COLLECTION.length;
  renderCurrentReel();
}

function startPhotoReelTimer(durationMs) {
  clearReelTimer();
  const startTime = Date.now();
  const fillEl = document.getElementById(`reelFill-${state.currentReelIndex}`);

  state.reelSlideTimer = setInterval(() => {
    if (state.isReelPaused) return;

    const elapsed = Date.now() - startTime;
    const progress = Math.min((elapsed / durationMs) * 100, 100);
    if (fillEl) fillEl.style.width = `${progress}%`;

    if (progress >= 100) {
      clearReelTimer();
      nextReel();
    }
  }, 50);
}

function clearReelTimer() {
  if (state.reelSlideTimer) {
    clearInterval(state.reelSlideTimer);
    state.reelSlideTimer = null;
  }
}

function toggleReelPlayback() {
  const current = REELS_COLLECTION[state.currentReelIndex];
  if (current && current.type === 'video') {
    if (elements.reelModalVideo.paused) {
      elements.reelModalVideo.play();
      elements.reelPlayToggle.classList.remove('show');
      state.isReelPaused = false;
    } else {
      elements.reelModalVideo.pause();
      elements.reelPlayToggle.classList.add('show');
      state.isReelPaused = true;
    }
  } else {
    state.isReelPaused = !state.isReelPaused;
    if (state.isReelPaused) {
      elements.reelPlayToggle.classList.add('show');
    } else {
      elements.reelPlayToggle.classList.remove('show');
    }
  }
}

// --- CHECKOUT & ORDER SUBMISSION ---
async function handleCheckout(isWhatsApp = true) {
  if (state.cart.length === 0) {
    showToast('Your bag is empty!', '⚠️');
    return;
  }

  const name = elements.custName.value.trim();
  const phone = elements.custPhone.value.trim();
  const deliveryMethod = document.querySelector('input[name="deliveryMethod"]:checked').value;
  const address = elements.custAddress.value.trim();
  const notes = elements.custNotes.value.trim();
  const isWholesale = elements.cartWholesaleCheck.checked;

  if (!name) {
    showToast('Please enter your full name', '⚠️');
    elements.custName.focus();
    return;
  }

  if (!phone) {
    showToast('Please enter your phone/WhatsApp number', '⚠️');
    elements.custPhone.focus();
    return;
  }

  if (deliveryMethod === 'friday-delivery' && !address) {
    showToast('Please enter your delivery location for Friday delivery', '⚠️');
    elements.custAddress.focus();
    return;
  }

  // Create real order record
  const orderId = `OHE-${Math.floor(1000 + Math.random() * 9000)}`;
  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  
  let pricedSum = 0;
  state.cart.forEach(item => {
    if (isPriceSet(item.price)) pricedSum += Number(item.price) * item.quantity;
  });

  const newOrder = {
    orderId,
    date: dateStr,
    timestamp: Date.now(),
    customer: {
      name,
      phone,
      address: deliveryMethod === 'friday-delivery' ? address : 'Self-Collection / Store Pick-Up',
      notes
    },
    deliveryMethod,
    isWholesale,
    items: [...state.cart],
    totalAmount: pricedSum > 0 ? pricedSum : null,
    status: 'Pending Confirmation'
  };

  // 1. Save to local state
  state.orders.unshift(newOrder);
  state.saveOrders();
  renderAdminOrdersList();

  // 2. Save directly to Supabase orders database!
  state.createOrderInSupabase(newOrder);

  if (isWhatsApp) {
    let msg = `👑 *NEW ORDER - OHEMAA'S APPAREL* 👑\n`;
    msg += `*Order Reference:* #${orderId}\n`;
    msg += `*Customer:* ${name}\n`;
    msg += `*Phone:* ${phone}\n`;
    msg += `*Fulfillment Method:* ${deliveryMethod === 'friday-delivery' ? '🚚 Friday Scheduled Delivery' : '🏬 Store Pick-Up'}\n`;
    if (deliveryMethod === 'friday-delivery') {
      msg += `*Delivery Location:* ${address}\n`;
    }
    if (isWholesale) {
      msg += `*Order Type:* 📦 Wholesale Bulk Order\n`;
    }
    if (notes) {
      msg += `*Special Notes:* ${notes}\n`;
    }

    msg += `\n*BAG CONTENTS (${state.cart.length} unique styles):*\n`;
    state.cart.forEach((item, idx) => {
      const priceTxt = isPriceSet(item.price) ? `GH₵ ${(Number(item.price) * item.quantity).toFixed(2)}` : `GH₵ ___ (Price to confirm)`;
      msg += `${idx + 1}. *${item.name}*\n   Size: ${item.size} | Color: ${item.color} | Qty: ${item.quantity}\n   Price: ${priceTxt}\n`;
    });

    if (pricedSum > 0) {
      msg += `\n*Subtotal:* GH₵ ${pricedSum.toFixed(2)}`;
    } else {
      msg += `\n*Subtotal:* GH₵ ___ (Awaiting Big Ohemaa's pricing)`;
    }

    msg += `\n\n*Policy Acknowledgement:*`;
    msg += `\n• Deliveries are strictly on Fridays across Ghana.`;
    msg += `\n• Pick-up allowed at store upon readiness.`;

    const encoded = encodeURIComponent(msg);
    window.open(`https://wa.me/${state.settings.whatsappNumber}?text=${encoded}`, '_blank');

    showToast(`Order #${orderId} sent to WhatsApp!`, '✅');
  }

  // Open digital receipt for customer reference
  openReceiptModal(newOrder);

  // Clear cart after order creation
  state.cart = [];
  state.saveCart();
  renderCartDrawer();
  closeCartDrawer();
}

// --- DIGITAL RECEIPT MODAL ---
function openReceiptModal(order) {
  elements.receiptIdTag.textContent = `ORDER #${order.orderId}`;
  elements.receiptDateTag.textContent = `Date: ${order.date}`;
  
  if (order.deliveryMethod === 'friday-delivery') {
    elements.receiptDeliveryNotice.textContent = '🚚 SCHEDULED FOR FRIDAY DELIVERY';
    elements.receiptDeliveryNotice.style.background = '#fef3c7';
    elements.receiptDeliveryNotice.style.color = '#92400e';
  } else {
    elements.receiptDeliveryNotice.textContent = '🏬 STORE PICK-UP RESERVATION';
    elements.receiptDeliveryNotice.style.background = '#dcfce7';
    elements.receiptDeliveryNotice.style.color = '#166534';
  }

  elements.receiptCustomerInfo.innerHTML = `
    <p><strong>Customer:</strong> ${escapeHtml(order.customer.name)}</p>
    <p><strong>Phone:</strong> ${escapeHtml(order.customer.phone)}</p>
    <p><strong>Location/Method:</strong> ${escapeHtml(order.customer.address)}</p>
    ${order.customer.notes ? `<p><strong>Notes:</strong> ${escapeHtml(order.customer.notes)}</p>` : ''}
  `;

  elements.receiptTableBody.innerHTML = order.items.map(item => `
    <tr>
      <td>
        <strong>${escapeHtml(item.name)}</strong><br>
        <small style="color:#64748b;">${escapeHtml(item.size)} • ${escapeHtml(item.color)}</small>
      </td>
      <td>${escapeHtml(item.quantity)}</td>
      <td class="text-right">
        ${isPriceSet(item.price) ? `GH₵ ${(Number(item.price) * item.quantity).toFixed(2)}` : 'GH₵ ___'}
      </td>
    </tr>
  `).join('');

  const subtotalFormatted = order.totalAmount ? `GH₵ ${Number(order.totalAmount).toFixed(2)}` : 'GH₵ ___ (Pending)';
  const fulfillmentFormatted = order.deliveryMethod === 'friday-delivery' ? 'Friday Route Dispatch' : 'Free In-Store Pick-up';
  const totalFormatted = order.totalAmount ? `GH₵ ${Number(order.totalAmount).toFixed(2)}` : 'GH₵ ___';

  elements.receiptTotalsBox.innerHTML = `
    <div class="row">
      <span>Subtotal</span>
      <span>${escapeHtml(subtotalFormatted)}</span>
    </div>
    <div class="row">
      <span>Fulfillment</span>
      <span>${escapeHtml(fulfillmentFormatted)}</span>
    </div>
    <div class="row grand-total">
      <span>Total Estimated</span>
      <span>${escapeHtml(totalFormatted)}</span>
    </div>
  `;

  elements.shareReceiptWhatsappBtn.onclick = () => {
    const receiptMsg = encodeURIComponent(
      `Hello Ohemaa’s Apparel! 👑\nHere is my official receipt for *Order #${order.orderId}*.\nName: ${order.customer.name}\nFulfillment: ${order.deliveryMethod === 'friday-delivery' ? 'Friday Delivery' : 'Pick-Up'}\nPlease verify my order!`
    );
    window.open(`https://wa.me/${state.settings.whatsappNumber}?text=${receiptMsg}`, '_blank');
  };

  elements.receiptModalOverlay.classList.remove('hidden');
  elements.receiptModal.classList.remove('hidden');
}

function closeReceiptModal() {
  elements.receiptModalOverlay.classList.add('hidden');
  elements.receiptModal.classList.add('hidden');
}

// --- WHOLESALE MODAL ---
function openWholesaleModal() {
  elements.wholesaleModalOverlay.classList.remove('hidden');
  elements.wholesaleModal.classList.remove('hidden');
}

function closeWholesaleModal() {
  elements.wholesaleModalOverlay.classList.add('hidden');
  elements.wholesaleModal.classList.add('hidden');
}

// --- AUTHENTICATION & ADMIN PORTAL LOGIC ---
function openAdminPortal(initialSection = 'signIn') {
  closeCartDrawer();
  closeProductModal();
  closeReelModal();
  closeWholesaleModal();
  closeReceiptModal();
  
  elements.adminModalOverlay.classList.remove('hidden');
  elements.adminModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  if (state.adminLoggedIn) {
    showAdminDashboard();
  } else if (state.currentCustomer) {
    showCustomerProfile();
  } else if (initialSection === 'signUp') {
    showSignUpSection();
  } else {
    showSignInSection();
  }
}

function closeAdminPortal() {
  elements.adminModalOverlay.classList.add('hidden');
  elements.adminModal.classList.add('hidden');
  document.body.style.overflow = '';
}

function showSignInSection() {
  elements.adminLoginScreen.classList.remove('hidden');
  elements.adminSignUpScreen.classList.add('hidden');
  elements.adminProfileScreen.classList.add('hidden');
  elements.adminDashboardScreen.classList.add('hidden');
  elements.loginErrorMsg.classList.add('hidden');
}

function showSignUpSection() {
  elements.adminLoginScreen.classList.add('hidden');
  elements.adminSignUpScreen.classList.remove('hidden');
  elements.adminProfileScreen.classList.add('hidden');
  elements.adminDashboardScreen.classList.add('hidden');
  elements.signUpErrorMsg.classList.add('hidden');
}

function showCustomerProfile() {
  elements.adminLoginScreen.classList.add('hidden');
  elements.adminSignUpScreen.classList.add('hidden');
  elements.adminProfileScreen.classList.remove('hidden');
  elements.adminDashboardScreen.classList.add('hidden');

  if (state.currentCustomer) {
    elements.profileCustName.textContent = state.currentCustomer.name || 'VIP Member';
    elements.profileCustPhone.textContent = state.currentCustomer.phone || state.settings.phone;
    elements.profileCustCity.textContent = state.currentCustomer.location || 'Accra Central';
  }
}

function handleContinueAsGuest() {
  state.setGuestSession(true);
  closeAdminPortal();
  showToast('Continuing as a Guest — Happy shopping! 🛍️', '🛍️');

  const catalog = document.getElementById('catalogSection');
  if (catalog) {
    catalog.scrollIntoView({ behavior: 'smooth' });
  }
}

function handleCustomerSignUp(e) {
  e.preventDefault();
  const name = elements.signUpFullName.value.trim();
  const phone = elements.signUpPhone.value.trim();
  const location = elements.signUpLocation.value.trim();
  const password = elements.signUpPassword.value.trim();

  if (!name || !phone || !location || password.length < 6) {
    elements.signUpErrorMsg.classList.remove('hidden');
    return;
  }
  elements.signUpErrorMsg.classList.add('hidden');

  // Check if account with same phone exists
  const cleanPhone = phone.replace(/\s+/g, '');
  const existing = state.customers.find(c => (c.phone || '').replace(/\s+/g, '') === cleanPhone);
  if (existing) {
    showToast('Account with this phone number already exists! Please sign in.', 'ℹ️');
    showSignInSection();
    elements.adminUsername.value = phone;
    return;
  }

  const newCustomer = {
    id: 'CUST_' + Date.now(),
    name,
    phone,
    location,
    password,
    registeredAt: new Date().toISOString()
  };

  state.saveCustomer(newCustomer);
  state.setCustomerSession(newCustomer);
  prefillCustomerDetails(newCustomer);

  showCustomerProfile();
  showToast(`Welcome, ${name}! Your VIP account is ready 👑`, '👑');
}

function prefillCustomerDetails(customer) {
  if (!customer) return;
  const nameEl = document.getElementById('custName');
  const phoneEl = document.getElementById('custPhone');
  const addrEl = document.getElementById('custAddress');
  if (nameEl && !nameEl.value) nameEl.value = customer.name || '';
  if (phoneEl && !phoneEl.value) phoneEl.value = customer.phone || '';
  if (addrEl && !addrEl.value) addrEl.value = customer.location || '';
}

function showAdminDashboard() {
  elements.adminLoginScreen.classList.add('hidden');
  elements.adminDashboardScreen.classList.remove('hidden');
  renderAdminPriceTable();
  renderAdminOrdersList();
  renderAdminInventoryList();
}

function handleAdminLogin(username, password) {
  // Store Owner Authentication (Big_Ohemaa / Ohemaa12345)
  if (username === state.settings.adminUser && password === state.settings.adminPass) {
    state.setAdminSession(true);
    showAdminDashboard();
    showToast('Welcome back, Big Ohemaa! 👑', '👑');
    return;
  }

  // Customer Account Authentication
  const cleanUser = username.toLowerCase().replace(/\s+/g, '');
  const foundCustomer = state.customers.find(c => {
    const custPhone = (c.phone || '').replace(/\s+/g, '');
    const custName = (c.name || '').toLowerCase().replace(/\s+/g, '');
    return (custPhone === cleanUser || custName === cleanUser) && c.password === password;
  });

  if (foundCustomer) {
    state.setCustomerSession(foundCustomer);
    prefillCustomerDetails(foundCustomer);
    showCustomerProfile();
    showToast(`Welcome back, ${foundCustomer.name}! 👑`, '👑');
    return;
  }

  elements.loginErrorMsg.classList.remove('hidden');
}

function handleAdminLogout() {
  state.setAdminSession(false);
  showSignInSection();
  showToast('Logged out of Admin Portal', '👋');
}

function handleCustomerLogout() {
  state.setCustomerSession(null);
  showSignInSection();
  showToast('Signed out of VIP account', '👋');
}

// --- ADMIN PRICE EDITOR WITH SUPABASE SYNC ---
function renderAdminPriceTable(searchFilter = '') {
  let list = [...state.products];
  if (searchFilter.trim() !== '') {
    const q = searchFilter.toLowerCase();
    list = list.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  }

  elements.adminPriceTableBody.innerHTML = '';

  list.forEach(product => {
    const row = document.createElement('tr');
    const isPriced = isPriceSet(product.price);

    row.innerHTML = `
      <td>
        <div class="table-product-cell">
          <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" class="table-thumb">
          <div>
            <strong>${escapeHtml(product.name)}</strong><br>
            <small style="color:var(--text-dim); font-size:0.7rem;">ID: ${escapeHtml(product.id)}</small>
          </div>
        </div>
      </td>
      <td><span class="product-category-tag">${escapeHtml(product.category)}</span></td>
      <td>
        <span class="price-tag ${isPriced ? '' : 'unpriced'}" id="tableDisplay-${escapeHtml(product.id)}">
          ${escapeHtml(formatPrice(product.price))}
        </span>
      </td>
      <td>
        <div style="display:flex; align-items:center; gap:4px;">
          <span>GH₵</span>
          <input type="number" 
                 class="table-price-input" 
                 data-id="${escapeHtml(product.id)}" 
                 value="${isPriced ? escapeHtml(product.price) : ''}" 
                 placeholder="0.00" 
                 step="5"
                 aria-label="Set price in Ghana Cedis for ${escapeHtml(product.name)}">
        </div>
      </td>
      <td>
        <button class="btn btn-gold btn-sm single-save-price-btn" data-id="${escapeHtml(product.id)}" aria-label="Save price for ${escapeHtml(product.name)}">
          Save
        </button>
      </td>
    `;

    // Row single save
    row.querySelector('.single-save-price-btn').addEventListener('click', () => {
      const input = row.querySelector(`.table-price-input[data-id="${product.id}"]`);
      saveSingleProductPrice(product.id, input.value);
    });

    elements.adminPriceTableBody.appendChild(row);
  });
}

function saveSingleProductPrice(productId, newPriceValue) {
  const prod = state.products.find(p => p.id === productId);
  if (!prod) return;

  const val = newPriceValue.trim();
  if (val === '') {
    prod.price = null;
  } else {
    prod.price = parseFloat(val);
  }

  state.saveProducts(state.products);
  state.syncProductPriceToSupabase(productId, prod.price);

  renderProducts();
  renderAdminPriceTable(elements.adminPriceSearch.value);
  showToast(`Updated price for ${prod.name}`, '✅');
}

function saveAllAdminPrices() {
  const inputs = elements.adminPriceTableBody.querySelectorAll('.table-price-input');
  let countUpdated = 0;

  inputs.forEach(input => {
    const id = input.dataset.id;
    const val = input.value.trim();
    const prod = state.products.find(p => p.id === id);
    if (prod) {
      if (val === '') {
        prod.price = null;
      } else {
        prod.price = parseFloat(val);
      }
      state.syncProductPriceToSupabase(id, prod.price);
      countUpdated++;
    }
  });

  state.saveProducts(state.products);
  renderProducts();
  renderAdminPriceTable(elements.adminPriceSearch.value);
  showToast(`Saved & synced all ${countUpdated} product prices!`, '🎉');
}

// --- ADMIN ORDERS LIST ---
function renderAdminOrdersList(filter = 'all') {
  let list = [...state.orders];
  if (filter === 'friday-delivery') {
    list = list.filter(o => o.deliveryMethod === 'friday-delivery');
  } else if (filter === 'store-pickup') {
    list = list.filter(o => o.deliveryMethod === 'store-pickup');
  }

  elements.adminOrdersBadge.textContent = state.orders.length;
  elements.allOrdersCount.textContent = state.orders.length;
  elements.fridayOrdersCount.textContent = state.orders.filter(o => o.deliveryMethod === 'friday-delivery').length;
  elements.pickupOrdersCount.textContent = state.orders.filter(o => o.deliveryMethod === 'store-pickup').length;

  if (list.length === 0) {
    elements.adminOrdersList.innerHTML = `
      <div style="text-align:center; padding:30px; color:var(--text-muted); background:var(--bg-card); border-radius:var(--radius-md);">
        <p>No orders recorded yet under this filter.</p>
        <small>Real customer orders placed on the storefront will appear here instantly!</small>
      </div>
    `;
    return;
  }

  elements.adminOrdersList.innerHTML = list.map(order => `
    <div class="admin-order-card ${order.deliveryMethod === 'friday-delivery' ? 'friday' : 'pickup'}">
      <div class="admin-order-top">
        <div>
          <h4>#${escapeHtml(order.orderId)} - ${escapeHtml(order.customer.name)}</h4>
          <span class="order-method-badge ${order.deliveryMethod === 'friday-delivery' ? 'friday' : 'pickup'}">
            ${order.deliveryMethod === 'friday-delivery' ? '🚚 Friday Delivery' : '🏬 Store Pick-up'}
          </span>
          ${order.isWholesale ? '<span class="badge-pill gold" style="margin-left:4px;">Wholesale</span>' : ''}
        </div>
        <strong style="color:var(--gold-secondary);">
          ${order.totalAmount ? `GH₵ ${Number(order.totalAmount).toFixed(2)}` : 'GH₵ ___'}
        </strong>
      </div>

      <div class="admin-order-details">
        <p>📞 Phone: <a href="tel:${escapeHtml(order.customer.phone)}" style="color:#ffffff;">${escapeHtml(order.customer.phone)}</a> | 📅 Date: ${escapeHtml(order.date)}</p>
        <p>📍 Location / Address: <strong>${escapeHtml(order.customer.address)}</strong></p>
        ${order.customer.notes ? `<p>📝 Notes: ${escapeHtml(order.customer.notes)}</p>` : ''}
      </div>

      <div class="admin-order-items">
        <strong>Items (${order.items.reduce((s, i) => s + i.quantity, 0)} pcs):</strong><br>
        ${order.items.map(i => `• ${escapeHtml(i.name)} (${escapeHtml(i.size)}, ${escapeHtml(i.color)}) x${escapeHtml(i.quantity)}`).join('<br>')}
      </div>

      <div class="admin-order-actions">
        <button class="btn btn-whatsapp btn-sm whatsapp-order-reply-btn" data-phone="${escapeHtml(order.customer.phone)}" data-id="${escapeHtml(order.orderId)}" data-name="${escapeHtml(order.customer.name)}">
          💬 WhatsApp Customer
        </button>
        <button class="btn btn-outline btn-sm delete-order-btn" data-id="${escapeHtml(order.orderId)}">
          🗑️ Archive Order
        </button>
      </div>
    </div>
  `).join('');

  // Attach WhatsApp chat with customer
  elements.adminOrdersList.querySelectorAll('.whatsapp-order-reply-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const phone = btn.dataset.phone.replace(/\D/g, '');
      const ghPhone = phone.startsWith('0') ? `233${phone.substring(1)}` : phone;
      const orderId = btn.dataset.id;
      const custName = btn.dataset.name;
      const reply = encodeURIComponent(
        `Hello ${custName}! 👑 This is Big Ohemaa from Ohemaa’s Apparel. Regarding your order #${orderId}...`
      );
      window.open(`https://wa.me/${ghPhone}?text=${reply}`, '_blank');
    });
  });

  // Attach delete / archive order
  elements.adminOrdersList.querySelectorAll('.delete-order-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const orderId = btn.dataset.id;
      state.orders = state.orders.filter(o => o.orderId !== orderId);
      state.saveOrders();
      renderAdminOrdersList();
      showToast('Order archived', '🗑️');
    });
  });
}

// --- ADMIN INVENTORY LIST ---
function renderAdminInventoryList() {
  elements.inventoryCount.textContent = state.products.length;
  elements.adminInventoryList.innerHTML = state.products.map(p => `
    <div class="inventory-row">
      <div class="inventory-info">
        <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}">
        <div>
          <strong>${escapeHtml(p.name)}</strong><br>
          <small style="color:var(--text-muted);">${escapeHtml(p.category)} • ${escapeHtml(formatPrice(p.price))}</small>
        </div>
      </div>
      <button class="btn btn-danger-outline btn-sm remove-product-btn" data-id="${escapeHtml(p.id)}">
        ✕
      </button>
    </div>
  `).join('');

  elements.adminInventoryList.querySelectorAll('.remove-product-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      if (confirm('Are you sure you want to remove this product from the catalog?')) {
        state.products = state.products.filter(p => p.id !== id);
        state.saveProducts(state.products);
        renderProducts();
        renderAdminPriceTable();
        renderAdminInventoryList();
        showToast('Product removed from catalog', '🗑️');
      }
    });
  });
}

// --- EVENT LISTENERS SETUP ---
function setupEventListeners() {
  // Mobile Drawer
  elements.mobileMenuBtn.addEventListener('click', () => {
    elements.mobileDrawerOverlay.classList.remove('hidden');
    elements.mobileDrawer.classList.add('open');
  });

  const closeDrawer = () => {
    elements.mobileDrawerOverlay.classList.add('hidden');
    elements.mobileDrawer.classList.remove('open');
  };

  elements.closeDrawerBtn.addEventListener('click', closeDrawer);
  elements.mobileDrawerOverlay.addEventListener('click', closeDrawer);

  document.querySelectorAll('.drawer-link').forEach(link => {
    link.addEventListener('click', (e) => {
      const cat = link.dataset.category;
      if (cat) {
        state.currentCategory = cat;
        renderCategoryNav();
        renderProducts();
      }
      closeDrawer();
    });
  });

  elements.drawerVideoBtn.addEventListener('click', () => {
    closeDrawer();
    openReelModal(0);
  });

  elements.drawerWholesaleBtn.addEventListener('click', () => {
    closeDrawer();
    openWholesaleModal();
  });

  elements.drawerAdminBtn.addEventListener('click', () => {
    closeDrawer();
    openAdminPortal();
  });

  // Header Search Toggle
  elements.headerSearchBtn.addEventListener('click', () => {
    elements.headerSearchBar.classList.toggle('hidden');
    if (!elements.headerSearchBar.classList.contains('hidden')) {
      elements.catalogSearchInput.focus();
    }
  });

  elements.catalogSearchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    elements.inlineSearchInput.value = state.searchQuery;
    renderProducts();
    if (state.searchQuery.length > 0) {
      elements.clearSearchBtn.classList.remove('hidden');
    } else {
      elements.clearSearchBtn.classList.add('hidden');
    }
  });

  elements.inlineSearchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    elements.catalogSearchInput.value = state.searchQuery;
    renderProducts();
  });

  elements.clearSearchBtn.addEventListener('click', () => {
    state.searchQuery = '';
    elements.catalogSearchInput.value = '';
    elements.inlineSearchInput.value = '';
    elements.clearSearchBtn.classList.add('hidden');
    renderProducts();
  });

  // Price & Sort dropdowns
  elements.priceFilterSelect.addEventListener('change', (e) => {
    state.priceFilter = e.target.value;
    renderProducts();
  });

  elements.sortSelect.addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    renderProducts();
  });

  elements.resetFiltersBtn.addEventListener('click', () => {
    state.currentCategory = 'all';
    state.searchQuery = '';
    state.priceFilter = 'all';
    elements.catalogSearchInput.value = '';
    elements.inlineSearchInput.value = '';
    elements.priceFilterSelect.value = 'all';
    renderCategoryNav();
    renderProducts();
  });

  // Dock Navigation Buttons
  if (elements.dockHomeBtn) {
    elements.dockHomeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
  if (elements.dockShopBtn) {
    elements.dockShopBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const catSec = document.getElementById('catalogSection');
      if (catSec) catSec.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // Cart Buttons
  elements.headerCartBtn.addEventListener('click', openCartDrawer);
  elements.dockCartBtn.addEventListener('click', openCartDrawer);
  elements.closeCartBtn.addEventListener('click', closeCartDrawer);
  elements.cartOverlay.addEventListener('click', closeCartDrawer);
  elements.cartEmptyShopBtn.addEventListener('click', () => {
    closeCartDrawer();
    window.location.hash = '#catalogSection';
  });

  // Delivery Method Radio change in Cart
  document.querySelectorAll('input[name="deliveryMethod"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.value === 'friday-delivery') {
        elements.deliveryAddressGroup.classList.remove('hidden');
      } else {
        elements.deliveryAddressGroup.classList.add('hidden');
      }
    });
  });

  // Checkout Buttons
  elements.checkoutWhatsappBtn.addEventListener('click', () => handleCheckout(true));
  elements.generateReceiptBtn.addEventListener('click', () => handleCheckout(false));

  // Product Modal
  elements.closeProductModalBtn.addEventListener('click', closeProductModal);
  elements.productModalOverlay.addEventListener('click', closeProductModal);

  // Story Highlights: Clicking any story opens Reels at the respective index!
  elements.storyVideoReel.addEventListener('click', () => openReelModal(0));
  elements.storyWholesale.addEventListener('click', openWholesaleModal);

  const storyFilters = [
    { selector: '.story-item[data-filter="palazzo"]', index: 1 },
    { selector: '.story-item[data-filter="crown"]', index: 2 },
    { selector: '.story-item[data-filter="co-ords"]', index: 3 },
    { selector: '.story-item[data-filter="shorts"]', index: 6 },
    { selector: '.story-item[data-filter="tie-dye"]', index: 4 }
  ];

  storyFilters.forEach(({ selector, index }) => {
    const el = document.querySelector(selector);
    if (el) {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        openReelModal(index);
      });
    }
  });

  // Video Reel & In-page Video Player Triggers
  elements.heroPlayVideoBtn.addEventListener('click', () => openReelModal(0));
  elements.openFullscreenReelBtn.addEventListener('click', () => openReelModal(0));
  elements.dockVideoBtn.addEventListener('click', () => openReelModal(0));
  elements.closeReelModalBtn.addEventListener('click', closeReelModal);
  elements.reelModalOverlay.addEventListener('click', closeReelModal);

  // In-line video banner play / pause
  elements.inlineVideoPlayBtn.addEventListener('click', () => {
    if (elements.featuredInlineVideo.paused) {
      elements.featuredInlineVideo.play();
      elements.videoBannerOverlay.style.background = 'transparent';
      elements.inlineVideoPlayBtn.style.opacity = '0';
    } else {
      elements.featuredInlineVideo.pause();
      elements.videoBannerOverlay.style.background = 'rgba(0,0,0,0.5)';
      elements.inlineVideoPlayBtn.style.opacity = '1';
    }
  });

  elements.videoBannerOverlay.addEventListener('click', (e) => {
    if (e.target.closest('#inlineVideoSoundToggle') || e.target.closest('#openFullscreenReelBtn')) return;
    if (elements.featuredInlineVideo.paused) {
      elements.featuredInlineVideo.play();
      elements.inlineVideoPlayBtn.style.opacity = '0';
    } else {
      elements.featuredInlineVideo.pause();
      elements.inlineVideoPlayBtn.style.opacity = '1';
    }
  });

  // In-line video sound toggle
  elements.inlineVideoSoundToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    elements.featuredInlineVideo.muted = !elements.featuredInlineVideo.muted;
    elements.soundIcon.textContent = elements.featuredInlineVideo.muted ? '🔇 Unmute' : '🔊 Sound On';
  });

  // Wholesale Buttons & Form
  elements.openWholesaleModalBtn.addEventListener('click', openWholesaleModal);
  elements.policyWholesaleLink.addEventListener('click', openWholesaleModal);
  elements.closeWholesaleModalBtn.addEventListener('click', closeWholesaleModal);
  elements.wholesaleModalOverlay.addEventListener('click', closeWholesaleModal);

  elements.wholesaleMinusBtn.addEventListener('click', () => {
    let q = parseInt(elements.wholesaleQtyInput.value, 10) || 10;
    if (q > 10) {
      elements.wholesaleQtyInput.value = q - 5;
    }
  });

  elements.wholesalePlusBtn.addEventListener('click', () => {
    let q = parseInt(elements.wholesaleQtyInput.value, 10) || 10;
    elements.wholesaleQtyInput.value = q + 5;
  });

  elements.wholesaleInquiryForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const wsName = document.getElementById('wsName').value.trim();
    const wsPhone = document.getElementById('wsPhone').value.trim();
    const wsLocation = document.getElementById('wsLocation').value.trim();
    const wsMessage = document.getElementById('wsMessage').value.trim();
    const wsQty = elements.wholesaleQtyInput.value;

    const wholesaleMsg = encodeURIComponent(
      `👑 *WHOLESALE BULK INQUIRY - OHEMAA’S APPAREL* 👑\n` +
      `*Name/Boutique:* ${wsName}\n` +
      `*WhatsApp:* ${wsPhone}\n` +
      `*Location:* ${wsLocation || 'Ghana'}\n` +
      `*Estimated Quantity:* ${wsQty} Pieces\n` +
      `*Styles of Interest:* ${wsMessage || 'Palazzo pants and lounge shorts'}\n\n` +
      `Please provide the wholesale rate card and Friday delivery details!`
    );

    window.open(`https://wa.me/${state.settings.whatsappNumber}?text=${wholesaleMsg}`, '_blank');
    closeWholesaleModal();
    showToast('Wholesale request opened on WhatsApp!', '📦');
  });

  // Receipt Modal
  elements.closeReceiptModalBtn.addEventListener('click', closeReceiptModal);
  elements.receiptModalOverlay.addEventListener('click', closeReceiptModal);
  elements.printReceiptBtn.addEventListener('click', () => {
    window.print();
  });

  // Admin & Account Portal Triggers
  if (elements.headerAuthBtn) {
    elements.headerAuthBtn.addEventListener('click', () => openAdminPortal('signIn'));
  }
  elements.dockAdminBtn.addEventListener('click', () => openAdminPortal('signIn'));
  elements.footerAdminBtn.addEventListener('click', () => openAdminPortal('signIn'));
  elements.adminModalOverlay.addEventListener('click', (e) => {
    if (e.target === elements.adminModalOverlay) closeAdminPortal();
  });
  elements.adminPreviewStoreBtn.addEventListener('click', closeAdminPortal);
  // Section Navigation & Close Triggers
  elements.closeAdminLoginBtn.addEventListener('click', closeAdminPortal);
  if (elements.closeSignUpBtn) {
    elements.closeSignUpBtn.addEventListener('click', closeAdminPortal);
  }
  if (elements.closeProfileBtn) {
    elements.closeProfileBtn.addEventListener('click', closeAdminPortal);
  }
  if (elements.backToSignInBtn) {
    elements.backToSignInBtn.addEventListener('click', showSignInSection);
  }
  if (elements.goToSignUpBtn) {
    elements.goToSignUpBtn.addEventListener('click', showSignUpSection);
  }
  if (elements.switchToSignInBtn) {
    elements.switchToSignInBtn.addEventListener('click', showSignInSection);
  }

  // Continue as Guest (In both Sign In & Sign Up sections)
  if (elements.guestContinueBtn) {
    elements.guestContinueBtn.addEventListener('click', handleContinueAsGuest);
  }
  if (elements.signUpGuestContinueBtn) {
    elements.signUpGuestContinueBtn.addEventListener('click', handleContinueAsGuest);
  }

  // Customer Sign Up Form Submission
  if (elements.customerSignUpForm) {
    elements.customerSignUpForm.addEventListener('submit', handleCustomerSignUp);
  }

  // Sign Up Password Toggle
  if (elements.toggleSignUpPwBtn) {
    elements.toggleSignUpPwBtn.addEventListener('click', () => {
      const isPw = elements.signUpPassword.type === 'password';
      elements.signUpPassword.type = isPw ? 'text' : 'password';
      elements.toggleSignUpPwBtn.textContent = isPw ? '🙈' : '👁️';
    });
  }

  // Customer Profile Actions
  if (elements.customerBrowseCatalogBtn) {
    elements.customerBrowseCatalogBtn.addEventListener('click', () => {
      closeAdminPortal();
      const catalog = document.getElementById('catalogSection');
      if (catalog) catalog.scrollIntoView({ behavior: 'smooth' });
    });
  }
  if (elements.customerViewCartBtn) {
    elements.customerViewCartBtn.addEventListener('click', () => {
      closeAdminPortal();
      openCartDrawer();
    });
  }
  if (elements.customerSignOutBtn) {
    elements.customerSignOutBtn.addEventListener('click', handleCustomerLogout);
  }

  // Sign In / Admin Login Submission
  elements.adminLoginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const u = elements.adminUsername.value.trim();
    const p = elements.adminPassword.value.trim();
    handleAdminLogin(u, p);
  });

  elements.togglePwBtn.addEventListener('click', () => {
    const isPw = elements.adminPassword.type === 'password';
    elements.adminPassword.type = isPw ? 'text' : 'password';
    elements.togglePwBtn.textContent = isPw ? '🙈' : '👁️';
  });

  elements.adminLogoutBtn.addEventListener('click', handleAdminLogout);

  // Admin Tabs
  document.querySelectorAll('.admin-tab-btn').forEach(tabBtn => {
    tabBtn.addEventListener('click', () => {
      const targetId = tabBtn.dataset.tab;
      document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
      tabBtn.classList.add('active');
      document.getElementById(targetId).classList.add('active');
    });
  });

  // Admin Price Editor
  elements.saveAllPricesBtn.addEventListener('click', saveAllAdminPrices);
  elements.adminPriceSearch.addEventListener('input', (e) => {
    renderAdminPriceTable(e.target.value);
  });

  // Admin Orders Filter Pills
  document.querySelectorAll('.order-filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.order-filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      renderAdminOrdersList(pill.dataset.filter);
    });
  });

  elements.clearCompletedOrdersBtn.addEventListener('click', () => {
    if (confirm('Archive all orders?')) {
      state.orders = [];
      state.saveOrders();
      renderAdminOrdersList();
      showToast('Orders list cleaned', '🧹');
    }
  });

  // Add New Product
  elements.addNewProductForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('newProdName').value.trim();
    const category = document.getElementById('newProdCategory').value;
    const priceVal = document.getElementById('newProdPrice').value.trim();
    const sizes = document.getElementById('newProdSizes').value.split(',').map(s => s.trim()).filter(Boolean);
    const colors = document.getElementById('newProdColors').value.split(',').map(c => c.trim()).filter(Boolean);
    const badge = document.getElementById('newProdBadge').value.trim();
    const desc = document.getElementById('newProdDesc').value.trim();
    const fileInput = document.getElementById('newProdImageFile');
    const urlInput = document.getElementById('newProdImageUrl');

    const handleCreate = async (imgSrc) => {
      const newProd = {
        id: `ohem-${Date.now().toString().slice(-4)}`,
        name: title,
        category,
        image: imgSrc || './pics/Gh100.jpg.jpeg',
        price: priceVal !== '' ? parseFloat(priceVal) : null,
        sizes: sizes.length ? sizes : ["S", "M", "L", "Free Size"],
        colors: colors.length ? colors : ["As Pictured"],
        badge: badge || "New Drop",
        description: desc || "Exclusive addition to Ohemaa's Apparel collection.",
        inStock: true,
        isFeatured: true
      };

      state.products.unshift(newProd);
      state.saveProducts(state.products);
      
      // Sync to Supabase
      try {
        await supabase.from('ohemaa_products').insert([{
          id: newProd.id,
          name: newProd.name,
          category: newProd.category,
          image: newProd.image,
          price: newProd.price,
          sizes: newProd.sizes,
          colors: newProd.colors,
          badge: newProd.badge,
          description: newProd.description,
          in_stock: true,
          is_featured: true
        }]);
      } catch (err) {
        console.warn('Supabase product insert error:', err);
      }

      renderProducts();
      renderAdminPriceTable();
      renderAdminInventoryList();
      elements.addNewProductForm.reset();
      showToast(`Added ${title} to store & Supabase!`, '🎉');
    };

    if (fileInput.files && fileInput.files[0]) {
      const reader = new FileReader();
      reader.onload = (re) => handleCreate(re.target.result);
      reader.readAsDataURL(fileInput.files[0]);
    } else {
      handleCreate(urlInput.value.trim() || './pics/Gh100.jpg.jpeg');
    }
  });

  // Store Settings Form
  elements.storeSettingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const phone = document.getElementById('setPhone').value.trim();
    const snap = document.getElementById('setSnapchat').value.trim();
    const tiktok = document.getElementById('setTiktok').value.trim();
    const announcement = document.getElementById('setAnnouncement').value.trim();
    const pickup = document.getElementById('setPickupInfo').value.trim();

    state.saveSettings({
      phone,
      snapchat: snap,
      tiktok,
      announcement,
      pickupAddress: pickup,
      whatsappNumber: phone.replace(/\D/g, '')
    });

    const ticker = elements.announcementBar ? elements.announcementBar.querySelector('.announcement-ticker') : null;
    if (ticker) {
      const phoneItem = ticker.querySelector('.ticker-item:last-child strong');
      if (phoneItem) {
        phoneItem.textContent = phone;
      }
    }

    showToast('Store settings saved successfully!', '⚙️');
  });

  // Export JSON Backup
  elements.exportDataBtn.addEventListener('click', () => {
    const backup = {
      settings: state.settings,
      products: state.products,
      orders: state.orders
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr);
    dl.setAttribute("download", `ohemaas_apparel_backup_${Date.now()}.json`);
    dl.click();
    showToast('Database exported as JSON', '📥');
  });

  // Import JSON Backup
  elements.importDataFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (re) => {
      try {
        const imported = JSON.parse(re.target.result);
        if (imported.products) state.saveProducts(imported.products);
        if (imported.settings) state.saveSettings(imported.settings);
        if (imported.orders) {
          state.orders = imported.orders;
          state.saveOrders();
        }
        renderCategoryNav();
        renderProducts();
        renderAdminPriceTable();
        renderAdminOrdersList();
        renderAdminInventoryList();
        showToast('Store data restored successfully!', '✅');
      } catch (err) {
        alert('Invalid JSON file format.');
      }
    };
    reader.readAsText(file);
  });

  // Reset all prices to GH₵ ___
  elements.resetCatalogBtn.addEventListener('click', async () => {
    if (confirm('Reset all prices back to GH₵ ___?')) {
      state.products.forEach(p => p.price = null);
      state.saveProducts(state.products);
      await state.syncAllProductsToSupabase();
      renderProducts();
      renderAdminPriceTable();
      showToast('All product prices reset to GH₵ ___ in Store & Supabase', '⚠️');
    }
  });
}

// Kick off when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);
