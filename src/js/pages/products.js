import { supabase } from '../supabase.js';
import { renderSidebar, bindSidebar } from '../components/sidebar.js';

const app = document.querySelector('#app');

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[c]);

const peso = value => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP'
}).format(Number(value || 0));

let products = [];
let categories = [];
let editingId = null;
let currentProfile = null;

export async function renderProducts(profile, goBack) {
  currentProfile = profile;
  editingId = null;

  app.innerHTML = `
    ${renderSidebar(profile, 'products')}
    <main class="main-content">
      <div class="topbar">
        <div>
          <button class="mobile-menu-btn" id="menuBtn"><i class="bi bi-list"></i></button>
          <h1 class="page-title">Products Management</h1>
          <p class="page-subtitle">Manage frames, lenses, and accessories.</p>
        </div>
      </div>

      <div id="productMessage"></div>

      <div class="content-card mb-4">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-3">
          <div>
            <h5 class="card-heading mb-1">Product Catalog</h5>
            <small class="text-muted">Manage your clinic products.</small>
          </div>
          ${profile.role === 'admin' ? `
            <button class="btn btn-primary" id="addProductBtn">
              <i class="bi bi-plus-lg"></i> Add Product
            </button>
          ` : ''}
        </div>
      </div>

      <div id="productFormArea"></div>

      <div class="content-card">
        <div class="row g-2 mb-3">
          <div class="col-12 col-md-7">
            <input id="productSearch" class="form-control"
              placeholder="Search product name or SKU...">
          </div>
          <div class="col-12 col-md-5">
            <select id="typeFilter" class="form-select">
              <option value="all">All Product Types</option>
              <option value="frame">Frames</option>
              <option value="lens">Lenses</option>
              <option value="accessory">Accessories</option>
            </select>
          </div>
        </div>

        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Type</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                ${profile.role === 'admin' ? '<th>Actions</th>' : ''}
              </tr>
            </thead>
            <tbody id="productsTable">
              <tr><td colspan="7" class="text-center">Loading products...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  `;

  bindSidebar(page => goBack(page));

  if (profile.role === 'admin') {
    document.querySelector('#addProductBtn').addEventListener('click', () => {
      showProductForm();
    });
  }

  document.querySelector('#productSearch').addEventListener('input', renderTable);
  document.querySelector('#typeFilter').addEventListener('change', renderTable);

  await loadProducts();
}

async function loadProducts() {
  const [productResult, categoryResult] = await Promise.all([
    supabase.from('products')
      .select('id,name,description,category_id,product_type,sku,barcode,price,stock_quantity,low_stock_threshold,image_url,is_active,created_at')
      .order('created_at', { ascending: false }),

    supabase.from('categories')
      .select('id,name')
      .order('name')
  ]);

  if (productResult.error) {
    showMessage(productResult.error.message, 'danger');
    return;
  }

  if (categoryResult.error) {
    showMessage(categoryResult.error.message, 'danger');
    return;
  }

  products = productResult.data || [];
  categories = categoryResult.data || [];

  renderTable();
}

function renderTable() {
  const search = document.querySelector('#productSearch').value.toLowerCase();
  const type = document.querySelector('#typeFilter').value;

  const filtered = products.filter(product => {
    const matchesSearch =
      product.name.toLowerCase().includes(search) ||
      String(product.sku || '').toLowerCase().includes(search);

    const matchesType = type === 'all' || product.product_type === type;

    return matchesSearch && matchesType;
  });

  const tbody = document.querySelector('#productsTable');

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr><td colspan="7" class="text-center text-muted py-4">
        No products found.
      </td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(product => {
    const category = categories.find(c => c.id === product.category_id);
    const low = Number(product.stock_quantity) <= Number(product.low_stock_threshold);

    return `
      <tr>
        <td>
          <div class="d-flex align-items-center gap-3">
            <div style="width:55px;height:55px;flex-shrink:0;">
              ${product.image_url ? `<img src="${esc(product.image_url)}" alt="${esc(product.name)}" class="rounded" style="width:55px;height:55px;object-fit:cover;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">` : ''}
              <div class="rounded bg-light text-secondary align-items-center justify-content-center" style="width:55px;height:55px;display:${product.image_url ? 'none' : 'flex'};">
                <i class="bi bi-image fs-4"></i>
              </div>
            </div>
            <div>
              <strong>${esc(product.name)}</strong>
              <div class="small text-muted">${esc(product.sku || 'No SKU')}</div>
            </div>
          </div>
        </td>
        <td>${esc(category?.name || 'Uncategorized')}</td>
        <td><span class="badge bg-light text-dark">${esc(product.product_type)}</span></td>
        <td>${peso(product.price)}</td>
        <td>
          ${product.stock_quantity}
          ${low ? '<span class="badge bg-warning text-dark">Low</span>' : ''}
        </td>
        <td>
          <span class="badge ${product.is_active ? 'bg-success' : 'bg-secondary'}">
            ${product.is_active ? 'Active' : 'Inactive'}
          </span>
        </td>
        ${currentProfile.role === 'admin' ? `
          <td>
            <button class="btn btn-sm btn-outline-primary edit-product"
              data-id="${product.id}" title="Edit">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger delete-product"
              data-id="${product.id}" title="Delete">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        ` : ''}
      </tr>`;
  }).join('');

  document.querySelectorAll('.edit-product').forEach(button => {
    button.addEventListener('click', () => {
      const product = products.find(p => p.id === Number(button.dataset.id));
      if (product) showProductForm(product);
    });
  });

  document.querySelectorAll('.delete-product').forEach(button => {
    button.addEventListener('click', () => deleteProduct(Number(button.dataset.id)));
  });
}

function showProductForm(product = null) {
  editingId = product?.id ?? null;

  document.querySelector('#productFormArea').innerHTML = `
    <div class="content-card mb-4">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h5 class="card-heading mb-0">${product ? 'Edit Product' : 'Add New Product'}</h5>
        <button type="button" class="btn-close" id="closeProductForm"></button>
      </div>

      <form id="productForm">
        <div class="row g-3">
          <div class="col-12 col-md-6">
            <label class="form-label">Product Name *</label>
            <input class="form-control" name="name" required
              value="${esc(product?.name || '')}" placeholder="Product name">
          </div>

          <div class="col-12 col-md-6">
            <label class="form-label">SKU</label>
            <input class="form-control" name="sku"
              value="${esc(product?.sku || '')}" placeholder="Product SKU">
          </div>

          <div class="col-12 col-md-4">
            <label class="form-label">Product Type *</label>
            <select class="form-select" name="product_type" required>
              <option value="frame" ${product?.product_type === 'frame' ? 'selected' : ''}>Frame</option>
              <option value="lens" ${product?.product_type === 'lens' ? 'selected' : ''}>Lens</option>
              <option value="accessory" ${product?.product_type === 'accessory' ? 'selected' : ''}>Accessory</option>
            </select>
          </div>

          <div class="col-12 col-md-4">
            <label class="form-label">Category *</label>
            <div class="input-group">
              <select class="form-select" name="category_id" id="productCategory" required>
                ${renderCategoryOptions(product?.category_id)}
              </select>
              <button class="btn btn-outline-primary" type="button" id="addCategoryBtn" title="Add Category">
                <i class="bi bi-plus-lg"></i>
              </button>
            </div>
            <div id="newCategoryArea" class="mt-2" style="display:none">
              <div class="input-group">
                <input class="form-control" id="newCategoryName" maxlength="100" placeholder="Enter category name">
                <button class="btn btn-primary" type="button" id="saveCategoryBtn">Save</button>
                <button class="btn btn-light" type="button" id="cancelCategoryBtn">Cancel</button>
              </div>
            </div>
          </div>

          <div class="col-12 col-md-4">
            <label class="form-label">Barcode</label>
            <input class="form-control" name="barcode"
              value="${esc(product?.barcode || '')}">
          </div>

          <div class="col-12 col-md-4">
            <label class="form-label">Price (PHP) *</label>
            <input class="form-control" type="number" name="price"
              min="0" step="0.01" required value="${product?.price ?? ''}">
          </div>

          <div class="col-12 col-md-4">
            <label class="form-label">Stock Quantity *</label>
            <input class="form-control" type="number" name="stock_quantity"
              min="0" step="1" required value="${product?.stock_quantity ?? 0}">
          </div>

          <div class="col-12 col-md-4">
            <label class="form-label">Low Stock Threshold *</label>
            <input class="form-control" type="number" name="low_stock_threshold"
              min="0" step="1" required value="${product?.low_stock_threshold ?? 5}">
          </div>

          <div class="col-12">
            <label class="form-label">Image URL</label>
            <input class="form-control" type="url" name="image_url"
              value="${esc(product?.image_url || '')}"
              placeholder="https://example.com/product.jpg">
            <label class="form-label mt-3">Or Upload Product Image</label>
            <input class="form-control" type="file" name="image_file"
              accept="image/jpeg,image/png,image/webp">
            <small class="text-muted">JPG, PNG or WEBP. Maximum 10 MB.</small>
          </div>

          <div class="col-12">
            <label class="form-label">Description</label>
            <textarea class="form-control" name="description" rows="3">${esc(product?.description || '')}</textarea>
          </div>

          <div class="col-12">
            <label class="form-check-label">
              <input class="form-check-input" type="checkbox" name="is_active"
                ${product?.is_active !== false ? 'checked' : ''}>
              Active product (visible in customer catalog)
            </label>
          </div>

          <div class="col-12">
            <button class="btn btn-primary" type="submit">
              <i class="bi bi-save"></i> ${product ? 'Save Changes' : 'Add Product'}
            </button>
            <button class="btn btn-light" type="button" id="cancelProductForm">Cancel</button>
          </div>
        </div>
      </form>
    </div>
  `;

  document.querySelector('#closeProductForm').addEventListener('click', closeForm);
  document.querySelector('#cancelProductForm').addEventListener('click', closeForm);

  document.querySelector('#productForm').addEventListener('submit', saveProduct);

  document.querySelector('#addCategoryBtn').addEventListener('click', () => {
    const area = document.querySelector('#newCategoryArea');
    area.style.display = 'block';
    document.querySelector('#newCategoryName').focus();
  });

  document.querySelector('#saveCategoryBtn').addEventListener('click', saveNewCategory);

  document.querySelector('#cancelCategoryBtn').addEventListener('click', () => {
    document.querySelector('#newCategoryName').value = '';
    document.querySelector('#newCategoryArea').style.display = 'none';
  });

  document.querySelector('#newCategoryName').addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveNewCategory();
    }
  });

  document.querySelector('#productFormArea').scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
}

function renderCategoryOptions(selectedId = '') {
  return `
    <option value="">Select category</option>
    ${categories.map(c => `
      <option value="${c.id}" ${String(selectedId) === String(c.id) ? 'selected' : ''}>
        ${esc(c.name)}
      </option>
    `).join('')}
  `;
}

async function saveNewCategory() {
  const input = document.querySelector('#newCategoryName');
  const button = document.querySelector('#saveCategoryBtn');
  const name = input.value.trim();

  if (!name) {
    showMessage('Please enter a category name.', 'warning');
    input.focus();
    return;
  }

  if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
    showMessage('This category already exists.', 'warning');
    return;
  }

  button.disabled = true;
  button.textContent = 'Saving...';

  const { data, error } = await supabase
    .from('categories')
    .insert({ name })
    .select('id,name')
    .single();

  button.disabled = false;
  button.textContent = 'Save';

  if (error) {
    showMessage(error.message, 'danger');
    return;
  }

  categories.push(data);
  categories.sort((a, b) => a.name.localeCompare(b.name));

  document.querySelector('#productCategory').innerHTML =
    renderCategoryOptions(data.id);

  input.value = '';
  document.querySelector('#newCategoryArea').style.display = 'none';

  showMessage('Category added successfully. It is now selected.', 'success');
}

function closeForm() {
  editingId = null;
  document.querySelector('#productFormArea').innerHTML = '';
}

async function saveProduct(event) {
  event.preventDefault();

  const form = event.target;
  const button = form.querySelector('button[type="submit"]');
  const values = new FormData(form);
  const imageFile = values.get('image_file');

  if (imageFile && imageFile.size > 0) {
    if (imageFile.size > 10 * 1024 * 1024) {
      showMessage('Image must not exceed 10 MB.', 'danger');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(imageFile.type)) {
      showMessage('Please upload a JPG, PNG, or WEBP image.', 'danger');
      return;
    }
  }

  const product = {
    name: String(values.get('name')).trim(),
    sku: String(values.get('sku') || '').trim() || null,
    product_type: values.get('product_type'),
    category_id: values.get('category_id') ? Number(values.get('category_id')) : null,
    barcode: String(values.get('barcode') || '').trim() || null,
    price: Number(values.get('price')),
    stock_quantity: Number(values.get('stock_quantity')),
    low_stock_threshold: Number(values.get('low_stock_threshold')),
    image_url: String(values.get('image_url') || '').trim() || null,
    description: String(values.get('description') || '').trim() || null,
    is_active: values.get('is_active') === 'on'
  };

  if (!product.name || !product.category_id || product.price < 0 ||
      product.stock_quantity < 0 || product.low_stock_threshold < 0) {
    showMessage('Please enter the product name, select a category, and check the other product information.', 'danger');
    return;
  }

  button.disabled = true;
  button.textContent = 'Saving...';

  if (imageFile && imageFile.size > 0) {
    const safeName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `products/${Date.now()}-${safeName}`;

    const { data: uploaded, error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(filePath, imageFile, {
        contentType: imageFile.type,
        upsert: false
      });

    if (uploadError) {
      button.disabled = false;
      button.textContent = editingId ? 'Save Changes' : 'Add Product';
      showMessage(uploadError.message, 'danger');
      return;
    }

    const { data: publicUrl } = supabase.storage
      .from('product-images')
      .getPublicUrl(uploaded.path);

    product.image_url = publicUrl.publicUrl;
  }

  const result = editingId
    ? await supabase.from('products').update(product).eq('id', editingId)
    : await supabase.from('products').insert(product);

  button.disabled = false;

  if (result.error) {
    showMessage(result.error.message, 'danger');
    button.textContent = editingId ? 'Save Changes' : 'Add Product';
    return;
  }

  showMessage(editingId ? 'Product updated successfully.' : 'Product added successfully.', 'success');
  closeForm();
  await loadProducts();
}

async function deleteProduct(id) {
  const product = products.find(p => p.id === id);
  if (!product) return;

  if (!confirm(`Delete "${product.name}"? This action cannot be undone.`)) return;

  const { error } = await supabase.from('products').delete().eq('id', id);

  if (error) {
    showMessage(error.message, 'danger');
    return;
  }

  showMessage('Product deleted successfully.', 'success');
  await loadProducts();
}

function showMessage(message, type) {
  document.querySelector('#productMessage').innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show">
      ${esc(message)}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>`;
}
