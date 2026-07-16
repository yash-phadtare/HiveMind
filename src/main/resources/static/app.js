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
  const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Request failed.");
  }
  return response.status === 204 ? null : response.json();
}
function friendlyError(error) { return /already exists/i.test(error.message) ? "This email is already registered. Please log in instead." : error.message; }

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
      window.location.assign("/login.html?registered=1");
    } catch (error) { showMessage(friendlyError(error)); }
  });
  loadOrganizations();
}

if (loginForm && new URLSearchParams(window.location.search).get("registered")) {
  showMessage("Account created. Your institution must approve it before you can log in.", "success");
}
request("/api/auth/me", null, "GET").then(openDashboard).catch(() => {});
