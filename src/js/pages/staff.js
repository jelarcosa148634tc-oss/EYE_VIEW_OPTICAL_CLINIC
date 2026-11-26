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

export async function renderStaff(profile, goBack) {
  if (profile?.role !== 'admin') return;

  app.innerHTML = `
    ${renderSidebar(profile, 'staff')}

    <main class="main-content">
      <div class="topbar">
        <div>
          <button class="mobile-menu-btn" id="menuBtn">
            <i class="bi bi-list"></i>
          </button>
          <h1 class="page-title">Staff Management</h1>
          <p class="page-subtitle">Manage clinic accounts and staff access.</p>
        </div>
      </div>

      <div id="staffMessage"></div>

      <div class="content-card mb-4">
        <h5 class="card-heading">Generate Staff Access Code</h5>
        <p class="text-muted">
          Create a one-time registration code for a new staff member.
          The code expires after 24 hours.
        </p>
        <button id="generateCode" class="btn btn-primary">
          <i class="bi bi-key"></i> Generate Access Code
        </button>
        <div id="generatedCode" class="mt-3"></div>
      </div>

      <div class="row g-3 mb-4">
        <div class="col-md-6">
          <div class="stat-card">
            <span class="stat-label">Total Staff</span>
            <h2 id="totalStaff">—</h2>
          </div>
        </div>
        <div class="col-md-6">
          <div class="stat-card">
            <span class="stat-label">Total Administrators</span>
            <h2 id="totalAdmins">—</h2>
          </div>
        </div>
      </div>

      <div class="content-card">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h5 class="card-heading mb-0">Staff Directory</h5>
          <button id="refreshStaff" class="btn btn-outline-secondary btn-sm">
            <i class="bi bi-arrow-clockwise"></i> Refresh
          </button>
        </div>

        <div class="table-responsive">
          <table class="table align-middle">
            <thead>
              <tr>
                <th>Full Name</th>
                <th>Role</th>
                <th>Date Created</th>
              </tr>
            </thead>
            <tbody id="staffTable">
              <tr>
                <td colspan="3" class="text-center py-4">Loading accounts...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  `;

  bindSidebar(page => goBack(page));

  document.querySelector('#generateCode').addEventListener('click', generateCode);
  document.querySelector('#refreshStaff').addEventListener('click', loadStaff);

  await loadStaff();
}

async function generateCode() {
  const button = document.querySelector('#generateCode');
  const output = document.querySelector('#generatedCode');
  const message = document.querySelector('#staffMessage');

  button.disabled = true;
  button.textContent = 'Generating...';
  output.innerHTML = '';
  message.innerHTML = '';

  try {
    const { data, error } = await supabase.functions.invoke('hyper-function', {
      body: { action: 'generate_code' }
    });

    if (error || !data?.success) {
      throw new Error(data?.error || error?.message || 'Unable to generate access code.');
    }

    const code = data.code;
    const expiry = new Date(data.expires_at).toLocaleString();

    output.innerHTML = `
      <div class="alert alert-success">
        <strong>Staff registration code generated</strong>
        <div class="d-flex align-items-center flex-wrap gap-2 mt-2">
          <code id="staffAccessCode" class="fs-5">${esc(code)}</code>
          <button type="button" id="copyStaffCode" class="btn btn-sm btn-outline-dark">
            <i class="bi bi-copy"></i> Copy Code
          </button>
        </div>
        <small class="d-block mt-2">Expires: ${esc(expiry)}</small>
        <small class="d-block">This code can only be used once.</small>
      </div>
    `;

    document.querySelector('#copyStaffCode').addEventListener('click', async () => {
      const copyButton = document.querySelector('#copyStaffCode');

      try {
        await navigator.clipboard.writeText(code);
        copyButton.innerHTML = '<i class="bi bi-check"></i> Copied';
      } catch {
        copyButton.textContent = 'Copy unavailable';
      }
    });

  } catch (error) {
    message.innerHTML = `<div class="alert alert-danger">${esc(error.message)}</div>`;
  } finally {
    button.disabled = false;
    button.innerHTML = '<i class="bi bi-key"></i> Generate Access Code';
  }
}

async function loadStaff() {
  const tbody = document.querySelector('#staffTable');
  const message = document.querySelector('#staffMessage');

  tbody.innerHTML = `
    <tr><td colspan="3" class="text-center py-4">Loading accounts...</td></tr>
  `;

  const { data, error } = await supabase
    .from('profiles')
    .select('id,full_name,role,created_at')
    .order('created_at', { ascending: false });

  if (error) {
    tbody.innerHTML = `
      <tr><td colspan="3" class="text-danger text-center py-4">${esc(error.message)}</td></tr>
    `;
    message.innerHTML = `<div class="alert alert-danger">${esc(error.message)}</div>`;
    return;
  }

  const profiles = data || [];
  const staff = profiles.filter(person => person.role === 'staff');
  const admins = profiles.filter(person => person.role === 'admin');

  document.querySelector('#totalStaff').textContent = staff.length;
  document.querySelector('#totalAdmins').textContent = admins.length;

  if (!profiles.length) {
    tbody.innerHTML = `
      <tr><td colspan="3" class="text-center text-muted py-4">No accounts found.</td></tr>
    `;
    return;
  }

  tbody.innerHTML = profiles.map(person => `
    <tr>
      <td>${esc(person.full_name)}</td>
      <td>
        <span class="badge ${person.role === 'admin' ? 'bg-primary' : 'bg-secondary'}">
          ${esc(person.role)}
        </span>
      </td>
      <td>${person.created_at ? esc(new Date(person.created_at).toLocaleDateString('en-PH')) : '—'}</td>
    </tr>
  `).join('');
}
