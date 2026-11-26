import { supabase } from '../supabase.js';
import eyeViewLogo from '../../assets/eye-view-logo.jpg';
import { renderStaffRegistration } from './register.js';

export function renderLogin() {
  document.querySelector('#app').innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <div class="login-logo">
          <img src="${eyeViewLogo}" alt="Eye-View Optical Clinic">
        </div>
        <h2>Eye-View Clinic</h2>
        <p>Optical Clinic Management System</p>

        <form id="loginForm">
          <label>Email Address</label>
          <input id="email" type="email" class="form-control mb-3"
            placeholder="Enter your email" required>

          <label>Password</label>
          <input id="password" type="password" class="form-control mb-3"
            placeholder="Enter your password" required>

          <button class="btn btn-primary w-100" type="submit">
            Sign In
          </button>
          <div id="loginMessage" class="mt-3"></div>
        </form>

        <div class="text-center mt-3">
          <button type="button" id="registerLink" class="btn btn-link">
            Register as Staff
          </button>
        </div>
      </div>
    </div>
  `;

  document.querySelector('#registerLink').addEventListener('click', () => {
    renderStaffRegistration(renderLogin);
  });

  document.querySelector('#loginForm').addEventListener('submit', async event => {
    event.preventDefault();

    const email = document.querySelector('#email').value.trim();
    const password = document.querySelector('#password').value;
    const message = document.querySelector('#loginMessage');
    const button = event.target.querySelector('button[type="submit"]');

    button.disabled = true;
    button.textContent = 'Signing in...';
    message.textContent = '';

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      message.className = 'text-danger mt-3';
      message.textContent = error.message;
      button.disabled = false;
      button.textContent = 'Sign In';
      return;
    }

    window.location.reload();
  });
}
