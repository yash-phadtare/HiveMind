const message = document.querySelector("#message");
const loginForm = document.querySelector("#login-form");
const registerForm = document.querySelector("#register-form");
const dashboardPath = { ORGANIZATION: "/admin-dashboard.html", TEACHER: "/teacher-dashboard.html", STUDENT: "/student-dashboard.html" };

function showMessage(text = "", type = "error") {
  if (!message) return;
  message.textContent = text;
  message.className = text ? `message visible ${type}` : "message";
}
function openDashboard(user) { window.location.assign(dashboardPath[user.role] || "/"); }
async function request(path, body, method = "POST") {
  const response = await fetch((window.APP_API || "") + path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Request failed.");
  }
  return response.status === 204 ? null : response.json();
}
function friendlyError(error) {
  const message = String(error.message || "");
  if (/account with this email already exists/i.test(message))
    return "This email is already registered. Please log in instead.";
  if (/organization with this name already exists/i.test(message))
    return "This organization is already registered. Log in, or choose a different name.";
  return message;
}

const EYE_OPEN =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_CLOSED =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

document.querySelectorAll('.auth-form input[type="password"]').forEach((input) => {
  if (input.closest(".password-wrap")) return;

  const wrap = document.createElement("div");
  wrap.className = "password-wrap";
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "password-toggle";
  toggle.setAttribute("aria-label", "Show password");
  toggle.setAttribute("aria-pressed", "false");
  toggle.setAttribute("tabindex", "0");
  toggle.innerHTML =
    `<span class="pwd-eye">${EYE_OPEN}</span>` +
    `<span class="pwd-eye-off">${EYE_CLOSED}</span>`;
  wrap.appendChild(toggle);

  toggle.addEventListener("click", (e) => {
    e.preventDefault();
    const reveal = input.type === "password";
    input.type = reveal ? "text" : "password";
    toggle.classList.toggle("is-visible", reveal);
    toggle.setAttribute("aria-pressed", String(reveal));
    toggle.setAttribute("aria-label", reveal ? "Hide password" : "Show password");
    const len = input.value.length;
    input.focus();
    if (typeof input.setSelectionRange === "function") {
      input.setSelectionRange(len, len);
    }
  });
});

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try { openDashboard(await request("/api/auth/login", Object.fromEntries(new FormData(event.target)))); }
    catch (error) { showMessage(friendlyError(error)); }
  });
}

if (registerForm) {
  const roleSelect = document.querySelector("#role");
  const organizationIdField = document.querySelector("#register-organization-id");
  const institutionNameField = document.querySelector("#institution-name-field");
  const institutionNameInput = document.querySelector("#institution-name");
  const organizationField = document.querySelector("#organization-field");
  const organizationHelp = document.querySelector("#organization-selection-help");
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  async function loadOrganizations() {
    try {
      const organizations = await request("/api/auth/organizations", null, "GET");
      if (!organizations.length) {
        organizationIdField.innerHTML = '<option value="">No institutions yet — register one first</option>';
        organizationIdField.disabled = true;
        organizationHelp.textContent = "No institution exists yet. Choose Organization / institution above to create the first one.";
        return;
      }
      organizationIdField.disabled = false;
      organizationHelp.textContent = "Select the institution where you will learn or teach.";
      organizationIdField.innerHTML = '<option value="">Choose your organization</option>' + organizations.map((organization) => `<option value="${organization.id}">${escapeHtml(organization.name)}</option>`).join("");
    } catch (_) { showMessage("Unable to load organizations. Please refresh and try again."); }
  }
  roleSelect.addEventListener("change", () => {
    const registeringOrganization = roleSelect.value === "ORGANIZATION";
    institutionNameField.classList.toggle("hidden", !registeringOrganization);
    institutionNameInput.required = registeringOrganization;
    organizationField.classList.toggle("hidden", registeringOrganization);
    organizationIdField.required = !registeringOrganization;
    if (!registeringOrganization) loadOrganizations();
  });
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const payload = Object.fromEntries(new FormData(event.target));
      const registeringOrganization = payload.role === "ORGANIZATION";
      await request(registeringOrganization ? "/api/auth/register-organization" : "/api/auth/register", registeringOrganization ? { organizationName: payload.organizationName, fullName: payload.fullName, email: payload.email, password: payload.password } : payload);
      window.location.assign(`/login.html?registered=1${registeringOrganization ? "&role=organization" : ""}`);
    } catch (error) { showMessage(friendlyError(error)); }
  });
  loadOrganizations();
}

if (loginForm && new URLSearchParams(window.location.search).get("registered")) {
  const newOrganization =
    new URLSearchParams(window.location.search).get("role") === "organization";
  showMessage(
    newOrganization
      ? "Organization created. You can sign in now."
      : "Account created. Your institution must approve it before you can log in.",
    "success",
  );
}
request("/api/auth/me", null, "GET").then(openDashboard).catch(() => {});
