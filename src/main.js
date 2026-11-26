import './style.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { supabase } from './js/supabase.js';
import { renderLogin } from './js/pages/login.js';
import { renderProducts } from './js/pages/products.js';
import { renderInventory } from './js/pages/inventory.js';
import { renderCustomers } from './js/pages/customers.js';
import { renderOrders } from './js/pages/orders.js';
import { renderRepairs } from './js/pages/repairs.js';
import { renderReports } from './js/pages/reports.js';
import { renderStaff } from './js/pages/staff.js';
import { renderSidebar, bindSidebar } from './js/components/sidebar.js';

const app = document.querySelector('#app');

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[c]);

const money = value => new Intl.NumberFormat('en-PH', {
  style: 'currency', currency: 'PHP'
}).format(Number(value || 0));

function showError(message) {
  app.innerHTML = `
    <div class="container py-5">
      <div class="alert alert-danger">
        <h4>Dashboard Error</h4>
        <p>${escapeHtml(message)}</p>
        <button onclick="location.reload()" class="btn btn-primary">Retry</button>
      </div>
    </div>`;
}

async function getDashboardData() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const results = await Promise.all([
    supabase.from('products').select('id', { count: 'exact', head: true }),
    supabase.from('customers').select('id', { count: 'exact', head: true }),
    supabase.from('orders').select('id', { count: 'exact', head: true }),
    supabase.from('products').select('stock_quantity,low_stock_threshold'),
    supabase.from('orders').select('total')
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString()),
    supabase.from('orders')
      .select('id,order_number,status,total,created_at')
      .order('created_at', { ascending: false })
      .limit(5)
  ]);


  const names = [
    'Products Count',
    'Customers Count',
    'Orders Count',
    'Stock Data',
    'Today Orders',
    'Recent Orders'
  ];

  const failures = results
    .map((r, i) => {
      if (!r.error) return null;

      const e = r.error;

      return {
        query: names[i],
        name: e.name,
        message: e.message,
        code: e.code,
        details: e.details,
        hint: e.hint,
        status: e.status,
        statusText: e.statusText,
        raw: String(e)
      };
    })
    .filter(Boolean);

  if (failures.length) {
    throw new Error(JSON.stringify(failures, null, 2));
  }


  return {
    products: results[0].count || 0,
    customers: results[1].count || 0,
    orders: results[2].count || 0,
    lowStock: results[3].data.filter(p =>
      Number(p.stock_quantity) <= Number(p.low_stock_threshold)
    ).length,
    todayValue: results[4].data.reduce((sum, o) => sum + Number(o.total || 0), 0),
    recent: results[5].data
  };
}

function renderDashboard(profile, data) {
  app.innerHTML = `
    ${renderSidebar(profile, 'dashboard')}

    <main class="main-content">
      <div class="topbar">
        <div>
          <button class="mobile-menu-btn" id="menuBtn"><i class="bi bi-list"></i></button>
          <h1 class="page-title">Dashboard</h1>
          <p class="page-subtitle">Welcome back, ${escapeHtml(profile.full_name)}! Here's your clinic overview.</p>
        </div>
        <button id="logoutBtn" class="btn btn-outline-danger">
          <i class="bi bi-box-arrow-right"></i> Logout
        </button>
      </div>

      <div class="row g-3 mb-4">
        ${[
          ['Total Products', data.products, 'bi-box-seam', 'primary'],
          ['Total Customers', data.customers, 'bi-people', 'success'],
          ['Total Orders', data.orders, 'bi-receipt', 'info'],
          ['Low Stock', data.lowStock, 'bi-exclamation-triangle', 'warning']
        ].map(([label, value, icon, color]) => `
          <div class="col-12 col-sm-6 col-xl-3">
            <div class="stat-card">
              <div class="d-flex justify-content-between">
                <span class="stat-label">${label}</span>
                <span class="stat-icon bg-${color}-subtle text-${color}">
                  <i class="bi ${icon}"></i>
                </span>
              </div>
              <div class="stat-value">${value}</div>
              <small class="text-muted">${label === 'Low Stock' ? 'At or below stock threshold' : 'Current registered records'}</small>
            </div>
          </div>`).join('')}
      </div>

      <div class="row g-3">
        <div class="col-12 col-lg-4">
          <div class="content-card">
            <h5 class="card-heading">Today's Order Value</h5>
            <div class="today-value">${money(data.todayValue)}</div>
            <p class="text-muted mb-0">Orders created today, not confirmed payments.</p>
          </div>
        </div>
        <div class="col-12 col-lg-8">
          <div class="content-card">
            <h5 class="card-heading">Recent Orders</h5>
            ${data.recent.length ? `
              <div class="table-responsive">
                <table class="table">
                  <thead><tr><th>Order No.</th><th>Status</th><th>Total</th><th>Date</th></tr></thead>
                  <tbody>${data.recent.map(o => `
                    <tr>
                      <td>${escapeHtml(o.order_number || '#' + o.id)}</td>
                      <td><span class="badge bg-secondary-subtle text-secondary">${escapeHtml(o.status)}</span></td>
                      <td>${money(o.total)}</td>
                      <td>${new Date(o.created_at).toLocaleDateString('en-PH')}</td>
                    </tr>`).join('')}
                  </tbody>
                </table>
              </div>` : '<div class="empty-state"><i class="bi bi-receipt"></i><p>No orders recorded yet.</p></div>'}
          </div>
        </div>
      </div>
    </main>`;

  document.querySelector('#logoutBtn').addEventListener('click', async () => {
    const button = document.querySelector('#logoutBtn');
    button.disabled = true;
    const { error } = await supabase.auth.signOut();
    if (error) {
      alert(error.message);
      button.disabled = false;
      return;
    }
    location.reload();
  });

  bindSidebar(page => navigateToPage(page, profile));
}

function renderComingSoon(profile, page) {
  const pages = {
    customers: ['Customers', 'people'],
    orders: ['Orders', 'receipt'],
    repairs: ['Frame Repairs', 'tools'],
    reports: ['Sales & Reports', 'bar-chart'],
  };

  const [title, icon] = pages[page] || ['Page', 'grid'];

  app.innerHTML = `
    ${renderSidebar(profile, page)}
    <main class="main-content">
      <div class="topbar">
        <div>
          <button class="mobile-menu-btn" id="menuBtn">
            <i class="bi bi-list"></i>
          </button>
          <h1 class="page-title">${title}</h1>
          <p class="page-subtitle">EYE-VIEW Optical Clinic Management</p>
        </div>
      </div>

      <div class="content-card text-center py-5">
        <i class="bi bi-${icon} display-3 text-primary"></i>
        <h4 class="mt-3">${title} is coming soon</h4>
        <p class="text-muted">This section is not available yet. We're building it for the clinic.</p>
        <button class="btn btn-primary" id="backDashboard">
          <i class="bi bi-house"></i> Back to Dashboard
        </button>
      </div>
    </main>
  `;

  document.querySelector('#backDashboard').addEventListener('click', () => {
    navigateToPage('dashboard', profile);
  });

  bindSidebar(page => navigateToPage(page, profile));
}

async function navigateToPage(page, profile) {
  if (page === 'dashboard') {
    const data = await getDashboardData();
    renderDashboard(profile, data);
    return;
  }

  if (page === 'products') {
    await renderProducts(profile, nextPage => navigateToPage(nextPage, profile));
    return;
  }

  if (page === 'inventory') {
    await renderInventory(profile, nextPage => navigateToPage(nextPage, profile));
    return;
  }

  if (page === 'customers') {
    await renderCustomers(profile, nextPage => navigateToPage(nextPage, profile));
    return;
  }

  if (page === 'orders') {
    await renderOrders(profile, nextPage => navigateToPage(nextPage, profile));
    return;
  }

  if (page === 'repairs') {
    await renderRepairs(profile, nextPage => navigateToPage(nextPage, profile));
    return;
  }

  if (page === 'reports') {
    await renderReports(profile, nextPage => navigateToPage(nextPage, profile));
    return;
  }

  if (page === 'staff') {
    if (profile.role !== 'admin') return;
    await renderStaff(profile, nextPage => navigateToPage(nextPage, profile));
    return;
  }

  renderComingSoon(profile, page);
}

async function startApp() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;

    if (!data.session) {
      renderLogin();
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id,full_name,role')
      .eq('id', data.session.user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    if (!profile) {
      await supabase.auth.signOut();
      renderLogin();
      return;
    }

    const dashboard = await getDashboardData();
    renderDashboard(profile, dashboard);
  } catch (error) {
    console.error('EYE-VIEW DEBUG ERROR:', error);
    const details = [
      error?.name,
      error?.message,
      error?.code,
      error?.details,
      error?.hint,
      error?.stack
    ].filter(Boolean).join('\n');
    showError(error.message || String(error));
  }
}

startApp();
