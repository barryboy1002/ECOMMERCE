// app.js — complete, defensive, and tested for local/static usage
// Features:
// - Search + category filtering
// - Item detail modal
// - Cart drawer with qty controls and subtotal
// - Checkout modal (simulated order) with success state
// - Overlay handling that cannot "stick" and block the UI permanently
// - Cart persisted in localStorage

(function(){
  'use strict';

  // Data
  const CATEGORIES = ['shoes','shirts','shorts','trousers','suits'];
  const ITEMS = [
    { id: '1', title: 'Classic Sneakers', category: 'shoes', price: 59.99, img: 'https://picsum.photos/seed/sneaker1/800/800', desc: 'Comfortable everyday sneakers with cushioned sole.' },
    { id: '2', title: 'Running Pro', category: 'shoes', price: 89.99, img: 'https://picsum.photos/seed/sneaker2/800/800', desc: 'Lightweight running shoes engineered for speed.' },
    { id: '3', title: 'White Tee', category: 'shirts', price: 19.99, img: 'https://picsum.photos/seed/shirt1/800/800', desc: 'Soft, breathable 100% cotton T-shirt.' },
    { id: '4', title: 'Denim Shirt', category: 'shirts', price: 39.99, img: 'https://picsum.photos/seed/shirt2/800/800', desc: 'Stylish denim button-up.' },
    { id: '5', title: 'Casual Shorts', category: 'shorts', price: 24.99, img: 'https://picsum.photos/seed/shorts1/800/800', desc: 'Everyday shorts perfect for summer.' },
    { id: '6', title: 'Chino Shorts', category: 'shorts', price: 29.99, img: 'https://picsum.photos/seed/shorts2/800/800', desc: 'Smart-casual chinos.' },
    { id: '7', title: 'Slim Trousers', category: 'trousers', price: 49.99, img: 'https://picsum.photos/seed/trousers1/800/800', desc: 'Tailored slim trousers.' },
    { id: '8', title: 'Formal Trousers', category: 'trousers', price: 59.99, img: 'https://picsum.photos/seed/trousers2/800/800', desc: 'Classic formal trousers.' },
    { id: '9', title: 'Business Suit', category: 'suits', price: 199.99, img: 'https://picsum.photos/seed/suit1/800/800', desc: 'Two-piece business suit.' },
    { id: '10', title: 'Evening Suit', category: 'suits', price: 249.99, img: 'https://picsum.photos/seed/suit2/800/800', desc: 'Tailored evening suit.' },
  ];

  // Helpers
  const formatPrice = n => `$${n.toFixed(2)}`;
  const escapeHtml = s => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const debounce = (fn, wait=200)=>{ let t; return (...a)=>{ clearTimeout(t); t = setTimeout(()=> fn.apply(null, a), wait); }; };

  // Cart persistence
  const STORAGE_KEY = 'simple_shop_cart_v1';
  let CART = (function load(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch(e){ console.warn('cart load failed', e); return {}; } })();
  function saveCart(){ try { localStorage.setItem(STORAGE_KEY, JSON.stringify(CART)); } catch(e){ console.warn('cart save failed', e); } }

  // DOM refs (set after DOM ready)
  let refs = {};

  function init() {
    refs = {
      main: document.getElementById('main'),
      search: document.getElementById('searchInput'),
      categories: document.getElementById('categories'),
      homeBtn: document.getElementById('homeBtn'),

      cartBtn: document.getElementById('cartBtn'),
      cartCount: document.getElementById('cartCount'),
      cartDrawer: document.getElementById('cartDrawer'),
      closeCart: document.getElementById('closeCart'),
      cartItems: document.getElementById('cartItems'),
      cartSubtotal: document.getElementById('cartSubtotal'),
      checkoutBtn: document.getElementById('checkoutBtn'),

      overlay: document.getElementById('overlay'),

      itemModal: document.getElementById('itemModal'),
      itemModalContent: document.getElementById('itemModalContent'),
      closeItemModal: document.getElementById('closeItemModal'),

      checkoutModal: document.getElementById('checkoutModal'),
      checkoutForm: document.getElementById('checkoutForm'),
      checkoutTotal: document.getElementById('checkoutTotal'),
      closeCheckout: document.getElementById('closeCheckout'),
      cancelCheckout: document.getElementById('cancelCheckout'),
      orderSuccess: document.getElementById('orderSuccess'),
      successClose: document.getElementById('successClose'),
    };

    // basic sanity
    if(!refs.main || !refs.categories || !refs.overlay || !refs.cartBtn) {
      console.error('Essential DOM elements are missing. Check HTML file.');
      return;
    }

    // overlay control (safe: cannot permanently block)
    let overlayTimer = null;
    function showOverlay(){
      refs.overlay.hidden = false;
      refs.overlay.style.display = 'block';
      requestAnimationFrame(()=> refs.overlay.classList.add('show'));
      refs.overlay.setAttribute('aria-hidden','false');
    }
    function hideOverlay(){
      refs.overlay.classList.remove('show');
      if(overlayTimer) clearTimeout(overlayTimer);
      overlayTimer = setTimeout(()=> {
        refs.overlay.style.display = 'none';
        refs.overlay.hidden = true;
        refs.overlay.setAttribute('aria-hidden','true');
        overlayTimer = null;
      }, 220);
    }

    // Category rendering
    function renderCategories(active=null){
      refs.categories.innerHTML = '';
      function addBtn(title, svg, key){
        const btn = document.createElement('button');
        btn.className = 'category-btn' + (active === key ? ' active' : '');
        btn.setAttribute('aria-label', title);
        btn.setAttribute('title', title);
        btn.innerHTML = svg;
        btn.addEventListener('click', ()=> { activeCategory = key; renderCategories(key); renderHome(); });
        refs.categories.appendChild(btn);
      }

      // All
      const all = document.createElement('button');
      all.className = 'category-btn' + (active === null ? ' active' : '');
      all.setAttribute('aria-label','All categories');
      all.setAttribute('title','All');
      all.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5L12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10.5z" fill="currentColor"/></svg>`;
      all.addEventListener('click', ()=> { activeCategory = null; renderCategories(null); renderHome(); });
      refs.categories.appendChild(all);

      addBtn('Shoes', `<svg viewBox="0 0 24 24" width="20" height="20"><path d="M3 13s2-4 7-4 8 3 8 3v6H3v-5z" fill="currentColor"/></svg>`, 'shoes');
      addBtn('Shirts', `<svg viewBox="0 0 24 24" width="20" height="20"><path d="M6 3l3 2 3-1 3 1 3-2 1 6-5 2-1 6h-6l-1-6-5-2 1-6z" fill="currentColor"/></svg>`, 'shirts');
      addBtn('Shorts', `<svg viewBox="0 0 24 24" width="20" height="20"><path d="M4 7h16v10H4z" fill="currentColor"/></svg>`, 'shorts');
      addBtn('Trousers', `<svg viewBox="0 0 24 24" width="20" height="20"><path d="M7 2l2 9 3-1 3 1 2-9 1 18h-16L7 2z" fill="currentColor"/></svg>`, 'trousers');
      addBtn('Suits', `<svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 2l3 4 4 2-3 8H8L5 8l4-2 3-4z" fill="currentColor"/></svg>`, 'suits');
    }

    // Grid render
    function renderGrid(items){
      const grid = document.createElement('div');
      grid.className = 'items-grid';
      items.forEach(it => {
        const card = document.createElement('article');
        card.className = 'card';
        card.tabIndex = 0;
        card.innerHTML = `
          <img loading="lazy" src="${it.img}" alt="${escapeHtml(it.title)}">
          <div class="card-body">
            <div>
              <div class="item-title">${escapeHtml(it.title)}</div>
              <div class="item-meta">${escapeHtml(it.category)}</div>
            </div>
            <div class="card-actions">
              <div class="item-price">${formatPrice(it.price)}</div>
              <div style="margin-left:auto;display:flex;gap:8px;align-items:center">
                <button class="btn" data-id="${it.id}" data-action="view">View</button>
                <button class="btn primary" data-id="${it.id}" data-action="add">Add</button>
              </div>
            </div>
          </div>
        `;
        const viewBtn = card.querySelector('[data-action="view"]');
        const addBtn = card.querySelector('[data-action="add"]');
        viewBtn && viewBtn.addEventListener('click', ()=> openItemModal(it.id));
        addBtn && addBtn.addEventListener('click', ev => { ev.stopPropagation(); addToCart(it.id, 1); flashCart(); openCart(); });
        card.addEventListener('keypress', e => { if(e.key === 'Enter') openItemModal(it.id); });
        grid.appendChild(card);
      });
      return grid;
    }

    // State
    let activeCategory = null;
    let activeQuery = '';

    function renderHome(){
      refs.main.innerHTML = '';
      const heading = document.createElement('h2');
      heading.textContent = activeCategory ? (activeCategory[0].toUpperCase() + activeCategory.slice(1)) : 'All items';
      refs.main.appendChild(heading);

      let items = ITEMS.slice();
      if(activeCategory) items = items.filter(i => i.category === activeCategory);
      if(activeQuery){
        const q = activeQuery.toLowerCase();
        items = items.filter(i => i.title.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
      }
      refs.main.appendChild(renderGrid(items));
      refs.main.focus();
    }

    // Item modal
    function openItemModal(id){
      const it = ITEMS.find(x => x.id === id);
      if(!it || !refs.itemModal || !refs.itemModalContent) return;
      refs.itemModalContent.innerHTML = `
        <div style="display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap">
          <img src="${it.img}" alt="${escapeHtml(it.title)}">
          <div class="info">
            <h3>${escapeHtml(it.title)}</h3>
            <div class="muted">${escapeHtml(it.category)}</div>
            <div style="margin:8px 0" class="item-price">${formatPrice(it.price)}</div>
            <p style="color:var(--muted);line-height:1.5">${escapeHtml(it.desc)}</p>
            <div style="margin-top:12px;display:flex;gap:10px">
              <button class="btn" id="modalBack">Back</button>
              <button class="btn primary" id="modalAdd">Add to cart</button>
            </div>
          </div>
        </div>
      `;
      refs.itemModal.setAttribute('aria-hidden','false');
      refs.itemModal.style.display = 'grid';
      showOverlay();

      const modalBack = document.getElementById('modalBack');
      const modalAdd = document.getElementById('modalAdd');
      modalBack && modalBack.addEventListener('click', closeItemModal);
      modalAdd && modalAdd.addEventListener('click', ()=> { addToCart(it.id,1); flashCart(); closeItemModal(); openCart(); });
    }

    function closeItemModal(){
      if(!refs.itemModal) return;
      refs.itemModal.setAttribute('aria-hidden','true');
      refs.itemModal.style.display = 'none';
      hideOverlay();
    }

    // Cart operations
    function addToCart(id, qty=1){
      CART[id] = (CART[id] || 0) + qty;
      if(CART[id] <= 0) delete CART[id];
      saveCart();
      updateCartUI();
    }
    function setQty(id, qty){
      if(qty <= 0) delete CART[id];
      else CART[id] = qty;
      saveCart();
      updateCartUI();
    }
    function removeFromCart(id){
      delete CART[id];
      saveCart();
      updateCartUI();
    }
    function cartItemsDetailed(){
      return Object.entries(CART).map(([id, qty]) => {
        const item = ITEMS.find(i => i.id === id) || { id, title: 'Unknown', price: 0, img: '' };
        return { ...item, qty };
      });
    }
    function subtotal(){
      return cartItemsDetailed().reduce((s,it) => s + (it.price * it.qty), 0);
    }

    function updateCartUI(){
      const totalQty = Object.values(CART).reduce((s,n) => s + n, 0);
      if(refs.cartCount) {
        refs.cartCount.textContent = totalQty;
        refs.cartCount.style.display = totalQty > 0 ? 'inline-block' : 'none';
      }

      if(!refs.cartItems) return;
      refs.cartItems.innerHTML = '';

      const items = cartItemsDetailed();
      if(items.length === 0){
        refs.cartItems.innerHTML = `<div style="padding:24px;text-align:center;color:var(--muted)">Your cart is empty.<div style="margin-top:12px"><button class="btn primary" id="shopNow">Shop now</button></div></div>`;
        const shopNow = document.getElementById('shopNow');
        if(shopNow) shopNow.addEventListener('click', ()=> { closeCart(); activeCategory = null; activeQuery = ''; if(refs.search) refs.search.value = ''; renderCategories(null); renderHome(); });
      } else {
        items.forEach(it => {
          const row = document.createElement('div');
          row.className = 'cart-item';
          row.innerHTML = `
            <img src="${it.img}" alt="${escapeHtml(it.title)}">
            <div style="flex:1">
              <div style="font-weight:700">${escapeHtml(it.title)}</div>
              <div class="muted">${formatPrice(it.price)}</div>
              <div class="qty-controls" style="margin-top:8px">
                <button class="btn" data-id="${it.id}" data-action="dec">-</button>
                <span style="min-width:28px;text-align:center">${it.qty}</span>
                <button class="btn" data-id="${it.id}" data-action="inc">+</button>
                <button class="btn" style="margin-left:8px" data-id="${it.id}" data-action="remove">Remove</button>
              </div>
            </div>
          `;
          refs.cartItems.appendChild(row);
        });

        // wire up controls (delegation would be fine too)
        refs.cartItems.querySelectorAll('[data-action="inc"]').forEach(bt => bt.addEventListener('click', ()=> addToCart(bt.dataset.id, 1)));
        refs.cartItems.querySelectorAll('[data-action="dec"]').forEach(bt => bt.addEventListener('click', ()=> {
          const id = bt.dataset.id;
          setQty(id, (CART[id] || 1) - 1);
        }));
        refs.cartItems.querySelectorAll('[data-action="remove"]').forEach(bt => bt.addEventListener('click', ()=> removeFromCart(bt.dataset.id)));
      }

      if(refs.cartSubtotal) refs.cartSubtotal.textContent = formatPrice(subtotal());
      if(refs.checkoutTotal) refs.checkoutTotal.textContent = formatPrice(subtotal());
    }

    // Drawer & checkout control
    function openCart(){
      refs.cartDrawer.classList.add('open');
      refs.cartDrawer.setAttribute('aria-hidden','false');
      showOverlay();
      updateCartUI();
    }
    function closeCart(){
      refs.cartDrawer.classList.remove('open');
      refs.cartDrawer.setAttribute('aria-hidden','true');
      hideOverlay();
    }

    function openCheckout(){
      if(Object.keys(CART).length === 0){ alert('Your cart is empty. Add items before checkout.'); return; }
      if(!refs.checkoutModal) return;
      refs.checkoutModal.setAttribute('aria-hidden','false');
      refs.checkoutModal.style.display = 'grid';
      showOverlay();
      if(refs.checkoutTotal) refs.checkoutTotal.textContent = formatPrice(subtotal());
    }
    function closeCheckout(){
      if(!refs.checkoutModal) return;
      refs.checkoutModal.setAttribute('aria-hidden','true');
      refs.checkoutModal.style.display = 'none';
      hideOverlay();
      if(refs.orderSuccess) refs.orderSuccess.hidden = true;
      if(refs.checkoutForm){ refs.checkoutForm.style.display = 'flex'; refs.checkoutForm.reset(); }
    }

    // events wiring
    if(refs.search){
      refs.search.addEventListener('input', debounce(() => {
        activeQuery = refs.search.value.trim();
        renderHome();
      }, 220));
    }
    refs.homeBtn && refs.homeBtn.addEventListener('click', ()=> { activeCategory = null; activeQuery = ''; if(refs.search) refs.search.value = ''; renderCategories(null); renderHome(); });

    refs.cartBtn && refs.cartBtn.addEventListener('click', ()=> { updateCartUI(); openCart(); });
    refs.closeCart && refs.closeCart.addEventListener('click', closeCart);

    refs.overlay.addEventListener('click', ()=> { closeCart(); closeItemModal(); closeCheckout(); });

    refs.closeItemModal && refs.closeItemModal.addEventListener('click', closeItemModal);

    refs.checkoutBtn && refs.checkoutBtn.addEventListener('click', ()=> openCheckout());
    refs.closeCheckout && refs.closeCheckout.addEventListener('click', closeCheckout);
    refs.cancelCheckout && refs.cancelCheckout.addEventListener('click', closeCheckout);

    if(refs.checkoutForm){
      refs.checkoutForm.addEventListener('submit', e => {
        e.preventDefault();
        const data = new FormData(refs.checkoutForm);
        if(!data.get('name') || !data.get('email') || !data.get('address')) {
          alert('Please fill all fields.');
          return;
        }
        // Simulate order success
        refs.checkoutForm.style.display = 'none';
        if(refs.orderSuccess) refs.orderSuccess.hidden = false;
        CART = {}; saveCart(); updateCartUI();
      });
    }

    if(refs.successClose) refs.successClose.addEventListener('click', ()=> {
      if(refs.orderSuccess) refs.orderSuccess.hidden = true;
      if(refs.checkoutForm) { refs.checkoutForm.style.display = 'flex'; refs.checkoutForm.reset(); }
      closeCheckout();
      activeCategory = null; activeQuery = ''; if(refs.search) refs.search.value = ''; renderCategories(null); renderHome();
    });

    // small visual helper
    function flashCart(){ refs.cartBtn && refs.cartBtn.animate([{ transform: 'translateY(-6px)' }, { transform: 'translateY(0)' }], { duration: 260, easing: 'cubic-bezier(.2,.9,.2,1)' }); }

    // initial render
    renderCategories(null);
    renderHome();
    updateCartUI();

    // ensure UI hidden state consistent
    if(refs.itemModal){ refs.itemModal.setAttribute('aria-hidden','true'); refs.itemModal.style.display = 'none'; }
    if(refs.checkoutModal){ refs.checkoutModal.setAttribute('aria-hidden','true'); refs.checkoutModal.style.display = 'none'; }
    if(refs.overlay){ refs.overlay.hidden = true; refs.overlay.classList.remove('show'); refs.overlay.style.display = 'none'; refs.overlay.setAttribute('aria-hidden','true'); }

    // expose some functions for debugging (optional)
    window.__simpleShop = {
      openCart, closeCart, addToCart, updateCartUI, CART
    };
  } // init

  // Run init on DOMContentLoaded
  if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Safety: global error handler logs (helps diagnose client-side freezes)
  window.addEventListener('error', function(ev){
    console.error('Unhandled error', ev.error || ev.message, ev);
  });
})();