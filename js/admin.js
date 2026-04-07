"use strict";

// const API_BASE = "http://localhost:5000/api/admin";

const BASE_API =
  window.APP_RUNTIME_CONFIG?.API_BASE_URL || "http://localhost:5000/api";

const API_BASE = `${BASE_API}/admin`;
const AUTH_API_BASE = `${BASE_API}/auth`;
const UPLOAD_API_BASE = `${BASE_API}/admin/upload`;

const TAB_LABELS = {
  orders: "orders",
  reservations: "reservations",
  inquiries: "inquiries",
  hotels: "hotels",
  "menu-items": "menu items"
};

// ====================== UPLOAD BUTTON ======================
const uploadBtn = document.getElementById("openUploadSectionBtn");

if (uploadBtn) {
  uploadBtn.addEventListener("click", () => {
    const isVisible = setSectionVisibility("uploadSection");
    if (isVisible) {
      scrollSectionIntoView("uploadSection");
    }
  });
}

const ADMIN_TOKEN_KEY = "hotel_platform_admin_token";

function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY) || "";
}

function setAdminToken(token) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

function clearAdminToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

const state = {
  activeTab: "orders",
  hotels: [],
  orders: [],
  reservations: [],
  inquiries: [],
  menuItems: []
};



function $(selector, scope = document) {
  return scope.querySelector(selector);
}

function escapeHTML(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeValue(value = "") {
  return String(value).trim().toLowerCase();
}

function getHotelFilterValue() {
  return $("#hotelFilter")?.value.trim() || "";
}

function setHotelFilterValue(value = "") {
  const select = $("#hotelFilter");
  if (!select) return;
  select.value = value;
}

function getSelectedHotel() {
  const filterValue = getHotelFilterValue();
  if (!filterValue) return null;

  const normalizedFilter = normalizeValue(filterValue);

  return (
    state.hotels.find((hotel) => {
      const slug = normalizeValue(hotel.slug);
      const name = normalizeValue(hotel.name);
      return slug === normalizedFilter || name === normalizedFilter;
    }) || null
  );
}

function getSelectedHotelName() {
  return getSelectedHotel()?.name || "";
}

function getSelectedHotelSlug() {
  const selectedHotel = getSelectedHotel();
  if (selectedHotel?.slug) return selectedHotel.slug;
  return getHotelFilterValue();
}

function getLoadingLabel(activeTab = state.activeTab) {
  return TAB_LABELS[activeTab] || "dashboard";
}

async function fetchJson(url, options = {}) {
  const headers = {
    ...(options.headers || {})
  };

  const token = getAdminToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

function buildUrl(endpoint) {
  const hotelName = getSelectedHotelName();
  if (!hotelName) return `${API_BASE}/${endpoint}`;

  const params = new URLSearchParams({ hotelName });
  return `${API_BASE}/${endpoint}?${params.toString()}`;
}

function getFilteredHotels() {
  const selectedHotel = getSelectedHotel();
  if (!selectedHotel) return state.hotels;

  return state.hotels.filter((hotel) => String(hotel.id) === String(selectedHotel.id));
}

function syncMenuFormHotelSlug({ force = false } = {}) {
  const input = document.getElementById("menuHotelSlugInput");
  const idField = document.getElementById("menuItemDbId");
  if (!input) return;

  const isEditingExistingItem = !!idField?.value.trim();
  if (isEditingExistingItem) return;

  const hotelSlug = getSelectedHotelSlug();

  if (force || !input.value.trim()) {
    input.value = hotelSlug || "";
  }
}

function resetHotelForm() {
  const form = document.getElementById("hotelForm");
  if (!form) return;

  form.reset();
  const idField = document.getElementById("hotelId");
  const activeField = document.getElementById("hotelIsActiveInput");

  if (idField) idField.value = "";
  if (activeField) activeField.checked = true;
}

function resetMenuItemForm() {
  const form = document.getElementById("menuItemForm");
  if (!form) return;

  form.reset();
  const idField = document.getElementById("menuItemDbId");
  const availableField = document.getElementById("menuIsAvailableInput");

  if (idField) idField.value = "";
  if (availableField) availableField.checked = true;

  syncMenuFormHotelSlug({ force: true });
}

function setSectionVisibility(id, shouldShow) {
  const el = document.getElementById(id);
  if (!el) return false;

  const isHidden = getComputedStyle(el).display === "none";
  const nextVisibleState = typeof shouldShow === "boolean" ? shouldShow : isHidden;

  el.style.display = nextVisibleState ? "block" : "none";
  return nextVisibleState;
}

function scrollSectionIntoView(id) {
  const el = document.getElementById(id);
  if (!el) return;

  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function loadHotels() {
  const result = await fetchJson(`${API_BASE}/hotels`);
  state.hotels = result.hotels || [];
  renderHotelFilter();
}

async function loadTabData() {
  const content = $("#adminContent");
  if (content) {
    content.innerHTML = `<p class="loading-state">Loading ${escapeHTML(getLoadingLabel())}...</p>`;
  }

  if (state.activeTab === "orders") {
    const result = await fetchJson(buildUrl("orders"));
    state.orders = result.orders || [];
    renderOrders();
    return;
  }

  if (state.activeTab === "reservations") {
    const result = await fetchJson(buildUrl("reservations"));
    state.reservations = result.reservations || [];
    renderReservations();
    return;
  }

  if (state.activeTab === "inquiries") {
    const result = await fetchJson(buildUrl("inquiries"));
    state.inquiries = result.inquiries || [];
    renderInquiries();
    return;
  }

  if (state.activeTab === "hotels") {
    renderHotels();
    return;
  }

  if (state.activeTab === "menu-items") {
    const hotelSlug = getSelectedHotelSlug();
    const result = await fetchJson(
      hotelSlug
        ? `${API_BASE}/menu-items?hotelSlug=${encodeURIComponent(hotelSlug)}`
        : `${API_BASE}/menu-items`
    );

    state.menuItems = result.menuItems || [];
    renderMenuItems();
    return;
  }

  if (content) {
    content.innerHTML = `<p class="empty-state">Select a valid dashboard section.</p>`;
  }
}

function renderMenuItems() {
  const content = $("#adminContent");
  if (!content) return;

  if (!state.menuItems.length) {
    content.innerHTML = `<p class="empty-state">No menu items found.</p>`;
    return;
  }

  content.innerHTML = `
    <div class="admin-grid">
      ${state.menuItems
        .map(
          (item) => `
            <article class="admin-card">
              <h3>${escapeHTML(item.name || "")}</h3>
              <div class="admin-meta">${escapeHTML(item.hotel_slug || "")} • ${escapeHTML(item.category || "")}</div>

              <div class="admin-row"><strong>DB ID:</strong> ${escapeHTML(item.id)}</div>
              <div class="admin-row"><strong>Item ID:</strong> ${escapeHTML(item.item_id || "")}</div>
              <div class="admin-row"><strong>Price:</strong> ₹${escapeHTML(item.price ?? "")}</div>
              <div class="admin-row"><strong>Badge:</strong> ${escapeHTML(item.badge || "")}</div>
              <div class="admin-row"><strong>Tag:</strong> ${escapeHTML(item.tag || "")}</div>
              <div class="admin-row"><strong>Available:</strong> ${escapeHTML(String(item.is_available))}</div>
              <div class="admin-row"><strong>Archived:</strong> ${escapeHTML(String(item.is_archived))}</div>
              <div class="admin-row"><strong>Sort Order:</strong> ${escapeHTML(item.sort_order ?? "")}</div>

              <button class="status-btn" data-edit-menu-item data-id="${escapeHTML(item.id)}">
                Edit Menu Item
              </button>

              <button 
                class="status-btn" 
                data-toggle-menu-archive 
                data-id="${escapeHTML(item.id)}" 
                data-archived="${escapeHTML(String(item.is_archived))}">
                ${item.is_archived ? "Restore Menu Item" : "Archive Menu Item"}
              </button>

              <button 
                class="status-btn" 
                data-delete-menu-item 
                data-id="${escapeHTML(item.id)}">
                Delete Menu Item
              </button>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function bindEditActions() {
  document.addEventListener("click", async (e) => {
    const menuBtn = e.target.closest("[data-edit-menu-item]");
    if (menuBtn) {
      const id = menuBtn.dataset.id;
      const item = state.menuItems.find((entry) => String(entry.id) === String(id));
      if (!item) return;

      setSectionVisibility("menuFormSection", true);
      document.getElementById("menuItemDbId").value = item.id || "";
      document.getElementById("menuHotelSlugInput").value = item.hotel_slug || "";
      document.getElementById("menuCategoryInput").value = item.category || "";
      document.getElementById("menuItemIdInput").value = item.item_id || "";
      document.getElementById("menuNameInput").value = item.name || "";
      document.getElementById("menuDescriptionInput").value = item.description || "";
      document.getElementById("menuPriceInput").value = item.price || 0;
      document.getElementById("menuImageInput").value = item.image || "";
      document.getElementById("menuAltInput").value = item.alt || "";
      document.getElementById("menuBadgeInput").value = item.badge || "";
      document.getElementById("menuTagInput").value = item.tag || "";
      document.getElementById("menuSortOrderInput").value = item.sort_order || 0;
      document.getElementById("menuIsAvailableInput").checked = !!item.is_available;
      scrollSectionIntoView("menuFormSection");
      return;
    }

    const hotelBtn = e.target.closest("[data-edit-hotel]");
    if (hotelBtn) {
      const id = hotelBtn.dataset.id;
      const hotel = state.hotels.find((entry) => String(entry.id) === String(id));
      if (!hotel) return;

      setSectionVisibility("hotelFormSection", true);
      document.getElementById("hotelId").value = hotel.id || "";
      document.getElementById("hotelSlugInput").value = hotel.slug || "";
      document.getElementById("hotelNameInput").value = hotel.name || "";
      document.getElementById("hotelWhatsappInput").value = hotel.whatsapp_number || "";
      document.getElementById("hotelUpiInput").value = hotel.upi_id || "";
      document.getElementById("hotelGstInput").value = hotel.gst_percent || 5;
      document.getElementById("hotelPrimaryDomainInput").value = hotel.primary_domain || "";
      document.getElementById("hotelSubdomainInput").value = hotel.subdomain || "";
      document.getElementById("hotelIsActiveInput").checked = !!hotel.is_active;
      scrollSectionIntoView("hotelFormSection");
    }

    const profileBtn = e.target.closest("[data-edit-profile]");
if (profileBtn) {
  const slug = profileBtn.dataset.slug;
  if (!slug) return;

  try {
    const result = await fetchHotelProfile(slug);
    fillProfileForm(result.profile);
  } catch (error) {
    console.error("Failed to load profile:", error);
    alert("Failed to load hotel profile");
  }
  return;
}

const archiveBtn = e.target.closest("[data-toggle-menu-archive]");
if (archiveBtn) {
  const id = archiveBtn.dataset.id;
  const currentArchived = archiveBtn.dataset.archived === "true";

  const confirmMessage = currentArchived
    ? "Restore this menu item?"
    : "Archive this menu item?";

  if (!window.confirm(confirmMessage)) return;

  try {
    await toggleMenuArchive(id, !currentArchived);
    await loadTabData();
  } catch (error) {
    console.error("Toggle menu archive failed:", error);
    alert("Failed to update menu item archive state");
  }
  return;
}

const deleteMenuBtn = e.target.closest("[data-delete-menu-item]");
if (deleteMenuBtn) {
  const id = deleteMenuBtn.dataset.id;

  if (!window.confirm("Delete this menu item permanently? This cannot be undone.")) {
    return;
  }

  try {
    await deleteMenuItem(id);
    await loadTabData();
  } catch (error) {
    console.error("Delete menu item failed:", error);
    alert("Failed to delete menu item");
  }
  return;
}

const hotelActiveBtn = e.target.closest("[data-toggle-hotel-active]");
if (hotelActiveBtn) {
  const id = hotelActiveBtn.dataset.id;
  const currentActive = hotelActiveBtn.dataset.active === "true";

  const confirmMessage = currentActive
    ? "Deactivate this hotel? It will stop resolving for live use."
    : "Activate this hotel?";

  if (!window.confirm(confirmMessage)) return;

  try {
    await toggleHotelActive(id, !currentActive);
    await loadHotels();
    if (state.activeTab === "hotels") {
      await loadTabData();
    }
  } catch (error) {
    console.error("Toggle hotel active failed:", error);
    alert("Failed to update hotel active state");
  }
  return;
}

  });
}

function renderHotelFilter() {
  const select = $("#hotelFilter");
  if (!select) return;

  const currentValue = getHotelFilterValue();
  const optionMap = new Map();

  state.hotels.forEach((hotel) => {
    const optionValue = (hotel.slug || hotel.name || "").trim();
    if (!optionValue) return;

    const key = normalizeValue(optionValue);
    if (!optionMap.has(key)) {
      optionMap.set(key, {
        value: optionValue,
        label: hotel.name || hotel.slug || optionValue
      });
    }
  });

  select.innerHTML = `
    <option value="">All Hotels</option>
    ${[...optionMap.values()]
      .map(
        (hotel) => `
          <option value="${escapeHTML(hotel.value)}">
            ${escapeHTML(hotel.label)}
          </option>
        `
      )
      .join("")}
  `;

  const matchingOption = [...optionMap.values()].find(
    (hotel) => normalizeValue(hotel.value) === normalizeValue(currentValue)
  );

  select.value = matchingOption?.value || "";
  syncMenuFormHotelSlug({ force: true });
}

function renderOrders() {
  const content = $("#adminContent");
  if (!content) return;

  if (!state.orders.length) {
    content.innerHTML = `<p class="empty-state">No orders found.</p>`;
    return;
  }

  content.innerHTML = `
    <div class="admin-grid">
      ${state.orders
        .map(
          (order) => `
            <article class="admin-card">
              <h3>Order #${escapeHTML(order.id)}</h3>
              <div class="admin-meta">${escapeHTML(order.created_at || "")}</div>

              <div class="admin-row"><strong>Hotel:</strong> ${escapeHTML(order.hotel_name || "")}</div>
              <div class="admin-row"><strong>Customer:</strong> ${escapeHTML(order.customer_name || "")}</div>
              <div class="admin-row"><strong>Phone:</strong> ${escapeHTML(order.customer_phone || "")}</div>
              <div class="admin-row"><strong>Address:</strong> ${escapeHTML(order.customer_address || "")}</div>
              <div class="admin-row"><strong>Payment:</strong> ${escapeHTML(order.payment_method || "")}</div>
              <div class="admin-row"><strong>Note:</strong> ${escapeHTML(order.note || "")}</div>
              <div class="admin-row"><strong>Total:</strong> ₹${escapeHTML(order.totals?.total ?? "")}</div>
              <div class="admin-row"><strong>Status:</strong> <span class="status-badge">${escapeHTML(order.status || "new")}</span></div>

              <details>
                <summary>View Items</summary>
                <pre class="json-box">${escapeHTML(JSON.stringify(order.items || [], null, 2))}</pre>
              </details>

              <div class="status-row">
                <select class="status-select" data-type="orders" data-id="${escapeHTML(order.id)}">
                  <option value="new" ${order.status === "new" ? "selected" : ""}>new</option>
                  <option value="confirmed" ${order.status === "confirmed" ? "selected" : ""}>confirmed</option>
                  <option value="preparing" ${order.status === "preparing" ? "selected" : ""}>preparing</option>
                  <option value="completed" ${order.status === "completed" ? "selected" : ""}>completed</option>
                  <option value="cancelled" ${order.status === "cancelled" ? "selected" : ""}>cancelled</option>
                </select>
                <button class="status-btn" data-update-status data-type="orders" data-id="${escapeHTML(order.id)}">Update Status</button>
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderReservations() {
  const content = $("#adminContent");
  if (!content) return;

  if (!state.reservations.length) {
    content.innerHTML = `<p class="empty-state">No reservations found.</p>`;
    return;
  }

  content.innerHTML = `
    <div class="admin-grid">
      ${state.reservations
        .map(
          (item) => `
            <article class="admin-card">
              <h3>Reservation #${escapeHTML(item.id)}</h3>
              <div class="admin-meta">${escapeHTML(item.created_at || "")}</div>

              <div class="admin-row"><strong>Hotel:</strong> ${escapeHTML(item.hotel_name || "")}</div>
              <div class="admin-row"><strong>Name:</strong> ${escapeHTML(item.name || "")}</div>
              <div class="admin-row"><strong>Phone:</strong> ${escapeHTML(item.phone || "")}</div>
              <div class="admin-row"><strong>Date:</strong> ${escapeHTML(item.date || "")}</div>
              <div class="admin-row"><strong>Time:</strong> ${escapeHTML(item.time || "")}</div>
              <div class="admin-row"><strong>Guests:</strong> ${escapeHTML(item.guests || "")}</div>
              <div class="admin-row"><strong>Note:</strong> ${escapeHTML(item.note || "")}</div>
              <div class="admin-row"><strong>Status:</strong> <span class="status-badge">${escapeHTML(item.status || "new")}</span></div>

              <div class="status-row">
                <select class="status-select" data-type="reservations" data-id="${escapeHTML(item.id)}">
                  <option value="new" ${item.status === "new" ? "selected" : ""}>new</option>
                  <option value="confirmed" ${item.status === "confirmed" ? "selected" : ""}>confirmed</option>
                  <option value="seated" ${item.status === "seated" ? "selected" : ""}>seated</option>
                  <option value="completed" ${item.status === "completed" ? "selected" : ""}>completed</option>
                  <option value="cancelled" ${item.status === "cancelled" ? "selected" : ""}>cancelled</option>
                </select>
                <button class="status-btn" data-update-status data-type="reservations" data-id="${escapeHTML(item.id)}">Update Status</button>
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderInquiries() {
  const content = $("#adminContent");
  if (!content) return;

  if (!state.inquiries.length) {
    content.innerHTML = `<p class="empty-state">No inquiries found.</p>`;
    return;
  }

  content.innerHTML = `
    <div class="admin-grid">
      ${state.inquiries
        .map(
          (item) => `
            <article class="admin-card">
              <h3>Inquiry #${escapeHTML(item.id)}</h3>
              <div class="admin-meta">${escapeHTML(item.created_at || "")}</div>

              <div class="admin-row"><strong>Hotel:</strong> ${escapeHTML(item.hotel_name || "")}</div>
              <div class="admin-row"><strong>Name:</strong> ${escapeHTML(item.name || "")}</div>
              <div class="admin-row"><strong>Phone:</strong> ${escapeHTML(item.phone || "")}</div>
              <div class="admin-row"><strong>Event Type:</strong> ${escapeHTML(item.event_type || "")}</div>
              <div class="admin-row"><strong>Date:</strong> ${escapeHTML(item.date || "")}</div>
              <div class="admin-row"><strong>Guests:</strong> ${escapeHTML(item.guests || "")}</div>
              <div class="admin-row"><strong>Requirements:</strong> ${escapeHTML(item.special_requirements || "")}</div>
              <div class="admin-row"><strong>Status:</strong> <span class="status-badge">${escapeHTML(item.status || "new")}</span></div>

              <div class="status-row">
                <select class="status-select" data-type="inquiries" data-id="${escapeHTML(item.id)}">
                  <option value="new" ${item.status === "new" ? "selected" : ""}>new</option>
                  <option value="contacted" ${item.status === "contacted" ? "selected" : ""}>contacted</option>
                  <option value="converted" ${item.status === "converted" ? "selected" : ""}>converted</option>
                  <option value="closed" ${item.status === "closed" ? "selected" : ""}>closed</option>
                </select>
                <button class="status-btn" data-update-status data-type="inquiries" data-id="${escapeHTML(item.id)}">Update Status</button>
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderHotels() {
  const content = $("#adminContent");
  if (!content) return;

  const hotelsToRender = getFilteredHotels();

  if (!hotelsToRender.length) {
    content.innerHTML = `<p class="empty-state">${getHotelFilterValue() ? "No hotels found for the selected filter." : "No hotels found."}</p>`;
    return;
  }

  content.innerHTML = `
    <div class="admin-grid">
      ${hotelsToRender
        .map(
          (hotel) => `
            <article class="admin-card">
              <h3>${escapeHTML(hotel.name || "")}</h3>
              <div class="admin-meta">${escapeHTML(hotel.created_at || "")}</div>
              <div class="admin-row"><strong>Slug:</strong> ${escapeHTML(hotel.slug || "")}</div>
              <div class="admin-row"><strong>WhatsApp:</strong> ${escapeHTML(hotel.whatsapp_number || "")}</div>
              <div class="admin-row"><strong>UPI ID:</strong> ${escapeHTML(hotel.upi_id || "")}</div>
              <div class="admin-row"><strong>GST %:</strong> ${escapeHTML(hotel.gst_percent ?? "")}</div>
              <div class="admin-row"><strong>Primary Domain:</strong> ${escapeHTML(hotel.primary_domain || "")}</div>
              <div class="admin-row"><strong>Subdomain:</strong> ${escapeHTML(hotel.subdomain || "")}</div>
              <div class="admin-row"><strong>Active:</strong> ${escapeHTML(String(hotel.is_active))}</div>
              <button class="status-btn" data-edit-hotel data-id="${escapeHTML(hotel.id)}">Edit Hotel</button>
              <button class="status-btn" data-edit-profile data-slug="${escapeHTML(hotel.slug)}">Edit Profile</button>
              <button class="status-btn" data-toggle-hotel-active data-id="${escapeHTML(hotel.id)}" data-active="${escapeHTML(String(hotel.is_active))}">
  ${hotel.is_active ? "Deactivate Hotel" : "Activate Hotel"}
</button>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

async function updateStatus(type, id, status) {
  await fetchJson(`${API_BASE}/${type}/${id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ status })
  });
}

function bindTabs() {
  const tabs = [...document.querySelectorAll(".admin-tab[data-tab]")];
  tabs.forEach((tab) => {
    tab.addEventListener("click", async () => {
      tabs.forEach((btn) => btn.classList.remove("active"));
      tab.classList.add("active");
      state.activeTab = tab.dataset.tab;
      await loadTabData();
    });
  });
}

function bindHotelFilter() {
  const select = $("#hotelFilter");
  if (!select) return;

  select.addEventListener("change", async () => {
    syncMenuFormHotelSlug({ force: true });
    await loadTabData();
  });
}

function bindStatusActions() {
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-update-status]");
    if (!btn) return;

    const { type, id } = btn.dataset;
    const select = document.querySelector(
      `.status-select[data-type="${type}"][data-id="${id}"]`
    );

    if (!select) return;

    try {
      btn.disabled = true;
      btn.textContent = "Updating...";

      await updateStatus(type, id, select.value);
      await loadTabData();
    } catch (error) {
      console.error("Status update failed:", error);
      alert("Failed to update status");
    } finally {
      btn.disabled = false;
      btn.textContent = "Update Status";
    }
  });
}

function bindFormToggles() {
  const hotelBtn = document.getElementById("openHotelFormBtn");
  const menuBtn = document.getElementById("openMenuFormBtn");
const profileBtn = document.getElementById("openProfileFormBtn");

if (profileBtn) {
  profileBtn.addEventListener("click", () => {
    const isVisible = setSectionVisibility("profileFormSection");
    if (isVisible) {
      scrollSectionIntoView("profileFormSection");
    }
  });
}

  if (hotelBtn) {
    hotelBtn.addEventListener("click", () => {
      const isVisible = setSectionVisibility("hotelFormSection");
      if (isVisible) {
        scrollSectionIntoView("hotelFormSection");
      }
    });
  }

  if (menuBtn) {
    menuBtn.addEventListener("click", () => {
      syncMenuFormHotelSlug({ force: true });
      const isVisible = setSectionVisibility("menuFormSection");
      if (isVisible) {
        scrollSectionIntoView("menuFormSection");
      }
    });
  }
}

async function createHotel(payload) {
  return fetchJson(`${API_BASE}/hotels`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

async function updateHotel(id, payload) {
  return fetchJson(`${API_BASE}/hotels/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

async function createMenuItem(payload) {
  return fetchJson(`${API_BASE}/menu-items`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

async function updateMenuItem(id, payload) {
  return fetchJson(`${API_BASE}/menu-items/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

function bindHotelForm() {
  const form = document.getElementById("hotelForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitButton = e.submitter || form.querySelector('button[type="submit"]');
    const id = document.getElementById("hotelId")?.value.trim();
    const currentlySelectedHotelId = getSelectedHotel()?.id;

    const payload = {
      slug: document.getElementById("hotelSlugInput")?.value.trim(),
      name: document.getElementById("hotelNameInput")?.value.trim(),
      whatsappNumber: document.getElementById("hotelWhatsappInput")?.value.trim(),
      upiId: document.getElementById("hotelUpiInput")?.value.trim(),
      gstPercent: Number(document.getElementById("hotelGstInput")?.value || 5),
      primaryDomain: document.getElementById("hotelPrimaryDomainInput")?.value.trim(),
      subdomain: document.getElementById("hotelSubdomainInput")?.value.trim(),
      isActive: !!document.getElementById("hotelIsActiveInput")?.checked
    };

    try {
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = id ? "Updating hotel..." : "Creating hotel...";
      }

      if (id) {
        await updateHotel(id, payload);
        alert("Hotel updated successfully");
      } else {
        await createHotel(payload);
        alert("Hotel created successfully");
      }

      await loadHotels();

      if (id && currentlySelectedHotelId && String(currentlySelectedHotelId) === String(id)) {
        const updatedHotel = state.hotels.find((entry) => String(entry.id) === String(id));
        if (updatedHotel) {
          setHotelFilterValue(updatedHotel.slug || updatedHotel.name || "");
        }
      }

      resetHotelForm();
      syncMenuFormHotelSlug({ force: true });
      await loadTabData();
    } catch (error) {
      console.error("Hotel form submit failed:", error);
      alert("Failed to save hotel");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Save Hotel";
      }
    }
  });
}

function bindMenuItemForm() {
  const form = document.getElementById("menuItemForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitButton = e.submitter || form.querySelector('button[type="submit"]');
    const id = document.getElementById("menuItemDbId")?.value.trim();

    const payload = {
      hotelSlug: document.getElementById("menuHotelSlugInput")?.value.trim(),
      category: document.getElementById("menuCategoryInput")?.value.trim(),
      itemId: document.getElementById("menuItemIdInput")?.value.trim(),
      name: document.getElementById("menuNameInput")?.value.trim(),
      description: document.getElementById("menuDescriptionInput")?.value.trim(),
      price: Number(document.getElementById("menuPriceInput")?.value || 0),
      image: document.getElementById("menuImageInput")?.value.trim(),
      alt: document.getElementById("menuAltInput")?.value.trim(),
      badge: document.getElementById("menuBadgeInput")?.value.trim(),
      tag: document.getElementById("menuTagInput")?.value.trim(),
      sortOrder: Number(document.getElementById("menuSortOrderInput")?.value || 0),
      isAvailable: !!document.getElementById("menuIsAvailableInput")?.checked
    };

    try {
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = id ? "Updating menu item..." : "Creating menu item...";
      }

      if (id) {
        await updateMenuItem(id, payload);
        alert("Menu item updated successfully");
      } else {
        await createMenuItem(payload);
        alert("Menu item created successfully");
      }

      resetMenuItemForm();

      if (state.activeTab === "menu-items") {
        await loadTabData();
      }
    } catch (error) {
      console.error("Menu form submit failed:", error);
      alert("Failed to save menu item");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Save Menu Item";
      }
    }
  });
}

async function fetchHotelProfile(slug) {
  return fetchJson(`${API_BASE}/hotel-profiles/${encodeURIComponent(slug)}`);
}

async function saveHotelProfile(payload) {
  return fetchJson(`${API_BASE}/hotel-profiles`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

function parseJsonInput(value, fallback) {
  const trimmed = String(value || "").trim();

  if (!trimmed) return fallback;

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    throw new Error("Invalid JSON input");
  }
}

function formatJson(value) {
  return JSON.stringify(value ?? null, null, 2);
}

function bindProfileForm() {
  const form = document.getElementById("profileForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      const payload = {
        hotelSlug: document.getElementById("profileHotelSlugInput")?.value.trim(),
        hotelName: document.getElementById("profileHotelNameInput")?.value.trim(),
        tagline: document.getElementById("profileTaglineInput")?.value.trim(),
        ownerWhatsAppNumber: document.getElementById("profileWhatsappInput")?.value.trim(),
        ownerUpiId: document.getElementById("profileUpiInput")?.value.trim(),
        gstPercent: Number(document.getElementById("profileGstInput")?.value || 5),

        branding: {
          logoTextPrimary: document.getElementById("profileBrandPrimaryInput")?.value.trim(),
          logoTextSecondary: document.getElementById("profileBrandSecondaryInput")?.value.trim()
        },

        hero: {
          titleLine1: document.getElementById("profileHeroLine1Input")?.value.trim(),
          titleLine2: document.getElementById("profileHeroLine2Input")?.value.trim(),
          titleLine3: document.getElementById("profileHeroLine3Input")?.value.trim(),
          stats: parseJsonInput(document.getElementById("profileHeroStatsInput")?.value, [])
        },

        about: {
          eyebrow: document.getElementById("profileAboutEyebrowInput")?.value.trim(),
          title: document.getElementById("profileAboutTitleInput")?.value.trim(),
          paragraphs: parseJsonInput(document.getElementById("profileAboutParagraphsInput")?.value, [])
        },

        features: parseJsonInput(document.getElementById("profileFeaturesInput")?.value, []),

        events: {
          eyebrow: document.getElementById("profileEventsEyebrowInput")?.value.trim(),
          title: document.getElementById("profileEventsTitleInput")?.value.trim(),
          subtitle: document.getElementById("profileEventsSubtitleInput")?.value.trim(),
          cards: parseJsonInput(document.getElementById("profileEventsCardsInput")?.value, [])
        },

        reservation: {
          eyebrow: document.getElementById("profileReservationEyebrowInput")?.value.trim(),
          title: document.getElementById("profileReservationTitleInput")?.value.trim(),
          subtitle: document.getElementById("profileReservationSubtitleInput")?.value.trim()
        },

        contactSection: {
          eyebrow: document.getElementById("profileContactEyebrowInput")?.value.trim(),
          title: document.getElementById("profileContactTitleInput")?.value.trim(),
          subtitle: document.getElementById("profileContactSubtitleInput")?.value.trim()
        },

        contact: {
          phone: document.getElementById("profilePhoneInput")?.value.trim(),
          email: document.getElementById("profileEmailInput")?.value.trim(),
          address: document.getElementById("profileAddressInput")?.value.trim()
        },

        location: {
          mapEmbedUrl: document.getElementById("profileMapEmbedInput")?.value.trim(),
          mapLink: document.getElementById("profileMapLinkInput")?.value.trim()
        },

        footer: {
          description: document.getElementById("profileFooterDescriptionInput")?.value.trim()
        },

        social: {
          instagram: document.getElementById("profileInstagramInput")?.value.trim(),
          facebook: document.getElementById("profileFacebookInput")?.value.trim(),
          youtube: document.getElementById("profileYoutubeInput")?.value.trim()
        }
      };

      if (!payload.hotelSlug || !payload.hotelName) {
        alert("Hotel slug and hotel name are required.");
        return;
      }

      await saveHotelProfile(payload);
      alert("Hotel profile saved successfully.");
    } catch (error) {
      console.error("Profile form submit failed:", error);
      alert(error.message || "Failed to save hotel profile");
    }
  });
}

function fillProfileForm(profile) {
  if (!profile) return;

  document.getElementById("profileFormSection").style.display = "block";

  document.getElementById("profileHotelSlugInput").value = profile.hotel_slug || "";
  document.getElementById("profileHotelNameInput").value = profile.hotel_name || "";
  document.getElementById("profileTaglineInput").value = profile.tagline || "";
  document.getElementById("profileWhatsappInput").value = profile.owner_whatsapp_number || "";
  document.getElementById("profileUpiInput").value = profile.owner_upi_id || "";
  document.getElementById("profileGstInput").value = profile.gst_percent ?? 5;

  document.getElementById("profileBrandPrimaryInput").value = profile.branding?.logoTextPrimary || "";
  document.getElementById("profileBrandSecondaryInput").value = profile.branding?.logoTextSecondary || "";

  document.getElementById("profileHeroLine1Input").value = profile.hero?.titleLine1 || "";
  document.getElementById("profileHeroLine2Input").value = profile.hero?.titleLine2 || "";
  document.getElementById("profileHeroLine3Input").value = profile.hero?.titleLine3 || "";
  document.getElementById("profileHeroStatsInput").value = formatJson(profile.hero?.stats || []);

  document.getElementById("profileAboutEyebrowInput").value = profile.about?.eyebrow || "";
  document.getElementById("profileAboutTitleInput").value = profile.about?.title || "";
  document.getElementById("profileAboutParagraphsInput").value = formatJson(profile.about?.paragraphs || []);

  document.getElementById("profileFeaturesInput").value = formatJson(profile.features || []);

  document.getElementById("profileEventsEyebrowInput").value = profile.events?.eyebrow || "";
  document.getElementById("profileEventsTitleInput").value = profile.events?.title || "";
  document.getElementById("profileEventsSubtitleInput").value = profile.events?.subtitle || "";
  document.getElementById("profileEventsCardsInput").value = formatJson(profile.events?.cards || []);

  document.getElementById("profileReservationEyebrowInput").value = profile.reservation?.eyebrow || "";
  document.getElementById("profileReservationTitleInput").value = profile.reservation?.title || "";
  document.getElementById("profileReservationSubtitleInput").value = profile.reservation?.subtitle || "";

  document.getElementById("profileContactEyebrowInput").value = profile.contact_section?.eyebrow || "";
  document.getElementById("profileContactTitleInput").value = profile.contact_section?.title || "";
  document.getElementById("profileContactSubtitleInput").value = profile.contact_section?.subtitle || "";

  document.getElementById("profilePhoneInput").value = profile.contact?.phone || "";
  document.getElementById("profileEmailInput").value = profile.contact?.email || "";
  document.getElementById("profileAddressInput").value = profile.contact?.address || "";

  document.getElementById("profileMapEmbedInput").value = profile.location?.mapEmbedUrl || "";
  document.getElementById("profileMapLinkInput").value = profile.location?.mapLink || "";

  document.getElementById("profileFooterDescriptionInput").value = profile.footer?.description || "";

  document.getElementById("profileInstagramInput").value = profile.social?.instagram || "";
  document.getElementById("profileFacebookInput").value = profile.social?.facebook || "";
  document.getElementById("profileYoutubeInput").value = profile.social?.youtube || "";
}


async function loginAdmin(email, password) {
 const response = await fetch(`${AUTH_API_BASE}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Login failed");
  }

  return data;
}

function showLoginView() {
  const loginWrap = document.getElementById("adminLoginWrap");
  const dashboardWrap = document.getElementById("adminDashboardWrap");

  if (loginWrap) loginWrap.style.display = "block";
  if (dashboardWrap) dashboardWrap.style.display = "none";
}

function showDashboardView() {
  const loginWrap = document.getElementById("adminLoginWrap");
  const dashboardWrap = document.getElementById("adminDashboardWrap");

  if (loginWrap) loginWrap.style.display = "none";
  if (dashboardWrap) dashboardWrap.style.display = "block";
}

function bindAdminLoginForm() {
  const form = document.getElementById("adminLoginForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("adminEmailInput")?.value.trim();
    const password = document.getElementById("adminPasswordInput")?.value || "";

    try {
      const result = await loginAdmin(email, password);
      setAdminToken(result.token);
      showDashboardView();
      await loadHotels();
      await loadTabData();
    } catch (error) {
      console.error("Admin login failed:", error);
      alert(error.message || "Login failed");
    }
  });
}

function bindAdminLogout() {
  const btn = document.getElementById("adminLogoutBtn");
  if (!btn) return;

  btn.addEventListener("click", () => {
    clearAdminToken();
    showLoginView();
  });
}

async function checkExistingAdminSession() {
  const token = getAdminToken();

  if (!token) {
    showLoginView();
    return false;
  }

  try {
    // await fetchJson("http://localhost:5000/api/auth/me");
    await fetchJson(`${AUTH_API_BASE}/me`);
    showDashboardView();
    return true;
  } catch (error) {
    console.warn("Admin session invalid:", error);
    clearAdminToken();
    showLoginView();
    return false;
  }
}

async function uploadImageFile({ hotelSlug, folder, file }) {
  const token = getAdminToken();
  const formData = new FormData();

  formData.append("hotelSlug", hotelSlug || "shared");
  formData.append("folder", folder || "misc");
  formData.append("file", file);

const response = await fetch(UPLOAD_API_BASE, {
    method: "POST",
    headers: token
      ? {
          Authorization: `Bearer ${token}`
        }
      : {},
    body: formData
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Upload failed");
  }

  return data;
}

function bindUploadForm() {
  const form = document.getElementById("uploadForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const hotelSlug =
      document.getElementById("uploadHotelSlugInput")?.value.trim() || "shared";
    const folder =
      document.getElementById("uploadFolderInput")?.value.trim() || "misc";
    const targetFieldId =
      document.getElementById("uploadTargetFieldInput")?.value.trim() || "";
    const fileInput = document.getElementById("uploadFileInput");
    const resultWrap = document.getElementById("uploadResult");
    const file = fileInput?.files?.[0];

    if (!file) {
      alert("Please choose a file first.");
      return;
    }

    try {
      if (resultWrap) {
        resultWrap.innerHTML = `<p class="loading-state">Uploading...</p>`;
      }

      const result = await uploadImageFile({
        hotelSlug,
        folder,
        file
      });

      const publicUrl = result.file?.publicUrl || "";

      if (targetFieldId) {
        const targetInput = document.getElementById(targetFieldId);
        if (targetInput) {
          targetInput.value = publicUrl;
        }
      }

      if (resultWrap) {
        resultWrap.innerHTML = `
          <div class="admin-card" style="margin-top: 12px;">
            <p><strong>Uploaded successfully</strong></p>
            <p><strong>URL:</strong> <a href="${escapeHTML(publicUrl)}" target="_blank" rel="noopener noreferrer">${escapeHTML(publicUrl)}</a></p>
            <img src="${escapeHTML(publicUrl)}" alt="Uploaded preview" style="max-width: 240px; border-radius: 8px; margin-top: 10px;" />
          </div>
        `;
      }

      form.reset();
    } catch (error) {
      console.error("Upload failed:", error);
      if (resultWrap) {
        resultWrap.innerHTML = `<p class="empty-state">Upload failed: ${escapeHTML(error.message || "Unknown error")}</p>`;
      }
    }
  });
}

async function toggleMenuArchive(id, isArchived) {
  return fetchJson(`${API_BASE}/menu-items/${id}/archive`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ isArchived })
  });
}

async function deleteMenuItem(id) {
  return fetchJson(`${API_BASE}/menu-items/${id}`, {
    method: "DELETE"
  });
}

async function toggleHotelActive(id, isActive) {
  return fetchJson(`${API_BASE}/hotels/${id}/active`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ isActive })
  });
}

async function deleteUploadedFile(storagePath) {
  return fetchJson(UPLOAD_API_BASE, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ storagePath })
  });
}

function bindUploadedFileDelete() {
  const btn = document.getElementById("deleteUploadedFileBtn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const storagePath =
      document.getElementById("deleteStoragePathInput")?.value.trim() || "";

    if (!storagePath) {
      alert("Enter a storage path first.");
      return;
    }

    if (!window.confirm("Delete this uploaded file?")) return;

    try {
      await deleteUploadedFile(storagePath);
      alert("Uploaded file deleted successfully");
      document.getElementById("deleteStoragePathInput").value = "";
    } catch (error) {
      console.error("Delete uploaded file failed:", error);
      alert("Failed to delete uploaded file");
    }
  });
}

async function initAdmin() {
  try {
    bindTabs();
    bindHotelFilter();
    bindStatusActions();
    bindFormToggles();
    bindHotelForm();
    bindMenuItemForm();
    bindEditActions();
    bindProfileForm();
    bindUploadForm();
    bindUploadedFileDelete();
    syncMenuFormHotelSlug();
     bindAdminLoginForm();
    bindAdminLogout();

    const hasSession = await checkExistingAdminSession();
    if (!hasSession) return;

    await loadHotels();
    await loadTabData();
  } catch (error) {
    console.error("Admin init failed:", error);
    const content = $("#adminContent");
    if (content) {
      content.innerHTML = `<p class="empty-state">Failed to load dashboard.</p>`;
    }
  }
}

document.addEventListener("DOMContentLoaded", initAdmin);
