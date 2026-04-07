"use strict";

// For Deployment Phase 

// window.APP_RUNTIME_CONFIG = {
//   API_BASE_URL: "http://localhost:5000/api",
//   BACKEND_BASE_URL: "http://localhost:5000",
//   DEFAULT_HOTEL_SLUG: "hotel-sai-raj"
// };

// For Production Phase 

window.APP_RUNTIME_CONFIG = {
  API_BASE_URL: process.env.REACT_APP_API_BASE_URL,
  BACKEND_BASE_URL: process.env.REACT_APP_BACKEND_BASE_URL,
  DEFAULT_HOTEL_SLUG: process.env.REACT_APP_DEFAULT_HOTEL_SLUG
};