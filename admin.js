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
    fechaSubida: new Date().toISOString()
  };

  if (editId) {
    await updateDoc(doc(db, "productos", editId), producto);
  } else {
    await addDoc(collection(db, "productos"), producto);
  }

  await loadProducts();
  renderProducts();
  buildCategoryFilter(); // Actualizar el datalist después de guardar
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
