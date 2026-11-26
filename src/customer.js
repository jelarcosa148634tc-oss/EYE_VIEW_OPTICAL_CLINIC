import { createClient } from '@supabase/supabase-js';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './customer.css';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      storageKey: 'eye-view-customer-auth',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

const app = document.querySelector('#customer-app');

let products = [];
let categories = [];
let cart = JSON.parse(localStorage.getItem('eye-view-cart') || '[]');
let currentUser = null;
let activeCategory = 'all';
let searchTerm = '';
let customerProfile = null;
let selectedAvatarFile = null;
let avatarPreviewUrl = null;
let removeAvatarRequested = false;
let profileCropper = null;
let cropSourceUrl = null;

const money = value => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP'
}).format(Number(value || 0));

const escapeHTML = value => String(value ?? '').replace(
  /[&<>"']/g,
  char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]
);

function saveCart() {
  localStorage.setItem('eye-view-cart', JSON.stringify(cart));
  updateCartCount();
}

function updateCartCount() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  document.querySelectorAll('.cart-count').forEach(el => {
    el.textContent = count;
  });
}

function renderShell() {
  app.innerHTML = `
    <header class="shop-header">
      <div class="shop-container header-inner">
        <a href="customer.html" class="brand">
          <img src="/src/assets/eye-view-logo.jpg" alt="Eye-View Clinic">
          <span>Eye-View <small>OPTICAL CLINIC</small></span>
        </a>

        <nav class="desktop-nav">
          <a href="#home">Home</a>
          <a href="#shop">Shop</a>
          <a href="#about">About</a>
        </nav>

        <div class="header-actions">
          <button class="icon-button" id="cartButton" aria-label="Shopping cart">
            <i class="bi bi-bag"></i>
            <span class="cart-count">0</span>
          </button>
          <button class="orders-header-button" id="ordersButton" aria-label="My Orders"><i class="bi bi-receipt"></i></button>
          <button class="account-button" id="accountButton">
            <i class="bi bi-person"></i>
            <span>Login</span>
          </button>
        </div>
      </div>
    </header>

    <main>
      <section class="hero-section" id="home">
        <div class="shop-container hero-content">
          <div class="hero-copy">
            <span class="eyebrow">SEE THE DIFFERENCE</span>
            <h1>Find your perfect <span>view.</span></h1>
            <p>Explore eyewear and optical essentials designed to complement your everyday style.</p>
            <a href="#shop" class="primary-button">Explore Collection <i class="bi bi-arrow-right"></i></a>
          </div>
          <div class="hero-image">
            <img src="/src/assets/hero.png" alt="Eye-View eyewear collection">
          </div>
        </div>
      </section>

      <section class="shop-section shop-container" id="shop">
        <div class="section-heading">
          <div>
            <span class="eyebrow">OUR COLLECTION</span>
            <h2>Explore eyewear</h2>
            <p>Find something that fits your style.</p>
          </div>
          <div class="search-box">
            <i class="bi bi-search"></i>
            <input id="productSearch" type="search" placeholder="Search products..." aria-label="Search products">
          </div>
        </div>

        <div class="category-list" id="categoryList">
          <button class="category-chip active" data-category="all">All Products</button>
        </div>

        <div class="product-grid" id="productGrid">
          <div class="catalog-message">Loading products...</div>
        </div>
      </section>

      <section class="about-section" id="about">
        <div class="shop-container about-inner">
          <span class="eyebrow">EYE-VIEW OPTICAL CLINIC</span>
          <h2>Better vision starts with the right choice.</h2>
          <p>Explore our online collection and visit our clinic for in-person eye checkups and professional assistance.</p>
        </div>
      </section>
    </main>

    <footer class="shop-footer">
      <div class="shop-container footer-inner">
        <div class="footer-intro">

          <h2>Your vision deserves the best care.</h2>
          <p>Looking for eyewear that fits your style and needs? We're here to help! Contact us today for inquiries, product assistance, and a visit to our clinic.</p>
          <span class="footer-tagline">See Clearly. Look Better. Feel Confident.</span>
        </div>

        <div class="footer-contact">
          <h3>Get in Touch</h3>
          <a href="tel:099301255391">
            <i class="bi bi-telephone-fill"></i>
            099301255391
          </a>
          <a href="https://www.facebook.com/share/1HNeXzUCmM/" target="_blank" rel="noopener noreferrer">
            <i class="bi bi-facebook"></i>
            Message us on Facebook
          </a>
        </div>

        <div class="footer-visit">
          <h3>Visit Our Clinic</h3>
          <p>
            <i class="bi bi-geo-alt-fill"></i>
            Nabunturan, Davao Region, 8800
          </p>
          <p>We look forward to welcoming you!</p>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© ${new Date().getFullYear()} Eye-View Optical Clinic. All rights reserved.</span>
      </div>
    </footer>

    <div class="overlay" id="productOverlay">
      <div class="dialog product-dialog">
        <button class="close-button" data-close="productOverlay" aria-label="Close">&times;</button>
        <div id="productDetails"></div>
      </div>
    </div>

    <div class="overlay" id="cartOverlay">
      <div class="dialog cart-dialog">
        <button class="close-button" data-close="cartOverlay" aria-label="Close">&times;</button>
        <h2>Your shopping bag</h2>
        <div id="cartContents"></div>
      </div>
    </div>

    <div class="overlay" id="authOverlay">
      <div class="dialog auth-dialog">
        <button class="close-button" data-close="authOverlay" aria-label="Close">&times;</button>
        <div class="auth-heading">
          <span class="eyebrow">WELCOME TO EYE-VIEW</span>
          <h2 id="authTitle">Welcome back</h2>
          <p id="authDescription">Log in to continue with your order.</p>
        </div>

        <div id="authMessage"></div>

        <form id="authForm">
          <div id="nameField" class="form-field hidden">
            <label for="authName">Full name</label>
            <input id="authName" type="text" placeholder="Your full name">
          </div>

          <div id="phoneField" class="form-field hidden">
            <label for="authPhone">Phone number</label>
            <input id="authPhone" type="tel" placeholder="Your phone number">
          </div>

          <div class="form-field">
            <label for="authEmail">Email address</label>
            <input id="authEmail" type="email" required placeholder="you@example.com">
          </div>

          <div class="form-field">
            <label for="authPassword">Password</label>
            <input id="authPassword" type="password" required minlength="6" placeholder="At least 6 characters">
          </div>

          <button type="submit" class="primary-button auth-submit" id="authSubmit">Login</button>
        </form>

        <p class="auth-switch">
          <span id="authSwitchText">Don't have an account?</span>
          <button id="authSwitch">Create account</button>
        </p>
      </div>
    </div>


    <div class="overlay" id="profileOverlay">
      <div class="dialog profile-dialog">
        <button class="close-button" data-close="profileOverlay" aria-label="Close">&times;</button>
        <div class="auth-heading">
          <span class="eyebrow">YOUR ACCOUNT</span>
          <h2>My Account</h2>
          <p>Manage your personal information.</p>
        </div>

        <div id="profileMessage"></div>

        <div class="profile-photo-section">
          <div class="profile-avatar-wrap">
            <img id="profileAvatar" alt="Profile photo" hidden>
            <div id="profileAvatarPlaceholder"><i class="bi bi-person"></i></div>
          </div>
          <label class="profile-photo-button" for="profilePhotoInput">
            <i class="bi bi-camera"></i> Change Photo
          </label>
          <input id="profilePhotoInput" type="file" accept="image/jpeg,image/png,image/webp" hidden>
          <button type="button" id="removeAvatarButton" class="profile-remove-photo">Remove photo</button>
        </div>

        <form id="profileForm">
          <div class="form-field">
            <label for="profileFullName">Full name</label>
            <input id="profileFullName" type="text" required maxlength="100">
          </div>
          <div class="form-field">
            <label for="profileEmail">Email address</label>
            <input id="profileEmail" type="email" readonly>
          </div>
          <div class="form-field">
            <label for="profilePhone">Phone number</label>
            <input id="profilePhone" type="tel" maxlength="30">
          </div>
          <button type="submit" class="primary-button auth-submit" id="saveProfileButton">Save Changes</button>
        </form>

        <button type="button" id="profileLogoutButton" class="profile-logout-button">
          <i class="bi bi-box-arrow-right"></i> Log Out
        </button>
      </div>
    </div>


    <div class="overlay" id="ordersOverlay">
      <div class="dialog orders-dialog">
        <button class="close-button" data-close="ordersOverlay" aria-label="Close">&times;</button>
        <div class="auth-heading">
          <span class="eyebrow">YOUR PURCHASES</span>
          <h2>My Orders</h2>
          <p>Track your orders and manage pending purchases.</p>
        </div>
        <section class="customer-orders-section">
          <div class="customer-orders-heading">
            <h3>Order History</h3>
            <button type="button" id="refreshOrdersButton" class="orders-refresh-button">
              <i class="bi bi-arrow-clockwise"></i> Refresh
            </button>
          </div>
          <div id="customerOrders">
            <p class="orders-message">Loading your orders...</p>
          </div>
        </section>
      </div>
    </div>

    <div class="overlay" id="cropOverlay">
      <div class="dialog crop-dialog">
        <button class="close-button" data-close="cropOverlay">&times;</button>
        <div class="auth-heading">
          <span class="eyebrow">PROFILE PHOTO</span>
          <h2>Adjust your photo</h2>
          <p>Drag to reposition and zoom to get the perfect crop.</p>
        </div>
        <div class="crop-image-container">
          <img id="cropImage" alt="Photo to crop">
        </div>
        <div class="crop-controls">
          <button type="button" id="zoomOutButton" aria-label="Zoom out">−</button>
          <input id="cropZoom" type="range" min="0" max="100" value="0">
          <button type="button" id="zoomInButton" aria-label="Zoom in">+</button>
        </div>
        <button type="button" class="primary-button auth-submit" id="applyCropButton">Crop & Use Photo</button>
      </div>
    </div>

    <div class="toast-message" id="toastMessage"></div>
  `;

  bindEvents();
  updateCartCount();
}

function showToast(message) {
  const toast = document.querySelector('#toastMessage');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2600);
}

function openOverlay(id) {
  document.getElementById(id).classList.add('show');
  document.body.classList.add('modal-open');
}

function closeOverlay(id) {
  document.getElementById(id).classList.remove('show');

  if (!document.querySelector('.overlay.show')) {
    document.body.classList.remove('modal-open');
  }
}

function bindEvents() {
  document.querySelector('#productSearch').addEventListener('input', event => {
    searchTerm = event.target.value.toLowerCase();
    renderProducts();
  });

  document.querySelector('#cartButton').addEventListener('click', openCart);

  document.querySelector('#ordersButton').addEventListener('click', openCustomerOrders);

  document.querySelector('#accountButton').addEventListener('click', () => {
    if (currentUser) {
      openCustomerProfile();
    } else {
      openAuth('login');
    }
  });

  document.querySelector('#profilePhotoInput').addEventListener('change', handleAvatarSelection);
  document.querySelector('#applyCropButton').addEventListener('click', applyProfileCrop);
  document.querySelector('#zoomInButton').addEventListener('click', () => {
    if (profileCropper) profileCropper.zoom(0.1);
  });
  document.querySelector('#zoomOutButton').addEventListener('click', () => {
    if (profileCropper) profileCropper.zoom(-0.1);
  });
  document.querySelector('#cropZoom').addEventListener('input', event => {
    adjustCropZoom(event.target.value);
  });
  document.querySelector('#profileForm').addEventListener('submit', saveCustomerProfile);
  document.querySelector('#removeAvatarButton').addEventListener('click', removeCustomerAvatar);
  document.querySelector('#profileLogoutButton').addEventListener('click', logoutCustomer);

  document.querySelector('#refreshOrdersButton').addEventListener('click', loadCustomerOrders);

  document.querySelector('#customerOrders').addEventListener('click', event => {
    const button = event.target.closest('[data-cancel-order]');
    if (button) cancelCustomerOrder(Number(button.dataset.cancelOrder), button.dataset.orderNumber);
  });

  document.querySelector('#authSwitch').addEventListener('click', () => {
    openAuth(document.querySelector('#authForm').dataset.mode === 'login' ? 'register' : 'login');
  });

  document.querySelector('#authForm').addEventListener('submit', handleAuth);

  document.querySelectorAll('[data-close]').forEach(button => {
    button.addEventListener('click', () => closeOverlay(button.dataset.close));
  });

  document.querySelectorAll('.overlay').forEach(overlay => {
    overlay.addEventListener('click', event => {
      if (event.target === overlay) closeOverlay(overlay.id);
    });
  });

  document.querySelector('#productGrid').addEventListener('click', event => {
    const button = event.target.closest('[data-product]');
    if (!button) return;
    showProduct(Number(button.dataset.product));
  });

  document.querySelector('#categoryList').addEventListener('click', event => {
    const button = event.target.closest('[data-category]');
    if (!button) return;

    activeCategory = button.dataset.category;

    document.querySelectorAll('.category-chip').forEach(chip => {
      chip.classList.toggle('active', chip === button);
    });

    renderProducts();
  });

  document.querySelector('#productDetails').addEventListener('click', event => {
    const button = event.target.closest('[data-add]');
    if (button) addToCart(Number(button.dataset.add));
  });

  document.querySelector('#cartContents').addEventListener('click', event => {
    const remove = event.target.closest('[data-remove]');
    if (remove) {
      cart = cart.filter(item => item.id !== Number(remove.dataset.remove));
      saveCart();
      openCart();
      return;
    }

    const checkout = event.target.closest('#checkoutButton');
    if (checkout) checkoutCart();
  });
}

async function loadCatalog() {
  const [productResult, categoryResult] = await Promise.all([
    supabase.from('customer_catalog_products').select('*').order('name'),
    supabase.from('customer_catalog_categories').select('*').order('name')
  ]);

  if (productResult.error) {
    console.error(productResult.error);
    document.querySelector('#productGrid').innerHTML =
      '<div class="catalog-message">Unable to load products. Please refresh the page.</div>';
    return;
  }

  products = productResult.data || [];
  categories = categoryResult.data || [];

  renderCategories();
  renderProducts();
}

function renderCategories() {
  const list = document.querySelector('#categoryList');

  list.innerHTML = `
    <button class="category-chip ${activeCategory === 'all' ? 'active' : ''}" data-category="all">
      All Products
    </button>
    ${categories.map(category => `
      <button class="category-chip ${activeCategory === String(category.id) ? 'active' : ''}"
        data-category="${category.id}">
        ${escapeHTML(category.name)}
      </button>
    `).join('')}
  `;
}

function renderProducts() {
  const filtered = products.filter(product => {
    const matchesCategory = activeCategory === 'all' ||
      String(product.category_id) === activeCategory;

    const matchesSearch = [
      product.name,
      product.description,
      product.category_name,
      product.product_type
    ].join(' ').toLowerCase().includes(searchTerm);

    return matchesCategory && matchesSearch;
  });

  const grid = document.querySelector('#productGrid');

  if (!filtered.length) {
    grid.innerHTML = '<div class="catalog-message">No products found.</div>';
    return;
  }

  grid.innerHTML = filtered.map(product => `
    <article class="product-card">
      <button class="product-image" data-product="${product.id}" aria-label="View ${escapeHTML(product.name)}">
        ${product.image_url
          ? `<img src="${escapeHTML(product.image_url)}" alt="${escapeHTML(product.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'">`
          : ''}
        <span class="image-placeholder" style="${product.image_url ? 'display:none' : ''}">
          <i class="bi bi-eyeglasses"></i>
        </span>
      </button>
      <div class="product-info">
        <span class="product-category">${escapeHTML(product.category_name || product.product_type)}</span>
        <button class="product-name" data-product="${product.id}">${escapeHTML(product.name)}</button>
        <div class="product-bottom">
          <strong>${money(product.price)}</strong>
          <button class="add-button" data-product="${product.id}" aria-label="View product">
            <i class="bi bi-plus-lg"></i>
          </button>
        </div>
      </div>
    </article>
  `).join('');
}

function showProduct(id) {
  const product = products.find(item => item.id === id);
  if (!product) return;

  document.querySelector('#productDetails').innerHTML = `
    <div class="detail-layout">
      <div class="detail-image">
        ${product.image_url
          ? `<img src="${escapeHTML(product.image_url)}" alt="${escapeHTML(product.name)}" onerror="this.style.display='none'">`
          : '<i class="bi bi-eyeglasses"></i>'}
      </div>
      <div class="detail-info">
        <span class="eyebrow">${escapeHTML(product.category_name || product.product_type)}</span>
        <h2>${escapeHTML(product.name)}</h2>
        <strong class="detail-price">${money(product.price)}</strong>
        <p>${escapeHTML(product.description || 'Contact our clinic for more product information.')}</p>
        <button class="primary-button" data-add="${product.id}">
          <i class="bi bi-bag-plus"></i> Add to bag
        </button>
      </div>
    </div>
  `;

  openOverlay('productOverlay');
}

function addToCart(id) {
  const product = products.find(item => item.id === id);
  if (!product) return;

  const existing = cart.find(item => item.id === id);

  if (existing) {
    existing.quantity++;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image_url: product.image_url,
      quantity: 1
    });
  }

  saveCart();
  closeOverlay('productOverlay');
  showToast('Product added to your bag!');
}

function openCart() {
  const contents = document.querySelector('#cartContents');

  if (!cart.length) {
    contents.innerHTML = `
      <div class="empty-cart">
        <i class="bi bi-bag"></i>
        <h3>Your bag is empty</h3>
        <p>Explore our collection and find something you love.</p>
      </div>
    `;
  } else {
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    contents.innerHTML = `
      <div class="cart-items">
        ${cart.map(item => `
          <div class="cart-item">
            <div class="cart-item-image">
              ${item.image_url
                ? `<img src="${escapeHTML(item.image_url)}" alt="">`
                : '<i class="bi bi-eyeglasses"></i>'}
            </div>
            <div class="cart-item-info">
              <strong>${escapeHTML(item.name)}</strong>
              <span>${money(item.price)} × ${item.quantity}</span>
            </div>
            <button class="remove-button" data-remove="${item.id}" aria-label="Remove ${escapeHTML(item.name)}">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        `).join('')}
      </div>
      <div class="cart-total">
        <span>Total</span>
        <strong>${money(total)}</strong>
      </div>
      <button class="primary-button checkout-button" id="checkoutButton">
        Proceed to checkout <i class="bi bi-arrow-right"></i>
      </button>
      <p class="cart-note">Your order will be submitted as a request for clinic confirmation.</p>
    `;
  }

  openOverlay('cartOverlay');
}

function openAuth(mode = 'login') {
  const register = mode === 'register';

  document.querySelector('#authForm').dataset.mode = mode;
  document.querySelector('#authTitle').textContent = register ? 'Create your account' : 'Welcome back';
  document.querySelector('#authDescription').textContent = register
    ? 'Create an account to place and track your orders.'
    : 'Log in to continue with your order.';

  document.querySelector('#nameField').classList.toggle('hidden', !register);
  document.querySelector('#phoneField').classList.toggle('hidden', !register);
  document.querySelector('#authName').required = register;
  document.querySelector('#authSubmit').textContent = register ? 'Create account' : 'Login';
  document.querySelector('#authSwitchText').textContent = register
    ? 'Already have an account?'
    : "Don't have an account?";
  document.querySelector('#authSwitch').textContent = register ? 'Login' : 'Create account';
  document.querySelector('#authMessage').innerHTML = '';

  openOverlay('authOverlay');
}

async function handleAuth(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const mode = form.dataset.mode;
  const email = document.querySelector('#authEmail').value.trim();
  const password = document.querySelector('#authPassword').value;
  const button = document.querySelector('#authSubmit');
  const message = document.querySelector('#authMessage');

  button.disabled = true;
  button.textContent = 'Please wait...';
  message.innerHTML = '';

  try {
    let result;

    if (mode === 'register') {
      result = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/customer.html`,
          data: {
            account_type: 'customer',
            full_name: document.querySelector('#authName').value.trim(),
            phone: document.querySelector('#authPhone').value.trim()
          }
        }
      });

      if (result.error) throw result.error;

      if (result.data.session) {
        currentUser = result.data.user;
        updateAccountButton();
        closeOverlay('authOverlay');
        showToast('Account created successfully!');
        return;
      }

      message.innerHTML = '<div class="auth-success">Account created. Please check your email to confirm your account before logging in.</div>';
    } else {
      result = await supabase.auth.signInWithPassword({ email, password });

      if (result.error) throw result.error;

      currentUser = result.data.user;
      updateAccountButton();
      closeOverlay('authOverlay');
      showToast('Welcome back!');
    }
  } catch (error) {
    message.innerHTML = `<div class="auth-error">${escapeHTML(error.message)}</div>`;
  } finally {
    button.disabled = false;
    button.textContent = mode === 'register' ? 'Create account' : 'Login';
  }
}

function updateAccountButton() {
  const button = document.querySelector('#accountButton');

  if (!button) return;

  button.innerHTML = currentUser
    ? '<i class="bi bi-person-check"></i><span>My Account</span>'
    : '<i class="bi bi-person"></i><span>Login</span>';
}


function showProfileMessage(message, isError = true) {
  const box = document.querySelector('#profileMessage');
  box.innerHTML = '<div class="' + (isError ? 'auth-error' : 'auth-success') + '">' +
    escapeHTML(message) + '</div>';
}

function displayCustomerAvatar(url) {
  const image = document.querySelector('#profileAvatar');
  const placeholder = document.querySelector('#profileAvatarPlaceholder');

  if (url) {
    image.src = url;
    image.hidden = false;
    placeholder.hidden = true;
  } else {
    image.removeAttribute('src');
    image.hidden = true;
    placeholder.hidden = false;
  }
}


async function loadCustomerOrders() {
  const container = document.querySelector('#customerOrders');
  if (!container || !customerProfile?.id) return;

  container.innerHTML = '<p class="orders-message">Loading your orders...</p>';

  try {
    const { data, error } = await supabase
      .from('orders')
      .select('id,order_number,status,total,created_at,order_items(product_name,quantity,line_total)')
      .eq('customer_id', customerProfile.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      container.innerHTML = '<div class="orders-empty"><i class="bi bi-receipt"></i><p>No orders found.</p></div>';
      return;
    }

    container.innerHTML = data.map(order => {
      const status = String(order.status || 'pending').toLowerCase();
      const date = order.created_at
        ? new Date(order.created_at).toLocaleString('en-PH')
        : '';

      const items = (order.order_items || []).map(item => `
        <div class="customer-order-item">
          <span>${escapeOrderText(item.product_name)} × ${Number(item.quantity)}</span>
          <strong>${formatOrderMoney(item.line_total)}</strong>
        </div>
      `).join('');

      return `
        <article class="customer-order-card">
          <div class="customer-order-top">
            <div><strong>${escapeOrderText(order.order_number)}</strong><small>${escapeOrderText(date)}</small></div>
            <span class="order-status status-${escapeOrderText(status)}">${escapeOrderText(status)}</span>
          </div>
          <div class="customer-order-items">${items}</div>
          <div class="customer-order-bottom">
            <strong>Total: ${formatOrderMoney(order.total)}</strong>
            ${status === 'pending' ? `<button type="button" class="cancel-order-button" data-cancel-order="${Number(order.id)}" data-order-number="${escapeOrderText(order.order_number)}">Cancel Order</button>` : ''}
          </div>
        </article>
      `;
    }).join('');
  } catch (error) {
    container.innerHTML = `<p class="orders-error">Unable to load orders: ${escapeOrderText(error.message)}</p>`;
  }
}

function escapeOrderText(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

function formatOrderMoney(value) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(Number(value) || 0);
}

async function cancelCustomerOrder(id, number) {
  if (!window.confirm(`Cancel order ${number}?`)) return;

  try {
    const { error } = await supabase.rpc('cancel_customer_order', {
      p_order_id: id
    });
    if (error) throw error;

    showToast(`Order ${number} cancelled.`);
    await loadCustomerOrders();
  } catch (error) {
    showToast(error.message || 'Unable to cancel order.');
  }
}

async function openCustomerOrders() {
  if (!currentUser) {
    openAuth('login');
    return;
  }

  openOverlay('ordersOverlay');

  const container = document.querySelector('#customerOrders');
  container.innerHTML = '<p class="orders-message">Loading your orders...</p>';

  const { data, error } = await supabase.rpc('get_customer_profile');

  if (error) {
    container.innerHTML = `<p class="orders-error">${escapeOrderText(error.message)}</p>`;
    return;
  }

  customerProfile = data;
  await loadCustomerOrders();
}

async function openCustomerProfile() {
  if (!currentUser) {
    openAuth('login');
    return;
  }

  selectedAvatarFile = null;
  removeAvatarRequested = false;
  document.querySelector('#profileMessage').innerHTML = '';
  document.querySelector('#profileFullName').value = '';
  document.querySelector('#profileEmail').value = currentUser.email || '';
  document.querySelector('#profilePhone').value = '';
  document.querySelector('#profilePhotoInput').value = '';
  document.querySelector('#saveProfileButton').disabled = true;
  displayCustomerAvatar(null);
  openOverlay('profileOverlay');

  const { data, error } = await supabase.rpc('get_customer_profile');

  if (error) {
    showProfileMessage(error.message);
    return;
  }

  customerProfile = data;
  document.querySelector('#profileFullName').value = data.full_name || '';
  document.querySelector('#profileEmail').value = data.email || currentUser.email || '';
  document.querySelector('#profilePhone').value = data.phone || '';

  if (data.avatar_url) {
    const { data: signed, error: imageError } = await supabase.storage
      .from('customer-avatars')
      .createSignedUrl(data.avatar_url, 3600);

    if (!imageError && signed?.signedUrl) {
      displayCustomerAvatar(signed.signedUrl);
    }
  }

  document.querySelector('#saveProfileButton').disabled = false;
}

function handleAvatarSelection(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

  if (!allowedTypes.includes(file.type)) {
    showProfileMessage('Please select a JPG, PNG, or WEBP image.');
    event.target.value = '';
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    showProfileMessage('Your photo must be 5 MB or smaller.');
    event.target.value = '';
    return;
  }

  if (cropSourceUrl) URL.revokeObjectURL(cropSourceUrl);
  cropSourceUrl = URL.createObjectURL(file);

  const image = document.querySelector('#cropImage');
  image.src = cropSourceUrl;
  document.querySelector('#cropZoom').value = 0;
  openOverlay('cropOverlay');

  image.onload = () => {
    if (profileCropper) profileCropper.destroy();

    profileCropper = new Cropper(image, {
      aspectRatio: 1,
      viewMode: 1,
      dragMode: 'move',
      autoCropArea: 0.8,
      responsive: true,
      background: false,
      guides: false,
      center: true,
      highlight: false,
      cropBoxMovable: false,
      cropBoxResizable: false,
      toggleDragModeOnDblclick: false,
      ready() {
        document.querySelector('#cropZoom').value = 0;
      },
      zoom(event) {
        const range = document.querySelector('#cropZoom');
        if (event.detail.ratio <= 0) return;
        range.value = Math.max(0, Math.min(100, Math.round(
          (event.detail.ratio - 1) * 100
        )));
      }
    });
  };

  document.querySelector('#profileMessage').innerHTML = '';
}

function applyProfileCrop() {
  if (!profileCropper) return;

  profileCropper.getCroppedCanvas({
    width: 600,
    height: 600,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high'
  }).toBlob(blob => {
    if (!blob) {
      showProfileMessage('Unable to crop this photo.');
      return;
    }

    selectedAvatarFile = new File(
      [blob],
      'profile-photo.jpg',
      { type: 'image/jpeg' }
    );

    removeAvatarRequested = false;

    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    avatarPreviewUrl = URL.createObjectURL(blob);
    displayCustomerAvatar(avatarPreviewUrl);

    profileCropper.destroy();
    profileCropper = null;

    if (cropSourceUrl) {
      URL.revokeObjectURL(cropSourceUrl);
      cropSourceUrl = null;
    }

    closeOverlay('cropOverlay');
    document.querySelector('#profileMessage').innerHTML = '';
    showToast('Photo cropped! Tap Save Changes to upload.');
  }, 'image/jpeg', 0.9);
}

function adjustCropZoom(value) {
  if (!profileCropper) return;
  const amount = Number(value);
  profileCropper.zoomTo(1 + amount / 100);
}

function removeCustomerAvatar() {
  selectedAvatarFile = null;
  removeAvatarRequested = true;
  document.querySelector('#profilePhotoInput').value = '';

  if (avatarPreviewUrl) {
    URL.revokeObjectURL(avatarPreviewUrl);
    avatarPreviewUrl = null;
  }

  displayCustomerAvatar(null);
  document.querySelector('#profileMessage').innerHTML = '';
}

async function saveCustomerProfile(event) {
  event.preventDefault();

  if (!currentUser || !customerProfile) return;

  const button = document.querySelector('#saveProfileButton');
  const fullName = document.querySelector('#profileFullName').value.trim();
  const phone = document.querySelector('#profilePhone').value.trim();

  if (!fullName) {
    showProfileMessage('Please enter your full name.');
    return;
  }

  button.disabled = true;
  button.textContent = 'Saving...';

  let newAvatarPath = null;
  let avatarPath = removeAvatarRequested ? null : customerProfile.avatar_url;

  try {
    if (selectedAvatarFile) {
      const extension = selectedAvatarFile.type === 'image/png'
        ? 'png'
        : selectedAvatarFile.type === 'image/webp' ? 'webp' : 'jpg';

      newAvatarPath = currentUser.id + '/' + Date.now() + '.' + extension;

      const { error: uploadError } = await supabase.storage
        .from('customer-avatars')
        .upload(newAvatarPath, selectedAvatarFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: selectedAvatarFile.type
        });

      if (uploadError) throw uploadError;
      avatarPath = newAvatarPath;
    }

    const { data, error } = await supabase.rpc('update_customer_profile', {
      p_full_name: fullName,
      p_phone: phone,
      p_avatar_url: avatarPath
    });

    if (error) throw error;

    const oldAvatarPath = customerProfile.avatar_url;
    customerProfile = data;
    selectedAvatarFile = null;
    removeAvatarRequested = false;

    if (avatarPreviewUrl) {
      URL.revokeObjectURL(avatarPreviewUrl);
      avatarPreviewUrl = null;
    }

    if (oldAvatarPath && oldAvatarPath !== data.avatar_url) {
      await supabase.storage.from('customer-avatars').remove([oldAvatarPath]);
    }

    if (data.avatar_url) {
      const { data: signed } = await supabase.storage
        .from('customer-avatars')
        .createSignedUrl(data.avatar_url, 3600);
      displayCustomerAvatar(signed?.signedUrl || null);
    } else {
      displayCustomerAvatar(null);
    }

    showProfileMessage('Your profile has been updated successfully.', false);
    showToast('Profile updated successfully!');
  } catch (error) {
    if (newAvatarPath) {
      await supabase.storage.from('customer-avatars').remove([newAvatarPath]);
    }
    showProfileMessage(error.message || 'Unable to save your profile.');
  } finally {
    button.disabled = false;
    button.textContent = 'Save Changes';
  }
}

async function logoutCustomer() {
  if (!window.confirm('Are you sure you want to log out?')) return;

  const { error } = await supabase.auth.signOut();

  if (error) {
    showProfileMessage(error.message);
    return;
  }

  currentUser = null;
  customerProfile = null;
  closeOverlay('profileOverlay');
  updateAccountButton();
  showToast('You have logged out successfully.');
}

async function checkoutCart() {
  if (!currentUser) {
    openAuth('login');
    return;
  }

  const button = document.querySelector('#checkoutButton');
  if (!button) return;

  button.disabled = true;
  button.textContent = 'Submitting order...';

  try {
    const { data, error } = await supabase.rpc('create_customer_order', {
      p_items: cart.map(item => ({
        product_id: item.id,
        quantity: item.quantity
      })),
      p_notes: null
    });

    if (error) throw error;

    const { data: order } = await supabase
      .from('orders')
      .select('order_number')
      .eq('id', data)
      .single();

    cart = [];
    saveCart();
    closeOverlay('cartOverlay');

    showToast(order?.order_number
      ? `Order ${order.order_number} submitted!`
      : 'Your order was submitted!');
  } catch (error) {
    showToast(error.message || 'Unable to submit your order.');
    openCart();
  }
}

async function start() {
  renderShell();

  const { data } = await supabase.auth.getSession();
  currentUser = data.session?.user || null;
  updateAccountButton();

  supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;
    updateAccountButton();
  });

  await loadCatalog();
}

start();
