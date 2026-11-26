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
let movements = [];
let monthMovements = [];

export async function renderInventory(profile, goDashboard) {
  app.innerHTML = `
    ${renderSidebar(profile, 'inventory')}

    <main class="main-content">
      <div class="topbar">
        <div>
          <button class="mobile-menu-btn" id="menuBtn">
            <i class="bi bi-list"></i>
          </button>
          <h1 class="page-title">Inventory Management</h1>
          <p class="page-subtitle">Monitor stock levels and product movements.</p>
        </div>
        <button class="btn btn-primary" id="stockActionBtn">
          <i class="bi bi-plus-lg"></i> Stock Action
        </button>
      </div>

      <div id="inventoryMessage"></div>

      <div class="row g-3 mb-4">
        <div class="col-12 col-sm-6 col-xl-3">
          <div class="stat-card">
            <div class="d-flex justify-content-between">
              <span class="stat-label">Total Products</span>
              <span class="stat-icon bg-primary-subtle text-primary">
                <i class="bi bi-box-seam"></i>
              </span>
            </div>
            <div class="stat-value" id="totalProducts">0</div>
            <small class="text-muted">Registered inventory items</small>
          </div>
        </div>

        <div class="col-12 col-sm-6 col-xl-3">
          <div class="stat-card">
            <div class="d-flex justify-content-between">
              <span class="stat-label">Total Stock Units</span>
              <span class="stat-icon bg-info-subtle text-info">
                <i class="bi bi-boxes"></i>
              </span>
            </div>
            <div class="stat-value" id="totalUnits">0</div>
            <small class="text-muted">Current stock quantity</small>
          </div>
        </div>

        <div class="col-12 col-sm-6 col-xl-3">
          <div class="stat-card">
            <div class="d-flex justify-content-between">
              <span class="stat-label">Low Stock</span>
              <span class="stat-icon bg-warning-subtle text-warning">
                <i class="bi bi-exclamation-triangle"></i>
              </span>
            </div>
            <div class="stat-value" id="lowStock">0</div>
            <small class="text-muted">At or below threshold</small>
          </div>
        </div>

        <div class="col-12 col-sm-6 col-xl-3">
          <div class="stat-card">
            <div class="d-flex justify-content-between">
              <span class="stat-label">Out of Stock</span>
              <span class="stat-icon bg-danger-subtle text-danger">
                <i class="bi bi-x-circle"></i>
              </span>
            </div>
            <div class="stat-value" id="outOfStock">0</div>
            <small class="text-muted">Items with zero stock</small>
          </div>
        </div>
      </div>

      <div class="row g-3 mb-4">
        <div class="col-12 col-md-6">
          <div class="content-card">
            <h5 class="card-heading">Stock Received This Month</h5>
            <div class="today-value text-success" id="monthlyStockIn">0</div>
            <small class="text-muted">Units added to inventory</small>
          </div>
        </div>
        <div class="col-12 col-md-6">
          <div class="content-card">
            <h5 class="card-heading">Stock Released This Month</h5>
            <div class="today-value text-danger" id="monthlyStockOut">0</div>
            <small class="text-muted">Units removed from inventory</small>
          </div>
        </div>
      </div>

      <div class="content-card mb-4" id="stockFormArea" style="display:none">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h5 class="card-heading mb-0">Record Stock Movement</h5>
          <button class="btn-close" id="closeStockForm"></button>
        </div>

        <form id="stockForm">
          <div class="row g-3">
            <div class="col-12 col-md-6">
              <label class="form-label">Product *</label>
              <select class="form-select" name="product_id" id="stockProduct" required>
                <option value="">Select product</option>
              </select>
            </div>

            <div class="col-12 col-md-6">
              <label class="form-label">Movement Type *</label>
              <select class="form-select" name="movement_type" id="movementType" required>
                <option value="stock_in">Stock In</option>
                <option value="stock_out">Stock Out</option>
                <option value="adjustment">Stock Adjustment</option>
              </select>
            </div>

            <div class="col-12 col-md-6">
              <label class="form-label" id="quantityLabel">Quantity *</label>
              <input class="form-control" type="number" name="quantity"
                id="movementQuantity" min="1" step="1" required>
              <small class="text-muted" id="quantityHelp">Enter the quantity to add.</small>
            </div>

            <div class="col-12 col-md-6">
              <label class="form-label">Reason *</label>
              <input class="form-control" name="reason" required
                maxlength="250" placeholder="e.g. New supplier delivery">
            </div>

            <div class="col-12">
              <button class="btn btn-primary" type="submit">
                <i class="bi bi-save"></i> Save Stock Movement
              </button>
              <button class="btn btn-light" type="button" id="cancelStockForm">Cancel</button>
            </div>
          </div>
        </form>
      </div>

      <div class="content-card mb-4">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
          <div>
            <h5 class="card-heading mb-1">Current Stock</h5>
            <small class="text-muted">Monitor quantities and stock status.</small>
          </div>
          <button class="btn btn-outline-secondary btn-sm" id="refreshInventory">
            <i class="bi bi-arrow-clockwise"></i> Refresh
          </button>
        </div>

        <div class="row g-2 mb-3">
          <div class="col-12 col-md-7">
            <input class="form-control" id="inventorySearch"
              placeholder="Search product name or SKU...">
          </div>
          <div class="col-12 col-md-5">
            <select class="form-select" id="stockFilter">
              <option value="all">All Stock Status</option>
              <option value="low">Low Stock</option>
              <option value="out">Out of Stock</option>
              <option value="normal">Normal Stock</option>
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
                <th>Stock</th>
                <th>Threshold</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="inventoryTable">
              <tr><td colspan="6" class="text-center">Loading inventory...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="content-card">
        <h5 class="card-heading">Recent Stock Movements</h5>
        <small class="text-muted">Latest 20 inventory transactions.</small>
        <div class="table-responsive mt-3">
          <table class="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Movement</th>
                <th>Quantity Change</th>
                <th>Reason</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody id="movementTable">
              <tr><td colspan="5" class="text-center">Loading movements...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  `;

  bindSidebar(page => goDashboard(page));

  document.querySelector('#stockActionBtn').addEventListener('click', openStockForm);
  document.querySelector('#closeStockForm').addEventListener('click', closeStockForm);
  document.querySelector('#cancelStockForm').addEventListener('click', closeStockForm);
  document.querySelector('#refreshInventory').addEventListener('click', loadInventory);
  document.querySelector('#inventorySearch').addEventListener('input', renderInventoryTable);
  document.querySelector('#stockFilter').addEventListener('change', renderInventoryTable);
  document.querySelector('#movementType').addEventListener('change', updateQuantityLabel);
  document.querySelector('#stockForm').addEventListener('submit', saveMovement);

  await loadInventory();
}

async function loadInventory() {
  showMessage('', '');

  const [productResult, movementResult] = await Promise.all([
    supabase.from('products')
      .select('id,name,sku,product_type,category:categories(name),stock_quantity,low_stock_threshold,is_active')
      .order('name'),
    supabase.from('inventory_movements')
      .select('id,product_id,movement_type,quantity,reason,created_at')
      .order('created_at', { ascending: false })
      .limit(20)
  ]);

  if (productResult.error) {
    showMessage(productResult.error.message, 'danger');
    return;
  }

  if (movementResult.error) {
    showMessage(movementResult.error.message, 'danger');
    return;
  }

  products = productResult.data || [];
  movements = movementResult.data || [];

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const monthlyResult = await supabase.from('inventory_movements')
    .select('movement_type,quantity')
    .gte('created_at', monthStart.toISOString())
    .lt('created_at', nextMonth.toISOString());

  if (monthlyResult.error) {
    showMessage(monthlyResult.error.message, 'danger');
    return;
  }

  monthMovements = monthlyResult.data || [];
  renderOverview();
  renderProductOptions();
  renderInventoryTable();
  renderMovementTable();
}

function renderOverview() {
  const low = products.filter(p =>
    Number(p.stock_quantity) > 0 &&
    Number(p.stock_quantity) <= Number(p.low_stock_threshold)
  );

  const out = products.filter(p => Number(p.stock_quantity) <= 0);
  const total = products.reduce((sum, p) => sum + Number(p.stock_quantity || 0), 0);

  const added = monthMovements
    .filter(m => m.movement_type === 'stock_in')
    .reduce((sum, m) => sum + Number(m.quantity || 0), 0);

  const removed = monthMovements
    .filter(m => m.movement_type === 'stock_out')
    .reduce((sum, m) => sum + Math.abs(Number(m.quantity || 0)), 0);

  document.querySelector('#totalProducts').textContent = products.length;
  document.querySelector('#totalUnits').textContent = total.toLocaleString('en-PH');
  document.querySelector('#lowStock').textContent = low.length;
  document.querySelector('#outOfStock').textContent = out.length;
  document.querySelector('#monthlyStockIn').textContent = added.toLocaleString('en-PH');
  document.querySelector('#monthlyStockOut').textContent = removed.toLocaleString('en-PH');
}

function renderProductOptions() {
  const select = document.querySelector('#stockProduct');
  select.innerHTML = '<option value="">Select product</option>' +
    products.map(p => `
      <option value="${p.id}">
        ${esc(p.name)} — Current stock: ${p.stock_quantity}
      </option>
    `).join('');
}

function renderInventoryTable() {
  const search = document.querySelector('#inventorySearch').value.toLowerCase();
  const filter = document.querySelector('#stockFilter').value;

  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search) ||
      String(p.sku || '').toLowerCase().includes(search);

    const stock = Number(p.stock_quantity);
    const threshold = Number(p.low_stock_threshold);

    const status = stock <= 0 ? 'out' : stock <= threshold ? 'low' : 'normal';

    return matchesSearch && (filter === 'all' || filter === status);
  });

  const tbody = document.querySelector('#inventoryTable');

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No matching products found.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const stock = Number(p.stock_quantity);
    const threshold = Number(p.low_stock_threshold);
    const status = stock <= 0
      ? '<span class="badge bg-danger">Out of Stock</span>'
      : stock <= threshold
        ? '<span class="badge bg-warning text-dark">Low Stock</span>'
        : '<span class="badge bg-success">Normal</span>';

    return `
      <tr>
        <td>
          <strong>${esc(p.name)}</strong>
          <div class="small text-muted">${esc(p.sku || 'No SKU')}</div>
        </td>
        <td>${esc(p.category?.name || "Uncategorized")}</td>
        <td>${esc(p.product_type)}</td>
        <td class="text-nowrap"><strong>${stock}</strong></td>
        <td class="text-nowrap">${threshold}</td>
        <td>${status}</td>
      </tr>
    `;
  }).join('');
}

function renderMovementTable() {
  const tbody = document.querySelector('#movementTable');

  if (!movements.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No stock movements recorded yet.</td></tr>';
    return;
  }

  tbody.innerHTML = movements.map(m => {
    const product = products.find(p => p.id === m.product_id);
    const type = {
      stock_in: 'Stock In',
      stock_out: 'Stock Out',
      adjustment_in: 'Adjustment (Increase)',
      adjustment_out: 'Adjustment (Decrease)',
      adjustment: 'Adjustment'
    }[m.movement_type] || m.movement_type;

    const quantity = Number(m.quantity);
    const isIncrease = ['stock_in', 'adjustment_in'].includes(m.movement_type);
    const display = `${isIncrease ? '+' : '−'}${quantity}`;
    const color = isIncrease ? 'text-success' : 'text-danger';

    return `
      <tr>
        <td>${esc(product?.name || `Product #${m.product_id}`)}</td>
        <td>${esc(type)}</td>
        <td class="${color} fw-semibold">${display}</td>
        <td>${esc(m.reason)}</td>
        <td>${new Date(m.created_at).toLocaleString('en-PH')}</td>
      </tr>
    `;
  }).join('');
}

function openStockForm() {
  if (!products.length) {
    showMessage('Add a product before recording stock movements.', 'warning');
    return;
  }

  document.querySelector('#stockFormArea').style.display = 'block';
  document.querySelector('#stockFormArea').scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
}

function closeStockForm() {
  document.querySelector('#stockForm').reset();
  document.querySelector('#stockFormArea').style.display = 'none';
  updateQuantityLabel();
}

function updateQuantityLabel() {
  const type = document.querySelector('#movementType').value;
  const label = document.querySelector('#quantityLabel');
  const help = document.querySelector('#quantityHelp');
  const input = document.querySelector('#movementQuantity');

  if (type === 'adjustment') {
    label.textContent = 'Actual Stock Quantity *';
    help.textContent = 'Enter the new total stock quantity.';
    input.min = '0';
  } else if (type === 'stock_out') {
    label.textContent = 'Quantity to Remove *';
    help.textContent = 'Enter the quantity to release.';
    input.min = '1';
  } else {
    label.textContent = 'Quantity to Add *';
    help.textContent = 'Enter the quantity received.';
    input.min = '1';
  }
}

async function saveMovement(event) {
  event.preventDefault();

  const form = event.target;
  const button = form.querySelector('button[type="submit"]');
  const values = new FormData(form);

  const productId = Number(values.get('product_id'));
  const type = values.get('movement_type');
  const quantity = Number(values.get('quantity'));
  const reason = String(values.get('reason') || '').trim();

  if (!productId || !reason || !Number.isInteger(quantity) ||
      quantity < (type === 'adjustment' ? 0 : 1)) {
    showMessage('Please check the stock movement information.', 'danger');
    return;
  }

  button.disabled = true;
  button.textContent = 'Saving...';

  const { error } = await supabase.rpc('record_inventory_movement', {
    p_product_id: productId,
    p_movement_type: type,
    p_quantity: quantity,
    p_reason: reason
  });

  button.disabled = false;
  button.innerHTML = '<i class="bi bi-save"></i> Save Stock Movement';

  if (error) {
    showMessage(error.message, 'danger');
    return;
  }

  closeStockForm();
  showMessage('Stock movement recorded successfully.', 'success');
  await loadInventory();
}

function showMessage(message, type) {
  const target = document.querySelector('#inventoryMessage');
  if (!target) return;

  target.innerHTML = message
    ? `<div class="alert alert-${type} alert-dismissible fade show">
         ${esc(message)}
         <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
       </div>`
    : '';
}
