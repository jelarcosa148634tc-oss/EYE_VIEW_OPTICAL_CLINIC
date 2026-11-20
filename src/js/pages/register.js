import { supabase } from '../supabase.js';

export function renderStaffRegistration(onBack) {
  document.querySelector('#app').innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <div class="login-logo">
          <img src="${(awaitLogo => awaitLogo)(document.querySelector('.login-logo img')?.src || '')}" alt="Eye-View Optical Clinic">
        </div>
        <h2>Staff Registration</h2>
        <p>Register your clinic staff account</p>

        <form id="staffRegisterForm">
          <label>Full Name</label>
          <input id="staffFullName" type="text" class="form-control mb-3"
            placeholder="Enter your full name" maxlength="100" required>

          <label>Email Address</label>
          <input id="staffEmail" type="email" class="form-control mb-3"
            placeholder="Enter your email" required>

          <label>Password</label>
          <input id="staffPassword" type="password" class="form-control mb-3"
            placeholder="At least 6 characters" minlength="6" required>

          <label>Staff Access Code</label>
          <input id="staffCode" type="text" class="form-control mb-3"
            placeholder="Enter the code provided by admin" required>

          <button class="btn btn-primary w-100" type="submit">
            Register Account
          </button>
          <div id="registerMessage" class="mt-3"></div>
        </form>

        <div class="text-center mt-3">
          <button type="button" id="backToLogin" class="btn btn-link">
            Back to Login
          </button>
        </div>
      </div>
    </div>
  `;

  document.querySelector('#backToLogin').addEventListener('click', onBack);

  document.querySelector('#staffRegisterForm').addEventListener('submit', async event => {
    event.preventDefault();

    const button = event.target.querySelector('button[type="submit"]');
    const message = document.querySelector('#registerMessage');

    const full_name = document.querySelector('#staffFullName').value.trim();
    const email = document.querySelector('#staffEmail').value.trim();
    const password = document.querySelector('#staffPassword').value;
    const code = document.querySelector('#staffCode').value.trim();

    button.disabled = true;
    button.textContent = 'Creating Account...';
    message.innerHTML = '';

    const { data, error } = await supabase.functions.invoke('hyper-function', {
      body: {
        action: 'register_staff',
        full_name,
        email,
        password,
        code
      }
    });

    button.disabled = false;
    button.textContent = 'Register Account';

    if (error || !data?.success) {
      message.innerHTML = `
        <div class="alert alert-danger">
          ${escapeHtml(data?.error || error?.message || 'Registration failed.')}
        </div>
      `;
      return;
    }

    message.innerHTML = `
      <div class="alert alert-success">
        Staff account created successfully. You can now log in.
      </div>
    `;

    document.querySelector('#staffRegisterForm').reset();
  });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}
