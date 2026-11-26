import { supabase } from '../supabase.js';
import { renderSidebar, bindSidebar } from '../components/sidebar.js';

const app = document.querySelector('#app');

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[c]);

const peso = value => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP'
}).format(Number(value || 0));

let customers = [];
let editingId = null;

export async function renderCustomers(profile, navigate) {
  editingId = null;

  app.innerHTML = `
    ${renderSidebar(profile, 'customers')}

    <main class="main-content">
      <div class="topbar">
        <div>
          <button class="mobile-menu-btn" id="menuBtn">
            <i class="bi bi-list"></i>
          </button>
          <h1 class="page-title">Customers Management</h1>
          <p class="page-subtitle">Manage customer information and purchase history.</p>
        </div>
      </div>

      <div id="customerMessage"></div>

      <div class="row g-3 mb-4">
        <div class="col-12 col-md-4">
          <div class="stat-card">
            <span class="stat-label">Total Customers</span>
            <div class="stat-value" id="totalCustomers">0</div>
            <small class="text-muted">Registered customers</small>
          </div>
        </div>
        <div class="col-12 col-md-4">
          <div class="stat-card">
            <span class="stat-label">Customers With Orders</span>
            <div class="stat-value" id="customersWithOrders">0</div>
            <small class="text-muted">Customers who have purchased</small>
          </div>
        </div>
        <div class="col-12 col-md-4">
          <div class="stat-card">
            <span class="stat-label">New This Month</span>
            <div class="stat-value" id="newCustomers">0</div>
            <small class="text-muted">Recently registered</small>
          </div>
        </div>
      </div>

      <div class="content-card mb-4">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-3">
          <div>
            <h5 class="card-heading mb-1">Customer Directory</h5>
            <small class="text-muted">View and manage your clinic customers.</small>
          </div>
          <button class="btn btn-primary" id="addCustomerBtn">
            <i class="bi bi-person-plus"></i> Add Customer
          </button>
        </div>
      </div>

      <div id="customerFormArea"></div>
      <div id="customerDetailsArea"></div>

      <div class="content-card">
        <div class="row g-2 mb-3">
          <div class="col-12 col-md-8">
            <input
              id="customerSearch"
              class="form-control"
              placeholder="Search name, phone, or email..."
            >
          </div>
          <div class="col-12 col-md-4">
            <button class="btn btn-outline-secondary w-100" id="refreshCustomers">
              <i class="bi bi-arrow-clockwise"></i> Refresh
            </button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="table align-middle">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Registered</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="customersTable">
              <tr>
                <td colspan="5" class="text-center py-4">Loading customers...</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="small text-muted" id="customerCount"></div>
      </div>
    </main>
  `;

  bindSidebar(page => navigate(page));

  document.querySelector('#addCustomerBtn').addEventListener('click', () => {
    showCustomerForm();
  });

  document.querySelector('#customerSearch').addEventListener('input', renderTable);
  document.querySelector('#refreshCustomers').addEventListener('click', loadCustomers);

  await loadCustomers();
}

async function loadCustomers() {
  showMessage('', '');

  const tbody = document.querySelector('#customersTable');
  tbody.innerHTML = `
    <tr><td colspan="5" class="text-center py-4">Loading customers...</td></tr>
  `;

  const { data, error } = await supabase
    .from('customers')
    .select('id,full_name,phone,email,address,created_at')
    .order('created_at', { ascending: false });

  if (error) {
    showMessage(error.message, 'danger');
    tbody.innerHTML = `
      <tr><td colspan="5" class="text-center text-danger py-4">
        Unable to load customers.
      </td></tr>
    `;
    return;
  }

  customers = data || [];
  updateStats();
  renderTable();
}

function updateStats() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const newThisMonth = customers.filter(customer =>
    customer.created_at && new Date(customer.created_at) >= monthStart
  ).length;

  document.querySelector('#totalCustomers').textContent = customers.length;
  document.querySelector('#newCustomers').textContent = newThisMonth;

  supabase
    .from('orders')
    .select('customer_id')
    .then(({ data, error }) => {
      if (error) {
        document.querySelector('#customersWithOrders').textContent = '—';
        return;
      }

      const ids = new Set((data || []).map(order => order.customer_id));
      document.querySelector('#customersWithOrders').textContent =
        customers.filter(customer => ids.has(customer.id)).length;
    });
}

function renderTable() {
  const search = document.querySelector('#customerSearch').value
    .trim()
    .toLowerCase();

  const filtered = customers.filter(customer => {
    return [
      customer.full_name,
      customer.phone,
      customer.email
    ].some(value => String(value || '').toLowerCase().includes(search));
  });

  const tbody = document.querySelector('#customersTable');

  document.querySelector('#customerCount').textContent =
    `Showing ${filtered.length} of ${customers.length} customers`;

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-5">
          <div class="empty-state">
            <i class="bi bi-people"></i>
            <p>${customers.length ? 'No matching customers found.' : 'No customers registered yet.'}</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(customer => `
    <tr>
      <td>
        <div class="d-flex align-items-center gap-2">
          <div class="rounded-circle bg-primary-subtle text-primary d-flex align-items-center justify-content-center"
               style="width:38px;height:38px;flex-shrink:0;">
            <i class="bi bi-person"></i>
          </div>
          <strong>${esc(customer.full_name)}</strong>
        </div>
      </td>
      <td>${esc(customer.phone || '—')}</td>
      <td>${esc(customer.email || '—')}</td>
      <td>${customer.created_at ? new Date(customer.created_at).toLocaleDateString('en-PH') : '—'}</td>
      <td>
        <div class="d-flex gap-1">
          <button class="btn btn-sm btn-outline-primary view-customer"
            data-id="${customer.id}" title="View details">
            <i class="bi bi-eye"></i>
          </button>
          <button class="btn btn-sm btn-outline-secondary edit-customer"
            data-id="${customer.id}" title="Edit customer">
            <i class="bi bi-pencil"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  document.querySelectorAll('.view-customer').forEach(button => {
    button.addEventListener('click', () => {
      const customer = customers.find(c => c.id === Number(button.dataset.id));
      if (customer) viewCustomer(customer);
    });
  });

  document.querySelectorAll('.edit-customer').forEach(button => {
    button.addEventListener('click', () => {
      const customer = customers.find(c => c.id === Number(button.dataset.id));
      if (customer) showCustomerForm(customer);
    });
  });
}

function showCustomerForm(customer = null) {
  editingId = customer?.id ?? null;

  document.querySelector('#customerDetailsArea').innerHTML = '';

  document.querySelector('#customerFormArea').innerHTML = `
    <div class="content-card mb-4">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h5 class="card-heading mb-1">
            ${customer ? 'Edit Customer' : 'Register New Customer'}
          </h5>
          <small class="text-muted">Fields marked with * are required.</small>
        </div>
        <button class="btn-close" id="closeCustomerForm" type="button"></button>
      </div>

      <form id="customerForm">
        <div class="row g-3">
          <div class="col-12 col-md-6">
            <label class="form-label">Full Name *</label>
            <input class="form-control" name="full_name" required maxlength="150"
              value="${esc(customer?.full_name || '')}"
              placeholder="Enter customer's full name">
          </div>

          <div class="col-12 col-md-6">
            <label class="form-label">Phone Number</label>
            <input class="form-control" name="phone" type="tel" maxlength="30"
              value="${esc(customer?.phone || '')}"
              placeholder="Enter phone number">
          </div>

          <div class="col-12 col-md-6">
            <label class="form-label">Email Address</label>
            <input class="form-control" name="email" type="email" maxlength="254"
              value="${esc(customer?.email || '')}"
              placeholder="Enter email address">
          </div>

          <div class="col-12 col-md-6">
            <label class="form-label">Address</label>
            <input class="form-control" name="address" maxlength="250"
              value="${esc(customer?.address || '')}"
              placeholder="Enter complete address">
          </div>
        </div>

        <div class="d-flex flex-wrap gap-2 mt-4">
          <button class="btn btn-primary" type="submit" id="saveCustomerBtn">
            <i class="bi bi-check-lg"></i>
            ${customer ? 'Save Changes' : 'Register Customer'}
          </button>
          <button class="btn btn-outline-secondary" type="button" id="cancelCustomerForm">
            Cancel
          </button>
        </div>
      </form>
    </div>
  `;

  document.querySelector('#closeCustomerForm').addEventListener('click', closeCustomerForm);
  document.querySelector('#cancelCustomerForm').addEventListener('click', closeCustomerForm);
  document.querySelector('#customerForm').addEventListener('submit', saveCustomer);

  document.querySelector('#customerFormArea').scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
}

async function saveCustomer(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const button = document.querySelector('#saveCustomerBtn');
  const values = Object.fromEntries(new FormData(form).entries());

  values.full_name = values.full_name.trim();
  values.phone = values.phone.trim() || null;
  values.email = values.email.trim() || null;
  values.address = values.address.trim() || null;

  if (!values.full_name) {
    showMessage('Customer name is required.', 'danger');
    return;
  }

  button.disabled = true;
  button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

  let result;

  if (editingId) {
    result = await supabase
      .from('customers')
      .update(values)
      .eq('id', editingId);
  } else {
    result = await supabase
      .from('customers')
      .insert(values);
  }

  if (result.error) {
    showMessage(result.error.message, 'danger');
    button.disabled = false;
    button.innerHTML = editingId ? 'Save Changes' : 'Register Customer';
    return;
  }

  closeCustomerForm();
  showMessage(
    editingId ? 'Customer information updated successfully.' : 'Customer registered successfully.',
    'success'
  );

  editingId = null;
  await loadCustomers();
}

function closeCustomerForm() {
  editingId = null;
  document.querySelector('#customerFormArea').innerHTML = '';
}

async function viewCustomer(customer) {
  closeCustomerForm();

  const area = document.querySelector('#customerDetailsArea');

  area.innerHTML = `
    <div class="content-card mb-4">
      <div class="text-center py-4">
        <div class="rounded-circle bg-primary-subtle text-primary d-inline-flex align-items-center justify-content-center"
             style="width:64px;height:64px;font-size:26px;">
          <i class="bi bi-person"></i>
        </div>
        <h4 class="mt-3 mb-1">${esc(customer.full_name)}</h4>
        <p class="text-muted mb-0">Customer #${customer.id}</p>
      </div>

      <div class="row g-3 border-top pt-3">
        <div class="col-12 col-md-4">
          <small class="text-muted d-block">Phone</small>
          <strong>${esc(customer.phone || 'Not provided')}</strong>
        </div>
        <div class="col-12 col-md-4">
          <small class="text-muted d-block">Email</small>
          <strong>${esc(customer.email || 'Not provided')}</strong>
        </div>
        <div class="col-12 col-md-4">
          <small class="text-muted d-block">Registered</small>
          <strong>${customer.created_at ? new Date(customer.created_at).toLocaleDateString('en-PH') : '—'}</strong>
        </div>
        <div class="col-12">
          <small class="text-muted d-block">Address</small>
          <strong>${esc(customer.address || 'Not provided')}</strong>
        </div>
      </div>

      <hr>
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <h5 class="card-heading mb-0">Order History</h5>
        <button class="btn btn-sm btn-outline-secondary" id="closeCustomerDetails">
          <i class="bi bi-x-lg"></i> Close
        </button>
      </div>

      <div id="customerOrders" class="mt-3">
        <div class="text-center text-muted py-3">
          <span class="spinner-border spinner-border-sm me-2"></span>
          Loading order history...
        </div>
      </div>
    </div>
  `;

  document.querySelector('#closeCustomerDetails').addEventListener('click', () => {
    area.innerHTML = '';
  });

  area.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id,order_number,status,subtotal,discount,total,created_at')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false });

  const ordersArea = document.querySelector('#customerOrders');

  if (!ordersArea) return;

  if (error) {
    ordersArea.innerHTML = `
      <div class="alert alert-danger mb-0">
        Unable to load order history: ${esc(error.message)}
      </div>
    `;
    return;
  }

  if (!orders?.length) {
    ordersArea.innerHTML = `
      <div class="empty-state py-4">
        <i class="bi bi-receipt"></i>
        <p>No orders recorded for this customer yet.</p>
      </div>
    `;
    return;
  }

  ordersArea.innerHTML = `
    <div class="table-responsive">
      <table class="table align-middle">
        <thead>
          <tr>
            <th>Order No.</th>
            <th>Date</th>
            <th>Status</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${orders.map(order => `
            <tr>
              <td><strong>${esc(order.order_number || '#' + order.id)}</strong></td>
              <td>${order.created_at ? new Date(order.created_at).toLocaleDateString('en-PH') : '—'}</td>
              <td><span class="badge bg-secondary">${esc(order.status || 'Pending')}</span></td>
              <td>${peso(order.total)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div class="text-end fw-semibold">
      ${orders.length} order${orders.length === 1 ? '' : 's'} found
    </div>
  `;
}

function showMessage(message, type) {
  const area = document.querySelector('#customerMessage');
  if (!area) return;

  area.innerHTML = message
    ? `<div class="alert alert-${type} alert-dismissible fade show" role="alert">
         ${esc(message)}
         <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
       </div>`
    : '';
}
