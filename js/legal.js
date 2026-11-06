'use strict';
const API = window.location.hostname === 'localhost'
  ? 'http://localhost:3001/api'
  : 'https://pcsolutions-backend.onrender.com/api';

const DOCS = {
  privacidad: { key: 'legal_privacidad', title: 'Política de privacidad y tratamiento de datos' },
  terminos:   { key: 'legal_terminos',   title: 'Términos y condiciones' }
};

function formatPhone(v) {
  const d = String(v || '').replace(/\D/g, '').replace(/^57(?=\d{10}$)/, '');
  return d.length === 10 ? '+57 ' + d.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3') : String(v || '');
}

(async function () {
  const doc = new URLSearchParams(location.search).get('doc');
  const def = DOCS[doc] || DOCS.privacidad;
  const id = DOCS[doc] ? doc : 'privacidad';
  document.getElementById('legal-title').textContent = def.title;
  document.title = def.title + ' — PC SOLUTIONS®';
  document.getElementById('tab-' + id).classList.add('active');
  document.getElementById('y').textContent = new Date().getFullYear();

  const body = document.getElementById('legal-body');
  try {
    const res = await fetch(API + '/config');
    if (!res.ok) throw new Error('http');
    const cfg = await res.json();
    if (cfg.nombre) document.getElementById('brand').textContent = cfg.nombre;
    const vars = {
      nombre: cfg.nombre || 'PC SOLUTIONS',
      direccion: cfg.direccion || '',
      email: cfg.email || '',
      telefono: formatPhone(cfg.telefono)
    };
    const text = String(cfg[def.key] || '').replace(/\{\{(\w+)\}\}/g, (m, k) => vars[k] ?? m);
    if (!text.trim()) { body.textContent = 'Este documento aún no está disponible. Escríbenos y con gusto te lo enviamos.'; return; }

    body.textContent = '';
    text.split(/\n{2,}/).forEach(block => {
      const lines = block.split('\n');
      const first = lines[0];
      if (/^\d+\.\s/.test(first) && first.length <= 80 && lines.length > 1) {
        const h = document.createElement('h2'); h.textContent = first; body.appendChild(h);
        lines.shift();
      }
      if (lines.length) { const p = document.createElement('p'); p.textContent = lines.join('\n'); body.appendChild(p); }
    });
  } catch (e) {
    body.textContent = 'No pudimos cargar este documento en este momento. Intenta de nuevo en unos minutos.';
  }
})();
