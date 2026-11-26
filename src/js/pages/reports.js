import { supabase } from '../supabase.js';
import { renderSidebar, bindSidebar } from '../components/sidebar.js';
import Chart from 'chart.js/auto';

const app = document.querySelector('#app');

const money = value => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP'
}).format(Number(value || 0));

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[c]);

let salesChart = null;

function getRange(period) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (period === 'daily') {
    return { start, end: now };
  }

  if (period === 'weekly') {
    const day = start.getDay();
    start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
    return { start, end: now };
  }

  start.setDate(1);
  return { start, end: now };
}

function isWithin(date, range) {
  const value = new Date(date);
  return value >= range.start && value <= range.end;
}

export async function renderReports(profile, navigate) {
  let orders = [];
  let items = [];
  let products = [];
  let movements = [];
  let period = 'monthly';

  async function loadData() {
    const results = await Promise.all([
      supabase.from('orders')
        .select('id,order_number,status,total,subtotal,discount,created_at')
        .order('created_at', { ascending: false }),
      supabase.from('order_items')
        .select('order_id,product_id,product_name,quantity,unit_price,line_total'),
      supabase.from('products')
        .select('id,name,sku,stock_quantity,low_stock_threshold,is_active')
        .order('name'),
      supabase.from('inventory_movements')
        .select('product_id,movement_type,quantity,created_at,reason')
        .order('created_at', { ascending: false })
    ]);

    const error = results.find(result => result.error)?.error;
    if (error) throw error;

    orders = results[0].data || [];
    items = results[1].data || [];
    products = results[2].data || [];
    movements = results[3].data || [];
  }

  function getMonthlySales() {
    const labels = [];
    const values = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth();

      labels.push(date.toLocaleDateString('en-PH', {
        month: 'short',
        year: 'numeric'
      }));

      const total = orders
        .filter(o => {
          const d = new Date(o.created_at);
          return o.status === 'completed' &&
            d.getFullYear() === year &&
            d.getMonth() === month;
        })
        .reduce((sum, o) => sum + Number(o.total || 0), 0);

      values.push(total);
    }

    return { labels, values };
  }

  function renderPage() {
    const range = getRange(period);
    const periodOrders = orders.filter(o => isWithin(o.created_at, range));
    const completed = periodOrders.filter(o => o.status === 'completed');
    const pending = periodOrders.filter(o =>
      ['pending', 'processing', 'ready'].includes(o.status)
    );

    const salesTotal = completed.reduce(
      (sum, o) => sum + Number(o.total || 0), 0
    );

    const stockUnits = products.reduce(
      (sum, p) => sum + Number(p.stock_quantity || 0), 0
    );

    const lowStock = products.filter(p =>
      Number(p.stock_quantity) > 0 &&
      Number(p.stock_quantity) <= Number(p.low_stock_threshold)
    );

    const outOfStock = products.filter(p =>
      Number(p.stock_quantity) <= 0
    );

    const periodMovements = movements.filter(m =>
      isWithin(m.created_at, range)
    );

    const stockIn = periodMovements
      .filter(m => m.movement_type === 'stock_in')
      .reduce((sum, m) => sum + Number(m.quantity || 0), 0);

    const stockOut = periodMovements
      .filter(m => m.movement_type === 'stock_out')
      .reduce((sum, m) => sum + Number(m.quantity || 0), 0);

    const completedIds = new Set(completed.map(o => o.id));

    const bestSelling = {};

    items.filter(item => completedIds.has(item.order_id)).forEach(item => {
      const key = item.product_id ?? item.product_name;

      if (!bestSelling[key]) {
        bestSelling[key] = {
          name: item.product_name,
          quantity: 0,
          sales: 0
        };
      }

      bestSelling[key].quantity += Number(item.quantity || 0);
      bestSelling[key].sales += Number(item.line_total || 0);
    });

    const topProducts = Object.values(bestSelling)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    const monthly = getMonthlySales();

    app.innerHTML = `
      ${renderSidebar(profile, 'reports')}

      <main class="main-content">
        <div class="topbar">
          <div>
            <button class="mobile-menu-btn" id="menuBtn">
              <i class="bi bi-list"></i>
            </button>
            <h1 class="page-title">Sales & Reports</h1>
            <p class="page-subtitle">Monitor clinic sales, orders, and inventory performance.</p>
          </div>
          <div class="d-flex gap-2">
            <button class="btn btn-outline-secondary" id="refreshReports">
              <i class="bi bi-arrow-clockwise"></i> Refresh
            </button>
            <button class="btn btn-primary" id="printReports">
              <i class="bi bi-printer"></i> Print
            </button>
          </div>
        </div>

        <div class="content-card mb-4">
          <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div>
              <h5 class="card-heading mb-1">Report Period</h5>
              <small class="text-muted">Choose the period for your sales and stock summaries.</small>
            </div>
            <select class="form-select" id="reportPeriod" style="max-width:180px">
              <option value="daily" ${period === 'daily' ? 'selected' : ''}>Today</option>
              <option value="weekly" ${period === 'weekly' ? 'selected' : ''}>This Week</option>
              <option value="monthly" ${period === 'monthly' ? 'selected' : ''}>This Month</option>
            </select>
          </div>
        </div>

        <div id="printableReports">
          <div class="row g-3 mb-4">
            ${[
              ['Completed Sales', money(salesTotal), 'bi-cash-stack', 'success'],
              ['Total Orders', periodOrders.length, 'bi-receipt', 'primary'],
              ['Completed Orders', completed.length, 'bi-check-circle', 'info'],
              ['Pending Orders', pending.length, 'bi-hourglass-split', 'warning']
            ].map(([label, value, icon, color]) => `
              <div class="col-6 col-xl-3">
                <div class="stat-card">
                  <div class="d-flex justify-content-between">
                    <span class="stat-label">${label}</span>
                    <span class="stat-icon bg-${color}-subtle text-${color}">
                      <i class="bi ${icon}"></i>
                    </span>
                  </div>
                  <div class="stat-value">${value}</div>
                </div>
              </div>
            `).join('')}
          </div>

          <div class="content-card mb-4">
            <h5 class="card-heading">Monthly Sales Performance</h5>
            <p class="text-muted small">Completed-order totals for the last six months.</p>
            <div style="height:300px;position:relative">
              <canvas id="salesChart"></canvas>
            </div>
          </div>

          <div class="row g-3 mb-4">
            <div class="col-12 col-lg-6">
              <div class="content-card h-100">
                <h5 class="card-heading">Best-Selling Products</h5>
                <div class="table-responsive">
                  <table class="table align-middle">
                    <thead>
                      <tr><th>Product</th><th>Qty Sold</th><th class="text-end">Sales</th></tr>
                    </thead>
                    <tbody>
                      ${topProducts.length ? topProducts.map(p => `
                        <tr>
                          <td>${escapeHtml(p.name)}</td>
                          <td>${p.quantity}</td>
                          <td class="text-end">${money(p.sales)}</td>
                        </tr>
                      `).join('') : `
                        <tr><td colspan="3" class="text-center text-muted py-3">
                          No completed sales yet.
                        </td></tr>
                      `}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div class="col-12 col-lg-6">
              <div class="content-card h-100">
                <h5 class="card-heading">Inventory Summary</h5>
                <div class="row g-3">
                  <div class="col-6">
                    <div class="p-3 rounded bg-light">
                      <small class="text-muted">Total Stock Units</small>
                      <h4 class="mb-0">${stockUnits}</h4>
                    </div>
                  </div>
                  <div class="col-6">
                    <div class="p-3 rounded bg-warning-subtle">
                      <small class="text-muted">Low Stock</small>
                      <h4 class="mb-0">${lowStock.length}</h4>
                    </div>
                  </div>
                  <div class="col-6">
                    <div class="p-3 rounded bg-danger-subtle">
                      <small class="text-muted">Out of Stock</small>
                      <h4 class="mb-0">${outOfStock.length}</h4>
                    </div>
                  </div>
                  <div class="col-6">
                    <div class="p-3 rounded bg-primary-subtle">
                      <small class="text-muted">Active Products</small>
                      <h4 class="mb-0">${products.filter(p => p.is_active).length}</h4>
                    </div>
                  </div>
                </div>

                <hr>
                <h6>Stock Movements — Selected Period</h6>
                <div class="d-flex justify-content-between mb-2">
                  <span class="text-muted">Stock Received</span>
                  <strong class="text-success">+${stockIn}</strong>
                </div>
                <div class="d-flex justify-content-between">
                  <span class="text-muted">Stock Released</span>
                  <strong class="text-danger">-${stockOut}</strong>
                </div>
              </div>
            </div>
          </div>

          <div class="content-card mb-4">
            <h5 class="card-heading">Low Stock & Out of Stock Products</h5>
            <div class="table-responsive">
              <table class="table align-middle">
                <thead>
                  <tr><th>Product</th><th>SKU</th><th>Current Stock</th><th>Threshold</th><th>Status</th></tr>
                </thead>
                <tbody>
                  ${[...outOfStock, ...lowStock].length ? [...outOfStock, ...lowStock].map(p => `
                    <tr>
                      <td>${escapeHtml(p.name)}</td>
                      <td>${escapeHtml(p.sku || '—')}</td>
                      <td>${p.stock_quantity}</td>
                      <td>${p.low_stock_threshold}</td>
                      <td>
                        ${Number(p.stock_quantity) <= 0
                          ? '<span class="badge bg-danger-subtle text-danger">Out of Stock</span>'
                          : '<span class="badge bg-warning-subtle text-warning-emphasis">Low Stock</span>'}
                      </td>
                    </tr>
                  `).join('') : `
                    <tr><td colspan="5" class="text-center text-muted py-3">
                      All products have sufficient stock.
                    </td></tr>
                  `}
                </tbody>
              </table>
            </div>
          </div>

          <div class="content-card">
            <h5 class="card-heading">Recent Orders — Selected Period</h5>
            <div class="table-responsive">
              <table class="table align-middle">
                <thead>
                  <tr><th>Order No.</th><th>Date</th><th>Status</th><th class="text-end">Total</th></tr>
                </thead>
                <tbody>
                  ${periodOrders.length ? periodOrders.slice(0, 20).map(o => `
                    <tr>
                      <td>${escapeHtml(o.order_number)}</td>
                      <td>${o.created_at ? new Date(o.created_at).toLocaleDateString('en-PH') : '—'}</td>
                      <td><span class="badge bg-secondary-subtle text-secondary">${escapeHtml(o.status)}</span></td>
                      <td class="text-end">${money(o.total)}</td>
                    </tr>
                  `).join('') : `
                    <tr><td colspan="4" class="text-center text-muted py-3">No orders in this period.</td></tr>
                  `}
                </tbody>
              </table>
            </div>
          </div>

          <p class="text-muted small mt-3">
            Sales figures represent completed orders, not verified payments.
            Cancelled orders are excluded from sales totals.
          </p>
        </div>
      </main>
    `;

    if (salesChart) {
      salesChart.destroy();
      salesChart = null;
    }

    const ctx = document.querySelector('#salesChart');

    salesChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: monthly.labels,
        datasets: [{
          label: 'Completed Sales',
          data: monthly.values,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: context => money(context.raw)
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: value => '₱' + Number(value).toLocaleString('en-PH')
            }
          }
        }
      }
    });

    bindEvents();
    bindSidebar(page => navigate(page));
  }

  function bindEvents() {
    document.querySelector('#reportPeriod')?.addEventListener('change', event => {
      period = event.target.value;
      renderPage();
    });

    document.querySelector('#refreshReports')?.addEventListener('click', async () => {
      try {
        await loadData();
        renderPage();
      } catch (error) {
        alert('Unable to refresh reports: ' + error.message);
      }
    });

    document.querySelector('#printReports')?.addEventListener('click', () => {
      window.print();
    });
  }

  try {
    await loadData();
    renderPage();
  } catch (error) {
    app.innerHTML = `
      <div class="container py-5">
        <div class="alert alert-danger">
          <h4>Reports Error</h4>
          <p>${escapeHtml(error.message)}</p>
          <button class="btn btn-primary" onclick="location.reload()">Retry</button>
        </div>
      </div>
    `;
  }
}
