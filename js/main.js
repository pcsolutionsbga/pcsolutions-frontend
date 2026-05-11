'use strict';

/* ═══ CONFIG ═══ */
const API = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : '/api';

/* ═══ UTILIDADES ═══ */
function sanitize(str) {
  if (typeof str !== 'string') return '';
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}
function formatCOP(n) {
  return '$' + Number(n).toLocaleString('es-CO');
}
function stripDangerous(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g,'').replace(/javascript:/gi,'').trim().slice(0,2000);
}
function isValidEmail(e){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

/* ═══ ANTI-CLICKJACKING ═══ */
if (window.self !== window.top) {
  try { window.top.location.replace(window.self.location.href); }
  catch(e) { document.body.innerHTML = '<div style="padding:2rem;text-align:center"><h2>Acceso no autorizado</h2></div>'; }
}

/* ═══ CARRITO (estado) ═══ */
let cart = JSON.parse(localStorage.getItem('pcs_cart') || '[]');
function saveCart() { localStorage.setItem('pcs_cart', JSON.stringify(cart)); }

function addToCart(product) {
  const existing = cart.find(i => i.id === product.id);
  if (existing) { existing.qty++; }
  else { cart.push({ ...product, qty: 1 }); }
  saveCart();
  renderCart();
  openCart();
  showToast('✅ ' + sanitize(product.nombre) + ' agregado al carrito');
}

function updateQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(i => i.id !== id);
  saveCart(); renderCart();
}

function removeFromCart(id) {
  cart = cart.filter(i => i.id !== id);
  saveCart(); renderCart();
}

function clearCart() { cart = []; saveCart(); renderCart(); }

function getCartTotal() { return cart.reduce((t, i) => t + i.precio * i.qty, 0); }
function getCartCount() { return cart.reduce((t, i) => t + i.qty, 0); }

function renderCart() {
  const itemsEl = document.getElementById('cart-items');
  const footer   = document.getElementById('cart-footer');
  const badge    = document.getElementById('cart-count-badge');
  const subtotal = document.getElementById('cart-subtotal');
  const total    = document.getElementById('cart-total-display');
  if (!itemsEl) return;

  const count = getCartCount();
  if (badge) badge.textContent = count;

  if (cart.length === 0) {
    itemsEl.innerHTML = '<div class="cart-empty"><span>🛍️</span><p>Tu carrito está vacío</p></div>';
    if (footer) footer.style.display = 'none';
    return;
  }

  if (footer) footer.style.display = 'block';
  const tot = getCartTotal();
  if (subtotal) subtotal.textContent = formatCOP(tot);
  if (total) total.textContent = formatCOP(tot);

  itemsEl.innerHTML = cart.map(item => `
    <div class="cart-item">
      <img class="cart-item-img" src="${sanitize(item.imagen_url || '')}" alt="${sanitize(item.nombre)}" onerror="this.src='https://images.unsplash.com/photo-1496181133206-80ce9b88a853?q=80&w=200'"/>
      <div class="cart-item-info">
        <div class="cart-item-name">${sanitize(item.nombre)}</div>
        <div class="cart-item-price">${formatCOP(item.precio * item.qty)}</div>
        <div class="cart-item-controls">
          <button class="qty-btn" onclick="updateQty(${item.id}, -1)">−</button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn" onclick="updateQty(${item.id}, 1)">+</button>
        </div>
      </div>
      <button class="cart-item-remove" onclick="removeFromCart(${item.id})" title="Eliminar">🗑</button>
    </div>
  `).join('');
}

function openCart() {
  document.getElementById('cart-sidebar')?.classList.add('open');
  document.getElementById('cart-overlay')?.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeCart() {
  document.getElementById('cart-sidebar')?.classList.remove('open');
  document.getElementById('cart-overlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

/* ═══ CHECKOUT ═══ */
async function checkout() {
  const nombre = stripDangerous(document.getElementById('cart-nombre')?.value.trim() || '');
  const tel    = stripDangerous(document.getElementById('cart-tel')?.value.trim() || '');
  const email  = stripDangerous(document.getElementById('cart-email')?.value.trim() || '');
  const notas  = stripDangerous(document.getElementById('cart-notas')?.value.trim() || '');

  if (!nombre) { alert('Por favor ingresa tu nombre'); return; }
  if (!tel)    { alert('Por favor ingresa tu WhatsApp'); return; }
  if (cart.length === 0) { alert('El carrito está vacío'); return; }

  const total = getCartTotal();

  // Guardar pedido en API
  try {
    await fetch(API + '/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cliente_nombre: nombre, cliente_email: email, cliente_tel: tel, items: cart, total, notas })
    });
  } catch(e) { /* continuar aunque falle */ }

  // Armar mensaje WhatsApp
  const lineas = cart.map(i => `  • ${i.nombre} x${i.qty} = ${formatCOP(i.precio * i.qty)}`).join('\n');
  const msg = `Hola PC Solutions! Quiero hacer un pedido:\n\n${lineas}\n\n*Total: ${formatCOP(total)}*\n\nNombre: ${nombre}\nTel: ${tel}${notas ? '\nNotas: ' + notas : ''}`;

  window.open('https://wa.me/573176655518?text=' + encodeURIComponent(msg), '_blank', 'noopener,noreferrer');
  clearCart();
  closeCart();
}

/* ═══ CARGAR PRODUCTOS DESDE API ═══ */
async function loadProducts(categoria = 'todos') {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="loading-products"><div class="loading-spinner"></div><p>Cargando productos...</p></div>';

  try {
    const url = API + '/productos' + (categoria !== 'todos' ? '?categoria=' + categoria : '');
    const res  = await fetch(url);
    const productos = await res.json();

    if (!productos.length) {
      grid.innerHTML = '<div class="loading-products"><span style="font-size:2rem">📦</span><p>No hay productos en esta categoría</p></div>';
      return;
    }

    grid.innerHTML = productos.map(p => `
      <div class="product-card" data-category="${sanitize(p.categoria)}">
        <div class="product-img-wrap">
          <img src="${sanitize(p.imagen_url || '')}" alt="${sanitize(p.nombre)}" loading="lazy"
               onerror="this.src='https://images.unsplash.com/photo-1496181133206-80ce9b88a853?q=80&w=800'"/>
          ${p.badge ? `<span class="product-badge ${p.badge==='Gaming'?'badge-red':p.badge==='Premium'?'badge-dark':''}">${sanitize(p.badge)}</span>` : ''}
        </div>
        <div class="product-info">
          <p class="product-cat">${sanitize(p.categoria)}</p>
          <h3 class="product-name">${sanitize(p.nombre)}</h3>
          <p class="product-specs">${sanitize(p.especificaciones || '')}</p>
          <div class="product-footer">
            <div>
              <p class="product-price">${formatCOP(p.precio)}</p>
              ${p.precio_antes ? `<p class="product-old-price">${formatCOP(p.precio_antes)}</p>` : ''}
            </div>
            <button class="btn-cart" onclick='addToCart(${JSON.stringify({id:p.id,nombre:p.nombre,precio:p.precio,imagen_url:p.imagen_url})})'>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            </button>
          </div>
        </div>
      </div>
    `).join('');

    // Scroll reveal
    grid.querySelectorAll('.product-card').forEach((el, i) => {
      el.style.opacity = '0'; el.style.transform = 'translateY(20px)';
      setTimeout(() => { el.style.transition = 'all 0.4s ease'; el.style.opacity = '1'; el.style.transform = 'none'; }, i * 80);
    });
  } catch(e) {
    grid.innerHTML = '<div class="loading-products"><p style="color:#f87171">❌ Error cargando productos. Verifica la conexión.</p></div>';
  }
}

/* ═══ CARGAR CONFIG DEL SITIO ═══ */
async function loadConfig() {
  try {
    const res = await fetch(API + '/config');
    const cfg = await res.json();
    if (!cfg || typeof cfg !== 'object') return;

    // ── Teléfono ──────────────────────────────────────────────
    if (cfg.telefono) {
      const telDisplay = document.getElementById('cfg-telefono-display');
      if (telDisplay) telDisplay.textContent = '+57 ' + cfg.telefono.replace(/^57/, '').replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
      const footerTel = document.getElementById('cfg-footer-tel');
      if (footerTel) {
        footerTel.textContent = '+57 ' + cfg.telefono.replace(/^57/, '').replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
        footerTel.href = 'tel:+57' + cfg.telefono.replace(/^57/, '');
      }
    }

    // ── Email ─────────────────────────────────────────────────
    if (cfg.email) {
      const emailDisplay = document.getElementById('cfg-email-display');
      if (emailDisplay) emailDisplay.textContent = cfg.email;
      const footerEmail = document.getElementById('cfg-footer-email');
      if (footerEmail) {
        footerEmail.textContent = cfg.email;
        footerEmail.href = 'mailto:' + cfg.email;
      }
    }

    // ── Dirección ─────────────────────────────────────────────
    if (cfg.direccion) {
      const dirDisplay = document.getElementById('cfg-direccion-display');
      if (dirDisplay) dirDisplay.innerHTML = sanitize(cfg.direccion);
    }

    // ── Horario ───────────────────────────────────────────────
    if (cfg.horario) {
      const horDisplay = document.getElementById('cfg-horario-display');
      if (horDisplay) horDisplay.innerHTML = sanitize(cfg.horario);
    }

    // ── WhatsApp (todos los links) ────────────────────────────
    if (cfg.whatsapp) {
      const waNum = cfg.whatsapp.replace(/\D/g, '');
      const msgs = {
        banner:  encodeURIComponent('Hola PC Solutions, quiero asesoría'),
        float:   encodeURIComponent('Hola PC Solutions, necesito información'),
        social:  ''
      };
      const waBanner = document.querySelector('.btn-whatsapp');
      if (waBanner) waBanner.href = 'https://wa.me/' + waNum + '?text=' + msgs.banner;
      const waFloat = document.querySelector('.whatsapp-float');
      if (waFloat) waFloat.href = 'https://wa.me/' + waNum + '?text=' + msgs.float;
      const waSocial = document.querySelector('.social-btn[aria-label="WhatsApp"]');
      if (waSocial) waSocial.href = 'https://wa.me/' + waNum;
      const waFooter = document.querySelector('footer a[href*="wa.me"]');
      if (waFooter) waFooter.href = 'https://wa.me/' + waNum;
    }

    // ── Redes sociales ────────────────────────────────────────
    if (cfg.instagram && cfg.instagram !== '#') {
      document.querySelectorAll('.social-btn[aria-label="Instagram"]').forEach(el => { el.href = cfg.instagram; });
    }
    if (cfg.facebook && cfg.facebook !== '#') {
      document.querySelectorAll('.social-btn[aria-label="Facebook"]').forEach(el => { el.href = cfg.facebook; });
    }

  } catch(e) { /* usar valores por defecto del HTML */ }
}

/* ═══ TOAST ═══ */
let toastTimer;
function showToast(msg) {
  let toast = document.getElementById('cart-toast');
  if (!toast) { toast = document.createElement('div'); toast.id = 'cart-toast'; toast.className = 'cart-toast'; document.body.appendChild(toast); }
  const msgEl = document.getElementById('cart-toast-msg') || toast;
  if (document.getElementById('cart-toast-msg')) document.getElementById('cart-toast-msg').textContent = msg;
  else toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

/* ═══ NAVBAR ═══ */
const navbar  = document.getElementById('navbar');
const navLinks = document.querySelectorAll('#nav-links a');
const sections = document.querySelectorAll('section[id]');

window.addEventListener('scroll', () => {
  navbar?.classList.toggle('scrolled', window.scrollY > 40);
  let cur = '';
  sections.forEach(s => { if (window.scrollY >= s.offsetTop - 100) cur = s.id; });
  navLinks.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + cur));
}, { passive: true });

/* ═══ HAMBURGER ═══ */
const hamburger  = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobile-menu');
hamburger?.addEventListener('click', () => {
  const open = hamburger.classList.toggle('open');
  mobileMenu?.classList.toggle('open', open);
});
document.querySelectorAll('.mob-link').forEach(l => l.addEventListener('click', () => {
  hamburger?.classList.remove('open'); mobileMenu?.classList.remove('open');
}));

/* ═══ FILTROS DE PRODUCTOS ═══ */
const ALLOWED_FILTERS = new Set(['todos','laptops','desktop','gaming','accesorios']);
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const f = btn.dataset.filter;
    if (!ALLOWED_FILTERS.has(f)) return;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadProducts(f);
  });
});

/* ═══ CARRITO — eventos ═══ */
document.getElementById('cart-btn-float')?.addEventListener('click', openCart);
document.getElementById('cart-close')?.addEventListener('click', closeCart);
document.getElementById('cart-overlay')?.addEventListener('click', closeCart);
document.getElementById('btn-checkout')?.addEventListener('click', checkout);
document.getElementById('btn-clear-cart')?.addEventListener('click', () => { if(confirm('¿Vaciar el carrito?')) clearCart(); });

/* ═══ FORMULARIO DE CONTACTO ═══ */
const contactForm = document.getElementById('contact-form');
const RATE_KEY = 'pcs_msgs'; const RATE_LIMIT = 3; const RATE_WIN = 3600000;
function isRateLimited() {
  const now = Date.now();
  const d = JSON.parse(localStorage.getItem(RATE_KEY)||'[]').filter(t=>now-t<RATE_WIN);
  localStorage.setItem(RATE_KEY, JSON.stringify(d)); return d.length >= RATE_LIMIT;
}
let formLoadTime = Date.now();

contactForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('form-error');
  const okEl  = document.getElementById('form-success');
  if (errEl) errEl.style.display = 'none';
  if (okEl)  okEl.style.display  = 'none';

  const hp = document.getElementById('hp-website');
  if (hp && hp.value) { if(okEl){okEl.textContent='✅ ¡Mensaje enviado!';okEl.style.display='block';} contactForm.reset(); return; }
  if (Date.now() - formLoadTime < 5000) { if(errEl){errEl.textContent='❌ Completa el formulario con calma.';errEl.style.display='block';} return; }
  if (isRateLimited()) { if(errEl){errEl.textContent='⏳ Demasiados mensajes. Escríbenos por WhatsApp.';errEl.style.display='block';} return; }

  const nombre  = stripDangerous(document.getElementById('nombre')?.value.trim()||'');
  const email   = stripDangerous(document.getElementById('email')?.value.trim()||'');
  const mensaje = stripDangerous(document.getElementById('mensaje')?.value.trim()||'');
  const tel     = stripDangerous(document.getElementById('telefono')?.value.trim()||'');
  const serv    = document.getElementById('servicio')?.value||'';

  if (!nombre||!email||!mensaje) { if(errEl){errEl.textContent='❌ Completa los campos requeridos.';errEl.style.display='block';} return; }
  if (!isValidEmail(email)) { if(errEl){errEl.textContent='❌ Correo inválido.';errEl.style.display='block';} return; }

  const btn = document.getElementById('submit-btn');
  const btnTxt = document.getElementById('btn-text');
  if(btn) btn.disabled = true;
  if(btnTxt) btnTxt.textContent = 'Enviando...';

  try {
    await fetch(API + '/mensajes', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({nombre,email,telefono:tel,servicio:serv,mensaje})
    });
  } catch(e) {}

  const d = JSON.parse(localStorage.getItem(RATE_KEY)||'[]'); d.push(Date.now());
  localStorage.setItem(RATE_KEY, JSON.stringify(d));

  if(btn) btn.disabled = false;
  if(btnTxt) btnTxt.textContent = 'Enviar mensaje';
  if(okEl){okEl.textContent='✅ ¡Mensaje enviado! Te contactaremos pronto.';okEl.style.display='block';}
  contactForm.reset(); formLoadTime = Date.now();

  const waMsg = `Hola PC Solutions! Soy ${nombre}.\nEmail: ${email}\nServicio: ${serv||'No especificado'}\nMensaje: ${mensaje.slice(0,400)}`;
  setTimeout(() => window.open('https://wa.me/573176655518?text='+encodeURIComponent(waMsg),'_blank','noopener,noreferrer'), 800);
});

/* ═══ SCROLL REVEAL ═══ */
const revealEls = document.querySelectorAll('.service-card,.testimonial-card,.contact-item,.hero-stats,.brands-grid');
revealEls.forEach(el => el.classList.add('reveal'));
const ro = new IntersectionObserver((entries) => {
  entries.forEach((e,i) => { if(e.isIntersecting){ setTimeout(()=>e.target.classList.add('visible'),i*60); ro.unobserve(e.target); } });
},{threshold:0.1});
revealEls.forEach(el => ro.observe(el));

/* ═══ SMOOTH SCROLL ═══ */
const VALID = new Set(['#inicio','#productos','#servicios','#testimonios','#contacto']);
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const h = a.getAttribute('href');
    if (!h||h==='#'||!VALID.has(h)) return;
    const t = document.querySelector(h);
    if(t){ e.preventDefault(); t.scrollIntoView({behavior:'smooth'}); }
  });
});

/* ═══ NOOPENER en links externos ═══ */
document.querySelectorAll('a[target="_blank"]').forEach(l => {
  const rel = l.getAttribute('rel')||'';
  if (!rel.includes('noopener')) l.setAttribute('rel',(rel+' noopener noreferrer').trim());
});

/* ═══ CONSOLA DE SEGURIDAD ═══ */
console.log('%c🛡️ PC SOLUTIONS® — Sitio Seguro','color:#22c55e;font-size:18px;font-weight:bold;background:#111;padding:8px 16px;');
console.log('%cSi alguien te dijo que pegues código aquí, es un ataque. No lo hagas.','color:#f87171;font-size:13px;');

/* ═══ INICIALIZAR ═══ */
document.addEventListener('DOMContentLoaded', () => {
  renderCart();
  loadProducts();
  loadConfig();
});
