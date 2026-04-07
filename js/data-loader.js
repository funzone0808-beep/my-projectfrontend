"use strict";

window.APP_STATE = {
  hotel: null,
  menu: null,
  testimonials: [],
  gallery: [],
  activeHotelSlug: null
};

// const FRONTEND_DEFAULT_HOTEL_SLUG = "hotel-sai-raj";
// const API_BASE = "http://localhost:5000/api";
// const TENANT_API_BASE = `${API_BASE}/tenant`;
// const PUBLIC_API_BASE = `${API_BASE}/public`;

const FRONTEND_DEFAULT_HOTEL_SLUG =
  window.APP_RUNTIME_CONFIG?.DEFAULT_HOTEL_SLUG || "hotel-sai-raj";

const API_BASE =
  window.APP_RUNTIME_CONFIG?.API_BASE_URL || "http://localhost:5000/api";

const TENANT_API_BASE = `${API_BASE}/tenant`;
const PUBLIC_API_BASE = `${API_BASE}/public`;


function getHotelSlugFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get("hotel");
}

function isLocalhost(hostname) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".localhost")
  );
}

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}`);
  }

  return response.json();
}

async function resolveHotelSlug() {
  const querySlug = getHotelSlugFromQuery();
  if (querySlug) return querySlug;

  const host = window.location.hostname;

  if (isLocalhost(host)) {
    return FRONTEND_DEFAULT_HOTEL_SLUG;
  }

  try {
    const result = await fetchJson(
      `${TENANT_API_BASE}/resolve?host=${encodeURIComponent(host)}`
    );

    return result.hotel?.slug || FRONTEND_DEFAULT_HOTEL_SLUG;
  } catch (error) {
    console.warn("Falling back to default hotel slug:", error);
    return FRONTEND_DEFAULT_HOTEL_SLUG;
  }
}

function mapHotelProfileToFrontendShape(rawHotel) {
  return {
    slug: rawHotel.hotel_slug,
    hotelName: rawHotel.hotel_name,
    tagline: rawHotel.tagline,
    ownerWhatsAppNumber: rawHotel.owner_whatsapp_number,
    ownerUpiId: rawHotel.owner_upi_id,
    gstPercent: Number(rawHotel.gst_percent || 5),
    contact: rawHotel.contact || {},
    branding: rawHotel.branding || {},
    hero: rawHotel.hero || {},
    about: rawHotel.about || {},
    features: rawHotel.features || [],
    events: rawHotel.events || {},
    reservation: rawHotel.reservation || {},
    contactSection: rawHotel.contact_section || {},
    location: rawHotel.location || {},
    footer: rawHotel.footer || {},
    social: rawHotel.social || {}
  };
}

async function loadAppData() {
  const hotelSlug = await resolveHotelSlug();

  const [hotelResult, menuResult] = await Promise.all([
    fetchJson(`${PUBLIC_API_BASE}/hotel/${hotelSlug}`),
    fetchJson(`${PUBLIC_API_BASE}/menu/${hotelSlug}`)
  ]);

  window.APP_STATE.hotel = mapHotelProfileToFrontendShape(hotelResult.hotel);
  window.APP_STATE.menu = menuResult.menu || {};
  window.APP_STATE.activeHotelSlug = hotelSlug;

  return window.APP_STATE;
}