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
let categorias = []; // Categorías guardadas en Firebase
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
  await loadProducts(); // Cargar productos primero
  await loadCategories(); // Luego categorías (que puede migrar desde productos)
  renderProducts();
  buildCategoryFilter();

  document.getElementById('addProductBtn').onclick = openAddModal;
  
  const generateImageBtn = document.getElementById('generateImageBtn');
  if (generateImageBtn) {
    generateImageBtn.onclick = openGenerateImageModal;
  }
  
  // Cerrar modal de generar imagen al hacer clic fuera
  const generateModal = document.getElementById('generateImageModal');
  if (generateModal) {
    generateModal.addEventListener('click', (e) => {
      if (e.target === generateModal) {
        closeGenerateImageModal();
      }
    });
  }
  
  const manageCategoriesBtn = document.getElementById('manageCategoriesBtn');
  if (manageCategoriesBtn) {
    manageCategoriesBtn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Botón categorías clickeado');
      await openCategoriesModal();
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

async function loadCategories() {
  try {
    const snapshot = await getDocs(collection(db, "categorias"));
    categorias = snapshot.docs.map(doc => doc.data().name).filter(Boolean).sort();
    
    // Si no hay categorías guardadas pero hay productos con categorías, migrar automáticamente
    if (categorias.length === 0 && productos.length > 0) {
      console.log('Migrando categorías desde productos...');
      const categoriesFromProducts = [...new Set(productos.map(p => p.category).filter(Boolean))];
      
      if (categoriesFromProducts.length > 0) {
        for (const catName of categoriesFromProducts) {
          try {
            await addDoc(collection(db, "categorias"), {
              name: catName,
              fechaCreacion: new Date().toISOString()
            });
            console.log('Categoría migrada:', catName);
          } catch (err) {
            console.error('Error migrando categoría:', catName, err);
          }
        }
        
        // Recargar después de la migración
        const newSnapshot = await getDocs(collection(db, "categorias"));
        categorias = newSnapshot.docs.map(doc => doc.data().name).filter(Boolean).sort();
        console.log('Migración completada. Categorías:', categorias);
      }
    }
  } catch (error) {
    console.error('Error cargando categorías:', error);
    categorias = [];
  }
}

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
  
  // Establecer categoría en el select
  const categorySelect = document.getElementById('category');
  if (categorySelect) {
    // Si la categoría del producto existe en las opciones, seleccionarla
    if (categorias.includes(p.category)) {
      categorySelect.value = p.category;
    } else {
      // Si no está en la lista (categoría antigua), agregarla temporalmente y seleccionarla
      const tempOption = document.createElement('option');
      tempOption.value = p.category;
      tempOption.textContent = p.category + ' (categoría no disponible)';
      categorySelect.appendChild(tempOption);
      categorySelect.value = p.category;
    }
  }
  
  form.isAlcohol.checked = p.isAlcohol;
  form.available.checked = p.available;
  form.badge.value = p.badge || '';
  preview.src = p.image;
  preview.style.display = 'block';
  // Bloquear scroll del body
  document.body.style.overflow = 'hidden';
  modal.style.display = 'flex';
  // Hacer scroll al inicio del modal (modal es el backdrop)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      // Scroll del backdrop (que es modal)
      modal.scrollTop = 0;
      // Scroll del contenido interno
      const modalContent = modal.querySelector('.modal-content');
      if (modalContent) {
        modalContent.scrollTop = 0;
      }
      // También hacer scroll del formulario al inicio
      const firstInput = form.querySelector('input');
      if (firstInput) {
        firstInput.focus();
        firstInput.blur(); // Quitar focus pero asegurar que el scroll se posicione
      }
    });
  });
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
  // Bloquear scroll del body
  document.body.style.overflow = 'hidden';
  modal.style.display = 'flex';
  // Hacer scroll al inicio del modal (modal es el backdrop)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      // Scroll del backdrop (que es modal)
      modal.scrollTop = 0;
      // Scroll del contenido interno
      const modalContent = modal.querySelector('.modal-content');
      if (modalContent) {
        modalContent.scrollTop = 0;
      }
      // También hacer scroll del formulario al inicio
      const firstInput = form.querySelector('input');
      if (firstInput) {
        firstInput.focus();
        firstInput.blur(); // Quitar focus pero asegurar que el scroll se posicione
      }
    });
  });
}

function closeModal() {
  modal.style.display = 'none';
  // Restaurar scroll del body
  document.body.style.overflow = '';
}

form.image.oninput = () => {
  preview.src = form.image.value;
  preview.style.display = form.image.value ? 'block' : 'none';
};

// Upload rápido de imagen desde el formulario
const quickImageUpload = document.getElementById('quickImageUpload');
const quickUploadBtn = document.getElementById('quickUploadBtn');

if (quickImageUpload) {
  quickImageUpload.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Mostrar estado de carga en el botón
    const originalText = quickUploadBtn.textContent;
    quickUploadBtn.disabled = true;
    quickUploadBtn.textContent = '⏳ Subiendo...';

    // Convertir y subir imagen
    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = function(event) {
      const img = new Image();
      img.src = event.target.result;
      
      img.onerror = function() {
        quickUploadBtn.disabled = false;
        quickUploadBtn.textContent = originalText;
        alert('❌ Error al cargar la imagen. Verifica que sea un archivo válido.');
        quickImageUpload.value = '';
      };
      
      img.onload = function() {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          canvas.toBlob(function(blob) {
            if (!blob) {
              // Si falla WebP, intentar con formato original
              canvas.toBlob(function(blobOriginal) {
                if (!blobOriginal) {
                  quickUploadBtn.disabled = false;
                  quickUploadBtn.textContent = originalText;
                  alert('❌ Error al convertir la imagen');
                  quickImageUpload.value = '';
                  return;
                }
                uploadQuickImage(blobOriginal, file.name || 'imagen.jpg');
              }, file.type || 'image/jpeg', 0.9);
              return;
            }
            uploadQuickImage(blob, 'imagen.webp');
          }, 'image/webp', 0.8);
        } catch (err) {
          quickUploadBtn.disabled = false;
          quickUploadBtn.textContent = originalText;
          alert(`❌ Error al procesar la imagen: ${err.message}`);
          console.error('Error en canvas:', err);
          quickImageUpload.value = '';
        }
      };
    };

    reader.onerror = function() {
      quickUploadBtn.disabled = false;
      quickUploadBtn.textContent = originalText;
      alert('❌ Error al leer el archivo');
      quickImageUpload.value = '';
    };
  });
}

function uploadQuickImage(blob, filename) {
  const formData = new FormData();
  formData.append('image', blob, filename);
  const quickUploadBtn = document.getElementById('quickUploadBtn');
  const originalText = quickUploadBtn.textContent;

  fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
    method: 'POST',
    body: formData,
  })
  .then(res => {
    if (!res.ok) {
      return res.text().then(text => {
        throw new Error(`HTTP error! status: ${res.status}`);
      });
    }
    return res.json();
  })
  .then(response => {
    quickUploadBtn.disabled = false;
    quickUploadBtn.textContent = '📤 Subir';

    if (response.success && response.data && response.data.url) {
      const url = response.data.url;
      
      // Llenar automáticamente el campo de imagen
      const imageInput = document.getElementById('image');
      if (imageInput) {
        imageInput.value = url;
      }
      
      // Actualizar preview automáticamente
      const preview = document.getElementById('preview');
      if (preview) {
        preview.src = url;
        preview.style.display = 'block';
      }
      
      // Limpiar el input de archivo
      quickImageUpload.value = '';
      
      // Mostrar mensaje de éxito brevemente
      quickUploadBtn.textContent = '✅ Listo';
      setTimeout(() => {
        quickUploadBtn.textContent = '📤 Subir';
      }, 2000);
    } else {
      const errorMsg = response.error ? (response.error.message || JSON.stringify(response.error)) : (response.status_txt || 'Error desconocido');
      alert(`❌ Error al subir la imagen: ${errorMsg}`);
      console.error('Error en respuesta:', response);
      quickImageUpload.value = '';
    }
  })
  .catch(err => {
    quickUploadBtn.disabled = false;
    quickUploadBtn.textContent = '📤 Subir';
    const errorMsg = err.message || 'Error de red o servidor';
    alert(`❌ Error en la subida: ${errorMsg}`);
    console.error('Error en fetch:', err);
    quickImageUpload.value = '';
  });
}

// Modal para ver imagen en tamaño completo
const imageViewerModal = document.getElementById('imageViewerModal');
const imageViewerImg = document.getElementById('imageViewerImg');

function openImageViewer(imgSrc) {
  if (imgSrc) {
    imageViewerImg.src = imgSrc;
    imageViewerModal.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
}

window.closeImageViewer = function() {
  imageViewerModal.classList.remove('show');
  document.body.style.overflow = '';
};

// Cerrar al hacer clic fuera de la imagen
imageViewerModal.addEventListener('click', (e) => {
  if (e.target === imageViewerModal) {
    closeImageViewer();
  }
});

// Cerrar con tecla Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && imageViewerModal.classList.contains('show')) {
    closeImageViewer();
  }
});

// Hacer que la imagen preview sea clickeable para abrirla en el visor
preview.addEventListener('click', () => {
  if (preview.src && preview.style.display !== 'none') {
    openImageViewer(preview.src);
  }
});

// Agregar cursor pointer a la imagen preview
preview.style.cursor = 'pointer';

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
  // Resetear el select de categoría
  const categorySelect = document.getElementById('category');
  if (categorySelect) {
    categorySelect.value = '';
    const firstOption = categorySelect.querySelector('option[value=""]');
    if (firstOption) firstOption.selected = true;
  }
  orig_openAddModal();
  // El scroll al inicio ya se maneja en openAddModal()
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
  // El scroll al inicio ya se maneja en editProduct()
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
  await loadCategories();
  buildCategoryFilter();
  closeModal();
};

function buildCategoryFilter() {
  // Usar categorías guardadas en Firebase, no las de productos
  const filterSelect = document.getElementById('filterCategory');
  const categorySelect = document.getElementById('category'); // Select del formulario
  
  // Limpiar opciones existentes del filtro
  filterSelect.innerHTML = '<option value="all">Todas las categorías</option>';
  
  // Limpiar y reconstruir el select del formulario
  if (categorySelect) {
    categorySelect.innerHTML = '<option value="" disabled selected>Selecciona una categoría</option>';
  }
  
  // Solo usar categorías guardadas
  categorias.forEach(c => {
    // Para el filtro de búsqueda
    const filterOption = document.createElement('option');
    filterOption.value = c;
    filterOption.textContent = c;
    filterSelect.appendChild(filterOption);
    
    // Para el select del formulario de productos
    if (categorySelect) {
      const formOption = document.createElement('option');
      formOption.value = c;
      formOption.textContent = c;
      categorySelect.appendChild(formOption);
    }
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
async function openCategoriesModal() {
  console.log('Función openCategoriesModal ejecutada');
  const categoriesModal = document.getElementById('categoriesModal');
  
  if (!categoriesModal) {
    console.error('Modal de categorías no encontrado');
    alert('Error: No se encontró el modal de categorías en el DOM');
    return;
  }
  
  console.log('Modal encontrado, renderizando lista de categorías...');
  console.log('Productos disponibles:', productos.length);
  
  await renderCategoriesList();
  
  // Asegurarse de que el modal sea visible
  categoriesModal.style.display = 'flex';
  categoriesModal.style.visibility = 'visible';
  categoriesModal.style.opacity = '1';
  
  // Prevenir scroll del body
  document.body.style.overflow = 'hidden';
  
  // Enfocar el input de nueva categoría y agregar listener para Enter
  const newCategoryInput = document.getElementById('newCategoryInput');
  if (newCategoryInput) {
    setTimeout(() => newCategoryInput.focus(), 100);
    newCategoryInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addCategory();
      }
    };
  }
  
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

async function renderCategoriesList() {
  console.log('Renderizando lista de categorías');
  const categoriesList = document.getElementById('categoriesList');
  
  if (!categoriesList) {
    console.error('No se encontró el elemento categoriesList');
    return;
  }
  
  // Recargar categorías antes de renderizar
  await loadCategories();
  
  console.log('Categorías encontradas:', categorias);
  
  if (categorias.length === 0) {
    categoriesList.innerHTML = '<div class="empty">No hay categorías. Agrega una nueva categoría arriba.</div>';
    return;
  }

  categoriesList.innerHTML = '';
  categorias.forEach(category => {
    const count = productos.filter(p => p.category === category).length;
    const categoryItem = document.createElement('div');
    categoryItem.className = 'category-item';
    
    // Escapar comillas para evitar problemas con onclick
    const safeCategoryName = category.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    
    categoryItem.innerHTML = `
      <div class="category-info">
        <h4>${category}</h4>
        <p class="muted">${count} producto${count !== 1 ? 's' : ''}</p>
      </div>
      <button class="btn danger" onclick="deleteCategory('${safeCategoryName}')">🗑️ Eliminar</button>
    `;
    categoriesList.appendChild(categoryItem);
  });
  
  console.log('Lista de categorías renderizada:', categorias.length, 'categorías');
}

window.addCategory = async function() {
  const input = document.getElementById('newCategoryInput');
  const categoryName = input.value.trim();
  
  if (!categoryName) {
    alert('Ingresá un nombre para la categoría');
    return;
  }
  
  // Verificar si ya existe
  if (categorias.includes(categoryName)) {
    alert('Esta categoría ya existe');
    input.value = '';
    return;
  }
  
  try {
    // Guardar en Firebase
    await addDoc(collection(db, "categorias"), {
      name: categoryName,
      fechaCreacion: new Date().toISOString()
    });
    
    // Recargar categorías y actualizar interfaz
    await loadCategories();
    buildCategoryFilter();
    await renderCategoriesList();
    
    // Limpiar input
    input.value = '';
    
    alert(`Categoría "${categoryName}" agregada correctamente`);
  } catch (error) {
    console.error('Error al agregar categoría:', error);
    alert('Error al agregar la categoría. Por favor, intenta nuevamente.');
  }
};

window.deleteCategory = async function(category) {
  console.log('Intentando eliminar categoría:', category);
  
  // Desescapar
  const actualCategory = category.replace(/\\'/g, "'").replace(/&quot;/g, '"');
  
  const productsInCategory = productos.filter(p => p.category === actualCategory);
  const count = productsInCategory.length;
  
  console.log('Productos en esta categoría:', count);
  
  if (!confirm(`¿Eliminar la categoría "${actualCategory}"?\n\n${count > 0 ? `Esto eliminará ${count} producto${count !== 1 ? 's' : ''} asociado${count !== 1 ? 's' : ''}.` : 'La categoría será eliminada.'}`)) {
    console.log('Eliminación cancelada por el usuario');
    return;
  }

  try {
    // Buscar y eliminar la categoría de Firebase
    const categoriesSnapshot = await getDocs(collection(db, "categorias"));
    const categoryDoc = categoriesSnapshot.docs.find(doc => doc.data().name === actualCategory);
    
    if (categoryDoc) {
      await deleteDoc(doc(db, "categorias", categoryDoc.id));
    }
    
    // Si hay productos en esa categoría, también eliminarlos
    if (count > 0) {
      console.log('Eliminando productos...');
      for (const producto of productsInCategory) {
        await deleteDoc(doc(db, "productos", producto.id));
        console.log('Producto eliminado:', producto.name);
      }
    }

    // Recargar productos y categorías, actualizar interfaz
    console.log('Recargando datos...');
    await loadCategories();
    await loadProducts();
    renderProducts();
    buildCategoryFilter();
    await renderCategoriesList();
    
    alert(`Categoría "${actualCategory}"${count > 0 ? ` y ${count} producto${count !== 1 ? 's' : ''} eliminado${count !== 1 ? 's' : ''}` : ''} correctamente.`);
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

  // Interceptar editProduct para bloquear scroll
  const prev_editProduct = window.editProduct;
  window.editProduct = async function(id) {
    openModalScrollLock();
    await prev_editProduct(id);
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

// ==========================================================
// 🖼️ GENERAR/SUBIR IMAGEN
// ==========================================================
const IMGBB_API_KEY = '3f059751d7037792d68c4c2f3c163040';
let currentImageUrl = '';

function openGenerateImageModal() {
  const generateModal = document.getElementById('generateImageModal');
  if (generateModal) {
    generateModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    // Reset del formulario
    document.getElementById('imageUploadInput').value = '';
    document.getElementById('imageUploadPreview').innerHTML = '';
    document.getElementById('imageUploadResult').style.display = 'none';
    document.getElementById('imageUploadLoading').classList.add('hidden');
    document.getElementById('imageUploadCopyMessage').classList.add('hidden');
    currentImageUrl = '';
    // Hacer scroll al inicio del modal
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        generateModal.scrollTop = 0;
        const modalContent = generateModal.querySelector('.modal-content');
        if (modalContent) {
          modalContent.scrollTop = 0;
        }
      });
    });
  }
}

window.closeGenerateImageModal = function() {
  const generateModal = document.getElementById('generateImageModal');
  if (generateModal) {
    generateModal.style.display = 'none';
    // Solo restaurar scroll si no hay otros modales abiertos
    const hasOpenModal = document.querySelector('.modal-backdrop[style*="flex"], .modal-backdrop[style*="display: flex"]');
    if (!hasOpenModal) {
      document.body.style.overflow = '';
    }
  }
};


window.uploadImage = async function() {
  const fileInput = document.getElementById('imageUploadInput');
  const file = fileInput.files[0];
  const preview = document.getElementById('imageUploadPreview');
  const resultDiv = document.getElementById('imageUploadResult');
  const loading = document.getElementById('imageUploadLoading');
  const urlInput = document.getElementById('imageUploadUrl');
  const uploadBtn = document.getElementById('uploadImageBtn');

  // Reset
  preview.innerHTML = '';
  resultDiv.style.display = 'none';
  loading.classList.add('hidden');
  document.getElementById('imageUploadCopyMessage').classList.add('hidden');

  if (!file) {
    alert('Seleccioná una imagen primero.');
    return;
  }

  loading.classList.remove('hidden');
  uploadBtn.disabled = true;
  uploadBtn.textContent = 'Subiendo...';

  try {
    // Convertir a base64 y luego a canvas
    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = function(event) {
      const img = new Image();
      img.src = event.target.result;
      
      img.onerror = function() {
        loading.classList.add('hidden');
        uploadBtn.disabled = false;
        uploadBtn.textContent = '📤 Subir imagen';
        alert('❌ Error al cargar la imagen. Verifica que sea un archivo válido.');
      };
      
      img.onload = function() {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          // Intentar convertir a WebP, si falla usar formato original
          let mimeType = 'image/webp';
          let quality = 0.8;
          
          // Verificar si el navegador soporta WebP
          if (!canvas.toBlob) {
            loading.classList.add('hidden');
            uploadBtn.disabled = false;
            uploadBtn.textContent = '📤 Subir imagen';
            alert('❌ Tu navegador no soporta la conversión de imágenes');
            return;
          }

          canvas.toBlob(function(blob) {
            if (!blob) {
              // Si falla WebP, intentar con formato original
              canvas.toBlob(function(blobOriginal) {
                if (!blobOriginal) {
                  loading.classList.add('hidden');
                  uploadBtn.disabled = false;
                  uploadBtn.textContent = '📤 Subir imagen';
                  alert('❌ Error al convertir la imagen');
                  return;
                }
                uploadBlob(blobOriginal, file.name || 'imagen.jpg');
              }, file.type || 'image/jpeg', 0.9);
              return;
            }
            uploadBlob(blob, 'imagen.webp');
          }, 'image/webp', quality);

          function uploadBlob(blob, filename) {
            const formData = new FormData();
            formData.append('image', blob, filename);

            fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
              method: 'POST',
              body: formData,
            })
            .then(res => {
              if (!res.ok) {
                return res.text().then(text => {
                  throw new Error(`HTTP error! status: ${res.status}, response: ${text}`);
                });
              }
              return res.json();
            })
            .then(response => {
              loading.classList.add('hidden');
              uploadBtn.disabled = false;
              uploadBtn.textContent = '📤 Subir imagen';

              if (response.success && response.data && response.data.url) {
                const url = response.data.url;
                currentImageUrl = url;

                // Mostrar preview
                preview.innerHTML = `<img src="${url}" alt="Imagen subida" style="max-width: 100%; max-height: 200px; border-radius: 8px; border: 1px solid var(--border);">`;
                
                // Mostrar URL
                urlInput.value = url;
                resultDiv.style.display = 'block';
              } else {
                const errorMsg = response.error ? (response.error.message || JSON.stringify(response.error)) : (response.status_txt || 'Error desconocido');
                alert(`❌ Error al subir la imagen: ${errorMsg}`);
                console.error('Error en respuesta:', response);
              }
            })
            .catch(err => {
              loading.classList.add('hidden');
              uploadBtn.disabled = false;
              uploadBtn.textContent = '📤 Subir imagen';
              const errorMsg = err.message || 'Error de red o servidor';
              alert(`❌ Error en la subida: ${errorMsg}`);
              console.error('Error en fetch:', err);
            });
          }
        } catch (err) {
          loading.classList.add('hidden');
          uploadBtn.disabled = false;
          uploadBtn.textContent = '📤 Subir imagen';
          alert(`❌ Error al procesar la imagen: ${err.message}`);
          console.error('Error en canvas:', err);
        }
      };
    };

    reader.onerror = function() {
      loading.classList.add('hidden');
      uploadBtn.disabled = false;
      uploadBtn.textContent = '📤 Subir imagen';
      alert('❌ Error al leer el archivo');
    };
  } catch (err) {
    loading.classList.add('hidden');
    uploadBtn.disabled = false;
    uploadBtn.textContent = '📤 Subir imagen';
    alert(`❌ Error al procesar la imagen: ${err.message}`);
    console.error('Error general:', err);
  }
};

window.copyImageUrl = function() {
  if (currentImageUrl) {
    navigator.clipboard.writeText(currentImageUrl)
      .then(() => {
        const copyMessage = document.getElementById('imageUploadCopyMessage');
        copyMessage.classList.remove('hidden');
        setTimeout(() => {
          copyMessage.classList.add('hidden');
        }, 2500);
      })
      .catch(() => alert('Error al copiar el link'));
  }
};

window.useImageUrl = function() {
  if (currentImageUrl) {
    const imageInput = document.getElementById('image');
    if (imageInput) {
      imageInput.value = currentImageUrl;
      // Actualizar preview
      const preview = document.getElementById('preview');
      if (preview) {
        preview.src = currentImageUrl;
        preview.style.display = 'block';
      }
      // Cerrar modal
      closeGenerateImageModal();
    }
  }
};
