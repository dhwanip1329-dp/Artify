/* =========================================
   GLOBAL API CONFIG
========================================= */
const BASE_URL = "http://a3e1042a9f60f42d3ba565ee93ab4c4e-1039973239.ap-south-1.elb.amazonaws.com"

const API_URL = `${BASE_URL}/api/auth`;
const ARTWORK_URL = `${BASE_URL}/api/artworks`;
const ORDER_URL = `${BASE_URL}/api/orders`;

const CURRENCY = "$";

function getUserRole() {
  return localStorage.getItem("role") || "";
}

let allArtworks = [];
const token = localStorage.getItem("token");

let cart = [];
cart = readCartFromStorage();
let activeGalleryCategory = "";
const DEFAULT_CATEGORIES = [
  "Painting",
  "Digital",
  "Photography",
  "Abstract",
  "Portrait",
  "Landscape"
];

function getOrderedCategories(artworks) {
  const dynamicCategories = [...new Set(
    artworks
      .map((art) => String(art.category || "").trim())
      .filter((cat) => cat.length > 0)
  )];

  const defaultLookup = DEFAULT_CATEGORIES.map((cat) => cat.toLowerCase());
  const extras = dynamicCategories
    .filter((cat) => !defaultLookup.includes(cat.toLowerCase()))
    .sort((a, b) => a.localeCompare(b));

  return [...DEFAULT_CATEGORIES, ...extras];
}

function getArtworkId(art) {
  return art.id || art._id;
}

function getArtworkImageUrl(art) {
  const candidates = [
    art?.image,
    art?.imageUrl,
    art?.imageURL,
    art?.s3Url,
    art?.s3URL,
    art?.url
  ];

  const raw = candidates.find(
    (value) => typeof value === "string" && value.trim().length > 0
  );

  if (!raw) return "";

  const value = raw.trim();
  if (/^https?:\/\//i.test(value) || value.startsWith("data:image/")) {
    return value;
  }

  if (value.startsWith("/")) {
    return `${BASE_URL}${value}`;
  }

 return `${BASE_URL}/${value.replace(/^\.?\//, "")}`;
}

function getUserRole() {
  const token = (localStorage.getItem("token") || "").trim();
  if (!token) return null;

  const payload = parseJwtPayload(token);
  return payload?.role || null;
}

function parseJwtPayload(token) {
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return null;
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const payloadJson = atob(padded);
    return JSON.parse(payloadJson);
  } catch (error) {
    return null;
  }
}

function getCurrentUserForCart() {
  const token = (localStorage.getItem("token") || "").trim();
  if (!token) return null;

  const payload = parseJwtPayload(token);
  if (!payload) return null;

  const id = String(payload.id || "").trim();
  const role = String(payload.role || "").trim().toLowerCase();
  if (!id) return null;

  return { id, role: role || "user" };
}

function getCartStorageKey() {
  const user = getCurrentUserForCart();
  if (!user) return "cart_guest";
  return `cart_${user.role}_${user.id}`;
}

function readCartFromStorage() {
  const cartKey = getCartStorageKey();
  const scopedCart = localStorage.getItem(cartKey);

  if (scopedCart) {
    try {
      return normalizeCartItems(JSON.parse(scopedCart) || []);
    } catch (error) {
      return [];
    }
  }

  // One-time migration from old shared key.
  const legacyCart = localStorage.getItem("cart");
  if (!legacyCart) return [];

  try {
    const migrated = normalizeCartItems(JSON.parse(legacyCart) || []);
    localStorage.setItem(cartKey, JSON.stringify(migrated));
    localStorage.removeItem("cart");
    return migrated;
  } catch (error) {
    localStorage.removeItem("cart");
    return [];
  }
}

function writeCartToStorage(items) {
  const normalized = normalizeCartItems(items);
  localStorage.setItem(getCartStorageKey(), JSON.stringify(normalized));
  cart = normalized;
  return normalized;
}

function clearCartFromStorage() {
  localStorage.removeItem(getCartStorageKey());
  cart = [];
}

function formatCategoryLabel(category) {
  const cleanCategory = String(category || "").trim();
  if (!cleanCategory) return "Art";
  if (cleanCategory.toLowerCase().endsWith("art")) return cleanCategory;
  return `${cleanCategory} Art`;
}

/* =========================================
   CART COUNT
========================================= */

function updateCartCount() {
  const countElement = document.getElementById("cartCount");
  if (!countElement) return;

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  countElement.textContent = totalItems;
}

/* =========================================
   LOAD FEATURED (HOME)
========================================= */

async function loadFeaturedArtworks() {
  const grid = document.getElementById("featuredGrid");
  if (!grid) return;

  const res = await fetch(ARTWORK_URL);
  const artworks = await res.json();

  grid.innerHTML = "";

  artworks.slice(0, 3).forEach(art => {
    const card = document.createElement("div");
    card.classList.add("art-card");
    const imageUrl = getArtworkImageUrl(art);

    card.innerHTML = `
      ${imageUrl ? `<img src="${imageUrl}" class="art-image" alt="">` : ""}
      <h3>${art.title}</h3>
      <p><strong>Price :- ${CURRENCY} ${art.price}</strong></p>
    `;

    if (imageUrl) {
      const image = card.querySelector(".art-image");
      if (image) {
        image.onerror = () => {
          image.remove();
        };
      }
    }

    card.onclick = () => {
      window.location.href = `artwork.html?id=${getArtworkId(art)}`;
    };

    grid.appendChild(card);
  });  
}

/* =========================================
   LOAD GALLERY
========================================= */

async function loadGallery() {
  const galleryGrid = document.getElementById("galleryGrid");
  if (!galleryGrid) return;
  const isCategoryPage = window.location.pathname.endsWith("category.html");
  const isGalleryPage = window.location.pathname.endsWith("gallery.html");

  const res = await fetch(ARTWORK_URL);
  allArtworks = await res.json();

  if (isGalleryPage) {
    populateCategoryFilter(allArtworks);
    populateCategoryButtons(allArtworks);
    activeGalleryCategory = "";
    renderGallery([]);
    galleryGrid.innerHTML = `<p class="gallery-empty">Select a category to view artworks.</p>`;
    return;
  }

  if (isCategoryPage) {
    const params = new URLSearchParams(window.location.search);
    const selected = (params.get("category") || "").trim();
    const heading = document.getElementById("categoryPageTitle");

    if (!selected) {
      if (heading) heading.textContent = "Choose a Category";
      renderGallery([]);
      galleryGrid.innerHTML = `<p class="gallery-empty">Please select a category from Gallery page.</p>`;
      return;
    }

    if (selected.toLowerCase() === "all") {
      if (heading) heading.textContent = "All Artworks";
      renderGallery(allArtworks);
      return;
    }

    const filtered = allArtworks.filter(
      (art) => String(art.category || "").trim().toLowerCase() === selected.toLowerCase()
    );
    if (heading) heading.textContent = formatCategoryLabel(selected);
    renderGallery(filtered);
  }
}

function populateCategoryFilter(artworks) {
  const filter = document.getElementById("categoryFilter");
  if (!filter) return;

  const categories = getOrderedCategories(artworks);

  filter.innerHTML = `<option value="">Select Category</option>`;
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    filter.appendChild(option);
  });
}

function populateCategoryButtons(artworks) {
  const wrapper = document.getElementById("categoryButtons");
  if (!wrapper) return;

  const categories = getOrderedCategories(artworks);

  wrapper.innerHTML = "";

  categories.forEach((category) => {
    const btn = document.createElement("button");
    btn.className = "category-btn";
    btn.textContent = category.toUpperCase();
    btn.dataset.category = category;
    btn.onclick = () => {
      window.location.href = `category.html?category=${encodeURIComponent(category)}`;
    };
    wrapper.appendChild(btn);
  });
}

function setActiveCategoryButton(selected) {
  const buttons = document.querySelectorAll(".category-btn");
  buttons.forEach((button) => {
    button.classList.toggle(
      "active",
      String(button.dataset.category || "").toLowerCase() === String(selected).toLowerCase()
    );
  });
}

function filterGallery(categoryFromClick) {
  const filter = document.getElementById("categoryFilter");
  const selected = categoryFromClick || (filter ? filter.value : "");
  activeGalleryCategory = selected;

  if (filter) filter.value = selected;
  setActiveCategoryButton(selected);

  if (!selected) {
    renderGallery([]);
    const galleryGrid = document.getElementById("galleryGrid");
    if (galleryGrid) galleryGrid.innerHTML = `<p class="gallery-empty">Click a category to view artworks.</p>`;
    return;
  }

  if (selected === "all") {
    renderGallery(allArtworks);
    return;
  }

  const filtered = allArtworks.filter(
    (art) => String(art.category || "").trim() === selected
  );
  renderGallery(filtered);
}

function renderGallery(artworks) {
  const galleryGrid = document.getElementById("galleryGrid");
  if (!galleryGrid) return;
  const canManageArtwork = getUserRole() === "artist";

  galleryGrid.innerHTML = "";
  if (!Array.isArray(artworks) || artworks.length === 0) {
    galleryGrid.innerHTML = `<p class="gallery-empty">No artworks available in this category.</p>`;
    return;
  }

 artworks.forEach(art => {
  const card = document.createElement("div");
  card.classList.add("art-card");
  const imageUrl = getArtworkImageUrl(art);

  card.innerHTML = `
    ${imageUrl ? `<img src="${imageUrl}" class="art-image" alt="">` : ""}
    <h3>${art.title}</h3>
    <p>${art.description}</p>
    <p><strong>Price :</strong> ${CURRENCY} ${art.price}</p>
    <p><strong>${formatCategoryLabel(art.category)}</strong></p>

    ${canManageArtwork ? `
      <button onclick="event.stopPropagation(); editArtwork('${getArtworkId(art)}')">Update</button>
      <button onclick="event.stopPropagation(); deleteArtwork('${getArtworkId(art)}')">Delete</button>
    ` : ""}
  `;

  card.onclick = () => {
    window.location.href = `artwork.html?id=${getArtworkId(art)}`;
  };

  if (imageUrl) {
    const image = card.querySelector(".art-image");
    if (image) {
      image.onerror = () => {
        image.remove();
      };
    }
  }

  galleryGrid.appendChild(card);
});
}

/* =========================================
   LOAD SINGLE ARTWORK
========================================= */

function addToCart(id) {
  let existingItem = cart.find(item => String(item.id) === String(id));

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({ id: id, quantity: 1 });
  }

  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartCount();
  alert("Added to cart 🛒");
}

async function loadSingleArtwork() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (!id) return;

  const res = await fetch(ARTWORK_URL);
  const artworks = await res.json();

 const artwork = artworks.find(
  (a) => String(getArtworkId(a)) === String(id)
);

  if (!artwork) return;

  const titleEl = document.getElementById("artTitle");
  const descEl = document.getElementById("artDesc");
  const priceEl = document.getElementById("artPrice");
  const categoryEl = document.getElementById("artCategory");
  const imageEl = document.getElementById("artImage");

  // ✅ Set Artwork Content
  if (titleEl) titleEl.textContent = artwork.title;
  if (descEl) descEl.textContent = artwork.description;
  if (priceEl)
    priceEl.innerHTML = `<strong>Price :</strong> ${CURRENCY} ${artwork.price}`;
  if (categoryEl)
    categoryEl.innerHTML = `<strong>Category :</strong> ${formatCategoryLabel(
      artwork.category
    )}`;
  const imageUrl = getArtworkImageUrl(artwork);
  if (imageEl) {
    if (imageUrl) {
      imageEl.src = imageUrl;
      imageEl.alt = "";
      imageEl.style.display = "block";
      imageEl.onerror = () => {
        imageEl.style.display = "none";
      };
    } else {
      imageEl.removeAttribute("src");
      imageEl.alt = "";
      imageEl.style.display = "none";
    }
  }

  // ===============================
  // 🛒 CART & BUY BUTTONS
  // ===============================

  const addBtn = document.getElementById("addToCartBtn");
  const buyBtn = document.getElementById("buyNowBtn");

  if (addBtn) {
    addBtn.onclick = () => {
      addToCart(getArtworkId(artwork));
    };
  }

  if (buyBtn) {
    buyBtn.onclick = () => {
      addToCart(getArtworkId(artwork));
      window.location.href = "checkout.html";
    };
  }

  // ===============================
  // 🔐 ROLE-BASED UPDATE / DELETE
  // ===============================

const updateBtn = document.getElementById("updateBtn");
const deleteBtn = document.getElementById("deleteBtn");

const canManageArtwork = getUserRole() === "artist";

// Hide or show buttons
if (!canManageArtwork) {
  if (updateBtn) updateBtn.style.display = "none";
  if (deleteBtn) deleteBtn.style.display = "none";
} else {
  if (updateBtn) {
    updateBtn.style.display = "inline-block";
    updateBtn.onclick = () =>
      editArtwork(getArtworkId(artwork));
  }

  if (deleteBtn) {
    deleteBtn.style.display = "inline-block";
    deleteBtn.onclick = () =>
      deleteArtwork(getArtworkId(artwork), true);
  }
}
}

/* =========================================
   DELETE ARTWORK
========================================= */

async function deleteArtwork(id, redirectToGallery = false) {
  const token = (localStorage.getItem("token") || "").trim();

  if (!token) {
    alert("Login required");
    return;
  }

  const confirmDelete = confirm("Are you sure?");
  if (!confirmDelete) return;

  const res = await fetch(`${ARTWORK_URL}/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: "Bearer " + token
    }
  });

  const data = await res.json();

  if (res.ok) {
    alert("Deleted successfully");
    if (redirectToGallery) {
      window.location.href = "gallery.html";
      return;
    }
    loadGallery();
  } else if (res.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    alert(data.message || "Session expired. Please login again.");
    window.location.href = "login.html";
  } else {
    alert(data.message || "Failed to delete artwork");
  }
}

async function editArtwork(id) {
  const token = localStorage.getItem("token");

  if (!token) {
    alert("Login required");
    return;
  }

  const res = await fetch(ARTWORK_URL);
  const artworks = await res.json();
  const artwork = artworks.find(a => String(getArtworkId(a)) === String(id));

  if (!artwork) {
    alert("Artwork not found");
    return;
  }

  const title = prompt("Update title:", artwork.title);
  if (title === null) return;

  const description = prompt("Update description:", artwork.description);
  if (description === null) return;

  const price = prompt("Update price:", artwork.price);
  if (price === null) return;

  const category = prompt("Update category:", artwork.category);
  if (category === null) return;

  const parsedPrice = Number(price);
  if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
    alert("Please enter a valid price");
    return;
  }

  const updateRes = await fetch(`${ARTWORK_URL}/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({
      title: title.trim(),
      description: description.trim(),
      price: parsedPrice,
      category: category.trim()
    })
  });

  const data = await updateRes.json();

  if (updateRes.ok) {
    alert("Artwork updated successfully");
    if (window.location.pathname.endsWith("artwork.html")) {
      loadSingleArtwork();
      return;
    }
    loadGallery();
  } else {
    alert(data.message || "Failed to update artwork");
  }
}

/* =========================================
   ADD TO CART
========================================= */

function normalizeCartItems(items) {
  const merged = new Map();

  (items || []).forEach((item) => {
    const id = String(item?.id || "").trim();
    const quantity = Number(item?.quantity || 0);
    if (!id || !Number.isFinite(quantity) || quantity <= 0) return;
    merged.set(id, (merged.get(id) || 0) + quantity);
  });

  return Array.from(merged.entries()).map(([id, quantity]) => ({ id, quantity }));
}

function addToCart(id) {
  let storedCart = readCartFromStorage();
  const normalizedId = String(id);
  let existingItem = storedCart.find(item => String(item.id) === normalizedId);

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    storedCart.push({ id: normalizedId, quantity: 1 });
  }

  storedCart = normalizeCartItems(storedCart);
  writeCartToStorage(storedCart);
  updateCartCount();
  alert("Added to cart");
}

/* =========================================
   LOAD CART
========================================= */
async function loadCart() {
  console.log("LOAD CART RUNNING");

  const cartDiv = document.getElementById("cartItems");
  const totalDiv = document.getElementById("cartTotal");
  if (!cartDiv) return;

  cartDiv.innerHTML = "";

  let storedCart = readCartFromStorage();
  const res = await fetch(ARTWORK_URL);
  const artworks = await res.json();
  const validIds = new Set(artworks.map((art) => String(getArtworkId(art))));

  // Remove stale cart entries that refer to deleted/missing artworks.
  const cleanedCart = storedCart.filter((item) => validIds.has(String(item.id)));
  if (cleanedCart.length !== storedCart.length) {
    writeCartToStorage(cleanedCart);
  }

  storedCart = cleanedCart;
  cart = storedCart;
  updateCartCount();

  if (storedCart.length === 0) {
    cartDiv.innerHTML = `<p class="cart-empty">Your cart is empty.</p>`;
    if (totalDiv) totalDiv.textContent = CURRENCY + " 0";
    return;
  }

  let total = 0;
  storedCart.forEach((item) => {
    const art = artworks.find((a) => String(getArtworkId(a)) === String(item.id));
    if (!art) return;

    const itemTotal = art.price * item.quantity;
    total += itemTotal;

    const div = document.createElement("div");
    div.className = "cart-item-card";
    const imageUrl = getArtworkImageUrl(art);
    div.innerHTML = `
      ${imageUrl ? `<img src="${imageUrl}" alt="" class="cart-item-image">` : ""}
      <div class="cart-item-content">
        <h3>${art.title}</h3>
        <p class="cart-item-price"><strong>Price :- ${CURRENCY} ${art.price}</strong></p>
        <div class="qty-controls">
          <button onclick="changeQuantity('${item.id}', -1)">-</button>
          <span>${item.quantity}</span>
          <button onclick="changeQuantity('${item.id}', 1)">+</button>
        </div>
        <p class="cart-item-subtotal">Subtotal: ${CURRENCY} ${itemTotal}</p>
        <button class="cart-remove-btn" onclick="removeFromCart('${item.id}')">Remove</button>
      </div>
    `;
    if (imageUrl) {
      const image = div.querySelector(".cart-item-image");
      if (image) {
        image.onerror = () => {
          image.remove();
        };
      }
    }
    cartDiv.appendChild(div);
  });

  if (totalDiv) totalDiv.textContent = CURRENCY + " " + total;
}

function removeFromCart(id) {
  let storedCart = readCartFromStorage();
  storedCart = storedCart.filter(item => String(item.id) !== String(id));
  writeCartToStorage(storedCart);
  updateCartCount();
  loadCart();
}

function changeQuantity(id, change) {
  let storedCart = readCartFromStorage();
  const item = storedCart.find(item => String(item.id) === String(id));
  if (!item) return;

  item.quantity += change;

  if (item.quantity <= 0) {
    storedCart = storedCart.filter(i => String(i.id) !== String(id));
  }

  storedCart = normalizeCartItems(storedCart);
  writeCartToStorage(storedCart);
  updateCartCount();
  loadCart();
}

function updateCartCount() {
  const cartCount = document.getElementById("cartCount");
  const cleanedCart = readCartFromStorage();
  writeCartToStorage(cleanedCart);
  const totalQuantity = cleanedCart.reduce((sum, item) => sum + item.quantity, 0);

  if (cartCount) cartCount.textContent = totalQuantity;
}

/* =========================================
   LOGIN
========================================= */

async function loginUser() {
  try {
    const email = document.getElementById("email").value.trim().toLowerCase();
    const password = document.getElementById("password").value;

    if (!email || !password) {
      alert("Email and password are required");
      return;
    }

    const res = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (res.ok) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role || "");
      alert("Login successful!");
      window.location.href = "gallery.html";
      return;
    }

    alert(data.message || "Login failed");
  } catch (error) {
    alert("Cannot connect to server. Start backend on port 5000.");
    console.error("Login error:", error);
  }
}

/* =========================================
   REGISTER
========================================= */

async function registerUser() {
  try {
    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim().toLowerCase();
    const password = document.getElementById("password").value;
    const roleElement = document.getElementById("role");
    const role = roleElement ? roleElement.value : "artist";

    if (!name || !email || !password) {
      alert("Name, email and password are required");
      return;
    }

    const res = await fetch(`${API_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        role
      })
    });

    const data = await res.json();

    if (res.ok) {
      alert("Registration successful");
      window.location.href = "login.html";
      return;
    }

    alert(data.message || "Registration failed");
  } catch (error) {
    alert("Cannot connect to server. Start backend on port 5000.");
    console.error("Register error:", error);
  }
}

/* =========================================
   UPLOAD ARTWORK
========================================= */

async function uploadArtwork() {
  const token = (localStorage.getItem("token") || "").trim();
  if (!token) {
    alert("Please login first");
    return;
  }
  if (getUserRole() !== "artist") {
    alert("Only artists can upload artworks");
    return;
  }

  const formData = new FormData();
  formData.append("title", document.getElementById("title").value);
  formData.append("description", document.getElementById("description").value);
 
  console.log("PRICE VALUE:", document.getElementById("price").value);
  formData.append("price", document.getElementById("price").value);
  formData.append("category", document.getElementById("category").value);
  formData.append("image", document.getElementById("image").files[0]);

  const res = await fetch(ARTWORK_URL, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token
    },
    body: formData
  });

  const data = await res.json();

  if (res.ok) {
    alert("Artwork uploaded 🎨");
    window.location.href = "gallery.html";
  } else if (res.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    alert(data.message || "Session expired. Please login again.");
    window.location.href = "login.html";
  } else {
    alert(data.message || "Upload failed");
  }
}

/* =========================================
   LOGOUT
========================================= */

function logout() {
  localStorage.removeItem("token");
  alert("Logged out");
  window.location.href = "login.html";
}

/* =========================================
   AUTH UI CONTROL
========================================= */

function checkAuthUI() {
  const token = localStorage.getItem("token");
  const role = getUserRole();

  const loginLink = document.getElementById("loginLink");
  const logoutLink = document.getElementById("logoutLink");
  const registerLink = document.getElementById("registerLink");
  const uploadLink = document.getElementById("uploadLink");

  if (!loginLink || !logoutLink || !registerLink) return;

  if (token) {
    loginLink.style.display = "none";
    registerLink.style.display = "none";
    logoutLink.style.display = "inline-block";
    if (uploadLink) {
      uploadLink.style.display = role === "artist" ? "inline-block" : "none";
    }
  } else {
    loginLink.style.display = "inline-block";
    registerLink.style.display = "inline-block";
    logoutLink.style.display = "none";
    if (uploadLink) uploadLink.style.display = "none";
  }
}

function protectUploadPage() {
  if (!window.location.pathname.endsWith("upload.html")) return;
  const role = getUserRole();

  if (!localStorage.getItem("token")) {
    alert("Please login first");
    window.location.href = "login.html";
    return;
  }

  if (role !== "artist") {
    alert("Only artists can access upload page");
    window.location.href = "gallery.html";
  }
}

/* =========================================
   DOM READY
========================================= */

document.addEventListener("DOMContentLoaded", () => {
  updateCartCount();
  //loadFeaturedArtworks();
  loadGallery();
  loadSingleArtwork();
  loadCart();
  if (typeof loadCheckout === "function") loadCheckout();
  if (typeof loadOrders === "function") loadOrders();
  if (typeof protectUploadPage === "function") protectUploadPage();
  checkAuthUI();
});

function goToCheckout() {
  const storedCart = readCartFromStorage();
  if (storedCart.length === 0) {
    alert("Your cart is empty!");
    return;
  }

  window.location.href = "checkout.html";
}

function controlAccess() {
  const role = localStorage.getItem("role");
  const uploadLink = document.getElementById("uploadLink");

  if (!uploadLink) return;

  if (role !== "artist") {
    uploadLink.style.display = "none";
  }
}

document.addEventListener("DOMContentLoaded", controlAccess);

function getUser() {
  const token = (localStorage.getItem("token") || "").trim();
  if (!token) return null;

  return parseJwtPayload(token);
}

function controlUIByRole() {
  const user = getUser();

  const uploadLink = document.getElementById("uploadLink");

  if (!user || user.role !== "artist") {
    if (uploadLink) uploadLink.style.display = "none";
  }
}

controlUIByRole();

// ===============================
// BUY NOW LOGIC
// ===============================

async function placeOrder(input) {
  try {
    const token = (localStorage.getItem("token") || "").trim();

    if (!token) {
      alert("Please login first");
      return;
    }

    // Supports both:
    // 1) placeOrder(cartItemsArray)
    // 2) placeOrder(event) from checkout form onsubmit
    if (input && typeof input.preventDefault === "function") {
      input.preventDefault();
    }

    const sourceItems = Array.isArray(input)
      ? input
      : readCartFromStorage();

    const items = normalizeCartItems(sourceItems).map((item) => ({
      id: String(item.id),
      quantity: Number(item.quantity) || 1
    }));

    if (items.length === 0) {
      alert("Cart is empty");
      return;
    }

    const res = await fetch(ORDER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({
        items
      })
    });

    const data = await res.json();
    if (res.ok) {
      clearCartFromStorage();
      updateCartCount();
      alert(data.message || "Order placed successfully");
      if (window.location.pathname.endsWith("cart.html")) {
        loadCart();
      } else if (window.location.pathname.endsWith("checkout.html")) {
        window.location.href = "orders.html";
      }
    } else {
      alert(data.message || "Failed to place order");
    }

  } catch (error) {
    console.error("Order error:", error);
    alert("Failed to place order");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const buyBtn = document.getElementById("buyNowBtn");

  if (buyBtn) {
    buyBtn.addEventListener("click", () => {
      const cartItems = readCartFromStorage();

      if (cartItems.length === 0) {
        alert("Cart is empty");
        return;
      }

      placeOrder(cartItems);
    });
  }
});

// ===============================
// LOAD MY ORDERS PAGE
// ===============================

async function loadMyOrders() {
  try {
    const token = localStorage.getItem("token");
    if (!token) return;

    const res = await fetch(`${ORDER_URL}/my`, {
      headers: {
        "Authorization": "Bearer " + token
      }
    });

    const orders = await res.json();

    const container = document.getElementById("ordersList");
    if (!container) return;

    container.innerHTML = "";

    if (orders.length === 0) {
      container.innerHTML = "<p>No orders found.</p>";
      return;
    }

    orders.forEach(order => {
      const div = document.createElement("div");
      div.classList.add("order-card");

      div.innerHTML = `
        <h3>Order ID: ${order.id}</h3>
        <p><strong>Total:</strong> $${order.totalAmount}</p>
        <p><strong>Status:</strong> ${order.status}</p>
        <p><strong>Date:</strong> ${new Date(order.createdAt).toLocaleString()}</p>
        <hr/>
      `;

      container.appendChild(div);
    });

  } catch (error) {
    console.error("Load Orders Error:", error);
  }
}

// Run only on Orders page
document.addEventListener("DOMContentLoaded", () => {
  if (window.location.pathname.includes("orders.html")) {
    loadMyOrders();
  }
});

