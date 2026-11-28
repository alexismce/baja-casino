const accessForm = document.querySelector("#access-form");
const weightsForm = document.querySelector("#weights-form");
const message = document.querySelector("#message");
const dashboard = document.querySelector("#dashboard");
const metrics = document.querySelector("#metrics");
const metricLabels = {
  activeSockets: "Connected sockets",
  walletCredits: "Credits in wallets",
  blackjackPayoutExposure: "Max Blackjack payouts",
  videoPokerPayoutExposure: "Max Video Poker payout",
  maximumUnsettledPayout: "Max unsettled payouts",
  estimatedRtp: "Estimated Lucky Slots RTP",
  fortuneRtp: "Estimated Fortune Slots RTP",
};
const adminTabs = [...document.querySelectorAll("[data-admin-tab]")];
const adminPanels = [...document.querySelectorAll(".admin-panel")];
const healthSummary = document.querySelector("#health-summary");
const healthDetails = document.querySelector("#health-details");
const creditsForm = document.querySelector("#credits-form");
const userSearch = document.querySelector("#user-search");
const userList = document.querySelector("#user-list");
const creditResult = document.querySelector("#credit-result");
let adminToken = "";
let dashboardLoaded = false;
let selectedTab = "overview";

async function adminRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "X-Admin-Token": adminToken,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`The server returned an unreadable response (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    throw new Error(typeof data.error === "string" ? data.error : `Admin request failed (HTTP ${response.status}).`);
  }
  return data;
}

function setMessage(text, state = "info") {
  message.textContent = text;
  message.dataset.state = state;
}

function setFormBusy(form, busy) {
  form.setAttribute("aria-busy", String(busy));
  form.querySelectorAll("button, input").forEach((control) => {
    control.disabled = busy;
  });
}

function renderMetrics(data) {
  metrics.replaceChildren();
  for (const [key, label] of Object.entries(metricLabels)) {
    const card = document.createElement("div");
    card.className = "metric";
    const name = document.createElement("span");
    name.textContent = label;
    const value = document.createElement("strong");
    value.textContent = key === "estimatedRtp" || key === "fortuneRtp"
      ? Number(key === "fortuneRtp" ? data.slots.fortuneTheoreticalRtp : data.slots.theoreticalRtp).toLocaleString(undefined, { style: "percent", maximumFractionDigits: 2 })
      : Number(data[key]).toLocaleString();
    card.append(name, value);
    metrics.append(card);
  }
  document.querySelector("#captured-at").textContent = `Updated ${new Date(data.capturedAt).toLocaleString()}`;
  for (const [symbol, weight] of Object.entries(data.slots.weights)) {
    weightsForm.elements[symbol].value = String(weight);
  }
  dashboard.hidden = false;
  dashboardLoaded = true;
}

function renderHealth(data) {
  healthSummary.textContent = data.ok
    ? "Healthy — all checks passed."
    : "Attention required — one or more checks failed.";
  healthSummary.dataset.status = data.ok ? "healthy" : "error";
  const values = [
    ["Integrity", data.database.integrity],
    ["Journal mode", String(data.database.journalMode).toUpperCase()],
    ["Foreign keys", data.database.foreignKeysEnabled ? "Enabled" : "Disabled"],
    ["Foreign-key violations", data.database.foreignKeyViolations.toLocaleString()],
    ["Malformed states", data.database.malformedState.toLocaleString()],
    ["Connected sockets", data.server.activeSockets.toLocaleString()],
    ["Uptime", `${Math.floor(data.server.uptimeSeconds / 60)} min`],
    ["Node", data.server.nodeVersion],
    ["Memory RSS", `${Math.round(data.server.rssBytes / 1024 / 1024)} MB`],
    ["Heap used", `${Math.round(data.server.heapUsedBytes / 1024 / 1024)} MB`],
  ];
  healthDetails.replaceChildren(...values.map(([label, value]) => {
    const card = document.createElement("div");
    card.className = "metric";
    const name = document.createElement("span");
    name.textContent = label;
    const result = document.createElement("strong");
    result.textContent = value;
    card.append(name, result);
    return card;
  }));
  document.querySelector("#health-captured-at").textContent = `Updated ${new Date(data.capturedAt).toLocaleString()}`;
}

async function refreshHealth() {
  const button = document.querySelector("#refresh-health");
  button.disabled = true;
  button.textContent = "Checking…";
  try {
    const data = await adminRequest("/api/admin/health");
    renderHealth(data);
    setMessage(data.ok ? "Project health checks passed." : "Health checks found a problem.", data.ok ? "success" : "error");
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = "Check health";
  }
}

function renderUsers(users) {
  if (!users.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No accounts found.";
    userList.replaceChildren(empty);
    return;
  }
  userList.replaceChildren(...users.map((user) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "user-choice";
    const name = document.createElement("strong");
    name.textContent = user.displayName;
    const detail = document.createElement("span");
    detail.textContent = `${user.email} · ${Number(user.balance).toLocaleString()} credits`;
    button.append(name, detail);
    button.addEventListener("click", () => {
      document.querySelector("#credit-email").value = user.email;
      document.querySelector("#credit-amount").focus();
    });
    return button;
  }));
}

async function refreshUsers() {
  const button = document.querySelector("#refresh-users");
  button.disabled = true;
  button.textContent = "Loading…";
  try {
    const query = userSearch.value.trim();
    const data = await adminRequest(`/api/admin/users${query ? `?search=${encodeURIComponent(query)}` : ""}`);
    renderUsers(data.users);
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = "Refresh users";
  }
}

async function selectAdminTab(name) {
  if (!dashboardLoaded || name === selectedTab) return;
  selectedTab = name;
  adminTabs.forEach((tab) => {
    const selected = tab.dataset.adminTab === name;
    tab.classList.toggle("active", selected);
    tab.setAttribute("aria-selected", String(selected));
  });
  adminPanels.forEach((panel) => {
    panel.hidden = panel.id !== `${name}-panel`;
  });
  if (name === "health") await refreshHealth();
  if (name === "credits") await refreshUsers();
}

async function refreshDashboard() {
  const refreshButton = document.querySelector("#refresh");
  refreshButton.disabled = true;
  refreshButton.textContent = "Refreshing…";
  try {
    const data = await adminRequest("/api/admin/metrics");
    renderMetrics(data);
    setMessage("", "info");
    return true;
  } catch (error) {
    setMessage(dashboardLoaded
      ? `Refresh failed. Showing the last successful metrics. ${error.message}`
      : error.message, "error");
    return false;
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = "Refresh";
  }
}

accessForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (accessForm.getAttribute("aria-busy") === "true") return;
  const submitButton = document.querySelector("#unlock-dashboard");
  setFormBusy(accessForm, true);
  submitButton.textContent = "Checking token…";
  adminToken = document.querySelector("#admin-token").value;
  try {
    await refreshDashboard();
  } finally {
    setFormBusy(accessForm, false);
    submitButton.textContent = "Unlock dashboard";
  }
});

document.querySelector("#refresh").addEventListener("click", refreshDashboard);
document.querySelector("#refresh-health").addEventListener("click", refreshHealth);
document.querySelector("#refresh-users").addEventListener("click", refreshUsers);
adminTabs.forEach((tab) => tab.addEventListener("click", () => selectAdminTab(tab.dataset.adminTab)));
userSearch.addEventListener("change", refreshUsers);
userSearch.addEventListener("search", refreshUsers);

weightsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (weightsForm.getAttribute("aria-busy") === "true") return;
  const weights = Object.fromEntries(
    ["SEVEN", "WATERMELON", "GRAPES", "ORANGE", "CHERRY"].map((symbol) => [
      symbol,
      Number(weightsForm.elements[symbol].value),
    ]),
  );
  const submitButton = document.querySelector("#apply-weights");
  setFormBusy(weightsForm, true);
  submitButton.textContent = "Applying…";
  try {
    await adminRequest("/api/admin/slot-weights", {
      method: "PUT",
      body: JSON.stringify({ weights }),
    });
    const refreshed = await refreshDashboard();
    setMessage(
      refreshed
        ? "Slot weights updated for this server process."
        : "Slot weights were updated, but the dashboard could not refresh. " + message.textContent,
      refreshed ? "success" : "error",
    );
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    setFormBusy(weightsForm, false);
    submitButton.textContent = "Apply slot weights";
  }
});

creditsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (creditsForm.getAttribute("aria-busy") === "true") return;
  const amount = Number(creditsForm.elements.amount.value);
  const email = creditsForm.elements.email.value.trim();
  const note = creditsForm.elements.note.value.trim();
  const submitButton = document.querySelector("#apply-credits");
  setFormBusy(creditsForm, true);
  submitButton.textContent = "Adding…";
  creditResult.hidden = true;
  try {
    const data = await adminRequest("/api/admin/credits", {
      method: "POST",
      body: JSON.stringify({ email, amount, note }),
    });
    const adjustment = data.adjustment;
    creditResult.hidden = false;
    creditResult.dataset.status = "healthy";
    creditResult.textContent = `${adjustment.displayName} received ${adjustment.amount.toLocaleString()} demo credits. Balance: ${adjustment.balanceBefore.toLocaleString()} → ${adjustment.balanceAfter.toLocaleString()}.`;
    setMessage("Manual credit adjustment saved.", "success");
    await refreshUsers();
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    setFormBusy(creditsForm, false);
    submitButton.textContent = "Add demo credits";
  }
});
