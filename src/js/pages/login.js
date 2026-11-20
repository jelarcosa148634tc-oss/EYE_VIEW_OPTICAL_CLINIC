import { supabase } from '../supabase.js';

export function renderLogin() {
  document.querySelector('#app').innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <div class="login-logo">
          <i class="bi bi-eyeglasses"></i>
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
      </div>
    </div>
  `;

  document.querySelector('#loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = document.querySelector('#email').value.trim();
    const password = document.querySelector('#password').value;
    const message = document.querySelector('#loginMessage');
    const button = event.target.querySelector('button');

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
