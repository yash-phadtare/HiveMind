const adminMessage = document.querySelector("#admin-message");

function showMessage(text = "", type = "error") {
  adminMessage.textContent = text;
  adminMessage.className = text ? `message visible ${type}` : "message";
}

async function request(path, options = {}) {
  const response = await fetch((window.APP_API || "") + path, options);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.detail || error.message || "Unable to complete this action.",
    );
  }
  return response.status === 204 ? null : response.json();
}

function node(tag, className, text) {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text !== undefined && text !== null) result.textContent = text;
  return result;
}

function actionButton(action, id, text, style) {
  const result = node("button", `table-action ${style || ""}`, text);
  result.type = "button";
  result.dataset.action = action;
  result.dataset.id = id;
  return result;
}

function status(status) {
  return node("span", `status status-${status.toLowerCase()}`, status);
}
function emptyRow(table, columns, text) {
  const row = table.insertRow();
  const cell = row.insertCell();
  cell.colSpan = columns;
  cell.className = "empty-state";
  cell.textContent = text;
}

function setQueryFilters(filters) {
  const params = new URLSearchParams(window.location.search);
  filters.forEach((filter) => {
    const parameter =
      filter.id === "course-status-filter"
        ? "status"
        : filter.id.replace("-filter", "");
    if (params.has(parameter)) filter.value = params.get(parameter);
  });
}

function renderActivityFeed(containerId) {
  const container = document.querySelector(containerId);
  if (!container || !window.HiveActivity) return;
  request(`/api/organization/activity`)
    .then((activities) => window.HiveActivity.render(container, activities))
    .catch(() =>
      window.HiveActivity.render(container, []),
    );
}

async function initOverview() {
  if (window.HiveActivity && HiveActivity.self) {
    const name = document.querySelector("#user-name");
    HiveActivity.self(name ? name.textContent : null);
  }
  renderActivityFeed("#admin-activity");
}

async function initUsers() {
  const teacherTable = document.querySelector("#teachers-table");
  const studentTable = document.querySelector("#students-table");
  const statusFilter = document.querySelector("#status-filter");
  setQueryFilters([statusFilter]);
  function renderUsers(table, users, emptyText) {
    table.replaceChildren();
    if (!users.length) return emptyRow(table, 4, emptyText);
    users.forEach((user) => {
      const row = table.insertRow();
      row.insertCell().append(node("strong", "", user.fullName));
      row.insertCell().append(node("small", "", user.email));
      row.insertCell().append(status(user.status));
      const actions = node("div", "table-actions");
      if (user.status === "PENDING")
        actions.append(
          actionButton("approve", user.id, "Approve", "approve"),
          actionButton("reject", user.id, "Reject", "reject"),
        );
      else if (user.status === "ACTIVE")
        actions.append(
          actionButton("suspend", user.id, "Suspend", "suspend"),
          actionButton("delete", user.id, "Delete", "delete"),
        );
      else
        actions.append(
          actionButton("activate", user.id, "Activate", "approve"),
          actionButton("delete", user.id, "Delete", "delete"),
        );
      row.insertCell().append(actions);
    });
  }
  async function load() {
    try {
      const params = new URLSearchParams();
      if (statusFilter.value) params.set("status", statusFilter.value);
      const users = await request(
        `/api/organization/users${params.size ? `?${params}` : ""}`,
      );
      renderUsers(
        teacherTable,
        users.filter((user) => user.role === "TEACHER"),
        "No teacher accounts match this filter.",
      );
      renderUsers(
        studentTable,
        users.filter((user) => user.role === "STUDENT"),
        "No student accounts match this filter.",
      );
    } catch (error) {
      teacherTable.replaceChildren();
      studentTable.replaceChildren();
      emptyRow(teacherTable, 4, "Unable to load teacher accounts.");
      emptyRow(studentTable, 4, "Unable to load student accounts.");
      showMessage(error.message);
    }
  }
  [teacherTable, studentTable].forEach((table) =>
    table.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      if (
        button.dataset.action === "delete" &&
        !confirm("Delete this account permanently?")
      )
        return;
      button.disabled = true;
      try {
        const remove = button.dataset.action === "delete";
        await request(
          `/api/organization/users/${button.dataset.id}${remove ? "" : `/${button.dataset.action}`}`,
          { method: remove ? "DELETE" : "PATCH" },
        );
        showMessage("Account updated successfully.", "success");
        await load();
      } catch (error) {
        button.disabled = false;
        showMessage(error.message);
      }
    }),
  );
  statusFilter.addEventListener("change", load);
  await load();
}

async function initCourses() {
  const table = document.querySelector("#courses-table");
  const filter = document.querySelector("#course-status-filter");
  setQueryFilters([filter]);
  async function load() {
    try {
      const courses = await request(
        `/api/organization/courses${filter.value ? `?status=${filter.value}` : ""}`,
      );
      table.replaceChildren();
      if (!courses.length)
        return emptyRow(table, 6, "No courses match this status.");
      courses.forEach((course) => {
        const row = table.insertRow();
        row.insertCell().append(node("strong", "", course.title));
        row.insertCell().append(node("small", "", course.description || "No description"));
        row.insertCell().textContent = course.teacherName;
        row.insertCell().textContent = course.categoryName || "Uncategorized";
        row.insertCell().append(status(course.status));
        const actions = node("div", "table-actions");
        if (course.status === "PENDING")
          actions.append(
            actionButton("approve", course.id, "Approve", "approve"),
            actionButton("reject", course.id, "Reject", "reject"),
          );
        else if (course.status === "APPROVED")
          actions.append(
            actionButton("suspend", course.id, "Suspend", "suspend"),
          );
        else
          actions.append(
            actionButton("approve", course.id, "Approve", "approve"),
          );
        row.insertCell().append(actions);
      });
    } catch (error) {
      table.replaceChildren();
      emptyRow(table, 6, "Unable to load courses.");
      showMessage(error.message);
    }
  }
  table.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    button.disabled = true;
    try {
      await request(
        `/api/organization/courses/${button.dataset.id}/${button.dataset.action}`,
        { method: "PATCH" },
      );
      showMessage("Course status updated successfully.", "success");
      await load();
    } catch (error) {
      button.disabled = false;
      showMessage(error.message);
    }
  });
  filter.addEventListener("change", load);
  await load();
}

async function initCategories() {
  const table = document.querySelector("#categories-table");
  const form = document.querySelector("#category-form");
  async function load() {
    try {
      const categories = await request("/api/organization/categories");
      table.replaceChildren();
      if (!categories.length) return emptyRow(table, 4, "No categories yet.");
      categories.forEach((category) => {
        const row = table.insertRow();
        row.insertCell().append(node("strong", "", category.name));
        row.insertCell().append(node("small", "", category.description || "No description"));
        row.insertCell().textContent = category.courseCount;
        const actions = node("div", "table-actions");
        actions.append(actionButton("edit", category.id, "Edit", "approve"));
        if (!category.courseCount)
          actions.append(
            actionButton("delete", category.id, "Delete", "delete"),
          );
        row.insertCell().append(actions);
      });
    } catch (error) {
      table.replaceChildren();
      emptyRow(table, 4, "Unable to load categories.");
      showMessage(error.message);
    }
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await request("/api/organization/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: document.querySelector("#category-name").value,
          description: document.querySelector("#category-description").value,
        }),
      });
      form.reset();
      showMessage("Category created successfully.", "success");
      await load();
    } catch (error) {
      showMessage(error.message);
    }
  });
  table.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    try {
      if (button.dataset.action === "delete") {
        if (!confirm("Delete this empty category?")) return;
        await request(`/api/organization/categories/${button.dataset.id}`, {
          method: "DELETE",
        });
        showMessage("Category deleted successfully.", "success");
      } else {
        const row = button.closest("tr");
        const name = prompt(
          "Category name",
          row.cells[0].textContent,
        );
        if (!name) return;
        const current = row.cells[1].textContent;
        const description = prompt(
          "Category description",
          current === "No description" ? "" : current,
        );
        if (description === null) return;
        await request(`/api/organization/categories/${button.dataset.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description }),
        });
        showMessage("Category updated successfully.", "success");
      }
      await load();
    } catch (error) {
      showMessage(error.message);
    }
  });
  await load();
}

const DONUT_PALETTE = [
  "var(--accent)",
  "var(--cyan)",
  "var(--lime)",
  "var(--amber)",
  "var(--rose)",
  "#9aa7ff",
];

function renderDonutChart(container, legend, items) {
  while (container.lastChild) container.lastChild.remove();
  legend.replaceChildren();

  const withEnrollments = items.filter(
    (item) => Number(item.enrollments) > 0,
  );
  const total = withEnrollments.reduce(
    (sum, item) => sum + Number(item.enrollments),
    0,
  );

  if (!withEnrollments.length) {
    container.innerHTML =
      '<span class="donut-empty">No enrollments recorded yet.</span>';
    return;
  }

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;
  const segments = withEnrollments.map((item) => {
    const length = (Number(item.enrollments) / total) * circumference;
    const segment = { item, length, start: cumulative, filled: false };
    cumulative += length;
    return segment;
  });

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 128 128");
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.setAttribute("transform", "rotate(-90 64 64)");

  const track = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  track.setAttribute("cx", "64");
  track.setAttribute("cy", "64");
  track.setAttribute("r", String(radius));
  track.setAttribute("fill", "none");
  track.setAttribute("stroke", "rgba(255,255,255,0.08)");
  track.setAttribute("stroke-width", "14");
  group.appendChild(track);

  segments.forEach((segment, index) => {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("class", "donut-seg");
    circle.setAttribute("cx", "64");
    circle.setAttribute("cy", "64");
    circle.setAttribute("r", String(radius));
    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke", DONUT_PALETTE[index % DONUT_PALETTE.length]);
    circle.setAttribute("stroke-width", "14");
    circle.setAttribute("stroke-dashoffset", String(-segment.start));
    circle.setAttribute("stroke-dasharray", `0 ${circumference}`);
    group.appendChild(circle);
    segment.circle = circle;
  });
  svg.appendChild(group);
  container.appendChild(svg);

  const center = node("div", "donut-center");
  center.append(node("strong", "", total), node("small", "", "enrollments"));
  container.appendChild(center);

  segments.forEach((segment, index) => {
    const share = Math.round((Number(segment.item.enrollments) / total) * 100);
    const li = node("li");
    const dot = node("i");
    dot.style.color = DONUT_PALETTE[index % DONUT_PALETTE.length];
    li.append(
      dot,
      node("strong", "", segment.item.category),
      node("small", "", `${segment.item.enrollments} · ${share}%`),
    );
    legend.appendChild(li);
  });

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      segments.forEach((segment) => {
        segment.circle.style.strokeDasharray =
          `${segment.length} ${circumference - segment.length}`;
      });
    });
  });
}

async function initReports() {
  const table = document.querySelector("#analytics-table");
  const summary = document.querySelector("#analytics-summary");
  try {
    const report = await request("/api/organization/reports/analytics");
    const summaryMetrics = [
      ["Students", report.students],
      ["Teachers", report.teachers],
      ["Courses", report.courses],
      ["Enrollments", report.enrollments],
      ["Quizzes", report.quizzes],
    ];
    const largestMetric = Math.max(1, ...summaryMetrics.map(([, value]) => Number(value) || 0));
    summaryMetrics.forEach(([label, value]) => {
      const card = node("article");
      card.className = "analytics-summary-card";
      card.dataset.reveal = "";
      const bar = node("span", "analytics-summary-bar");
      bar.style.setProperty("--metric-size", `${Math.max(8, ((Number(value) || 0) / largestMetric) * 100)}%`);
      const valueNode = node("strong", "", value);
      valueNode.setAttribute("data-count", "");
      card.append(node("p", "", label), valueNode, bar);
      summary.append(card);
    });
    const donut = document.querySelector("#category-donut");
    const legend = document.querySelector("#category-legend");
    if (donut && legend) renderDonutChart(donut, legend, report.coursesByCategory);
    if (!report.coursesByCategory.length)
      return emptyRow(table, 3, "No course analytics yet.");
    const maximumCourses = Math.max(1, ...report.coursesByCategory.map((item) => Number(item.courses) || 0));
    const maximumEnrollments = Math.max(1, ...report.coursesByCategory.map((item) => Number(item.enrollments) || 0));
    report.coursesByCategory.forEach((item) => {
      const row = table.insertRow();
      row.insertCell().textContent = item.category;
      [[item.courses, maximumCourses], [item.enrollments, maximumEnrollments]].forEach(([value, maximum]) => {
        const cell = row.insertCell();
        cell.className = "analytics-measure";
        const valueLabel = node("strong", "", value);
        const track = node("span", "analytics-measure-track");
        const fill = node("i", "analytics-measure-fill");
        fill.style.width = `${Math.max(4, ((Number(value) || 0) / maximum) * 100)}%`;
        track.append(fill);
        cell.append(valueLabel, track);
      });
    });
  } catch (error) {
    emptyRow(table, 3, "Unable to load analytics.");
    showMessage(error.message);
  }
}

const AUDIT_ACTIONS = [
  ["TEACHER_REGISTERED", "Teacher registered"],
  ["STUDENT_REGISTERED", "Student registered"],
  ["COURSE_SUBMITTED", "Course submitted"],
  ["TEACHER_APPROVED", "Teacher approved"],
  ["TEACHER_REJECTED", "Teacher rejected"],
  ["TEACHER_SUSPENDED", "Teacher suspended"],
  ["TEACHER_ACTIVATED", "Teacher re-activated"],
  ["STUDENT_APPROVED", "Student approved"],
  ["STUDENT_REJECTED", "Student rejected"],
  ["STUDENT_SUSPENDED", "Student suspended"],
  ["STUDENT_ACTIVATED", "Student re-activated"],
  ["COURSE_APPROVED", "Course approved"],
  ["COURSE_REJECTED", "Course rejected"],
  ["COURSE_SUSPENDED", "Course suspended"],
  ["ENROLLMENT", "Enrollment"],
  ["ASSIGNMENT_SUBMITTED", "Assignment submitted"],
  ["ASSIGNMENT_GRADED", "Assignment graded"],
  ["QUIZ_COMPLETED", "Quiz completed"],
];

function auditLabel(action) {
  const match = AUDIT_ACTIONS.find(([value]) => value === action);
  return match ? match[1] : action;
}

async function initAudit() {
  const table = document.querySelector("#audit-table");
  const filter = document.querySelector("#audit-action");
  if (!table || !filter) return;
  const all = document.createElement("option");
  all.value = "";
  all.textContent = "All actions";
  filter.replaceChildren(all);
  AUDIT_ACTIONS.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    filter.appendChild(option);
  });

  async function load() {
    table.replaceChildren();
    const query = filter.value ? `?action=${encodeURIComponent(filter.value)}` : "";
    try {
      const rows = await request(`/api/organization/audit${query}`);
      if (!rows.length) {
        emptyRow(
          table,
          4,
          filter.value
            ? "No audit events match this filter."
            : "No audit events recorded yet.",
        );
        return;
      }
      rows.forEach((row) => {
        const tr = table.insertRow();
        const actionCell = tr.insertCell();
        const chip = node(
          "span",
          "audit-chip",
          auditLabel(row.action),
        );
        chip.dataset.action = row.action;
        actionCell.appendChild(chip);
        tr.insertCell().appendChild(node("span", "audit-actor", row.actor_name || "\u2014"));
        const what = tr.insertCell();
        if (row.detail) {
          what.append(
            node("span", "audit-entity", row.entity_name || "\u2014"),
            node("span", "audit-detail", row.detail),
          );
        } else {
          what.textContent = row.entity_name || "\u2014";
        }
        const when = tr.insertCell();
        const time = node("time", "audit-when", "\u2014");
        time.dateTime = row.stamp;
        time.textContent = window.HiveActivity && HiveActivity.timeAgo
          ? HiveActivity.timeAgo(row.stamp)
          : String(row.stamp || "\u2014");
        when.appendChild(time);
      });
    } catch (error) {
      emptyRow(table, 4, "Unable to load the audit log.");
      showMessage(error.message);
    }
  }

  filter.addEventListener("change", load);
  await load();
}

window.adminReady.then((authorized) => {
  if (!authorized) return;
  return (
    {
      overview: initOverview,
      users: initUsers,
      courses: initCourses,
      categories: initCategories,
      reports: initReports,
      audit: initAudit,
    }[document.body.dataset.adminPage] || (() => {})
  )();
});
