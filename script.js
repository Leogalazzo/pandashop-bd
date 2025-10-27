// ==========================================================
// 🔥 FIREBASE CONFIGURACIÓN
// ==========================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDAp3SNGCdu3yaBJc4BKmI8fgf0cY7DMM0",
  authDomain: "panda-577da.firebaseapp.com",
  projectId: "panda-577da",
  storageBucket: "panda-577da.appspot.com",
  messagingSenderId: "651396342669",
  appId: "1:651396342669:web:a07a61a1d99b0b64efd3c4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ==========================================================
// 🧩 CONFIGURACIÓN INICIAL
// ==========================================================
const WHATSAPP_PHONE = '5493644539325';
const AGE_KEY = 'panda_age_ok';

// Función auxiliar para cargar el carrito desde localStorage
function loadCart() {
  try { 
    return JSON.parse(localStorage.getItem('panda_cart') || '[]'); 
  } catch { 
    return []; 
  }
}

window.__PANDA_STATE__ = { products: [], cart: loadCart() };

// ==========================================================
// 🚀 CARGA DE PRODUCTOS DESDE FIRESTORE (con cache)
// ==========================================================
const PRODUCTS_CACHE_KEY = 'panda_products_cache';
const PRODUCTS_CACHE_TIME = 60000; // 1 minuto

async function loadProducts() {
  // Mostrar productos en cache inmediatamente si existe
  const cachedData = localStorage.getItem(PRODUCTS_CACHE_KEY);
  if (cachedData) {
    try {
      const { data, timestamp } = JSON.parse(cachedData);
      const ageStatus = localStorage.getItem(AGE_KEY);
      
      window.__PANDA_STATE__.products = data;
      buildFilters(data);
      render(data);
      updateCartUI();
      document.getElementById('year').textContent = new Date().getFullYear();
      
      if (ageStatus === null) showAgeGate();
      else applyAgeRestriction(ageStatus);
    } catch(e) {
      console.error("Error cargando cache:", e);
    }
  }

  // Cargar desde Firebase y actualizar
  try {
    const snapshot = await getDocs(collection(db, "productos"));
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Guardar en cache
    localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
    
    window.__PANDA_STATE__.products = data;
    const ageStatus = localStorage.getItem(AGE_KEY);
    buildFilters(data);
    render(data);
    updateCartUI();
    
    if (ageStatus === null) showAgeGate();
    else applyAgeRestriction(ageStatus);
  } catch (error) {
    console.error("Error cargando productos:", error);
    if (!cachedData) {
      alert("No se pudieron cargar los productos desde Firebase.");
    }
  }
}

// Inicialización al cargar la página
document.addEventListener("DOMContentLoaded", () => {
  // Validación del campo teléfono
  const phoneInput = document.getElementById('buyerPhone');
  if (phoneInput) {
    phoneInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/[^0-9]/g, '');
    });
  }
  
  // Listener del backdrop del modal
  const modal = document.getElementById("productModal");
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  }
  
  // Cargar productos
  loadProducts();
});

// ==========================================================
// 🛒 FILTROS Y PRODUCTOS
// ==========================================================
function buildFilters(list) {
  const cats = Array.from(new Set(list.map(p => p.category))).sort();
  const filters = document.getElementById('filters');
  filters.innerHTML = '';
  const allBtn = pill('Todos', true, () => { setActivePill(allBtn); render(list); });
  filters.appendChild(allBtn);
  cats.forEach(c => {
    const el = pill(c, false, () => { setActivePill(el); render(list.filter(p => p.category === c)); });
    filters.appendChild(el);
  });
}
function pill(label, active, onclick) {
  const el = document.createElement('button');
  el.className = 'pill' + (active ? ' active' : '');
  el.textContent = label;
  el.onclick = onclick;
  return el;
}
function setActivePill(activeEl) {
  document.querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
  activeEl.classList.add('active');
  document.getElementById('search').value = '';
}

// Función para aplicar filtros de búsqueda
window.applyFilters = () => {
  const q = document.getElementById('search').value.trim().toLowerCase();
  const activePill = document.querySelector('.pill.active');
  if (activePill.textContent === 'Todos') {
    render(window.__PANDA_STATE__.products);
  } else {
    const category = activePill.textContent;
    const filtered = window.__PANDA_STATE__.products.filter(p => p.category === category);
    render(filtered);
  }
};

// ==========================================================
// 🧩 RENDER DE PRODUCTOS (100% funcional con módulo)
// ==========================================================
function render(list) {
  const grid = document.getElementById('grid');
  const q = document.getElementById('search').value.trim().toLowerCase();
  const filtered = list.filter(p => p.name.toLowerCase().includes(q));
  grid.innerHTML = '';

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px;">
        <div style="font-size: 48px;">🔍</div>
        <h3>No se encontraron productos</h3>
        <p class="muted">Intenta con otra búsqueda o cambia el filtro</p>
      </div>`;
    return;
  }

  filtered.forEach(p => {
    const card = document.createElement('article');
    card.className = 'card';
    if (!p.available) card.classList.add('out-of-stock');

    // estructura visual igual que antes
    card.innerHTML = `
      <div class="card-img">
        ${p.badge ? `<span class="badge">${p.badge}</span>` : ''}
        <img src="${p.image}" alt="${p.name}">
      </div>
      <div class="card-body">
        <div class="card-content">
          <div class="title">${p.name}</div>
          <div class="price-row">
            ${p.originalPrice ? `
              <div class="price-with-old">
                <div class="old-price">$${formatNumber(p.originalPrice)}</div>
                <div class="price" style="color:#ff6b35">$${formatNumber(p.price)}</div>
              </div>` : `<div class="price">$${formatNumber(p.price)}</div>`}
            <div class="muted">${p.category}${p.isAlcohol ? ' · 18+' : ''}</div>
          </div>
        </div>
        <button class="btn" ${p.available ? '' : 'disabled'}>Agregar</button>
      </div>`;

    // EVENTOS
    const imgDiv = card.querySelector(".card-img");
    const titleDiv = card.querySelector(".title");
    const btn = card.querySelector(".btn");

    if (p.available) {
      imgDiv.style.cursor = 'pointer';
      imgDiv.addEventListener("click", () => window.openModal(p));
      titleDiv.style.cursor = 'pointer';
      titleDiv.addEventListener("click", () => window.openModal(p));
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const rect = e.target.getBoundingClientRect();
        animateToCart(p.image, rect.left, rect.top);
        window.addToCart(p);
        showToast("Producto agregado al carrito ");
      });
    }

    grid.appendChild(card);
  });
}

// ==========================================================
// 🧩 MODAL DE PRODUCTO (reparado visualmente)
// ==========================================================
function openModal(p) {
  const modal = document.getElementById("productModal");
  modal.classList.add("show");
  document.body.style.overflow = "hidden";
  document.getElementById("modalImage").src = p.image;
  document.getElementById("modalTitle").textContent = p.name;
  document.getElementById("modalCategory").textContent = p.category + (p.isAlcohol ? " · 18+" : "");
  document.getElementById("modalPrice").textContent = "$" + formatNumber(p.price);

  const addBtn = document.getElementById("modalAddBtn");
  addBtn.onclick = () => { 
    window.addToCart(p); 
    closeModal(); 
    showToast("Producto agregado al carrito"); 
  };
}

function closeModal() {
  const modal = document.getElementById("productModal");
  modal.classList.remove("show");
  document.body.style.overflow = "";
}

// Exponer globalmente
window.openModal = openModal;
window.closeModal = closeModal;

// ==========================================================
// ✨ ANIMACIÓN DE PRODUCTO AL CARRITO
// ==========================================================
function animateToCart(imgSrc, startX, startY) {
  const flyImg = document.createElement("img");
  flyImg.src = imgSrc;
  flyImg.className = "fly-img";
  flyImg.style.left = `${startX}px`;
  flyImg.style.top = `${startY}px`;
  document.body.appendChild(flyImg);
  flyImg.addEventListener("animationend", () => flyImg.remove());
}

// ==========================================================
// 🛍️ CARRITO DE COMPRAS
// ==========================================================
function saveCart() {
  localStorage.setItem('panda_cart', JSON.stringify(window.__PANDA_STATE__.cart));
}

window.addToCart = (p) => {
  const cart = window.__PANDA_STATE__.cart;
  const idx = cart.findIndex(i => i.id === p.id);
  if (idx > -1) cart[idx].qty++;
  else cart.push({ ...p, qty: 1 });
  saveCart();
  updateCartUI();
  bounceMiniCount();
};

function bounceMiniCount() {
  const el = document.getElementById('miniCount');
  el.style.transform = 'scale(1.2)';
  setTimeout(() => el.style.transform = 'scale(1)', 140);
}

window.toggleCart = (open) => {
  const drawer = document.getElementById('cartDrawer');
  drawer.classList.toggle('open', !!open);
  drawer.setAttribute('aria-hidden', !open);
  document.body.style.overflow = open ? 'hidden' : '';
};

window.clearCart = () => {
  const cart = window.__PANDA_STATE__.cart;
  if (cart.length === 0) return;
  document.getElementById('clearCartModal').classList.add('show');
};
window.closeClearCartModal = () => document.getElementById('clearCartModal').classList.remove('show');
window.confirmClearCart = () => {
  window.__PANDA_STATE__.cart = [];
  saveCart();
  updateCartUI();
  document.getElementById('clearCartModal').classList.remove('show');
};

function updateCartUI() {
  const cart = window.__PANDA_STATE__.cart;
  const list = document.getElementById('cartList');
  list.innerHTML = '';
  const empty = document.getElementById('cartEmpty');
  empty.style.display = cart.length ? 'none' : 'block';

  let subtotal = 0, count = 0;
  cart.forEach(item => {
    subtotal += item.price * item.qty;
    count += item.qty;
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <img src="${item.image}" alt="${item.name}">
      <div>
        <div style="font-weight:600">${item.name}</div>
        <div class="muted">$${formatNumber(item.price)} · ${item.category}</div>
        <div class="qty" style="margin-top:6px">
          <button onclick='decr("${item.id}")'>−</button>
          <span>${item.qty}</span>
          <button onclick='incr("${item.id}")'>+</button>
          <button style="margin-left:8px" class="icon-btn" onclick='removeItem("${item.id}")'>🗑️</button>
        </div>
      </div>
      <div style="font-weight:700">$${formatNumber(item.price * item.qty)}</div>`;
    list.appendChild(row);
  });

  const deliveryCost = currentDelivery === 'delivery' ? 1500 : 0;
  const total = subtotal + deliveryCost;
  document.getElementById('subtotal').textContent = `$${formatNumber(subtotal)}`;
  document.getElementById('deliveryCost').textContent = `$${formatNumber(deliveryCost)}`;
  document.getElementById('total').textContent = `$${formatNumber(total)}`;
  document.getElementById('miniCount').textContent = count > 0 ? count : '';
  document.getElementById('checkoutBtn').disabled = count === 0;

  const clearCartBtn = document.getElementById('clearCartBtn');
  if (clearCartBtn) clearCartBtn.disabled = count === 0;
}
window.incr = (id) => { const c = window.__PANDA_STATE__.cart; const i = c.find(x => x.id === id); if (i) { i.qty++; saveCart(); updateCartUI(); } };
window.decr = (id) => { const c = window.__PANDA_STATE__.cart; const i = c.find(x => x.id === id); if (i) { i.qty--; if (i.qty <= 0) removeItem(id); else { saveCart(); updateCartUI(); } } };
window.removeItem = (id) => { const c = window.__PANDA_STATE__.cart; window.__PANDA_STATE__.cart = c.filter(x => x.id !== id); saveCart(); updateCartUI(); };

// ==========================================================
// 🚚 ENTREGA Y RETIRO
// ==========================================================
let currentDelivery = 'delivery';
window.setDelivery = (type) => {
  currentDelivery = type;
  const localBtn = document.getElementById('optionLocal');
  const deliveryBtn = document.getElementById('optionDelivery');
  const addressField = document.getElementById('buyerAddress');

  if (type === 'local') {
    localBtn.classList.add('active');
    deliveryBtn.classList.remove('active');
    addressField.style.display = 'none';
  } else {
    deliveryBtn.classList.add('active');
    localBtn.classList.remove('active');
    addressField.style.display = 'block';
  }
  updateCartUI();
};

// ==========================================================
// 🔞 VERIFICACIÓN DE EDAD
// ==========================================================
function showAgeGate(){ document.getElementById('ageBackdrop').classList.add('show'); }
function hideAgeGate(){ document.getElementById('ageBackdrop').classList.remove('show'); }
window.acceptAge = ()=>{ localStorage.setItem(AGE_KEY,'1'); hideAgeGate(); applyAgeRestriction('1'); }
window.denyAge = ()=>{ hideAgeGate(); applyAgeRestriction('0'); }
function applyAgeRestriction(value){
  const all = window.__PANDA_STATE__.products;
  if(value==='0'){ 
    const noAlcohol = all.filter(p=>!p.isAlcohol); 
    buildFilters(noAlcohol); 
    render(noAlcohol);
    
    // Mostrar aviso de modo restringido
    const filters = document.getElementById('filters');
    // Remover aviso anterior si existe
    const existingNotice = document.querySelector('#restricted-mode-notice');
    if (existingNotice) existingNotice.remove();
    
    const notice = document.createElement('div');
    notice.id = 'restricted-mode-notice';
    notice.style.padding = '10px';
    notice.style.background = '#222';
    notice.style.borderRadius = '10px';
    notice.style.marginBottom = '12px';
    notice.style.fontSize = '14px';
    notice.style.color = '#ff5a5a';
    notice.textContent = 'Modo restringido: solo se muestran productos sin alcohol. Recarga la web para cambiar esta configuración.';
    filters.before(notice);
    
    // Actualizar búsqueda para solo buscar en productos sin alcohol
    const searchInput = document.getElementById('search');
    if (searchInput) {
      searchInput.oninput = () => {
        const q = searchInput.value.trim().toLowerCase();
        const filtered = noAlcohol.filter(p => p.name.toLowerCase().includes(q));
        render(filtered);
      };
    }
  }
  else { 
    // Remover aviso de modo restringido si existe
    const existingNotice = document.querySelector('#restricted-mode-notice');
    if (existingNotice) existingNotice.remove();
    
    buildFilters(all); 
    render(all);
    
    // Restaurar búsqueda normal
    const searchInput = document.getElementById('search');
    if (searchInput) {
      searchInput.oninput = () => applyFilters();
    }
  }
}

// ==========================================================
// 💬 PEDIDO POR WHATSAPP
// ==========================================================
window.checkoutWhatsApp = () => {
  const { cart } = window.__PANDA_STATE__;
  if (cart.length === 0) return alert("Tu carrito está vacío 🛒");
  const name = document.getElementById("buyerName").value.trim();
  const phone = document.getElementById("buyerPhone").value.trim();
  const address = document.getElementById("buyerAddress").value.trim();
  const notes = document.getElementById("buyerNotes").value.trim();

  if (!name) return showFormAlert("❌ Ingresá tu nombre");
  if (!phone) return showFormAlert("❌ Ingresá tu teléfono");
  if (currentDelivery === "delivery" && !address) return showFormAlert("❌ Ingresá tu dirección");

  const lines = ["*Panda · Nuevo pedido*",""];
  cart.forEach(i=>lines.push(`• ${i.name} x${i.qty} — $${formatNumber(i.price*i.qty)}`));
  const subtotal=cart.reduce((s,i)=>s+i.price*i.qty,0);
  const deliveryCost=currentDelivery==='delivery'?1500:0;
  const total=subtotal+deliveryCost;
  lines.push(`\n*Subtotal:* $${formatNumber(subtotal)}`);
  if (deliveryCost > 0) {
    lines.push(`*Delivery:* $${formatNumber(deliveryCost)}`);
  }
  lines.push(`*Total:* $${formatNumber(total)}`);
  lines.push("\n———");
  lines.push(`*Nombre:* ${name}`);
  lines.push(`*Teléfono:* ${phone}`);
  lines.push(`*Entrega:* ${currentDelivery==='local'?'Retiro en local':'Delivery'}`);
  if(currentDelivery==='delivery') lines.push(`*Dirección:* ${address}`);
  if(notes) lines.push(`*Notas:* ${notes}`);
  lines.push("\nEnviado desde *panda.shop*");
  const text=encodeURIComponent(lines.join("\n"));
  window.open(`https://wa.me/${WHATSAPP_PHONE}?text=${text}`,"_blank");
  window.__PANDA_STATE__.cart=[];saveCart();updateCartUI();
};

// ==========================================================
// ✨ UTILIDADES
// ==========================================================
function formatNumber(n){return new Intl.NumberFormat('es-AR').format(Math.round(n));}
function showToast(m){const t=document.createElement('div');t.className='toast';t.textContent=m;document.body.appendChild(t);setTimeout(()=>t.remove(),1800);}
function showFormAlert(m){const a=document.getElementById('formAlert');const msg=document.getElementById('formAlertMessage');msg.textContent=m;a.classList.add('show');setTimeout(()=>a.classList.remove('show'),2500);}
