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

const statusInfo = {
  received: { label: 'Received', class: 'bg-warning-subtle text-warning-emphasis' },
  repairing: { label: 'In Progress', class: 'bg-primary-subtle text-primary' },
  ready: { label: 'Ready for Pickup', class: 'bg-success-subtle text-success' },
  released: { label: 'Released', class: 'bg-secondary-subtle text-secondary' }
};

const nextStatuses = {
  received: ['repairing'],
  repairing: ['ready'],
  ready: ['released'],
  released: []
};

export async function renderRepairs(profile, navigate) {
  let customers = [];
  let repairs = [];

  async function loadData() {
    const [customerResult, repairResult] = await Promise.all([
      supabase.from('customers')
        .select('id,full_name,phone')
        .order('full_name'),
      supabase.from('frame_repairs')
        .select('id,customer_id,frame_description,issue_description,status,repair_cost,received_at,completed_at,customer:customers(full_name,phone)')
        .order('received_at', { ascending: false })
    ]);

    if (customerResult.error) throw customerResult.error;
    if (repairResult.error) throw repairResult.error;

    customers = customerResult.data || [];
    repairs = repairResult.data || [];
  }

  function renderPage() {
    const counts = {
      total: repairs.length,
      received: repairs.filter(r => r.status === 'received').length,
      repairing: repairs.filter(r => r.status === 'repairing').length,
      ready: repairs.filter(r => r.status === 'ready').length,
      released: repairs.filter(r => r.status === 'released').length
    };

    app.innerHTML = `
      ${renderSidebar(profile, 'repairs')}

      <main class="main-content">
        <div class="topbar">
          <div>
            <button class="mobile-menu-btn" id="menuBtn">
              <i class="bi bi-list"></i>
            </button>
            <h1 class="page-title">Frame Repairs</h1>
            <p class="page-subtitle">Manage customer frame repair requests and progress.</p>
          </div>
          <button class="btn btn-outline-secondary" id="refreshRepairs">
            <i class="bi bi-arrow-clockwise"></i> Refresh
          </button>
        </div>

        <div class="row g-3 mb-4">
          ${[
            ['Total Repairs', counts.total, 'bi-tools', 'primary'],
            ['Received', counts.received, 'bi-inbox', 'warning'],
            ['In Progress', counts.repairing, 'bi-wrench-adjustable', 'info'],
            ['Ready for Pickup', counts.ready, 'bi-check-circle', 'success']
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
          <h5 class="card-heading mb-3">Register Frame Repair</h5>

          <form id="repairForm">
            <div class="row g-3">
              <div class="col-12 col-md-6">
                <label class="form-label">Customer *</label>
                <select class="form-select" id="repairCustomer" required>
                  <option value="">Select customer</option>
                  ${customers.map(c => `
                    <option value="${c.id}">
                      ${escapeHtml(c.full_name)}${c.phone ? ' — ' + escapeHtml(c.phone) : ''}
                    </option>
                  `).join('')}
                </select>
                ${customers.length ? '' : '<small class="text-danger">Register a customer first.</small>'}
              </div>

              <div class="col-12 col-md-6">
                <label class="form-label">Frame Description *</label>
                <input class="form-control" id="frameDescription"
                  placeholder="e.g. Black metal frame, Ray-Ban style" required maxlength="500">
              </div>

              <div class="col-12">
                <label class="form-label">Problem / Repair Needed *</label>
                <textarea class="form-control" id="issueDescription"
                  rows="3" placeholder="Describe the damage or repair needed..." required maxlength="2000"></textarea>
              </div>

              <div class="col-12 col-md-6">
                <label class="form-label">Repair Cost (₱)</label>
                <input class="form-control" id="repairCost"
                  type="number" min="0" step="0.01" value="0" required>
              </div>

              <div class="col-12 col-md-6 d-flex align-items-end">
                <button class="btn btn-primary w-100" type="submit" ${customers.length ? '' : 'disabled'}>
                  <i class="bi bi-plus-circle"></i> Register Repair
                </button>
              </div>
            </div>
          </form>
        </div>

        <div class="content-card">
          <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <h5 class="card-heading mb-0">Repair Records</h5>
            <div class="d-flex gap-2 flex-wrap">
              <select class="form-select" id="repairFilter" style="max-width:170px">
                <option value="all">All Statuses</option>
                <option value="received">Received</option>
                <option value="repairing">In Progress</option>
                <option value="ready">Ready for Pickup</option>
                <option value="released">Released</option>
              </select>
              <input class="form-control" id="repairSearch"
                placeholder="Search customer or frame..." style="max-width:230px">
            </div>
          </div>

          <div class="table-responsive">
            <table class="table align-middle">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Frame</th>
                  <th>Problem</th>
                  <th>Received</th>
                  <th>Cost</th>
                  <th>Status</th>
                  <th>Update</th>
                </tr>
              </thead>
              <tbody id="repairsTable">
                ${repairs.length ? repairs.map(repairRow).join('') : `
                  <tr><td colspan="7" class="text-center text-muted py-4">No repair records yet.</td></tr>
                `}
              </tbody>
            </table>
          </div>
          <div class="text-muted small mt-2">
            Completed repairs become Ready for Pickup. Mark them Released when the customer collects the frame.
          </div>
        </div>
      </main>
    `;

    bindEvents();
    bindSidebar(page => navigate(page));
    applyFilters();
  }

  function repairRow(repair) {
    const info = statusInfo[repair.status] || statusInfo.received;
    const options = nextStatuses[repair.status] || [];
    const customerName = repair.customer?.full_name || 'Walk-in / Unknown';

    return `
      <tr
        data-status="${escapeHtml(repair.status)}"
        data-search="${escapeHtml((customerName + ' ' + repair.frame_description + ' ' + repair.issue_description).toLowerCase())}"
      >
        <td>
          <strong>${escapeHtml(customerName)}</strong>
          <div class="small text-muted">${escapeHtml(repair.customer?.phone || '')}</div>
        </td>
        <td>${escapeHtml(repair.frame_description)}</td>
        <td style="min-width:180px">${escapeHtml(repair.issue_description)}</td>
        <td>${repair.received_at ? new Date(repair.received_at).toLocaleDateString('en-PH') : '—'}</td>
        <td>${money(repair.repair_cost)}</td>
        <td><span class="badge ${info.class}">${info.label}</span></td>
        <td style="min-width:160px">
          ${options.length ? `
            <select class="form-select form-select-sm repair-status" data-id="${repair.id}">
              <option value="">Update...</option>
              ${options.map(s => `
                <option value="${s}">${statusInfo[s].label}</option>
              `).join('')}
            </select>
          ` : '<span class="text-muted small">Finished</span>'}
        </td>
      </tr>
    `;
  }

  function applyFilters() {
    const query = document.querySelector('#repairSearch')?.value.toLowerCase() || '';
    const status = document.querySelector('#repairFilter')?.value || 'all';

    document.querySelectorAll('#repairsTable tr[data-search]').forEach(row => {
      const matchesSearch = row.dataset.search.includes(query);
      const matchesStatus = status === 'all' || row.dataset.status === status;
      row.hidden = !(matchesSearch && matchesStatus);
    });
  }

  function bindEvents() {
    document.querySelector('#refreshRepairs')?.addEventListener('click', async () => {
      try {
        await loadData();
        renderPage();
      } catch (error) {
        alert('Unable to refresh repairs: ' + error.message);
      }
    });

    document.querySelector('#repairSearch')?.addEventListener('input', applyFilters);
    document.querySelector('#repairFilter')?.addEventListener('change', applyFilters);

    document.querySelector('#repairForm')?.addEventListener('submit', async event => {
      event.preventDefault();

      const customerId = Number(document.querySelector('#repairCustomer').value);
      const frameDescription = document.querySelector('#frameDescription').value.trim();
      const issueDescription = document.querySelector('#issueDescription').value.trim();
      const repairCost = Number(document.querySelector('#repairCost').value);

      if (!customerId) return alert('Please select a customer.');
      if (!frameDescription || !issueDescription) {
        return alert('Please complete the frame and problem descriptions.');
      }
      if (!Number.isFinite(repairCost) || repairCost < 0) {
        return alert('Please enter a valid repair cost.');
      }

      const button = event.submitter;
      button.disabled = true;
      button.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';

      try {
        const { error } = await supabase.from('frame_repairs').insert({
          customer_id: customerId,
          frame_description: frameDescription,
          issue_description: issueDescription,
          repair_cost: repairCost,
          status: 'received'
        });

        if (error) throw error;

        alert('Frame repair registered successfully!');
        await loadData();
        renderPage();
      } catch (error) {
        alert('Unable to register repair: ' + error.message);
        button.disabled = false;
        button.innerHTML = '<i class="bi bi-plus-circle"></i> Register Repair';
      }
    });

    document.querySelectorAll('.repair-status').forEach(select => {
      select.addEventListener('change', async event => {
        const repairId = Number(event.target.dataset.id);
        const newStatus = event.target.value;
        if (!newStatus) return;

        const repair = repairs.find(r => r.id === repairId);
        if (!repair) return;

        const confirmed = confirm(
          `Update repair status to "${statusInfo[newStatus].label}"?`
        );

        if (!confirmed) {
          event.target.value = '';
          return;
        }

        event.target.disabled = true;

        const update = { status: newStatus };

        if (newStatus === 'ready') {
          update.completed_at = new Date().toISOString();
        }

        try {
          const { error } = await supabase
            .from('frame_repairs')
            .update(update)
            .eq('id', repairId);

          if (error) throw error;

          alert('Repair status updated successfully!');
          await loadData();
          renderPage();
        } catch (error) {
          alert('Unable to update repair: ' + error.message);
          event.target.disabled = false;
          event.target.value = '';
        }
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
          <h4>Frame Repairs Error</h4>
          <p>${escapeHtml(error.message)}</p>
          <button class="btn btn-primary" onclick="location.reload()">Retry</button>
        </div>
      </div>
    `;
  }
}
