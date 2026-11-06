'use strict';

/* ═══ CONFIG ═══ */
const API = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : 'https://pcsolutions-backend.onrender.com/api';

/* Todo el contenido (teléfono, enlaces, redes, textos, servicios, opiniones…)
   viene de la API y se edita desde el panel de administración. */
let CFG = {};
const PLACEHOLDER_IMG = 'img/placeholder.svg';
const ICONOS = ['wrench','laptop','cpu','network','shield','box','monitor','phone'];

/* ═══ UTILIDADES ═══ */
function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function formatCOP(n) { return '$' + Number(n).toLocaleString('es-CO'); }
function stripDangerous(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g,'').replace(/javascript:/gi,'').trim().slice(0,2000);
}
function isValidEmail(e){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function icon(name, extra) {
  return `<svg class="ico ${extra||''}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
}
function safeHttps(u) { return typeof u === 'string' && /^https:\/\//.test(u) ? u : ''; }
function safeImg(u) { return typeof u === 'string' && /^(https:\/\/|\/?img\/)/.test(u) ? u : PLACEHOLDER_IMG; }
function waNumber() { return String(CFG.whatsapp || CFG.telefono || '').replace(/\D/g, ''); }
function waLink(text) {
  const n = waNumber();
  if (!n) return '#contacto';
  return 'https://wa.me/' + n + (text ? '?text=' + encodeURIComponent(text) : '');
}
function formatPhone(v) {
  const d = String(v || '').replace(/\D/g, '').replace(/^57(?=\d{10}$)/, '');
  return d.length === 10 ? '+57 ' + d.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3') : String(v || '');
}
function setLines(el, text, sep) {
  el.textContent = '';
  String(text).split(sep).forEach((part, i) => {
    if (i) el.appendChild(document.createElement('br'));
    el.appendChild(document.createTextNode(part.trim()));
  });
}
function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

/* ═══ ANTI-CLICKJACKING ═══ */
if (window.self !== window.top) {
  try { window.top.location.replace(window.self.location.href); }
  catch(e) { document.body.textContent = 'Acceso no autorizado'; }
}

/* Imagen de respaldo cuando una foto no carga */
document.addEventListener('error', (e) => {
  const t = e.target;
  if (t && t.tagName === 'IMG' && !t.dataset.failed) { t.dataset.failed = '1'; t.src = PLACEHOLDER_IMG; }
}, true);

/* ═══ CARRITO ═══ */
let cart = [];
try { cart = JSON.parse(localStorage.getItem('pcs_cart') || '[]'); if (!Array.isArray(cart)) cart = []; } catch { cart = []; }
let productosById = {};

function saveCart() { try { localStorage.setItem('pcs_cart', JSON.stringify(cart)); } catch {} }

function addToCart(product) {
  const existing = cart.find(i => i.id === product.id);
  if (existing) { existing.qty = Math.min(99, existing.qty + 1); }
  else { cart.push({ ...product, qty: 1 }); }
  saveCart(); renderCart(); openCart();
  showToast(product.nombre + ' agregado al carrito');
}
function updateQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty = Math.min(99, item.qty + delta);
  if (item.qty <= 0) cart = cart.filter(i => i.id !== id);
  saveCart(); renderCart();
}
function removeFromCart(id) { cart = cart.filter(i => i.id !== id); saveCart(); renderCart(); }
function clearCart() { cart = []; saveCart(); renderCart(); }
function getCartTotal() { return cart.reduce((t, i) => t + i.precio * i.qty, 0); }
function getCartCount() { return cart.reduce((t, i) => t + i.qty, 0); }

function renderCart() {
  const itemsEl = document.getElementById('cart-items');
  const footer  = document.getElementById('cart-footer');
  const badge   = document.getElementById('cart-count-badge');
  if (!itemsEl) return;
  if (badge) badge.textContent = getCartCount();

  if (cart.length === 0) {
    itemsEl.innerHTML = `<div class="cart-empty">${icon('bag')}<p>Tu carrito está vacío</p></div>`;
    if (footer) footer.style.display = 'none';
    return;
  }
  if (footer) footer.style.display = 'block';
  const tot = formatCOP(getCartTotal());
  document.getElementById('cart-subtotal').textContent = tot;
  document.getElementById('cart-total-display').textContent = tot;

  itemsEl.innerHTML = cart.map(item => `
    <div class="cart-item">
      <img class="cart-item-img" src="${esc(safeImg(item.imagen_url))}" alt="${esc(item.nombre)}"/>
      <div class="cart-item-info">
        <div class="cart-item-name">${esc(item.nombre)}</div>
        <div class="cart-item-price">${formatCOP(item.precio * item.qty)}</div>
        <div class="cart-item-controls">
          <button class="qty-btn" data-cart="dec" data-id="${Number(item.id)}" aria-label="Quitar uno">−</button>
          <span class="qty-num">${Number(item.qty)}</span>
          <button class="qty-btn" data-cart="inc" data-id="${Number(item.id)}" aria-label="Agregar uno">+</button>
        </div>
      </div>
      <button class="cart-item-remove" data-cart="del" data-id="${Number(item.id)}" title="Eliminar" aria-label="Eliminar">${icon('trash')}</button>
    </div>`).join('');
}

function openCart() {
  document.getElementById('cart-sidebar')?.classList.add('open');
  document.getElementById('cart-overlay')?.classList.add('open');
  document.body.style.overflow = 'hidden';
  ensureTurnstile('cart');
}
function closeCart() {
  document.getElementById('cart-sidebar')?.classList.remove('open');
  document.getElementById('cart-overlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('cart-items')?.addEventListener('click', (e) => {
  const b = e.target.closest('[data-cart]');
  if (!b) return;
  const id = Number(b.dataset.id);
  if (b.dataset.cart === 'inc') updateQty(id, 1);
  if (b.dataset.cart === 'dec') updateQty(id, -1);
  if (b.dataset.cart === 'del') removeFromCart(id);
});

/* ═══ CLOUDFLARE TURNSTILE (anti-spam gratuito) ═══ */
const ts = { loaded: false, loading: false, widgets: {}, tokens: {} };

function loadTurnstile() {
  if (!CFG.turnstile_sitekey || ts.loaded || ts.loading) return;
  ts.loading = true;
  window.__tsReady = () => { ts.loaded = true; ensureTurnstile('contact'); };
  const s = document.createElement('script');
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__tsReady';
  s.async = true; s.defer = true;
  document.head.appendChild(s);
}
function ensureTurnstile(name) {
  if (!CFG.turnstile_sitekey || !ts.loaded || !window.turnstile || ts.widgets[name] !== undefined) return;
  const box = document.getElementById('ts-' + name);
  if (!box) return;
  ts.widgets[name] = window.turnstile.render(box, {
    sitekey: CFG.turnstile_sitekey,
    theme: 'dark',
    appearance: 'interaction-only',
    callback: (t) => { ts.tokens[name] = t; },
    'expired-callback': () => { ts.tokens[name] = ''; },
    'error-callback': () => { ts.tokens[name] = ''; }
  });
}
function takeToken(name) {
  if (!CFG.turnstile_sitekey) return { ok: true, token: '' };
  const t = ts.tokens[name];
  if (!t) return { ok: false };
  return { ok: true, token: t };
}
function resetToken(name) {
  ts.tokens[name] = '';
  if (window.turnstile && ts.widgets[name] !== undefined) { try { window.turnstile.reset(ts.widgets[name]); } catch {} }
}

/* ═══ CHECKOUT ═══ */
function showCartError(msg) {
  const el = document.getElementById('cart-error');
  if (!el) return;
  el.textContent = msg || ''; el.hidden = !msg;
}

async function checkout() {
  showCartError('');
  const nombre = stripDangerous(document.getElementById('cart-nombre')?.value.trim() || '');
  const tel    = stripDangerous(document.getElementById('cart-tel')?.value.trim() || '');
  const email  = stripDangerous(document.getElementById('cart-email')?.value.trim() || '');
  const notas  = stripDangerous(document.getElementById('cart-notas')?.value.trim() || '');

  if (!nombre) return showCartError('Por favor ingresa tu nombre.');
  if (!tel)    return showCartError('Por favor ingresa tu WhatsApp.');
  if (email && !isValidEmail(email)) return showCartError('El correo no es válido.');
  if (!document.getElementById('consent-cart')?.checked) return showCartError('Debes autorizar el tratamiento de datos para continuar.');
  if (cart.length === 0) return showCartError('El carrito está vacío.');

  const tk = takeToken('cart');
  if (!tk.ok) return showCartError('Estamos verificando que eres una persona. Intenta de nuevo en unos segundos.');

  let lineas = cart.map(i => ({ nombre: i.nombre, precio: i.precio, qty: i.qty }));
  let total = getCartTotal();

  const btn = document.getElementById('btn-checkout');
  if (btn) btn.disabled = true;
  try {
    const res = await fetch(API + '/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente_nombre: nombre, cliente_email: email, cliente_tel: tel, notas,
        items: cart.map(i => ({ id: i.id, qty: i.qty })),
        turnstile_token: tk.token
      })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      // El servidor recalcula los precios: usamos sus valores
      if (Array.isArray(data.items)) { lineas = data.items; total = data.total; }
    } else if (res.status >= 400 && res.status < 500) {
      resetToken('cart');
      if (btn) btn.disabled = false;
      return showCartError(data.error || 'No pudimos registrar el pedido.');
    }
  } catch (e) { /* sin conexión: igual abrimos WhatsApp */ }
  if (btn) btn.disabled = false;

  const detalle = lineas.map(i => `  • ${i.nombre} x${i.qty} = ${formatCOP(i.precio * i.qty)}`).join('\n');
  const msg = `Hola PC Solutions! Quiero hacer un pedido:\n\n${detalle}\n\n*Total: ${formatCOP(total)}*\n\nNombre: ${nombre}\nTel: ${tel}${notas ? '\nNotas: ' + notas : ''}`;
  window.open(waLink(msg), '_blank', 'noopener,noreferrer');
  resetToken('cart');
  clearCart(); closeCart();
}

/* ═══ PRODUCTOS (API) ═══ */
async function loadProducts(categoria = 'todos') {
  const grid = document.getElementById('products-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="loading-products"><div class="loading-spinner"></div><p>Cargando productos...</p></div>';

  try {
    const url = API + '/productos' + (categoria !== 'todos' ? '?categoria=' + encodeURIComponent(categoria) : '');
    const res = await fetch(url);
    if (!res.ok) throw new Error('http');
    const productos = await res.json();

    if (!productos.length) {
      grid.innerHTML = `<div class="loading-products">${icon('box','ico-lg')}<p>No hay productos en esta categoría por ahora.</p></div>`;
      return;
    }
    productos.forEach(p => { productosById[p.id] = p; });

    grid.innerHTML = productos.map(p => `
      <div class="product-card" data-category="${esc(p.categoria)}">
        <div class="product-img-wrap">
          <img src="${esc(safeImg(p.imagen_url))}" alt="${esc(p.nombre)}" loading="lazy"/>
          ${p.badge ? `<span class="product-badge ${p.badge==='Gaming'?'badge-red':p.badge==='Premium'?'badge-dark':''}">${esc(p.badge)}</span>` : ''}
        </div>
        <div class="product-info">
          <p class="product-cat">${esc(p.categoria)}</p>
          <h3 class="product-name">${esc(p.nombre)}</h3>
          <p class="product-specs">${esc(p.especificaciones || '')}</p>
          <div class="product-footer">
            <div>
              <p class="product-price">${formatCOP(p.precio)}</p>
              ${p.precio_antes ? `<p class="product-old-price">${formatCOP(p.precio_antes)}</p>` : ''}
            </div>
            <button class="btn-cart" data-add="${Number(p.id)}" aria-label="Agregar ${esc(p.nombre)} al carrito">${icon('cart')}</button>
          </div>
        </div>
      </div>`).join('');

    grid.querySelectorAll('.product-card').forEach((el, i) => {
      el.style.opacity = '0'; el.style.transform = 'translateY(20px)';
      setTimeout(() => { el.style.transition = 'all 0.4s ease'; el.style.opacity = '1'; el.style.transform = 'none'; }, i * 80);
    });
  } catch(e) {
    grid.innerHTML = `<div class="loading-products">${icon('alert','ico-lg')}<p>No pudimos cargar los productos. Revisa tu conexión e intenta de nuevo.</p></div>`;
  }
}

document.getElementById('products-grid')?.addEventListener('click', (e) => {
  const b = e.target.closest('[data-add]');
  if (!b) return;
  const p = productosById[b.dataset.add];
  if (p) addToCart({ id: Number(p.id), nombre: p.nombre, precio: Number(p.precio), imagen_url: p.imagen_url || '' });
});

/* ═══ SERVICIOS Y OPINIONES (API) ═══ */
async function loadServicios() {
  const grid = document.getElementById('services-grid');
  const footerList = document.getElementById('footer-services');
  try {
    const res = await fetch(API + '/servicios');
    if (!res.ok) throw new Error('http');
    const items = await res.json();
    if (grid) grid.innerHTML = items.map(s => {
      const ic = ICONOS.includes(s.icono) ? s.icono : 'wrench';
      const destino = s.destino === 'productos' ? '#productos' : '#contacto';
      return `<div class="service-card reveal visible">
        <div class="service-icon">${icon(ic)}</div>
        <h3>${esc(s.titulo)}</h3>
        <p>${esc(s.descripcion)}</p>
        <a href="${destino}" class="service-link">${esc(s.boton_texto || 'Solicitar')} →</a>
      </div>`;
    }).join('');
    if (footerList) footerList.innerHTML = items.slice(0, 5).map(s => `<li><a href="#servicios">${esc(s.titulo)}</a></li>`).join('');
  } catch (e) {
    if (grid) grid.innerHTML = '<p class="section-sub">No pudimos cargar los servicios. Escríbenos por WhatsApp y con gusto te atendemos.</p>';
  }
}

async function loadTestimonios() {
  const sec = document.getElementById('testimonios');
  const nav = document.getElementById('nav-testimonios');
  const grid = document.getElementById('testimonials-grid');
  try {
    const res = await fetch(API + '/testimonios');
    const items = res.ok ? await res.json() : [];
    if (!items.length) { sec.hidden = true; nav.hidden = true; return; }
    grid.innerHTML = items.map(t => `
      <div class="testimonial-card reveal visible">
        <div class="stars" aria-label="${Number(t.estrellas)} de 5 estrellas">${'★'.repeat(Math.min(5, Math.max(1, Number(t.estrellas) || 5)))}</div>
        <p class="testimonial-text">“${esc(t.texto)}”</p>
        <div class="testimonial-author">
          <div class="author-avatar">${esc(initials(t.nombre))}</div>
          <div>
            <p class="author-name">${esc(t.nombre)}</p>
            ${t.cargo ? `<p class="author-role">${esc(t.cargo)}</p>` : ''}
          </div>
        </div>
      </div>`).join('');
    sec.hidden = false; nav.hidden = false;
  } catch (e) { sec.hidden = true; nav.hidden = true; }
}

/* ═══ CONFIG DEL SITIO (API) ═══ */
function applyConfig(cfg) {
  CFG = cfg;

  // Textos
  document.querySelectorAll('[data-cfg]').forEach(el => {
    const k = el.dataset.cfg;
    const v = cfg[k];
    if (v === undefined || v === '') return;
    if (el.dataset.format === 'phone') el.textContent = formatPhone(v);
    else if (el.dataset.format === 'lines') setLines(el, v, '|');
    else el.textContent = v;
  });

  // Enlaces de WhatsApp, teléfono y correo
  document.querySelectorAll('[data-wa]').forEach(a => { a.href = waLink(a.dataset.waMsg || ''); });
  if (cfg.telefono) document.querySelectorAll('[data-tel]').forEach(a => { a.href = 'tel:+57' + cfg.telefono.replace(/\D/g, '').replace(/^57(?=\d{10}$)/, ''); });
  if (cfg.email) document.querySelectorAll('[data-mail]').forEach(a => { a.href = 'mailto:' + cfg.email; });

  // Redes sociales: solo se muestran las que tienen enlace
  document.querySelectorAll('[data-social]').forEach(a => {
    const url = safeHttps(cfg[a.dataset.social]);
    if (url) { a.href = url; a.hidden = false; } else { a.hidden = true; }
  });

  // Hero
  document.getElementById('hero-badge-wrap').hidden = !cfg.hero_badge;

  // Cifras del hero (solo las que tengan valor)
  const stats = [1, 2, 3].map(n => ({ num: cfg['stat' + n + '_num'], label: cfg['stat' + n + '_label'] })).filter(s => s.num);
  const statsEl = document.getElementById('hero-stats');
  statsEl.innerHTML = stats.map(s => `<div class="stat"><span class="stat-num">${esc(s.num)}</span><span class="stat-label">${esc(s.label || '')}</span></div>`)
    .join('<div class="stat-divider"></div>');
  statsEl.hidden = stats.length === 0;

  // Marcas
  const marcas = String(cfg.marcas || '').split(',').map(m => m.trim()).filter(Boolean).slice(0, 16);
  document.getElementById('brands-grid').innerHTML = marcas.map(m => `<div class="brand-item">${esc(m)}</div>`).join('');
  document.getElementById('brands').hidden = marcas.length === 0;

  // Quiénes somos
  const about = document.getElementById('nosotros');
  const navAbout = document.getElementById('nav-nosotros');
  if (cfg.about_texto) {
    document.getElementById('about-body').innerHTML = cfg.about_texto.split(/\n+/).filter(Boolean).map(p => `<p class="about-p">${esc(p)}</p>`).join('');
    const img = document.getElementById('about-img');
    if (cfg.about_imagen && /^(https:\/\/|\/?img\/)/.test(cfg.about_imagen)) { img.src = cfg.about_imagen; img.hidden = false; }
    document.getElementById('about-grid').classList.toggle('has-img', !img.hidden);
    about.hidden = false; navAbout.hidden = false;
  } else { about.hidden = true; navAbout.hidden = true; }

  // Mapa (a partir de la dirección, o del enlace de inserción que pegues en el panel)
  const mapWrap = document.getElementById('map-wrap');
  let mapSrc = '';
  if (cfg.mapa_embed && /^https:\/\/(www\.)?google\.com\/maps\/embed\?/.test(cfg.mapa_embed)) mapSrc = cfg.mapa_embed;
  else if (cfg.mapa_mostrar === '1' && cfg.direccion) mapSrc = 'https://www.google.com/maps?q=' + encodeURIComponent(cfg.direccion) + '&output=embed';
  if (mapSrc) {
    const f = document.getElementById('map-frame');
    if (f.getAttribute('src') !== mapSrc) f.src = mapSrc;
    document.getElementById('map-link').href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(cfg.direccion || '');
    mapWrap.hidden = false;
  } else mapWrap.hidden = true;

  // Año del copyright
  document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });

  // Título de la pestaña y datos para Google (negocio local)
  injectBusinessData(cfg);

  // Protección anti-spam
  loadTurnstile();
}

function injectBusinessData(cfg) {
  try {
    document.getElementById('ld-business')?.remove();
    const sameAs = ['instagram', 'facebook'].map(k => safeHttps(cfg[k])).filter(Boolean);
    const data = {
      '@context': 'https://schema.org',
      '@type': 'ComputerStore',
      name: String(cfg.nombre || 'PC SOLUTIONS').replace('®', ''),
      url: location.origin,
      telephone: cfg.telefono ? '+57' + cfg.telefono.replace(/\D/g, '').replace(/^57(?=\d{10}$)/, '') : undefined,
      email: cfg.email || undefined,
      address: cfg.direccion ? { '@type': 'PostalAddress', streetAddress: cfg.direccion, addressCountry: 'CO' } : undefined,
      openingHours: cfg.horario || undefined,
      sameAs: sameAs.length ? sameAs : undefined
    };
    const s = document.createElement('script');
    s.type = 'application/ld+json'; s.id = 'ld-business';
    s.textContent = JSON.stringify(data);
    document.head.appendChild(s);
  } catch {}
}

async function loadConfig() {
  try {
    const res = await fetch(API + '/config');
    if (!res.ok) throw new Error('http');
    const cfg = await res.json();
    if (cfg && typeof cfg === 'object') applyConfig(cfg);
  } catch(e) {
    // Si la API no responde, se conservan los valores básicos del HTML
    document.querySelectorAll('[data-wa]').forEach(a => { a.href = '#contacto'; a.removeAttribute('target'); });
  }
}

/* ═══ AVISOS ═══ */
let toastTimer;
function showToast(msg) {
  const toast = document.getElementById('cart-toast');
  const msgEl = document.getElementById('cart-toast-msg');
  if (!toast || !msgEl) return;
  msgEl.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

/* ═══ NAVBAR ═══ */
const navbar  = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar?.classList.toggle('scrolled', window.scrollY > 40);
  let cur = '';
  document.querySelectorAll('section[id]:not([hidden])').forEach(s => { if (window.scrollY >= s.offsetTop - 100) cur = s.id; });
  document.querySelectorAll('#nav-links a').forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + cur));
}, { passive: true });

const hamburger  = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobile-menu');
hamburger?.addEventListener('click', () => {
  const open = hamburger.classList.toggle('open');
  mobileMenu?.classList.toggle('open', open);
});
document.querySelectorAll('.mob-link, .mob-cta').forEach(l => l.addEventListener('click', () => {
  hamburger?.classList.remove('open'); mobileMenu?.classList.remove('open');
}));

/* ═══ FILTROS DE PRODUCTOS ═══ */
const ALLOWED_FILTERS = new Set(['todos','laptops','desktop','gaming','accesorios']);
function setFilter(f) {
  if (!ALLOWED_FILTERS.has(f)) return;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === f));
  loadProducts(f);
}
document.querySelectorAll('.filter-btn').forEach(btn => btn.addEventListener('click', () => setFilter(btn.dataset.filter)));
document.querySelectorAll('[data-go-filter]').forEach(a => a.addEventListener('click', () => setFilter(a.dataset.goFilter)));

/* ═══ CARRITO — eventos ═══ */
document.getElementById('cart-btn-float')?.addEventListener('click', openCart);
document.getElementById('cart-close')?.addEventListener('click', closeCart);
document.getElementById('cart-overlay')?.addEventListener('click', closeCart);
document.getElementById('btn-checkout')?.addEventListener('click', checkout);
document.getElementById('btn-clear-cart')?.addEventListener('click', () => { if (confirm('¿Vaciar el carrito?')) clearCart(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCart(); });

/* ═══ FORMULARIO DE CONTACTO ═══ */
const contactForm = document.getElementById('contact-form');
const RATE_KEY = 'pcs_msgs'; const RATE_LIMIT = 3; const RATE_WIN = 3600000;
function readRate() { try { return JSON.parse(localStorage.getItem(RATE_KEY)||'[]'); } catch { return []; } }
function isRateLimited() {
  const now = Date.now();
  const d = readRate().filter(t => now - t < RATE_WIN);
  try { localStorage.setItem(RATE_KEY, JSON.stringify(d)); } catch {}
  return d.length >= RATE_LIMIT;
}
let formLoadTime = Date.now();

function formMsg(kind, text) {
  const ok = document.getElementById('form-success'), er = document.getElementById('form-error');
  ok.hidden = true; er.hidden = true;
  const el = kind === 'ok' ? ok : er;
  if (!text) return;
  el.innerHTML = icon(kind === 'ok' ? 'check' : 'alert') + '<span></span>';
  el.querySelector('span').textContent = text;
  el.hidden = false;
}

contactForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  formMsg('', '');

  const hp = document.getElementById('hp-website');
  if (hp && hp.value) { formMsg('ok', '¡Mensaje enviado!'); contactForm.reset(); return; }
  if (Date.now() - formLoadTime < 4000) return formMsg('err', 'Completa el formulario con calma e intenta de nuevo.');
  if (isRateLimited()) return formMsg('err', 'Has enviado varios mensajes seguidos. Escríbenos por WhatsApp.');

  const nombre  = stripDangerous(document.getElementById('nombre')?.value.trim()||'');
  const email   = stripDangerous(document.getElementById('email')?.value.trim()||'');
  const mensaje = stripDangerous(document.getElementById('mensaje')?.value.trim()||'');
  const tel     = stripDangerous(document.getElementById('telefono')?.value.trim()||'');
  const serv    = document.getElementById('servicio')?.value||'';

  if (!nombre || !email || !mensaje) return formMsg('err', 'Completa los campos obligatorios (*).');
  if (!isValidEmail(email)) return formMsg('err', 'El correo no es válido.');
  if (!document.getElementById('consent-contact')?.checked) return formMsg('err', 'Debes autorizar el tratamiento de datos para enviar el mensaje.');
  const tk = takeToken('contact');
  if (!tk.ok) return formMsg('err', 'Estamos verificando que eres una persona. Intenta de nuevo en unos segundos.');

  const btn = document.getElementById('submit-btn');
  const btnTxt = document.getElementById('btn-text');
  btn.disabled = true; btnTxt.textContent = 'Enviando...';

  try {
    const res = await fetch(API + '/mensajes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, email, telefono: tel, servicio: serv, mensaje, turnstile_token: tk.token })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { resetToken('contact'); formMsg('err', data.error || 'No pudimos enviar tu mensaje. Escríbenos por WhatsApp.'); return; }
  } catch (err) {
    formMsg('err', 'No pudimos conectarnos. Revisa tu internet o escríbenos por WhatsApp.');
    return;
  } finally {
    btn.disabled = false; btnTxt.textContent = 'Enviar mensaje';
  }

  const d = readRate(); d.push(Date.now());
  try { localStorage.setItem(RATE_KEY, JSON.stringify(d)); } catch {}
  formMsg('ok', '¡Mensaje enviado! Te contactaremos pronto.');
  contactForm.reset(); formLoadTime = Date.now(); resetToken('contact');

  const waMsg = `Hola PC Solutions! Soy ${nombre}.\nEmail: ${email}\nServicio: ${serv||'No especificado'}\nMensaje: ${mensaje.slice(0,400)}`;
  setTimeout(() => window.open(waLink(waMsg), '_blank', 'noopener,noreferrer'), 800);
});

/* ═══ SCROLL SUAVE ═══ */
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const h = a.getAttribute('href');
  if (!h || h === '#' || !/^#[a-z]+$/.test(h)) return;
  const t = document.querySelector(h);
  if (t && !t.hidden) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth' }); }
});

/* ═══ INICIALIZAR ═══ */
document.addEventListener('DOMContentLoaded', () => {
  renderCart();
  loadConfig();
  loadProducts();
  loadServicios();
  loadTestimonios();
  const ro = new IntersectionObserver((entries) => {
    entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('visible'); ro.unobserve(en.target); } });
  }, { threshold: 0.1 });
  document.querySelectorAll('.contact-item, .hero-stats').forEach(el => { el.classList.add('reveal'); ro.observe(el); });
});
