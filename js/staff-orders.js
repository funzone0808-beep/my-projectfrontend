"use strict";

const STAFF_BASE_API =
  window.APP_RUNTIME_CONFIG?.API_BASE_URL || "http://localhost:5000/api";
const STAFF_API_BASE = `${STAFF_BASE_API}/staff`;
const STAFF_TOKEN_KEY = "hotel_platform_staff_token";
const STAFF_STATE = {
  staffUser: null,
  activeView: "dashboard",
  orders: [],
  reservations: [],
  inquiries: [],
  reservationsLoaded: false,
  inquiriesLoaded: false
};
const STAFF_RESERVATION_STATUS_OPTIONS = ["new", "confirmed", "seated", "completed", "cancelled"];
const STAFF_INQUIRY_STATUS_OPTIONS = ["new", "contacted", "converted", "closed"];

function $(selector) {
  return document.querySelector(selector);
}

function getStaffToken() {
  return localStorage.getItem(STAFF_TOKEN_KEY) || "";
}

function setStaffToken(token) {
  localStorage.setItem(STAFF_TOKEN_KEY, token);
}

function clearStaffToken() {
  localStorage.removeItem(STAFF_TOKEN_KEY);
}

function resetStaffDashboardState() {
  STAFF_STATE.activeView = "dashboard";
  STAFF_STATE.orders = [];
  STAFF_STATE.reservations = [];
  STAFF_STATE.inquiries = [];
  STAFF_STATE.reservationsLoaded = false;
  STAFF_STATE.inquiriesLoaded = false;
  showStaffView("dashboard");
  setStaffDashboardSummaryEmpty("Login to load the dashboard summary.");
  updateStaffViewTabCounts();
}

function setStaffLoginStatus(message = "", isError = false) {
  const status = $("#staffLoginStatus");
  if (!status) return;

  status.textContent = message;
  status.classList.toggle("is-error", !!isError);
}

function escapeHTML(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getNumberValue(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function formatMoney(value) {
  const numberValue = getNumberValue(value);
  return numberValue === null ? "Rs. 0.00" : `Rs. ${numberValue.toFixed(2)}`;
}

function formatOrderDate(value = "") {
  if (!value) return "Time not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function normalizeStatus(value = "") {
  return String(value || "").trim().toLowerCase();
}

function getStaffOrderItems(order = {}) {
  return Array.isArray(order.items) ? order.items : [];
}

function getStaffOrderTotals(order = {}) {
  return order.totals && typeof order.totals === "object" && !Array.isArray(order.totals)
    ? order.totals
    : {};
}

function getStaffOrderTotal(order = {}) {
  const totals = getStaffOrderTotals(order);
  const itemSubtotal = getStaffOrderItems(order).reduce((sum, item) => {
    const qty = getNumberValue(item?.qty) || 0;
    const price = getNumberValue(item?.price) || 0;
    return sum + qty * price;
  }, 0);

  return (
    getNumberValue(totals.gpayFinalTotal) ??
    getNumberValue(totals.final) ??
    getNumberValue(totals.total) ??
    getNumberValue(totals.normalTotal) ??
    itemSubtotal
  );
}

function getStaffOrderLineTotal(item = {}) {
  const qty = getNumberValue(item?.qty) || 0;
  const price = getNumberValue(item?.price) || 0;
  return qty * price;
}

function getStaffOrderPaymentStatus(order = {}) {
  return order.paymentStatus || "unpaid";
}

function getStaffOrderBillingStatus(order = {}) {
  return order.billingStatus || "not_billed";
}

function getStaffOrderTableLabel(order = {}) {
  return order.tableNumber || "No table";
}

function getStaffOrderSourceMeta(order = {}) {
  const source = normalizeStatus(order.orderSource);
  const orderType = normalizeStatus(order.orderType);
  const tableNumber = String(order.tableNumber || "").trim();
  const isQrTableOrder =
    Boolean(tableNumber) ||
    orderType === "dine-in" ||
    source === "qr" ||
    source === "table" ||
    source === "dine-in";

  if (isQrTableOrder) {
    return {
      label: "QR Table",
      detail: tableNumber ? `Table ${tableNumber}` : "Dine-in",
      badgeClass: "is-important"
    };
  }

  return {
    label: "Website",
    detail: "Online order",
    badgeClass: ""
  };
}

function getStaffOrderSourceKey(order = {}) {
  return getStaffOrderSourceMeta(order).label === "QR Table" ? "qr-table" : "website";
}

function getStaffPaymentBadgeClass(paymentStatus = "") {
  return normalizeStatus(paymentStatus) === "paid" ? "is-success" : "is-danger";
}

function getStaffBillingBadgeClass(billingStatus = "") {
  return normalizeStatus(billingStatus) === "billed" ? "is-success" : "is-warning";
}

function getStaffRecordStatusBadgeClass(status = "", type = "") {
  const normalizedStatus = normalizeStatus(status);
  const normalizedType = normalizeStatus(type);

  if (["cancelled", "closed"].includes(normalizedStatus)) {
    return "is-danger";
  }

  if (
    ["completed", "converted"].includes(normalizedStatus) ||
    (normalizedType === "reservation" && ["confirmed", "seated"].includes(normalizedStatus)) ||
    (normalizedType === "inquiry" && normalizedStatus === "contacted")
  ) {
    return "is-success";
  }

  return "is-warning";
}

function buildStaffOrderItemsList(order = {}) {
  const items = getStaffOrderItems(order);

  if (!items.length) {
    return `<p class="staff-order-note">No items found for this order.</p>`;
  }

  return `
    <ol class="staff-order-items">
      ${items
        .map((item) => {
          const name = item?.name || item?.id || "Item";
          const qty = getNumberValue(item?.qty) || 0;
          const price = getNumberValue(item?.price);
          const priceLabel = price === null ? "" : ` - ${formatMoney(price)}`;

          return `<li>${escapeHTML(name)} x ${escapeHTML(qty)}${escapeHTML(priceLabel)}</li>`;
        })
        .join("")}
    </ol>
  `;
}

function getStaffOrdersSummary(orders = []) {
  return orders.reduce(
    (summary, order) => {
      const total = getStaffOrderTotal(order);
      const paymentStatus = normalizeStatus(getStaffOrderPaymentStatus(order));
      const billingStatus = normalizeStatus(getStaffOrderBillingStatus(order));
      const sourceKey = getStaffOrderSourceKey(order);

      summary.totalOrders += 1;
      summary.totalEarnings += total;

      if (paymentStatus === "paid") {
        summary.paidOrders += 1;
        summary.paidEarnings += total;
      } else {
        summary.unpaidOrders += 1;
        summary.unpaidEarnings += total;
      }

      if (billingStatus === "billed") {
        summary.billedOrders += 1;
      } else {
        summary.unbilledOrders += 1;
      }

      if (sourceKey === "qr-table") {
        summary.qrOrders += 1;
        summary.qrEarnings += total;
      } else {
        summary.websiteOrders += 1;
        summary.websiteEarnings += total;
      }

      return summary;
    },
    {
      totalOrders: 0,
      totalEarnings: 0,
      paidOrders: 0,
      unpaidOrders: 0,
      paidEarnings: 0,
      unpaidEarnings: 0,
      billedOrders: 0,
      unbilledOrders: 0,
      qrOrders: 0,
      websiteOrders: 0,
      qrEarnings: 0,
      websiteEarnings: 0
    }
  );
}

function buildStaffSummaryCard(label, value, note) {
  return `
    <article class="staff-summary-card">
      <p class="staff-summary-label">${escapeHTML(label)}</p>
      <p class="staff-summary-value">${escapeHTML(value)}</p>
      <p class="staff-summary-note">${escapeHTML(note)}</p>
    </article>
  `;
}

function setStaffDashboardSummaryEmpty(message = "No orders found for this hotel in the selected range.") {
  const summaryWrap = $("#staffDashboardSummary");
  const empty = $("#staffDashboardEmpty");

  if (summaryWrap) {
    summaryWrap.hidden = true;
    summaryWrap.innerHTML = "";
  }

  if (empty) {
    empty.hidden = false;
    empty.textContent = message;
  }
}

function renderStaffOrdersSummary(orders = []) {
  const summaryWrap = $("#staffDashboardSummary");
  const empty = $("#staffDashboardEmpty");
  if (!summaryWrap) return;

  if (!orders.length) {
    setStaffDashboardSummaryEmpty();
    return;
  }

  const summary = getStaffOrdersSummary(orders);

  summaryWrap.hidden = false;
  if (empty) empty.hidden = true;
  summaryWrap.innerHTML = [
    buildStaffSummaryCard(
      "Total earnings",
      formatMoney(summary.totalEarnings),
      `${summary.totalOrders} order${summary.totalOrders === 1 ? "" : "s"} in this view`
    ),
    buildStaffSummaryCard(
      "Paid vs unpaid",
      `${summary.paidOrders} paid / ${summary.unpaidOrders} unpaid`,
      `${formatMoney(summary.paidEarnings)} paid - ${formatMoney(summary.unpaidEarnings)} pending`
    ),
    buildStaffSummaryCard(
      "Billing status",
      `${summary.billedOrders} billed / ${summary.unbilledOrders} unbilled`,
      "Track what still needs bill closure"
    ),
    buildStaffSummaryCard(
      "Order sources",
      `${summary.qrOrders} QR / ${summary.websiteOrders} website`,
      `${formatMoney(summary.qrEarnings)} QR - ${formatMoney(summary.websiteEarnings)} website`
    )
  ].join("");
}

function countStaffRecordsByStatus(records = []) {
  return records.reduce(
    (counts, record) => {
      const status = normalizeStatus(record.status) || "new";
      counts.total += 1;
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    },
    { total: 0 }
  );
}

function renderStaffReservationsSummary(reservations = []) {
  const summaryWrap = $("#staffReservationsSummary");
  if (!summaryWrap) return;

  if (!reservations.length) {
    summaryWrap.hidden = true;
    summaryWrap.innerHTML = "";
    return;
  }

  const counts = countStaffRecordsByStatus(reservations);

  summaryWrap.hidden = false;
  summaryWrap.innerHTML = [
    buildStaffSummaryCard(
      "Reservations",
      `${counts.total}`,
      "Total reservation requests in this view"
    ),
    buildStaffSummaryCard(
      "New",
      `${counts.new || 0}`,
      "Fresh requests waiting for attention"
    ),
    buildStaffSummaryCard(
      "Confirmed",
      `${counts.confirmed || 0}`,
      "Reservations confirmed by the hotel"
    ),
    buildStaffSummaryCard(
      "Completed / Cancelled",
      `${(counts.completed || 0) + (counts.cancelled || 0)}`,
      `${counts.completed || 0} completed - ${counts.cancelled || 0} cancelled`
    )
  ].join("");
}

function renderStaffInquiriesSummary(inquiries = []) {
  const summaryWrap = $("#staffInquiriesSummary");
  if (!summaryWrap) return;

  if (!inquiries.length) {
    summaryWrap.hidden = true;
    summaryWrap.innerHTML = "";
    return;
  }

  const counts = countStaffRecordsByStatus(inquiries);

  summaryWrap.hidden = false;
  summaryWrap.innerHTML = [
    buildStaffSummaryCard(
      "Inquiries",
      `${counts.total}`,
      "Total inquiry requests in this view"
    ),
    buildStaffSummaryCard(
      "New",
      `${counts.new || 0}`,
      "Fresh inquiries waiting for reply"
    ),
    buildStaffSummaryCard(
      "Contacted",
      `${counts.contacted || 0}`,
      "Guests already contacted"
    ),
    buildStaffSummaryCard(
      "Converted / Closed",
      `${(counts.converted || 0) + (counts.closed || 0)}`,
      `${counts.converted || 0} converted - ${counts.closed || 0} closed`
    )
  ].join("");
}

function getStaffSelectedSourceFilter() {
  return $("#staffOrdersSourceInput")?.value || "all";
}

function getStaffSelectedPaymentFilter() {
  return $("#staffOrdersPaymentInput")?.value || "all";
}

function getStaffSelectedBillingFilter() {
  return $("#staffOrdersBillingInput")?.value || "all";
}

function getStaffSelectedRecordStatusFilter(selector) {
  return $(selector)?.value || "all";
}

function filterStaffRecordsByStatus(records = [], statusFilter = "all") {
  if (statusFilter === "all") {
    return records;
  }

  return records.filter((record) => normalizeStatus(record.status) === statusFilter);
}

function getStaffSelectedRangeLabel() {
  const input = $("#staffOrdersRangeInput");
  return input?.selectedOptions?.[0]?.textContent?.trim() || "selected range";
}

function getStaffSelectedFilterLabels() {
  const sourceInput = $("#staffOrdersSourceInput");
  const paymentInput = $("#staffOrdersPaymentInput");
  const billingInput = $("#staffOrdersBillingInput");

  return [sourceInput, paymentInput, billingInput]
    .filter((input) => input && input.value !== "all")
    .map((input) => input.selectedOptions?.[0]?.textContent?.trim() || input.value);
}

function getStaffVisibleOrders() {
  const sourceFilter = getStaffSelectedSourceFilter();
  const paymentFilter = getStaffSelectedPaymentFilter();
  const billingFilter = getStaffSelectedBillingFilter();

  return STAFF_STATE.orders.filter((order) => {
    const sourceMatches =
      sourceFilter === "all" || getStaffOrderSourceKey(order) === sourceFilter;
    const paymentStatus = normalizeStatus(getStaffOrderPaymentStatus(order));
    const paymentMatches =
      paymentFilter === "all" ||
      (paymentFilter === "paid" && paymentStatus === "paid") ||
      (paymentFilter === "unpaid" && paymentStatus !== "paid");
    const billingStatus = normalizeStatus(getStaffOrderBillingStatus(order));
    const billingMatches =
      billingFilter === "all" ||
      (billingFilter === "billed" && billingStatus === "billed") ||
      (billingFilter === "unbilled" && billingStatus !== "billed");

    return sourceMatches && paymentMatches && billingMatches;
  });
}

function renderCurrentStaffOrders() {
  renderStaffOrders(getStaffVisibleOrders());
}

function getStaffVisibleReservations() {
  return filterStaffRecordsByStatus(
    STAFF_STATE.reservations,
    getStaffSelectedRecordStatusFilter("#staffReservationsStatusInput")
  );
}

function getStaffVisibleInquiries() {
  return filterStaffRecordsByStatus(
    STAFF_STATE.inquiries,
    getStaffSelectedRecordStatusFilter("#staffInquiriesStatusInput")
  );
}

function getStaffSelectedRecordStatusLabel(selector) {
  const input = $(selector);
  return input?.selectedOptions?.[0]?.textContent?.trim() || "selected status";
}

function getStaffReservationsEmptyMessage() {
  if (!STAFF_STATE.reservations.length) {
    return "No reservations found for this hotel and selected range.";
  }

  return `No reservations match ${escapeHTML(getStaffSelectedRecordStatusLabel("#staffReservationsStatusInput"))}.`;
}

function getStaffInquiriesEmptyMessage() {
  if (!STAFF_STATE.inquiries.length) {
    return "No inquiries found for this hotel and selected range.";
  }

  return `No inquiries match ${escapeHTML(getStaffSelectedRecordStatusLabel("#staffInquiriesStatusInput"))}.`;
}

function renderCurrentStaffReservations() {
  const reservations = getStaffVisibleReservations();
  renderStaffReservationsSummary(reservations);
  renderStaffRecordList(
    "#staffReservationsContent",
    reservations,
    buildStaffReservationCard,
    getStaffReservationsEmptyMessage()
  );
}

function renderCurrentStaffInquiries() {
  const inquiries = getStaffVisibleInquiries();
  renderStaffInquiriesSummary(inquiries);
  renderStaffRecordList(
    "#staffInquiriesContent",
    inquiries,
    buildStaffInquiryCard,
    getStaffInquiriesEmptyMessage()
  );
}

function resetStaffViewFilters() {
  const sourceInput = $("#staffOrdersSourceInput");
  const paymentInput = $("#staffOrdersPaymentInput");
  const billingInput = $("#staffOrdersBillingInput");

  if (sourceInput) sourceInput.value = "all";
  if (paymentInput) paymentInput.value = "all";
  if (billingInput) billingInput.value = "all";

  renderCurrentStaffOrders();
}

function renderStaffFilterStatus(visibleOrders = []) {
  const status = $("#staffOrdersFilterStatus");
  if (!status) return;

  if (!STAFF_STATE.orders.length) {
    status.hidden = true;
    status.textContent = "";
    return;
  }

  const visibleCount = visibleOrders.length;
  const totalCount = STAFF_STATE.orders.length;
  const visibleOrderWord = visibleCount === 1 ? "order" : "orders";
  const activeFilters = getStaffSelectedFilterLabels();
  const activeFilterText = activeFilters.length
    ? `Active filters: ${activeFilters.join(", ")}.`
    : "No extra filters active.";

  status.hidden = false;
  status.textContent = `Showing ${visibleCount} ${visibleOrderWord} of ${totalCount} total from ${getStaffSelectedRangeLabel()}. ${activeFilterText}`;
}

function clearStaffFilterStatus() {
  const status = $("#staffOrdersFilterStatus");
  if (!status) return;

  status.hidden = true;
  status.textContent = "";
}

function getStaffEmptyOrdersMessage() {
  if (!STAFF_STATE.orders.length) {
    return `No orders found for this hotel in ${escapeHTML(getStaffSelectedRangeLabel())}.`;
  }

  const activeFilters = getStaffSelectedFilterLabels();

  if (activeFilters.length) {
    return `No orders match these filters: ${escapeHTML(activeFilters.join(", "))}. Use Clear Filters to see all loaded orders.`;
  }

  return "No orders found for this hotel and selected range.";
}

function buildStaffBillTotalsRows(order = {}) {
  const totals = getStaffOrderTotals(order);
  const rows = [];
  const subtotal = getNumberValue(totals.subtotal);
  const gst = getNumberValue(totals.gst);
  const normalTotal = getNumberValue(totals.normalTotal);
  const gpayDiscount = getNumberValue(totals.gpayDiscount);
  const gpayFinalTotal = getNumberValue(totals.gpayFinalTotal);

  if (subtotal !== null) {
    rows.push(`<tr><th>Subtotal</th><td>${escapeHTML(formatMoney(subtotal))}</td></tr>`);
  }

  if (gst !== null) {
    rows.push(`<tr><th>GST</th><td>${escapeHTML(formatMoney(gst))}</td></tr>`);
  }

  if (normalTotal !== null) {
    rows.push(`<tr><th>Original Total</th><td>${escapeHTML(formatMoney(normalTotal))}</td></tr>`);
  }

  if (gpayDiscount !== null) {
    rows.push(`<tr><th>Google Pay Discount</th><td>-${escapeHTML(formatMoney(gpayDiscount))}</td></tr>`);
  }

  if (gpayFinalTotal !== null) {
    rows.push(`<tr><th>Final Paid Amount</th><td>${escapeHTML(formatMoney(gpayFinalTotal))}</td></tr>`);
  } else {
    rows.push(`<tr><th>Total</th><td>${escapeHTML(formatMoney(getStaffOrderTotal(order)))}</td></tr>`);
  }

  return rows.join("");
}

function getStaffBillTitle(order = {}) {
  return order.billNumber || `Draft Bill - Order ${order.id || ""}`;
}

function buildStaffBillPrintDocument(order = {}) {
  const items = getStaffOrderItems(order);
  const sourceMeta = getStaffOrderSourceMeta(order);
  const sourceDetail = sourceMeta.detail ? ` (${sourceMeta.detail})` : "";
  const itemRows = items.length
    ? items
        .map((item, index) => {
          const qty = getNumberValue(item?.qty) || 0;
          const price = getNumberValue(item?.price) || 0;
          const lineTotal = getStaffOrderLineTotal(item);

          return `
            <tr>
              <td>${escapeHTML(index + 1)}</td>
              <td>${escapeHTML(item?.name || item?.id || "Item")}</td>
              <td>${escapeHTML(qty)}</td>
              <td>${escapeHTML(formatMoney(price))}</td>
              <td>${escapeHTML(formatMoney(lineTotal))}</td>
            </tr>
          `;
        })
        .join("")
    : `<tr><td colspan="5">No items found for this order.</td></tr>`;

  const billTitle = getStaffBillTitle(order);

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHTML(billTitle)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111; margin: 24px; }
    .bill { max-width: 760px; margin: 0 auto; }
    .bill-header { display: flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid #111; padding-bottom: 14px; margin-bottom: 18px; }
    h1, h2, p { margin: 0; }
    h1 { font-size: 24px; }
    h2 { font-size: 16px; margin-top: 4px; font-weight: 600; }
    .muted { color: #555; font-size: 13px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin: 18px 0; }
    .row { font-size: 14px; line-height: 1.5; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 14px; }
    th { background: #f2f2f2; }
    .totals { max-width: 340px; margin-left: auto; }
    .note { margin-top: 18px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 14px; }
    .actions { display: flex; justify-content: flex-end; margin-bottom: 18px; }
    button { border: 0; border-radius: 8px; background: #111; color: #fff; padding: 10px 14px; cursor: pointer; }
    @media print {
      body { margin: 0; }
      .actions { display: none; }
      .bill { max-width: none; }
    }
  </style>
</head>
<body>
  <div class="bill">
    <div class="actions">
      <button type="button" onclick="window.print()">Print Bill</button>
    </div>
    <header class="bill-header">
      <div>
        <h1>${escapeHTML(order.hotelName || "Hotel")}</h1>
        <h2>${escapeHTML(billTitle)}</h2>
      </div>
      <div class="muted">
        <p>Order: ${escapeHTML(order.id || "")}</p>
        ${order.billNumber ? `<p>Bill Number: ${escapeHTML(order.billNumber)}</p>` : ""}
        <p>Created: ${escapeHTML(formatOrderDate(order.createdAt))}</p>
        <p>Billed: ${escapeHTML(order.billedAt || "Not billed yet")}</p>
      </div>
    </header>

    <section class="grid">
      <div class="row"><strong>Table:</strong> ${escapeHTML(getStaffOrderTableLabel(order))}</div>
      <div class="row"><strong>Order Type:</strong> ${escapeHTML(order.orderType || "dine-in")}</div>
      <div class="row"><strong>Payment:</strong> ${escapeHTML(order.paymentMethod || "")}</div>
      <div class="row"><strong>Payment Status:</strong> ${escapeHTML(getStaffOrderPaymentStatus(order))}</div>
      <div class="row"><strong>Billing Status:</strong> ${escapeHTML(getStaffOrderBillingStatus(order))}</div>
      <div class="row"><strong>Source:</strong> ${escapeHTML(sourceMeta.label + sourceDetail)}</div>
    </section>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Item</th>
          <th>Qty</th>
          <th>Rate</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <table class="totals">
      <tbody>${buildStaffBillTotalsRows(order)}</tbody>
    </table>

    <div class="note">
      <strong>Note:</strong> ${escapeHTML(order.note || "No note")}
    </div>
  </div>
</body>
</html>`;
}

function openStaffOrderBill(order = {}) {
  const printWindow = window.open("", "_blank", "width=780,height=900");

  if (!printWindow) {
    window.alert("Please allow popups to open the bill view.");
    return;
  }

  printWindow.document.open();
  printWindow.document.write(buildStaffBillPrintDocument(order));
  printWindow.document.close();
  printWindow.focus();
}

function buildStaffOrderCard(order = {}) {
  const orderId = order.id || "";
  const paymentStatus = getStaffOrderPaymentStatus(order);
  const billingStatus = getStaffOrderBillingStatus(order);
  const tableLabel = getStaffOrderTableLabel(order);
  const sourceMeta = getStaffOrderSourceMeta(order);
  const sourceBadgeClass = sourceMeta.badgeClass ? ` ${sourceMeta.badgeClass}` : "";
  const sourceDetail = sourceMeta.detail ? ` (${sourceMeta.detail})` : "";
  const paymentBadgeClass = getStaffPaymentBadgeClass(paymentStatus);
  const billingBadgeClass = getStaffBillingBadgeClass(billingStatus);
  const safeOrderId = escapeHTML(orderId);
  const markBilledDisabled =
    !orderId || normalizeStatus(billingStatus) === "billed" ? "disabled" : "";
  const markPaidDisabled =
    !orderId || normalizeStatus(paymentStatus) === "paid" ? "disabled" : "";
  const note = order.note ? `<p class="staff-order-note"><strong>Note:</strong> ${escapeHTML(order.note)}</p>` : "";

  return `
    <article class="staff-order-card">
      <div class="staff-order-topline">
        <h3 class="staff-order-title">Order #${safeOrderId}</h3>
        <span class="staff-order-time">${escapeHTML(formatOrderDate(order.createdAt))}</span>
      </div>

      <div class="staff-order-badges">
        <span class="staff-badge${sourceBadgeClass}">Source: ${escapeHTML(sourceMeta.label + sourceDetail)}</span>
        <span class="staff-badge is-important">Table: ${escapeHTML(tableLabel)}</span>
        <span class="staff-badge">Total: ${escapeHTML(formatMoney(getStaffOrderTotal(order)))}</span>
        <span class="staff-badge ${paymentBadgeClass}">Payment: ${escapeHTML(paymentStatus)}</span>
        <span class="staff-badge ${billingBadgeClass}">Billing: ${escapeHTML(billingStatus)}</span>
      </div>

      <div class="staff-order-meta">
        <span>Method: ${escapeHTML(order.paymentMethod || "Not provided")}</span>
        <span>Status: ${escapeHTML(order.status || "new")}</span>
        ${order.billNumber ? `<span>Bill: ${escapeHTML(order.billNumber)}</span>` : ""}
      </div>

      ${buildStaffOrderItemsList(order)}
      ${note}

      <div class="staff-order-actions">
        <button class="staff-btn secondary" type="button" data-staff-mark-billed data-order-id="${safeOrderId}" ${markBilledDisabled}>
          ${markBilledDisabled ? "Billed" : "Mark Billed"}
        </button>
        <button class="staff-btn secondary" type="button" data-staff-mark-paid data-order-id="${safeOrderId}" ${markPaidDisabled}>
          ${markPaidDisabled ? "Paid" : "Mark Paid"}
        </button>
        <button class="staff-btn secondary" type="button" data-staff-view-bill data-order-id="${safeOrderId}">
          View Bill
        </button>
      </div>
    </article>
  `;
}

function buildStaffOrderSourceGroup(sourceKey, orders = []) {
  if (!orders.length) {
    return "";
  }

  const isQrTableGroup = sourceKey === "qr-table";
  const title = isQrTableGroup ? "QR Table Orders" : "Website Orders";
  const note = isQrTableGroup
    ? "Orders placed after scanning a table QR code."
    : "Orders placed from the normal public website flow.";
  const countLabel = `${orders.length} order${orders.length === 1 ? "" : "s"}`;
  const groupTotal = orders.reduce((sum, order) => sum + getStaffOrderTotal(order), 0);

  return `
    <section class="staff-order-group" aria-label="${escapeHTML(title)}">
      <div class="staff-order-group-header">
        <div>
          <h3 class="staff-order-group-title">${escapeHTML(title)}</h3>
          <p class="staff-order-group-note">${escapeHTML(note)}</p>
        </div>
        <div class="staff-order-group-metrics">
          <span class="staff-order-group-count">${escapeHTML(countLabel)}</span>
          <span class="staff-order-group-count">Total: ${escapeHTML(formatMoney(groupTotal))}</span>
        </div>
      </div>
      <div class="staff-order-group-list">
        ${orders.map(buildStaffOrderCard).join("")}
      </div>
    </section>
  `;
}

function buildStaffOrdersListMarkup(orders = []) {
  if (getStaffSelectedSourceFilter() !== "all") {
    return orders.map(buildStaffOrderCard).join("");
  }

  const qrOrders = orders.filter((order) => getStaffOrderSourceKey(order) === "qr-table");
  const websiteOrders = orders.filter((order) => getStaffOrderSourceKey(order) === "website");

  return [
    buildStaffOrderSourceGroup("qr-table", qrOrders),
    buildStaffOrderSourceGroup("website", websiteOrders)
  ].join("");
}

function setStaffRecordsLoading(selector, message) {
  const content = $(selector);
  if (!content) return;

  content.className = "staff-empty";
  content.textContent = message;
}

function buildStaffRecordStatusOptions(statuses = [], selectedStatus = "") {
  const normalizedSelectedStatus = normalizeStatus(selectedStatus);

  return statuses
    .map((status) => {
      const isSelected = normalizeStatus(status) === normalizedSelectedStatus ? "selected" : "";
      const label = status
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");

      return `<option value="${escapeHTML(status)}" ${isSelected}>${escapeHTML(label)}</option>`;
    })
    .join("");
}

function buildStaffRecordStatusControls(type = "", record = {}, statuses = []) {
  const recordId = record.id || "";
  const safeRecordId = escapeHTML(recordId);
  const selectedStatus = record.status || "new";
  const selectDisabled = recordId ? "" : "disabled";
  const buttonDisabled = "disabled";

  return `
    <div class="staff-order-actions staff-record-status-actions">
      <span class="staff-status-control-label">Update status</span>
      <select class="staff-select staff-status-select" data-staff-record-status-select data-record-type="${escapeHTML(type)}" data-record-id="${safeRecordId}" data-current-status="${escapeHTML(selectedStatus)}" ${selectDisabled}>
        ${buildStaffRecordStatusOptions(statuses, selectedStatus)}
      </select>
      <button class="staff-btn secondary" type="button" data-staff-update-record-status data-record-type="${escapeHTML(type)}" data-record-id="${safeRecordId}" ${buttonDisabled}>
        Update Status
      </button>
    </div>
  `;
}

function clearStaffRecordSummary(selector) {
  const summaryWrap = $(selector);
  if (!summaryWrap) return;

  summaryWrap.hidden = true;
  summaryWrap.innerHTML = "";
}

function buildStaffReservationCard(reservation = {}) {
  const status = reservation.status || "new";
  const statusBadgeClass = getStaffRecordStatusBadgeClass(status, "reservation");

  return `
    <article class="staff-order-card">
      <div class="staff-order-topline">
        <h3 class="staff-order-title">Reservation #${escapeHTML(reservation.id || "")}</h3>
        <span class="staff-order-time">${escapeHTML(formatOrderDate(reservation.createdAt))}</span>
      </div>

      <div class="staff-order-badges">
        <span class="staff-badge is-important">Guests: ${escapeHTML(reservation.guests || "Not provided")}</span>
        <span class="staff-badge">Date: ${escapeHTML(reservation.date || "Not provided")}</span>
        <span class="staff-badge">Time: ${escapeHTML(reservation.time || "Not provided")}</span>
        <span class="staff-badge ${statusBadgeClass}">Status: ${escapeHTML(status)}</span>
      </div>

      <div class="staff-order-meta">
        <span>Name: ${escapeHTML(reservation.name || "Not provided")}</span>
        <span>Phone: ${escapeHTML(reservation.phone || "Not provided")}</span>
        <span>Hotel: ${escapeHTML(reservation.hotelName || reservation.hotelSlug || "This hotel")}</span>
      </div>

      <p class="staff-order-note"><strong>Note:</strong> ${escapeHTML(reservation.note || "No note")}</p>
      ${buildStaffRecordStatusControls("reservation", reservation, STAFF_RESERVATION_STATUS_OPTIONS)}
    </article>
  `;
}

function buildStaffInquiryCard(inquiry = {}) {
  const status = inquiry.status || "new";
  const statusBadgeClass = getStaffRecordStatusBadgeClass(status, "inquiry");

  return `
    <article class="staff-order-card">
      <div class="staff-order-topline">
        <h3 class="staff-order-title">Inquiry #${escapeHTML(inquiry.id || "")}</h3>
        <span class="staff-order-time">${escapeHTML(formatOrderDate(inquiry.createdAt))}</span>
      </div>

      <div class="staff-order-badges">
        <span class="staff-badge is-important">Event: ${escapeHTML(inquiry.eventType || "Not provided")}</span>
        <span class="staff-badge">Date: ${escapeHTML(inquiry.date || "Not provided")}</span>
        <span class="staff-badge">Guests: ${escapeHTML(inquiry.guests || "Not provided")}</span>
        <span class="staff-badge ${statusBadgeClass}">Status: ${escapeHTML(status)}</span>
      </div>

      <div class="staff-order-meta">
        <span>Name: ${escapeHTML(inquiry.name || "Not provided")}</span>
        <span>Phone: ${escapeHTML(inquiry.phone || "Not provided")}</span>
        <span>Hotel: ${escapeHTML(inquiry.hotelName || inquiry.hotelSlug || "This hotel")}</span>
      </div>

      <p class="staff-order-note"><strong>Requirements:</strong> ${escapeHTML(inquiry.specialRequirements || "No requirements")}</p>
      ${buildStaffRecordStatusControls("inquiry", inquiry, STAFF_INQUIRY_STATUS_OPTIONS)}
    </article>
  `;
}

function renderStaffRecordList(selector, records = [], buildCard, emptyMessage = "No records found.") {
  const content = $(selector);
  if (!content) return;

  if (!records.length) {
    content.className = "staff-empty";
    content.textContent = emptyMessage;
    return;
  }

  content.className = "staff-orders-list";
  content.innerHTML = records.map(buildCard).join("");
}

function renderStaffOrders(orders = []) {
  const content = $("#staffOrdersContent");
  if (!content) return;
  renderStaffFilterStatus(orders);

  if (!orders.length) {
    content.className = "staff-empty";
    content.innerHTML = getStaffEmptyOrdersMessage();
    return;
  }

  content.className = "staff-orders-list";
  content.innerHTML = buildStaffOrdersListMarkup(orders);
}

function setStaffOrdersLoading(message = "Loading staff orders...") {
  const content = $("#staffOrdersContent");
  setStaffDashboardSummaryEmpty("Loading dashboard summary...");
  clearStaffFilterStatus();
  if (!content) return;

  content.className = "staff-empty";
  content.textContent = message;
}

function showStaffLoginView(message = "") {
  const loginWrap = $("#staffLoginWrap");
  const dashboardWrap = $("#staffDashboardWrap");

  resetStaffDashboardState();
  if (loginWrap) loginWrap.style.display = "grid";
  if (dashboardWrap) dashboardWrap.style.display = "none";

  if (message) {
    setStaffLoginStatus(message);
  }
}

function showStaffDashboardView(staffUser = {}) {
  const loginWrap = $("#staffLoginWrap");
  const dashboardWrap = $("#staffDashboardWrap");
  const hotelLabel = $("#staffSessionHotel");
  STAFF_STATE.staffUser = staffUser;

  if (loginWrap) loginWrap.style.display = "none";
  if (dashboardWrap) dashboardWrap.style.display = "grid";
  if (hotelLabel) hotelLabel.textContent = staffUser.hotelSlug || "this hotel";
}

function showStaffView(view = "dashboard") {
  const supportedViews = ["dashboard", "orders", "reservations", "inquiries"];
  const nextView = supportedViews.includes(view) ? view : "dashboard";
  STAFF_STATE.activeView = nextView;

  document.querySelectorAll("[data-staff-view]").forEach((button) => {
    const isActive = button.dataset.staffView === nextView;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  document.querySelectorAll("[data-staff-view-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.staffViewPanel !== nextView;
  });
}

function openStaffView(view = "dashboard") {
  showStaffView(view);

  if (view === "reservations" && !STAFF_STATE.reservationsLoaded) {
    void loadStaffReservations();
  }

  if (view === "inquiries" && !STAFF_STATE.inquiriesLoaded) {
    void loadStaffInquiries();
  }
}

function setStaffTabCount(selector, count) {
  const countEl = $(selector);
  if (!countEl) return;

  countEl.textContent = String(count || 0);
}

function updateStaffViewTabCounts() {
  setStaffTabCount("#staffOrdersTabCount", STAFF_STATE.orders.length);
  setStaffTabCount("#staffReservationsTabCount", STAFF_STATE.reservations.length);
  setStaffTabCount("#staffInquiriesTabCount", STAFF_STATE.inquiries.length);
}

function setStaffFormDisabled(form, isDisabled) {
  if (!form) return;

  form.querySelectorAll("input, button, select").forEach((field) => {
    field.disabled = !!isDisabled;
  });
}

async function staffFetchJson(url, options = {}) {
  const headers = {
    ...(options.headers || {})
  };

  const token = getStaffToken();
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

async function loadStaffOrders() {
  const range = $("#staffOrdersRangeInput")?.value || "recent";

  try {
    setStaffOrdersLoading();
    const params = new URLSearchParams({ range });
    const result = await staffFetchJson(`${STAFF_API_BASE}/orders?${params.toString()}`);
    STAFF_STATE.orders = Array.isArray(result.orders) ? result.orders : [];
    updateStaffViewTabCounts();
    renderStaffOrdersSummary(STAFF_STATE.orders);
    renderCurrentStaffOrders();
  } catch (error) {
    console.error("Staff orders load failed:", error);
    setStaffOrdersLoading(error.message || "Failed to load staff orders.");
  }
}

async function loadStaffReservations() {
  const range = $("#staffReservationsRangeInput")?.value || "recent";

  try {
    clearStaffRecordSummary("#staffReservationsSummary");
    setStaffRecordsLoading("#staffReservationsContent", "Loading reservations...");
    const params = new URLSearchParams({ range });
    const result = await staffFetchJson(`${STAFF_API_BASE}/reservations?${params.toString()}`);
    STAFF_STATE.reservations = Array.isArray(result.reservations)
      ? result.reservations
      : [];
    STAFF_STATE.reservationsLoaded = true;
    updateStaffViewTabCounts();
    renderCurrentStaffReservations();
  } catch (error) {
    console.error("Staff reservations load failed:", error);
    clearStaffRecordSummary("#staffReservationsSummary");
    setStaffRecordsLoading(
      "#staffReservationsContent",
      error.message || "Failed to load staff reservations."
    );
  }
}

async function loadStaffInquiries() {
  const range = $("#staffInquiriesRangeInput")?.value || "recent";

  try {
    clearStaffRecordSummary("#staffInquiriesSummary");
    setStaffRecordsLoading("#staffInquiriesContent", "Loading inquiries...");
    const params = new URLSearchParams({ range });
    const result = await staffFetchJson(`${STAFF_API_BASE}/inquiries?${params.toString()}`);
    STAFF_STATE.inquiries = Array.isArray(result.inquiries) ? result.inquiries : [];
    STAFF_STATE.inquiriesLoaded = true;
    updateStaffViewTabCounts();
    renderCurrentStaffInquiries();
  } catch (error) {
    console.error("Staff inquiries load failed:", error);
    clearStaffRecordSummary("#staffInquiriesSummary");
    setStaffRecordsLoading(
      "#staffInquiriesContent",
      error.message || "Failed to load staff inquiries."
    );
  }
}

async function patchStaffOrderAction(orderId, action) {
  return staffFetchJson(
    `${STAFF_API_BASE}/orders/${encodeURIComponent(orderId)}/${action}`,
    {
      method: "PATCH"
    }
  );
}

function getStaffRecordStatusEndpoint(recordType = "") {
  if (recordType === "reservation") {
    return "reservations";
  }

  if (recordType === "inquiry") {
    return "inquiries";
  }

  return "";
}

async function patchStaffRecordStatus(recordType, recordId, status) {
  const endpoint = getStaffRecordStatusEndpoint(recordType);

  if (!endpoint) {
    throw new Error("Unsupported staff record type");
  }

  return staffFetchJson(
    `${STAFF_API_BASE}/${endpoint}/${encodeURIComponent(recordId)}/status`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ status })
    }
  );
}

function findStaffOrder(orderId) {
  return STAFF_STATE.orders.find((order) => String(order.id) === String(orderId));
}

function getStaffOrderActionConfirmMessage(orderId, actionLabel) {
  const order = findStaffOrder(orderId) || {};
  const tableLabel = getStaffOrderTableLabel(order);

  return [
    `${actionLabel} order ${orderId}?`,
    `Table: ${tableLabel}`,
    "",
    "Only continue if the hotel operator has confirmed this change."
  ].join("\n");
}

async function handleStaffOrderAction(button, action, actionLabel) {
  const orderId = button.dataset.orderId || "";

  if (!orderId) {
    return;
  }

  const confirmed = window.confirm(
    getStaffOrderActionConfirmMessage(orderId, actionLabel)
  );

  if (!confirmed) {
    return;
  }

  const originalText = button.textContent;

  try {
    button.disabled = true;
    button.textContent = "Updating...";
    await patchStaffOrderAction(orderId, action);
    await loadStaffOrders();
  } catch (error) {
    console.error(`Staff ${action} failed:`, error);
    window.alert(error.message || `Failed to ${actionLabel.toLowerCase()}`);
    button.disabled = false;
    button.textContent = originalText;
  }
}

function getStaffRecordStatusConfirmMessage(recordType, recordId, status) {
  const recordLabel = recordType === "reservation" ? "reservation" : "inquiry";

  return [
    `Update ${recordLabel} ${recordId} status to "${status}"?`,
    "",
    "Only continue if the hotel operator has confirmed this change."
  ].join("\n");
}

function hasStaffRecordStatusChanged(select) {
  if (!select) return false;

  return normalizeStatus(select.value) !== normalizeStatus(select.dataset.currentStatus);
}

function updateStaffRecordStatusButtonState(select) {
  const actions = select?.closest(".staff-record-status-actions");
  const button = actions?.querySelector("[data-staff-update-record-status]");

  if (!button) return;

  const hasRecordId = Boolean(select?.dataset.recordId);
  button.disabled = !hasRecordId || !hasStaffRecordStatusChanged(select);
}

async function handleStaffRecordStatusAction(button) {
  const recordType = button.dataset.recordType || "";
  const recordId = button.dataset.recordId || "";
  const card = button.closest(".staff-order-card");
  const select = card?.querySelector("[data-staff-record-status-select]");
  const status = select?.value || "";

  if (!recordType || !recordId || !status) {
    return;
  }

  if (!hasStaffRecordStatusChanged(select)) {
    updateStaffRecordStatusButtonState(select);
    return;
  }

  const confirmed = window.confirm(
    getStaffRecordStatusConfirmMessage(recordType, recordId, status)
  );

  if (!confirmed) {
    return;
  }

  const originalText = button.textContent;

  try {
    button.disabled = true;
    button.textContent = "Updating...";
    await patchStaffRecordStatus(recordType, recordId, status);

    if (recordType === "reservation") {
      await loadStaffReservations();
    } else if (recordType === "inquiry") {
      await loadStaffInquiries();
    }
  } catch (error) {
    console.error(`Staff ${recordType} status update failed:`, error);
    window.alert(error.message || "Failed to update status");
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function loginStaff(hotelSlug, pin) {
  const response = await fetch(`${STAFF_API_BASE}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ hotelSlug, pin })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Staff login failed");
  }

  return data;
}

async function checkExistingStaffSession() {
  const token = getStaffToken();

  if (!token) {
    showStaffLoginView();
    return false;
  }

  try {
    const result = await staffFetchJson(`${STAFF_API_BASE}/me`);
    showStaffDashboardView(result.staffUser || {});
    await loadStaffOrders();
    return true;
  } catch (error) {
    console.warn("Staff session invalid:", error);
    clearStaffToken();
    showStaffLoginView("Staff session expired. Please login again.");
    return false;
  }
}

function prefillStaffHotelSlug() {
  const input = $("#staffHotelSlugInput");
  if (!input || input.value.trim()) return;

  const params = new URLSearchParams(window.location.search);
  const hotelSlug =
    params.get("hotel") ||
    window.APP_RUNTIME_CONFIG?.DEFAULT_HOTEL_SLUG ||
    "";

  input.value = hotelSlug;
}

function bindStaffLoginForm() {
  const form = $("#staffLoginForm");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const hotelSlug = $("#staffHotelSlugInput")?.value.trim() || "";
    const pin = $("#staffPinInput")?.value.trim() || "";

    try {
      setStaffFormDisabled(form, true);
      setStaffLoginStatus("Checking staff access...");

      const result = await loginStaff(hotelSlug, pin);
      if (!result.token) {
        throw new Error("Staff login did not return a session token");
      }

      setStaffToken(result.token);
      showStaffDashboardView(result.staffUser || {});
      await loadStaffOrders();
    } catch (error) {
      console.error("Staff login failed:", error);
      clearStaffToken();
      showStaffLoginView(error.message || "Staff login failed");
      setStaffLoginStatus(error.message || "Staff login failed", true);
    } finally {
      setStaffFormDisabled(form, false);
    }
  });
}

function bindStaffLogout() {
  const button = $("#staffLogoutBtn");
  if (!button) return;

  button.addEventListener("click", () => {
    clearStaffToken();
    showStaffLoginView("Logged out.");
  });
}

function bindStaffOrderActions() {
  const refreshButton = $("#staffRefreshOrdersBtn");
  const rangeInput = $("#staffOrdersRangeInput");
  const sourceInput = $("#staffOrdersSourceInput");
  const paymentInput = $("#staffOrdersPaymentInput");
  const billingInput = $("#staffOrdersBillingInput");
  const clearFiltersButton = $("#staffClearFiltersBtn");
  const reservationsRefreshButton = $("#staffRefreshReservationsBtn");
  const reservationsRangeInput = $("#staffReservationsRangeInput");
  const reservationsStatusInput = $("#staffReservationsStatusInput");
  const inquiriesRefreshButton = $("#staffRefreshInquiriesBtn");
  const inquiriesRangeInput = $("#staffInquiriesRangeInput");
  const inquiriesStatusInput = $("#staffInquiriesStatusInput");

  if (refreshButton) {
    refreshButton.addEventListener("click", () => {
      void loadStaffOrders();
    });
  }

  if (rangeInput) {
    rangeInput.addEventListener("change", () => {
      void loadStaffOrders();
    });
  }

  if (sourceInput) {
    sourceInput.addEventListener("change", () => {
      renderCurrentStaffOrders();
    });
  }

  if (paymentInput) {
    paymentInput.addEventListener("change", () => {
      renderCurrentStaffOrders();
    });
  }

  if (billingInput) {
    billingInput.addEventListener("change", () => {
      renderCurrentStaffOrders();
    });
  }

  if (clearFiltersButton) {
    clearFiltersButton.addEventListener("click", () => {
      resetStaffViewFilters();
    });
  }

  document.querySelectorAll("[data-staff-view]").forEach((button) => {
    button.addEventListener("click", () => {
      openStaffView(button.dataset.staffView || "orders");
    });
  });

  if (reservationsRefreshButton) {
    reservationsRefreshButton.addEventListener("click", () => {
      void loadStaffReservations();
    });
  }

  if (reservationsRangeInput) {
    reservationsRangeInput.addEventListener("change", () => {
      void loadStaffReservations();
    });
  }

  if (reservationsStatusInput) {
    reservationsStatusInput.addEventListener("change", () => {
      renderCurrentStaffReservations();
    });
  }

  if (inquiriesRefreshButton) {
    inquiriesRefreshButton.addEventListener("click", () => {
      void loadStaffInquiries();
    });
  }

  if (inquiriesRangeInput) {
    inquiriesRangeInput.addEventListener("change", () => {
      void loadStaffInquiries();
    });
  }

  if (inquiriesStatusInput) {
    inquiriesStatusInput.addEventListener("change", () => {
      renderCurrentStaffInquiries();
    });
  }

  document.addEventListener("change", (event) => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const statusSelect = target.closest("[data-staff-record-status-select]");
    if (statusSelect) {
      updateStaffRecordStatusButtonState(statusSelect);
    }
  });

  document.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const markBilledButton = target.closest("[data-staff-mark-billed]");
    if (markBilledButton) {
      void handleStaffOrderAction(markBilledButton, "mark-billed", "Mark billed");
      return;
    }

    const markPaidButton = target.closest("[data-staff-mark-paid]");
    if (markPaidButton) {
      void handleStaffOrderAction(markPaidButton, "mark-paid", "Mark paid");
      return;
    }

    const viewBillButton = target.closest("[data-staff-view-bill]");
    if (viewBillButton) {
      const orderId = viewBillButton.dataset.orderId || "";
      const order = findStaffOrder(orderId);

      if (!order) {
        window.alert("Order not found in the current staff list.");
        return;
      }

      openStaffOrderBill(order);
      return;
    }

    const updateRecordStatusButton = target.closest("[data-staff-update-record-status]");
    if (updateRecordStatusButton) {
      void handleStaffRecordStatusAction(updateRecordStatusButton);
    }
  });
}

async function initStaffOrdersPage() {
  prefillStaffHotelSlug();
  bindStaffLoginForm();
  bindStaffLogout();
  bindStaffOrderActions();
  await checkExistingStaffSession();
}

document.addEventListener("DOMContentLoaded", initStaffOrdersPage);
