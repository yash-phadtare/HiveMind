const authCard = document.querySelector("#auth-card");
const message = document.querySelector("#message");

const dashboardPath = {
  ORGANIZATION: "/admin-dashboard.html",
  TEACHER: "/teacher-dashboard.html",
  STUDENT: "/student-dashboard.html",
};

function showMessage(text = "", type = "error") {
  message.textContent = text;
  message.className = text ? `message visible ${type}` : "message";
}
function switchView(view, clearMessage = true) {
  document
    .querySelectorAll(".tabs button")
    .forEach((button) =>
      button.classList.toggle("active", button.dataset.view === view),
    );
  document
    .querySelector("#login-form")
    .classList.toggle("hidden", view !== "login");
  document
    .querySelector("#register-form")
    .classList.toggle("hidden", view !== "register");
  document.querySelector("#auth-title").textContent =
    view === "login" ? "Welcome back." : "Join the workspace.";
  document.querySelector("#auth-description").textContent =
    view === "login"
      ? "Sign in and continue where you left off."
      : "Create an account and start learning today.";
  if (clearMessage) showMessage();
}
function openDashboard(user) {
  window.location.assign(dashboardPath[user.role] || "/");
}
async function request(path, body, method = "POST") {
  const response = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Request failed.");
  }
  return response.status === 204 ? null : response.json();
}
document
  .querySelectorAll(".tabs button")
  .forEach((button) =>
    button.addEventListener("click", () => switchView(button.dataset.view)),
  );
const roleSelect = document.querySelector("#role");
const organizationIdField = document.querySelector("#register-organization-id");
const institutionNameField = document.querySelector("#institution-name-field");
const institutionNameInput = document.querySelector("#institution-name");
const organizationHelp = document.querySelector("#organization-selection-help");
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
roleSelect.addEventListener("change", () => {
  const registeringOrganization = roleSelect.value === "ORGANIZATION";
  institutionNameField.classList.toggle("hidden", !registeringOrganization);
  institutionNameInput.required = registeringOrganization;
  organizationIdField.closest(".field").classList.toggle("hidden", registeringOrganization);
  organizationIdField.required = !registeringOrganization;
  if (!registeringOrganization) loadOrganizations();
});
async function loadOrganizations() {
  try {
    const organizations = await request("/api/auth/organizations", null, "GET");
    if (!organizations.length) {
      organizationIdField.innerHTML = '<option value="">No institutions yet — register one first</option>';
      organizationIdField.disabled = true;
      organizationHelp.textContent = "No institution exists yet. Choose “Organization / institution” above to create the first one.";
      return;
    }
    organizationIdField.disabled = false;
    organizationHelp.textContent = "Select the institution where you will learn or teach.";
    organizationIdField.innerHTML = '<option value="">Choose your organization</option>' + organizations
      .map((organization) => `<option value="${organization.id}">${escapeHtml(organization.name)}</option>`)
      .join("");
  } catch (_) {
    showMessage("Unable to load organizations. Please refresh and try again.");
  }
}
function friendlyError(error) {
  return /already exists/i.test(error.message)
    ? "This email is already registered. Please log in instead."
    : error.message;
}
document
  .querySelector("#login-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      openDashboard(
        await request(
          "/api/auth/login",
          Object.fromEntries(new FormData(event.target)),
        ),
      );
    } catch (error) {
      showMessage(friendlyError(error));
    }
  });
document
  .querySelector("#register-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const payload = Object.fromEntries(new FormData(event.target));
      const registeringOrganization = payload.role === "ORGANIZATION";
      const user = await request(
        registeringOrganization ? "/api/auth/register-organization" : "/api/auth/register",
        registeringOrganization
          ? { organizationName: payload.organizationName, fullName: payload.fullName, email: payload.email, password: payload.password }
          : payload,
      );
      event.target.reset();
      roleSelect.dispatchEvent(new Event("change"));
      await loadOrganizations();
      switchView("login", false);
      const registrationMessage = user.role === "ORGANIZATION"
        ? `Institution created for ${user.fullName}. You can now log in and manage your workspace.`
        : user.role === "TEACHER"
        ? "Teacher account created. Your organization must approve it before you can log in."
        : `Account created for ${user.fullName}. You can now log in.`;
      showMessage(registrationMessage, "success");
    } catch (error) {
      showMessage(friendlyError(error));
    }
  });
request("/api/auth/me", null, "GET")
  .then(openDashboard)
  .catch(() => {});
loadOrganizations();
