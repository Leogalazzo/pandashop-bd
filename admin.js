import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDAp3SNGCdu3yaBJc4BKmI8fgf0cY7DMM0",
  authDomain: "panda-577da.firebaseapp.com",
  projectId: "panda-577da",
  storageBucket: "panda-577da.firebasestorage.app",
  messagingSenderId: "651396342669",
  appId: "1:651396342669:web:a07a61a1d99b0b64efd3c4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let productos = [];
let editId = null;

const grid = document.getElementById('productGrid');
const modal = document.getElementById('productModal');
const form = document.getElementById('productForm');
const modalTitle = document.getElementById('modalTitle');
const searchInput = document.getElementById('searchInput');
const filterCategory = document.getElementById('filterCategory');
const filterAvailability = document.getElementById('filterAvailability');
const scrollTopBtn = document.getElementById('scrollTopBtn');
const preview = document.getElementById('preview');

document.addEventListener("DOMContentLoaded", async () => {
  await loadProducts();
  renderProducts();
  buildCategoryFilter();

  document.getElementById('addProductBtn').onclick = openAddModal;
  
  const manageCategoriesBtn = document.getElementById('manageCategoriesBtn');
  if (manageCategoriesBtn) {
    manageCategoriesBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Botón categorías clickeado');
      openCategoriesModal();
    };
  } else {
    console.error('No se encontró el botón manageCategoriesBtn');
  }
  
  document.getElementById('cancelBtn').onclick = closeModal;
  searchInput.oninput = applyFilters;
  filterCategory.onchange = applyFilters;
  filterAvailability.onchange = applyFilters;
  scrollTopBtn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
});

async function loadProducts() {
  const snapshot = await getDocs(collection(db, "productos"));
  productos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

function renderProducts(list = productos) {
  grid.innerHTML = '';
  if (list.length === 0) {
    grid.innerHTML = '<div class="empty">No hay productos.</div>';
    return;
  }

  list.forEach(p => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <img src="${p.image}" alt="${p.name}">
      <div class="card-body">
        <h3>${p.name}</h3>
        <p class="muted">${p.category}${p.isAlcohol ? ' · 18+' : ''}</p>
        <p class="price">$${p.price.toLocaleString()}</p>
        ${p.originalPrice ? `<p class="old-price">$${p.originalPrice.toLocaleString()}</p>` : ''}
        ${p.badge ? `<span class="badge">${p.badge}</span>` : ''}
        <div class="actions">
          <button class="btn secondary" onclick="editProduct('${p.id}')">Editar</button>
          <button class="btn danger" onclick="deleteProduct('${p.id}')">Eliminar</button>
        </div>
      </div>`;
    grid.appendChild(card);
  });
}

window.editProduct = async (id) => {
  const p = productos.find(x => x.id === id);
  if (!p) return;
  editId = id;
  modalTitle.textContent = "Editar producto";
  form.name.value = p.name;
  form.price.value = p.price;
  form.originalPrice.value = p.originalPrice || '';
  form.image.value = p.image;
  form.category.value = p.category;
  form.isAlcohol.checked = p.isAlcohol;
  form.available.checked = p.available;
  form.badge.value = p.badge || '';
  preview.src = p.image;
  preview.style.display = 'block';
  modal.style.display = 'flex';
};

window.deleteProduct = async (id) => {
  if (!confirm("¿Eliminar producto?")) return;
  await deleteDoc(doc(db, "productos", id));
  await loadProducts();
  renderProducts();
};

function openAddModal() {
  editId = null;
  form.reset();
  modalTitle.textContent = "Agregar producto";
  preview.style.display = 'none';
  modal.style.display = 'flex';
}

function closeModal() {
  modal.style.display = 'none';
}

form.image.oninput = () => {
  preview.src = form.image.value;
  preview.style.display = form.image.value ? 'block' : 'none';
};

// --- CÁLCULO AUTOMÁTICO DE PRECIO SEGÚN COSTO Y MARGEN ---
const costPriceInput = form.elements['costPrice'];
const marginPercentSelect = form.elements['marginPercent'];
const priceInput = form.elements['price'];
const unitsInput = form.elements['unitsPerPack'];

function actualizarPrecioAuto() {
  const costo = parseFloat(costPriceInput.value);
  const margen = parseFloat(marginPercentSelect.value);
  const unidades = parseFloat(unitsInput.value) || 1;
  if (!isNaN(costo) && !isNaN(margen) && unidades > 0) {
    const precioUnitario = costo / unidades;
    const precio = +(precioUnitario * (1 + margen / 100)).toFixed(2);
    if (!priceInput.dataset.editadoManualmente || priceInput.value === '' || priceInput.value == 0) {
      priceInput.value = precio;
    }
    priceInput.dataset.precioAuto = precio;
  }
}

if (costPriceInput && marginPercentSelect && priceInput) {
  costPriceInput.addEventListener('input', actualizarPrecioAuto);
  marginPercentSelect.addEventListener('change', actualizarPrecioAuto);
  priceInput.addEventListener('input', () => {
    // Marcar cuando el usuario edita manualmente
    priceInput.dataset.editadoManualmente = 'true';
  });
}

if (unitsInput) {
  unitsInput.addEventListener('input', actualizarPrecioAuto);
}

// Al abrir modal de agregar producto
const orig_openAddModal = openAddModal;
openAddModal = function() {
  if (priceInput) priceInput.dataset.editadoManualmente = '';
  if (costPriceInput) costPriceInput.value = '';
  if (marginPercentSelect) marginPercentSelect.value = '30';
  if (priceInput) priceInput.value = '';
  if (unitsInput) unitsInput.value = 1;
  orig_openAddModal();
};
// Al editar producto
const orig_editProduct = window.editProduct;
window.editProduct = async function(id) {
  await orig_editProduct(id);
  const p = productos.find(x => x.id === id);
  if (!p) return;
  if (costPriceInput) costPriceInput.value = p.costPrice || '';
  if (marginPercentSelect) marginPercentSelect.value = p.marginPercent || '30';
  if (unitsInput) unitsInput.value = p.unitsPerPack || 1;
  if (priceInput) priceInput.dataset.editadoManualmente = '';
  actualizarPrecioAuto();
};
// Guardar en BD
form.onsubmit = async (e) => {
  e.preventDefault();
  const producto = {
    name: form.name.value.trim(),
    price: parseFloat(form.price.value),
    originalPrice: form.originalPrice.value ? parseFloat(form.originalPrice.value) : null,
    image: form.image.value.trim(),
    category: form.category.value.trim(),
    isAlcohol: form.isAlcohol.checked,
    available: form.available.checked,
    badge: form.badge.value.trim(),
    fechaSubida: new Date().toISOString(),
    costPrice: costPriceInput ? parseFloat(costPriceInput.value) : null,
    marginPercent: marginPercentSelect ? parseFloat(marginPercentSelect.value) : null,
    unitsPerPack: unitsInput ? parseInt(unitsInput.value) : 1
  };
  if (editId) {
    await updateDoc(doc(db, 'productos', editId), producto);
  } else {
    await addDoc(collection(db, 'productos'), producto);
  }
  await loadProducts();
  renderProducts();
  buildCategoryFilter();
  closeModal();
};

function buildCategoryFilter() {
  const categories = [...new Set(productos.map(p => p.category))];
  const filterSelect = document.getElementById('filterCategory');
  const categoryDatalist = document.getElementById('categoryList');
  
  // Limpiar opciones existentes
  filterSelect.innerHTML = '<option value="all">Todas las categorías</option>';
  categoryDatalist.innerHTML = '';
  
  categories.forEach(c => {
    // Para el filtro
    const option = document.createElement('option');
    option.value = c;
    option.textContent = c;
    filterSelect.appendChild(option);
    
    // Para el datalist de autocompletado
    const datalistOption = document.createElement('option');
    datalistOption.value = c;
    categoryDatalist.appendChild(datalistOption);
  });
}

function applyFilters() {
  let filtered = [...productos];
  const search = searchInput.value.toLowerCase();
  if (search) filtered = filtered.filter(p => p.name.toLowerCase().includes(search));

  const cat = filterCategory.value;
  if (cat !== 'all') filtered = filtered.filter(p => p.category === cat);

  const avail = filterAvailability.value;
  if (avail === 'available') filtered = filtered.filter(p => p.available);
  if (avail === 'unavailable') filtered = filtered.filter(p => !p.available);

  renderProducts(filtered);
}

// ==========================================================
// GESTIÓN DE CATEGORÍAS
// ==========================================================
function openCategoriesModal() {
  console.log('Función openCategoriesModal ejecutada');
  const categoriesModal = document.getElementById('categoriesModal');
  
  if (!categoriesModal) {
    console.error('Modal de categorías no encontrado');
    alert('Error: No se encontró el modal de categorías en el DOM');
    return;
  }
  
  console.log('Modal encontrado, renderizando lista de categorías...');
  console.log('Productos disponibles:', productos.length);
  
  renderCategoriesList();
  
  // Asegurarse de que el modal sea visible
  categoriesModal.style.display = 'flex';
  categoriesModal.style.visibility = 'visible';
  categoriesModal.style.opacity = '1';
  
  // Prevenir scroll del body
  document.body.style.overflow = 'hidden';
  
  console.log('Modal abierto correctamente');
}

window.closeCategoriesModal = function() {
  console.log('Cerrando modal de categorías');
  const categoriesModal = document.getElementById('categoriesModal');
  if (categoriesModal) {
    categoriesModal.style.display = 'none';
    categoriesModal.style.visibility = 'hidden';
    categoriesModal.style.opacity = '0';
    
    // Restaurar scroll del body
    document.body.style.overflow = '';
  }
}

// Cerrar modal al hacer clic fuera
window.addEventListener('click', (e) => {
  const categoriesModal = document.getElementById('categoriesModal');
  if (categoriesModal && e.target === categoriesModal) {
    console.log('Click fuera del modal, cerrando...');
    closeCategoriesModal();
  }
});

function renderCategoriesList() {
  console.log('Renderizando lista de categorías');
  const categories = [...new Set(productos.map(p => p.category))].sort();
  const categoriesList = document.getElementById('categoriesList');
  
  console.log('Categorías encontradas:', categories);
  
  if (!categoriesList) {
    console.error('No se encontró el elemento categoriesList');
    return;
  }
  
  if (categories.length === 0) {
    categoriesList.innerHTML = '<div class="empty">No hay categorías.</div>';
    return;
  }

  categoriesList.innerHTML = '';
  categories.forEach(category => {
    const count = productos.filter(p => p.category === category).length;
    const categoryItem = document.createElement('div');
    categoryItem.className = 'category-item';
    
    // Escapar comillas para evitar problemas con onclick
    const safeCategoryName = category.replace(/'/g, "\\'");
    
    categoryItem.innerHTML = `
      <div class="category-info">
        <h4>${category}</h4>
        <p class="muted">${count} producto${count !== 1 ? 's' : ''}</p>
      </div>
      <button class="btn danger" onclick="deleteCategory('${safeCategoryName}')">🗑️ Eliminar</button>
    `;
    categoriesList.appendChild(categoryItem);
  });
  
  console.log('Lista de categorías renderizada:', categories.length, 'categorías');
}

window.deleteCategory = async function(category) {
  console.log('Intentando eliminar categoría:', category);
  
  // Desescapar las comillas si fueron escapadas
  const actualCategory = category.replace(/\\'/g, "'");
  
  const productsInCategory = productos.filter(p => p.category === actualCategory);
  const count = productsInCategory.length;
  
  console.log('Productos en esta categoría:', count);
  
  if (!confirm(`¿Eliminar la categoría "${actualCategory}"?\n\nEsto eliminará ${count} producto${count !== 1 ? 's' : ''} asociado${count !== 1 ? 's' : ''}.`)) {
    console.log('Eliminación cancelada por el usuario');
    return;
  }

  try {
    console.log('Eliminando productos...');
    // Eliminar todos los productos de esa categoría
    for (const producto of productsInCategory) {
      await deleteDoc(doc(db, "productos", producto.id));
      console.log('Producto eliminado:', producto.name);
    }

    // Recargar productos y actualizar interfaz
    console.log('Recargando productos...');
    await loadProducts();
    renderProducts();
    buildCategoryFilter();
    renderCategoriesList();
    
    alert(`Categoría "${actualCategory}" y ${count} producto${count !== 1 ? 's' : ''} eliminado${count !== 1 ? 's' : ''} correctamente.`);
    console.log('Categoría eliminada exitosamente');
  } catch (error) {
    console.error('Error al eliminar categoría:', error);
    alert('Error al eliminar la categoría. Por favor, intenta nuevamente.');
  }
}

// Al abrir el modal de producto, bloquear el scroll del body
definirOpenModalScrollLock();
function definirOpenModalScrollLock() {
  const openModalScrollLock = () => { document.body.style.overflow = 'hidden'; };
  const closeModalScrollLock = () => { document.body.style.overflow = ''; };

  // Interceptar openAddModal (ya redefinido)
  const prev_openAddModal = openAddModal;
  openAddModal = function() {
    openModalScrollLock();
    prev_openAddModal();
  };

  // Interceptar closeModal
  const prev_closeModal = closeModal;
  closeModal = function() {
    closeModalScrollLock();
    prev_closeModal();
  };

  // Al cerrar modal por cancelar botón u otras acciones 
  if (form) {
    form.addEventListener('submit', closeModalScrollLock);
  }
}
