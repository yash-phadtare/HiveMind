async function requireOrganizationPage() {
  const response = await fetch((window.APP_API || "") + "/api/auth/me");
  if (!response.ok) throw new Error("No active session");
  const user = await response.json();
  if (user.role !== "ORGANIZATION") {
    window.location.replace(
      {
        TEACHER: "/teacher-dashboard.html",
        STUDENT: "/student-dashboard.html",
      }[user.role] || "/",
    );
    return false;
  }
  document.querySelectorAll("#user-name").forEach((node) => {
    node.textContent = user.fullName;
  });
  document
    .querySelector(
      `.admin-nav [data-page="${document.body.dataset.adminPage}"]`,
    )
    ?.classList.add("active");
  return true;
}

document.querySelector("#logout").addEventListener("click", async () => {
  const button = document.querySelector("#logout");
  button.disabled = true;
  try {
    await fetch((window.APP_API || "") + "/api/auth/logout", { method: "DELETE" });
  } finally {
    window.location.assign("/");
  }
});

window.adminReady = requireOrganizationPage();
window.adminReady.catch(() => window.location.replace("/"));
