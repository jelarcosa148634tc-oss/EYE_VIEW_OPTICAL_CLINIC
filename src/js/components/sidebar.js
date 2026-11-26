import eyeViewLogo from '../../assets/eye-view-logo.jpg';

let controller;

export function renderSidebar(profile, active = '') {
  const links = [
    ['dashboard', 'grid-1x2', 'Dashboard'],
    ['products', 'box-seam', 'Products'],
    ['inventory', 'boxes', 'Inventory'],
    ['customers', 'people', 'Customers'],
    ['orders', 'receipt', 'Orders'],
    ['repairs', 'tools', 'Frame Repairs'],
    ['reports', 'bar-chart', 'Sales & Reports']
  ];

  return `
    <aside class="sidebar" id="sidebar">
      <div class="brand">
        <div class="brand-icon"><img src="${eyeViewLogo}" alt="Eye-View Logo"></div>
        <div><h5>EYE-VIEW</h5><small>OPTICAL CLINIC</small></div>
      </div>
      <div class="nav-label">MAIN MENU</div>
      <nav class="side-nav">
        ${links.map(([page, icon, label]) => `
          <a class="nav-link ${active === page ? 'active' : ''} "
             href="#" data-page="${page}">
            <i class="bi bi-${icon}"></i> ${label}
          </a>
        `).join('')}
        ${profile.role === 'admin' ? `
          <div class="nav-label">MANAGEMENT</div>
          <a class="nav-link" href="#" data-page="staff">
            <i class="bi bi-person-gear"></i> Staff
          </a>
        ` : ''}
      </nav>
      <div class="sidebar-bottom">
        <div class="user-info">
          <div class="user-avatar"><i class="bi bi-person"></i></div>
          <div class="user-details">
            <strong>${String(profile.full_name || '').replace(/[&<>"']/g, '')}</strong>
            <small>${String(profile.role || '').toUpperCase()}</small>
          </div>
        </div>
      </div>
    </aside>
  `;
}

export function bindSidebar(onNavigate) {
  if (controller) controller.abort();
  controller = new AbortController();
  const options = { signal: controller.signal };

  const sidebar = document.querySelector('#sidebar');
  const menuBtn = document.querySelector('#menuBtn');

  if (!sidebar || !menuBtn) return;

  menuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('show');
  }, options);

  document.addEventListener('click', event => {
    if (window.innerWidth > 900) return;
    if (!sidebar.contains(event.target) && !menuBtn.contains(event.target)) {
      sidebar.classList.remove('show');
    }
  }, options);

  sidebar.querySelectorAll('[data-page]').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      if (link.classList.contains('disabled')) return;
      sidebar.classList.remove('show');
      onNavigate(link.dataset.page);
    }, options);
  });
}
