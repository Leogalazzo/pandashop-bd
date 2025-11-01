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

// Control de tiempo mínimo del loader
const LOADER_START_TIME = Date.now();
const MIN_LOADER_TIME = 2000; // 2 segundos mínimo

// Función para ocultar el loader de página
function hidePageLoader() {
  const loader = document.getElementById('pageLoader');
  if (loader) {
    const elapsedTime = Date.now() - LOADER_START_TIME;
    const remainingTime = Math.max(0, MIN_LOADER_TIME - elapsedTime);
    
    // Esperar el tiempo mínimo antes de ocultar
    setTimeout(() => {
      loader.classList.add('fade-out');
      // Habilitar scroll del body
      document.body.classList.remove('loading');
      setTimeout(() => {
        loader.style.display = 'none';
      }, 500); // Coincide con la duración de la transición CSS
    }, remainingTime);
  }
}

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
      applyFilters(); // Usar applyFilters en lugar de render directo
      
      // NO validar aquí - se hará al abrir el carrito
      updateCartUI();
      document.getElementById('year').textContent = new Date().getFullYear();
      
      // Ocultar loader cuando se cargan productos desde cache
      hidePageLoader();
      
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
    applyFilters(); // Usar applyFilters en lugar de render directo
    
    // NO validar aquí - se hará al abrir el carrito
    updateCartUI();
    
    // Ocultar loader cuando se cargan productos desde Firebase
    hidePageLoader();
    
    if (ageStatus === null) showAgeGate();
    else applyAgeRestriction(ageStatus);
  } catch (error) {
    console.error("Error cargando productos:", error);
    if (!cachedData) {
      hidePageLoader();
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
  
  // Listeners para cerrar modales de alerta al hacer clic en el backdrop
  const clearCartModal = document.getElementById('clearCartModal');
  if (clearCartModal) {
    clearCartModal.addEventListener('click', (e) => {
      if (e.target === clearCartModal) {
        closeClearCartModal();
      }
    });
  }
  
  const deleteItemModal = document.getElementById('deleteItemModal');
  if (deleteItemModal) {
    deleteItemModal.addEventListener('click', (e) => {
      if (e.target === deleteItemModal) {
        closeDeleteItemModal();
      }
    });
  }
  
  const unavailableItemsModal = document.getElementById('unavailableItemsModal');
  if (unavailableItemsModal) {
    unavailableItemsModal.addEventListener('click', (e) => {
      if (e.target === unavailableItemsModal) {
        closeUnavailableItemsModal();
      }
    });
  }
  
  // Cerrar carrito al hacer clic fuera (solo en PC)
  document.addEventListener('click', (e) => {
    const drawer = document.getElementById('cartDrawer');
    if (window.innerWidth >= 768 && drawer && drawer.classList.contains('open')) {
      const isClickInsideDrawer = drawer.contains(e.target);
      const isCartButton = e.target.closest('button[onclick*="toggleCart"]');
      const isInModal = e.target.closest('.alert-backdrop, .alert-modal');
      // Excluir botones de cantidad (incr/decr) dentro del carrito
      const isQtyButton = e.target.tagName === 'BUTTON' && 
        (e.target.getAttribute('onclick')?.includes('incr(') || 
         e.target.getAttribute('onclick')?.includes('decr('));
      if (!isClickInsideDrawer && !isCartButton && !isInModal && !isQtyButton) {
        toggleCart(false);
      }
    }
  });
  
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
  const allBtn = pill('Todos', true, () => { setActivePill(allBtn); applyFilters(); });
  filters.appendChild(allBtn);
  cats.forEach(c => {
    const el = pill(c, false, () => { setActivePill(el); applyFilters(); });
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
  // NO limpiamos el buscador, solo actualizamos los filtros
}

// Función auxiliar para normalizar texto (remover acentos)
function normalizeText(text) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Función para aplicar filtros de búsqueda en tiempo real con coincidencias parciales
window.applyFilters = () => {
  const q = document.getElementById('search').value.trim().toLowerCase();
  const activePill = document.querySelector('.pill.active');
  
  // Obtener lista base según filtro de categoría
  let baseList = [];
  if (activePill && activePill.textContent === 'Todos') {
    baseList = window.__PANDA_STATE__.products;
  } else if (activePill) {
    const category = activePill.textContent;
    baseList = window.__PANDA_STATE__.products.filter(p => p.category === category);
  } else {
    baseList = window.__PANDA_STATE__.products;
  }
  
  // Si no hay búsqueda, renderizar toda la lista base
  if (!q) {
    render(baseList);
    return;
  }
  
  // Normalizar término de búsqueda (sin acentos)
  const normalizedQ = normalizeText(q);
  
  // Filtrar con coincidencias parciales en nombre, categoría o descripción
  const filtered = baseList.filter(p => {
    // Normalizar nombre y categoría del producto
    const normalizedName = normalizeText(p.name.toLowerCase());
    const normalizedCategory = normalizeText(p.category.toLowerCase());
    
    const nameMatch = normalizedName.includes(normalizedQ);
    const categoryMatch = normalizedCategory.includes(normalizedQ);
    
    // Buscar coincidencias en cada palabra del término de búsqueda
    const searchTerms = normalizedQ.split(' ').filter(term => term.length > 0);
    const allTermsMatch = searchTerms.every(term => 
      normalizedName.includes(term) || 
      normalizedCategory.includes(term)
    );
    
    return nameMatch || categoryMatch || allTermsMatch;
  });
  
  render(filtered);
};

// Función auxiliar para resaltar texto de búsqueda (con normalización)
function highlightSearchText(text, searchQuery) {
  if (!searchQuery || !searchQuery.trim()) return text;
  
  // Normalizar tanto el texto como la búsqueda
  const normalizedText = normalizeText(text);
  const normalizedSearch = normalizeText(searchQuery.trim().toLowerCase());
  
  const terms = normalizedSearch.split(' ').filter(term => term.length > 0);
  if (terms.length === 0) return text;
  
  // Crear un mapeo de caracteres para encontrar coincidencias
  // Simplemente buscamos en el texto original usando regex flexible
  let result = text;
  
  terms.forEach(term => {
    // Crear un patrón regex que coincida con el término normalizado
    // Buscar cada carácter del término de forma flexible
    const pattern = term.split('').map(char => {
      // Para cada carácter, buscar tanto la versión con acento como sin acento
      // Ejemplo: 'a' coincidirá con 'a', 'á', 'à', etc.
      if (/[aeiouAEIOU]/.test(char)) {
        const vowels = {
          'a': '[aáàäâ]', 'e': '[eéèëê]', 'i': '[iíìïî]', 
          'o': '[oóòöô]', 'u': '[uúùüû]',
          'A': '[AaÁáÀàÄäÂâ]', 'E': '[EeÉéÈèËëÊê]', 'I': '[IiÍíÌìÏïÎî]',
          'O': '[OoÓóÒòÖöÔô]', 'U': '[UuÚúÙùÜüÛû]'
        };
        return vowels[char] || char;
      }
      return char;
    }).join('');
    
    try {
      const regex = new RegExp(`(${pattern})`, 'gi');
      result = result.replace(regex, '<mark>$1</mark>');
    } catch (e) {
      // Si hay error en el regex, intentar sin modificaciones
      const simpleRegex = new RegExp(`(${term})`, 'gi');
      result = result.replace(simpleRegex, '<mark>$1</mark>');
    }
  });
  
  return result;
}

// ==========================================================
// 🧩 RENDER DE PRODUCTOS (mejorado con resaltado)
// ==========================================================
function render(list) {
  const grid = document.getElementById('grid');
  const q = document.getElementById('search')?.value.trim().toLowerCase() || '';
  grid.innerHTML = '';

  if (list.length === 0) {
    const activePill = document.querySelector('.pill.active');
    const categoryName = activePill && activePill.textContent !== 'Todos' ? activePill.textContent : '';
    const isSearching = q.length > 0;
    
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="M21 21l-4.35-4.35"></path>
          </svg>
        </div>
        <h2 class="empty-state-title">
          ${isSearching ? 'No encontramos productos' : categoryName ? `No hay productos en "${categoryName}"` : 'No hay productos'}
        </h2>
        <p class="empty-state-description">
          ${isSearching 
            ? `No encontramos productos que coincidan con "<strong>${document.getElementById('search').value}</strong>".` 
            : categoryName 
              ? 'Esta categoría aún no tiene productos disponibles.' 
              : 'No hay productos disponibles en este momento.'}
        </p>
        <div class="empty-state-suggestions">
          ${isSearching ? `
            <span class="suggestion-tag">💡 Prueba con términos más cortos</span>
            <span class="suggestion-tag">💡 Busca sin acentos</span>
            <span class="suggestion-tag">💡 Verifica la ortografía</span>
          ` : ''}
        </div>
        <button class="empty-state-btn" onclick="
          document.getElementById('search').value = '';
          document.querySelector('.pill.active')?.click();
        ">
          ${isSearching ? 'Limpiar búsqueda' : 'Ver todos los productos'}
        </button>
      </div>`;
    return;
  }

  list.forEach(p => {
    const card = document.createElement('article');
    card.className = 'card';
    if (!p.available) card.classList.add('out-of-stock');

    // Resaltar texto si hay búsqueda activa
    const highlightedName = highlightSearchText(p.name, q);
    const highlightedCategory = highlightSearchText(p.category, q);

    // estructura visual igual que antes
    card.innerHTML = `
      <div class="card-img">
        ${p.badge ? `<span class="badge">${p.badge}</span>` : ''}
        <img src="${p.image}" alt="${p.name}">
      </div>
      <div class="card-body">
        <div class="card-content">
          <div class="title">${highlightedName}</div>
          <div class="price-row">
            ${p.originalPrice ? `
              <div class="price-with-old">
                <div class="old-price">$${formatNumber(p.originalPrice)}</div>
                <div class="price" style="color:#ff6b35">$${formatNumber(p.price)}</div>
              </div>` : `<div class="price">$${formatNumber(p.price)}</div>`}
            <div class="muted">${highlightedCategory}${p.isAlcohol ? ' · 18+' : ''}</div>
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
  
  // Verificar disponibilidad del producto
  if (!p.available) {
    addBtn.textContent = "Sin stock";
    addBtn.disabled = true;
    addBtn.onclick = null;
  } else {
    addBtn.textContent = "Agregar";
    addBtn.disabled = false;
    addBtn.onclick = () => { 
      window.addToCart(p); 
      closeModal(); 
      showToast("Producto agregado al carrito"); 
    };
  }
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

// Función para validar y limpiar productos no disponibles del carrito
// Retorna el array de productos removidos (nombres)
function validateCartItems() {
  const cart = window.__PANDA_STATE__.cart;
  const products = window.__PANDA_STATE__.products;
  const removedItems = [];
  
  // Si no hay productos cargados aún, no validar
  if (products.length === 0) return [];
  
  // Crear un mapa de productos disponibles por ID
  const availableProductsMap = {};
  products.forEach(p => {
    availableProductsMap[p.id] = p;
  });
  
  // Filtrar y recopilar productos no disponibles
  window.__PANDA_STATE__.cart = cart.filter(item => {
    const product = availableProductsMap[item.id];
    if (!product || !product.available) {
      removedItems.push(item.name);
      return false;
    }
    return true;
  });
  
  // Si se removieron productos, guardar
  if (removedItems.length > 0) {
    saveCart();
    updateCartUI();
  }
  
  return removedItems;
}

// Funciones para el modal de productos no disponibles
window.closeUnavailableItemsModal = () => {
  document.getElementById('unavailableItemsModal').classList.remove('show');
};

window.showUnavailableItemsModal = (removedItems) => {
  const messageEl = document.getElementById('unavailableItemsMessage');
  const modalEl = document.getElementById('unavailableItemsModal');
  
  if (!messageEl || !modalEl) return;
  
  let message;
  
  if (removedItems.length === 1) {
    message = `<strong>${removedItems[0]}</strong> ya no está disponible y fue removido de tu carrito.`;
  } else {
    const itemsList = removedItems.map(item => `<strong>${item}</strong>`).join(', ');
    message = `Los siguientes productos ya no están disponibles y fueron removidos de tu carrito:<br><br>${itemsList}`;
  }
  
  messageEl.innerHTML = message;
  modalEl.classList.add('show');
};

window.toggleCart = (open) => {
  const drawer = document.getElementById('cartDrawer');
  drawer.classList.toggle('open', !!open);
  drawer.setAttribute('aria-hidden', !open);
  document.body.style.overflow = open ? 'hidden' : '';
  
  // Validar productos al abrir el carrito
  if (open) {
    const removedItems = validateCartItems();
    
    // Si hay productos removidos, mostrar modal
    if (removedItems.length > 0) {
      // Pequeño delay para que el drawer se abra primero
      setTimeout(() => {
        showUnavailableItemsModal(removedItems);
      }, 300);
    }
    
    const drawerBody = drawer.querySelector('.drawer-body');
    if (drawerBody) {
      setTimeout(() => drawerBody.scrollTop = 0, 100);
    }
  }
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

// ==========================================================
// 🗑️ ELIMINAR PRODUCTO DEL CARRITO
// ==========================================================
let pendingDeleteId = null;
window.openDeleteItemModal = (id) => {
  const item = window.__PANDA_STATE__.cart.find(x => x.id === id);
  if (item) {
    pendingDeleteId = id;
    document.getElementById('deleteItemMessage').textContent = `¿Estás seguro de eliminar "${item.name}" del carrito?`;
    document.getElementById('deleteItemModal').classList.add('show');
  }
};
window.closeDeleteItemModal = () => {
  document.getElementById('deleteItemModal').classList.remove('show');
  pendingDeleteId = null;
};
window.confirmDeleteItem = () => {
  if (pendingDeleteId) {
    window.__PANDA_STATE__.cart = window.__PANDA_STATE__.cart.filter(x => x.id !== pendingDeleteId);
    saveCart();
    updateCartUI();
    closeDeleteItemModal();
  }
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
          <button style="margin-left:8px" class="icon-btn" onclick='openDeleteItemModal("${item.id}")'>🗑️</button>
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
window.decr = (id) => { 
  const c = window.__PANDA_STATE__.cart; 
  const i = c.find(x => x.id === id); 
  if (i) { 
    if (i.qty <= 1) {
      removeItem(id);
    } else {
      i.qty--; 
      saveCart(); 
      updateCartUI(); 
    }
  } 
};
window.removeItem = (id) => { 
  openDeleteItemModal(id);
};

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
window.denyAge = ()=>{ localStorage.setItem(AGE_KEY,'0'); hideAgeGate(); applyAgeRestriction('0'); }
function applyAgeRestriction(value){
  const all = window.__PANDA_STATE__.products;
  if(value==='0'){ 
    const noAlcohol = all.filter(p=>!p.isAlcohol); 
    buildFilters(noAlcohol); 
    applyFilters(); // Usar applyFilters en lugar de render directo
    
    // Mostrar aviso de modo restringido
    const filters = document.getElementById('filters');
    // Remover aviso anterior si existe
    const existingNotice = document.querySelector('#restricted-mode-notice');
    if (existingNotice) existingNotice.remove();
    
    const notice = document.createElement('div');
    notice.id = 'restricted-mode-notice';
    notice.style.padding = '14px 16px';
    notice.style.background = 'rgba(255, 90, 90, 0.15)';
    notice.style.border = '1px solid #ff5a5a';
    notice.style.borderRadius = '12px';
    notice.style.marginTop = '16px';
    notice.style.marginBottom = '16px';
    notice.style.fontSize = '14px';
    notice.style.fontWeight = '600';
    notice.style.color = '#ff5a5a';
    notice.style.textAlign = 'center';
    notice.style.boxShadow = '0 2px 8px rgba(255, 90, 90, 0.2)';
    notice.textContent = '⚠️ Modo restringido: solo se muestran productos sin alcohol. Borra el caché para cambiar esta configuración.';
    filters.before(notice);
  }
  else { 
    // Remover aviso de modo restringido si existe
    const existingNotice = document.querySelector('#restricted-mode-notice');
    if (existingNotice) existingNotice.remove();
    
    buildFilters(all); 
    applyFilters(); // Usar applyFilters en lugar de render directo
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
  const paymentSelect = document.getElementById("buyerPayment");
  const paymentValue = paymentSelect ? paymentSelect.value.trim() : '';
  const notes = document.getElementById("buyerNotes").value.trim();

  if (!name) return showFormAlert("❌ Ingresá tu nombre");
  if (!phone) return showFormAlert("❌ Ingresá tu teléfono");
  if (currentDelivery === "delivery" && !address) return showFormAlert("❌ Ingresá tu dirección");
  if (!paymentValue) return showFormAlert("❌ Seleccioná una forma de pago");

  // Calcular totales
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const deliveryCost = currentDelivery === 'delivery' ? 1500 : 0;
  const total = subtotal + deliveryCost;
  
  // Obtener forma de pago desde el select
  const paymentOption = paymentSelect.options[paymentSelect.selectedIndex];
  const paymentLabel = paymentOption && paymentOption.text !== 'Forma de pago' ? paymentOption.text : 'Efectivo';
  
  // Construir el mensaje desde la perspectiva del cliente
  const lines = [];
  
  lines.push("Hola! Quiero hacer un pedido 🐼");
  lines.push("");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("*📦 PRODUCTOS:*");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━");
  
  // Lista de productos
  cart.forEach((i, idx) => {
    lines.push(`${idx + 1}. ${i.name}`);
    lines.push(`   ${i.qty}x $${formatNumber(i.price)} = $${formatNumber(i.price * i.qty)}`);
  });
  
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━");
  
  // Totales
  lines.push(`*Subtotal:* $${formatNumber(subtotal)}`);
  if (deliveryCost > 0) {
    lines.push(`*Delivery:* $${formatNumber(deliveryCost)}`);
  }
  lines.push("");
  lines.push(`*TOTAL: $${formatNumber(total)}*`);
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("");
  
  // Información del cliente
  lines.push("*👤 Mis datos:*");
  lines.push(`Nombre: ${name}`);
  lines.push(`Teléfono: ${phone}`);
  lines.push(`Forma de entrega: ${currentDelivery === 'local' ? '🏪 Retiro en local' : '🚚 Delivery'}`);
  if (currentDelivery === 'delivery') {
    lines.push(`Dirección: ${address}`);
  }
  lines.push(`Forma de pago: ${paymentLabel === 'Efectivo' ? '💰 Efectivo' : '💳 Transferencia'}`);
  
  if (notes) {
    lines.push("");
    lines.push(`*Observaciones:* ${notes}`);
  }
  
  const text = encodeURIComponent(lines.join("\n"));
  window.open(`https://wa.me/${WHATSAPP_PHONE}?text=${text}`,"_blank");
  
  // Limpiar carrito
  window.__PANDA_STATE__.cart = [];
  saveCart();
  updateCartUI();
  
  // Limpiar formulario
  document.getElementById("buyerName").value = "";
  document.getElementById("buyerPhone").value = "";
  document.getElementById("buyerAddress").value = "";
  document.getElementById("buyerPayment").value = "";
  document.getElementById("buyerNotes").value = "";
  
  // Resetear forma de entrega
  if (currentDelivery === 'local') {
    setDelivery('delivery');
  }
};

// ==========================================================
// ✨ UTILIDADES
// ==========================================================
function formatNumber(n){return new Intl.NumberFormat('es-AR').format(Math.round(n));}
function showToast(m){const t=document.createElement('div');t.className='toast';t.textContent=m;document.body.appendChild(t);setTimeout(()=>t.remove(),1800);}
function showFormAlert(m){const a=document.getElementById('formAlert');const msg=document.getElementById('formAlertMessage');msg.textContent=m;a.classList.add('show');setTimeout(()=>a.classList.remove('show'),2500);}

// ==========================================================
// 🔝 SCROLL TO TOP
// ==========================================================
window.scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Mostrar/ocultar botón scroll to top
window.addEventListener('scroll', () => {
  const scrollTopBtn = document.getElementById('scrollTopBtn');
  if (scrollTopBtn) {
    if (window.pageYOffset > 300) {
      scrollTopBtn.classList.add('show');
    } else {
      scrollTopBtn.classList.remove('show');
    }
  }
});
