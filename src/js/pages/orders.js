import { supabase } from '../supabase.js';
import { renderSidebar, bindSidebar } from '../components/sidebar.js';

const app = document.querySelector('#app');

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[c]);

const money = value => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP'
}).format(Number(value || 0));

const statusClass = status => ({
  pending: 'bg-warning-subtle text-warning-emphasis',
  processing: 'bg-primary-subtle text-primary',
  ready: 'bg-info-subtle text-info-emphasis',
  completed: 'bg-success-subtle text-success',
  cancelled: 'bg-danger-subtle text-danger'
}[status] || 'bg-secondary-subtle text-secondary');

const nextStatuses = {
  pending: ['processing', 'cancelled'],
  processing: ['ready', 'cancelled'],
  ready: ['completed', 'cancelled'],
  completed: [],
  cancelled: []
};

export async function renderOrders(profile, navigate) {
  let customers = [];
  let products = [];
  let orders = [];
  let cart = [];
  let loading = false;

  async function loadData() {
    const [customerResult, productResult, orderResult] = await Promise.all([
      supabase.from('customers')
        .select('id,full_name,phone')
        .order('full_name'),
      supabase.from('products')
        .select('id,name,sku,price,stock_quantity,is_active')
        .eq('is_active', true)
        .order('name'),
      supabase.from('orders')
        .select('id,customer_id,order_number,status,subtotal,discount,total,notes,created_at,customer:customers(full_name)')
        .order('created_at', { ascending: false })
    ]);

    const error = customerResult.error || productResult.error || orderResult.error;
    if (error) throw error;

    customers = customerResult.data || [];
    products = productResult.data || [];
    orders = orderResult.data || [];
  }

  function productOptions(selectedId = '') {
    return `
      <option value="">Select product</option>
      ${products.map(p => `
        <option value="${p.id}" ${String(p.id) === String(selectedId) ? 'selected' : ''}>
          ${escapeHtml(p.name)} — ${money(p.price)} (Stock: ${p.stock_quantity})
        </option>
      `).join('')}
    `;
  }

  function cartRow(item, index) {
    const product = products.find(p => String(p.id) === String(item.product_id));
    const price = Number(product?.price || 0);
    const quantity = Number(item.quantity || 1);

    return `
      <tr>
        <td>
          <select class="form-select form-select-sm cart-product" data-index="${index}">
            ${productOptions(item.product_id)}
          </select>
        </td>
        <td style="min-width:100px">
          <input class="form-control form-control-sm cart-quantity"
            type="number" min="1" value="${quantity}" data-index="${index}">
        </td>
        <td class="text-end">${money(price)}</td>
        <td class="text-end">${money(price * quantity)}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-danger remove-item" data-index="${index}" type="button">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }

  function renderPage() {
    const subtotal = cart.reduce((sum, item) => {
      const product = products.find(p => String(p.id) === String(item.product_id));
      return sum + Number(product?.price || 0) * Number(item.quantity || 0);
    }, 0);

    app.innerHTML = `
      ${renderSidebar(profile, 'orders')}

      <main class="main-content">
        <div class="topbar">
          <div>
            <button class="mobile-menu-btn" id="menuBtn">
              <i class="bi bi-list"></i>
            </button>
            <h1 class="page-title">Orders Management</h1>
            <p class="page-subtitle">Create orders and monitor their progress.</p>
          </div>
          <button class="btn btn-outline-secondary" id="refreshOrders">
            <i class="bi bi-arrow-clockwise"></i> Refresh
          </button>
        </div>

        <div class="row g-3 mb-4">
          <div class="col-6 col-xl-3">
            <div class="stat-card">
              <span class="stat-label">Total Orders</span>
              <div class="stat-value">${orders.length}</div>
            </div>
          </div>
          <div class="col-6 col-xl-3">
            <div class="stat-card">
              <span class="stat-label">Pending</span>
              <div class="stat-value">${orders.filter(o => o.status === 'pending').length}</div>
            </div>
          </div>
          <div class="col-6 col-xl-3">
            <div class="stat-card">
              <span class="stat-label">Processing</span>
              <div class="stat-value">${orders.filter(o => o.status === 'processing').length}</div>
            </div>
          </div>
          <div class="col-6 col-xl-3">
            <div class="stat-card">
              <span class="stat-label">Ready</span>
              <div class="stat-value">${orders.filter(o => o.status === 'ready').length}</div>
            </div>
          </div>
        </div>

        <div class="content-card mb-4">
          <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <h5 class="card-heading mb-0">Create New Order</h5>
            <span class="text-muted small">New orders start as Pending</span>
          </div>

          <form id="orderForm">
            <div class="row g-3 mb-3">
              <div class="col-12 col-md-6">
                <label class="form-label">Customer *</label>
                <select class="form-select" id="orderCustomer" required>
                  <option value="">Select customer</option>
                  ${customers.map(c => `
                    <option value="${c.id}">
                      ${escapeHtml(c.full_name)}${c.phone ? ' — ' + escapeHtml(c.phone) : ''}
                    </option>
                  `).join('')}
                </select>
                ${customers.length ? '' : '<small class="text-danger">Add a customer before creating an order.</small>'}
              </div>
              <div class="col-12 col-md-6">
                <label class="form-label">Discount (₱)</label>
                <input class="form-control" id="orderDiscount" type="number" min="0" step="0.01" value="0">
              </div>
            </div>

            <div class="table-responsive">
              <table class="table align-middle">
                <thead>
                  <tr>
                    <th style="min-width:220px">Product</th>
                    <th style="width:110px">Quantity</th>
                    <th class="text-end">Unit Price</th>
                    <th class="text-end">Line Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody id="cartRows">
                  ${cart.length ? cart.map(cartRow).join('') : `
                    <tr><td colspan="5" class="text-center text-muted py-3">No products added yet.</td></tr>
                  `}
                </tbody>
              </table>
            </div>

            <button class="btn btn-outline-primary btn-sm mb-3" type="button" id="addOrderItem">
              <i class="bi bi-plus-circle"></i> Add Product
            </button>

            <div class="row justify-content-end">
              <div class="col-12 col-md-5 col-lg-4">
                <div class="d-flex justify-content-between mb-2">
                  <span class="text-muted">Subtotal</span>
                  <strong>${money(subtotal)}</strong>
                </div>
                <div class="d-flex justify-content-between mb-2">
                  <span class="text-muted">Discount</span>
                  <strong id="discountDisplay">${money(document.querySelector('#orderDiscount')?.value || 0)}</strong>
                </div>
                <hr>
                <div class="d-flex justify-content-between mb-3">
                  <strong>Order Total</strong>
                  <strong class="text-primary fs-5" id="orderTotal">
                    ${money(Math.max(0, subtotal - Number(document.querySelector('#orderDiscount')?.value || 0)))}
                  </strong>
                </div>
              </div>
            </div>

            <div class="mb-3">
              <label class="form-label">Notes (Optional)</label>
              <textarea class="form-control" id="orderNotes" rows="2" placeholder="Additional order details..."></textarea>
            </div>

            <button class="btn btn-primary" type="submit" ${loading || !products.length || !customers.length ? 'disabled' : ''}>
              <i class="bi bi-receipt"></i> Create Order
            </button>
          </form>
        </div>

        <div class="content-card">
          <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <h5 class="card-heading mb-0">All Orders</h5>
            <input class="form-control" id="orderSearch" placeholder="Search order or customer..." style="max-width:260px">
          </div>

          <div class="table-responsive">
            <table class="table align-middle">
              <thead>
                <tr>
                  <th>Order No.</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Update Status</th>
                </tr>
              </thead>
              <tbody id="ordersTable">
                ${orders.length ? orders.map(orderRow).join('') : `
                  <tr><td colspan="6" class="text-center text-muted py-4">No orders recorded yet.</td></tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    `;

    bindEvents();
    bindSidebar(page => navigate(page));
  }

  function orderRow(order) {
    const options = nextStatuses[order.status] || [];

    return `
      <tr data-order-search="${escapeHtml((order.order_number + ' ' + (order.customer?.full_name || '')).toLowerCase())}">
        <td>
          <strong>${escapeHtml(order.order_number)}</strong>
          <button class="btn btn-link btn-sm p-0 ms-1 view-order" data-id="${order.id}" type="button">Items</button>
        </td>
        <td>${escapeHtml(order.customer?.full_name || 'Unknown customer')}</td>
        <td>${order.created_at ? new Date(order.created_at).toLocaleDateString('en-PH') : '—'}</td>
        <td><span class="badge ${statusClass(order.status)}">${escapeHtml(order.status)}</span></td>
        <td>${money(order.total)}</td>
        <td style="min-width:150px">
          ${options.length ? `
            <select class="form-select form-select-sm order-status" data-id="${order.id}">
              <option value="">Change status...</option>
              ${options.map(s => `<option value="${s}">${s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join('')}
            </select>
          ` : '<span class="text-muted small">No further action</span>'}
        </td>
      </tr>
    `;
  }

  function bindEvents() {
    document.querySelector('#refreshOrders')?.addEventListener('click', async () => {
      try {
        await loadData();
        renderPage();
      } catch (error) {
        alert(error.message);
      }
    });

    document.querySelector('#addOrderItem')?.addEventListener('click', () => {
      cart.push({ product_id: '', quantity: 1 });
      renderPage();
    });

    document.querySelectorAll('.cart-product').forEach(select => {
      select.addEventListener('change', event => {
        const index = Number(event.target.dataset.index);
        cart[index].product_id = event.target.value;
        renderPage();
      });
    });

    document.querySelectorAll('.cart-quantity').forEach(input => {
      input.addEventListener('change', event => {
        const index = Number(event.target.dataset.index);
        cart[index].quantity = Math.max(1, Number(event.target.value || 1));
        renderPage();
      });
    });

    document.querySelectorAll('.remove-item').forEach(button => {
      button.addEventListener('click', event => {
        const index = Number(event.currentTarget.dataset.index);
        cart.splice(index, 1);
        renderPage();
      });
    });

    document.querySelector('#orderDiscount')?.addEventListener('input', event => {
      const discount = Math.max(0, Number(event.target.value || 0));
      const subtotal = cart.reduce((sum, item) => {
        const p = products.find(x => String(x.id) === String(item.product_id));
        return sum + Number(p?.price || 0) * Number(item.quantity || 0);
      }, 0);
      document.querySelector('#discountDisplay').textContent = money(discount);
      document.querySelector('#orderTotal').textContent = money(Math.max(0, subtotal - discount));
    });

    document.querySelector('#orderForm')?.addEventListener('submit', async event => {
      event.preventDefault();

      const customerId = Number(document.querySelector('#orderCustomer').value);
      const discount = Number(document.querySelector('#orderDiscount').value || 0);
      const notes = document.querySelector('#orderNotes').value;
      const items = cart.map(item => ({
        product_id: Number(item.product_id),
        quantity: Number(item.quantity)
      }));

      if (!customerId) return alert('Please select a customer.');
      if (!items.length || items.some(i => !i.product_id || i.quantity < 1)) {
        return alert('Please select a product and valid quantity for every row.');
      }
      if (discount < 0) return alert('Discount cannot be negative.');

      const subtotal = cart.reduce((sum, item) => {
        const p = products.find(x => String(x.id) === String(item.product_id));
        return sum + Number(p?.price || 0) * Number(item.quantity || 0);
      }, 0);

      if (discount > subtotal) return alert('Discount cannot exceed subtotal.');

      const button = event.submitter;
      button.disabled = true;
      button.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Creating...';

      try {
        const { error } = await supabase.rpc('create_clinic_order', {
          p_customer_id: customerId,
          p_discount: discount,
          p_notes: notes,
          p_items: items
        });

        if (error) throw error;

        alert('Order created successfully!');
        cart = [];
        await loadData();
        renderPage();
      } catch (error) {
        alert('Unable to create order: ' + error.message);
        button.disabled = false;
        button.innerHTML = '<i class="bi bi-receipt"></i> Create Order';
      }
    });

    document.querySelectorAll('.order-status').forEach(select => {
      select.addEventListener('change', async event => {
        const orderId = Number(event.target.dataset.id);
        const newStatus = event.target.value;
        if (!newStatus) return;

        const confirmed = confirm(`Change this order status to ${newStatus}?`);
        if (!confirmed) {
          event.target.value = '';
          return;
        }

        event.target.disabled = true;

        try {
          const { error } = await supabase.rpc('update_clinic_order_status', {
            p_order_id: orderId,
            p_new_status: newStatus
          });

          if (error) throw error;

          alert('Order status updated.');
          await loadData();
          renderPage();
        } catch (error) {
          alert('Unable to update status: ' + error.message);
          event.target.disabled = false;
          event.target.value = '';
        }
      });
    });

    document.querySelectorAll('.view-order').forEach(button => {
      button.addEventListener('click', async event => {
        const orderId = Number(event.currentTarget.dataset.id);

        try {
          const { data, error } = await supabase
            .from('order_items')
            .select('product_name,quantity,unit_price,line_total')
            .eq('order_id', orderId);

          if (error) throw error;

          const order = orders.find(o => o.id === orderId);
          const lines = (data || []).map(item =>
            `${item.product_name} — ${item.quantity} x ${money(item.unit_price)} = ${money(item.line_total)}`
          );

          alert(
            `Order: ${order?.order_number || orderId}\n\n` +
            (lines.join('\n') || 'No items found.') +
            `\n\nSubtotal: ${money(order?.subtotal)}\nDiscount: ${money(order?.discount)}\nTotal: ${money(order?.total)}`
          );
        } catch (error) {
          alert('Unable to load order items: ' + error.message);
        }
      });
    });

    document.querySelector('#orderSearch')?.addEventListener('input', event => {
      const query = event.target.value.toLowerCase();
      document.querySelectorAll('#ordersTable tr[data-order-search]').forEach(row => {
        row.hidden = !row.dataset.orderSearch.includes(query);
      });
    });
  }

  try {
    await loadData();
    renderPage();
  } catch (error) {
    app.innerHTML = `
      <div class="container py-5">
        <div class="alert alert-danger">
          <h4>Orders Error</h4>
          <p>${escapeHtml(error.message)}</p>
          <button class="btn btn-primary" onclick="location.reload()">Retry</button>
        </div>
      </div>
    `;
  }
}
