const message = document.querySelector("#teacher-message");
let courses = [],
  assignments = [],
  assignmentSubmissions = [],
  quizSubmissions = [],
  assignmentCurrent = null;

const api = async (path, options = {}) => {
  const method = options.method || "GET";
  const r = await fetch((window.APP_API || "") + path, options);
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    const error = new Error(
      `${e.detail || e.message || e.error || `HTTP ${r.status}`} (${method} ${path})`,
    );
    error.status = r.status;
    throw error;
  }
  const body = await r.text();
  return body ? JSON.parse(body) : null;
};

const inform = (text, type = "success") => {
  message.textContent = text;
  message.className = `message visible ${type}`;
};

const formData = (form) => Object.fromEntries(new FormData(form));

const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"]/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
      })[char],
  );

const isCorrectAnswer = (value) =>
  value === true || value === 1 || value === "1" || value === "true";

function filterSubmissionCards(listSelector, searchId) {
  const search = document.querySelector(searchId);
  const term = (search?.value || "").trim().toLowerCase();
  const cards = document.querySelectorAll(
    `${listSelector} .submission-card`,
  );
  cards.forEach((card) => {
    const hay = `${card.dataset.name} ${card.dataset.email}`.toLowerCase();
    card.hidden = term ? !hay.includes(term) : false;
  });
}

function updateAssignmentProgress() {
  const total = assignmentSubmissions.length;
  const graded = assignmentSubmissions.filter((s) => s.score != null).length;
  const chip = document.querySelector("#assignment-grade-progress");
  if (!chip) return;
  chip.hidden = !total;
  chip.className =
    "chip " + (total && graded === total ? "chip--good" : total ? "chip--accent" : "");
  chip.textContent = total
    ? `${graded} of ${total} graded \u00B7 ${total - graded} ungraded`
    : "";
}

function openGradePanel(submission) {
  const panel = document.querySelector("#assignment-grade-panel");
  if (!panel) return;
  document.querySelector("#assignment-grade-student").textContent =
    submission.student_name;
  document.querySelector("#assignment-grade-max").textContent =
    submission.max_score;
  document.querySelector("#assignment-grade-score").value =
    submission.score != null ? submission.score : "";
  document.querySelector("#assignment-grade-feedback").value =
    submission.feedback || "";
  panel.classList.remove("hidden");
}

function hideGradePanel() {
  const panel = document.querySelector("#assignment-grade-panel");
  if (panel) panel.classList.add("hidden");
}

const formatBody = (text) => {
  let formatted = esc(text || "");
  formatted = formatted.replace(/\n/g, "<br>");
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  formatted = formatted.replace(/\*(.*?)\*/g, "<em>$1</em>");
  formatted = formatted.replace(
    /`(.*?)`/g,
    '<code style="background:var(--indigo-soft); padding:2px 4px; border-radius:4px; font-family:monospace; font-size:92%;">$1</code>',
  );
  return formatted;
};

function gradeFor(score) {
  const value = Number(score);
  if (!Number.isFinite(value) || value < 0) return null;
  if (value >= 90) return "A";
  if (value >= 80) return "B";
  if (value >= 70) return "C";
  if (value >= 60) return "D";
  return "F";
}

const csvCell = (value) => {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const buildCsv = (headers, rows) =>
  [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");

function downloadCsv(filename, headers, rows) {
  const blob = new Blob(["\uFEFF" + buildCsv(headers, rows)], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

const safeFilename = (title) =>
  String(title || "submissions")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "-")
    .trim() || "submissions";

function getScoreGaugeSvg(score) {
  const normalizedScore = Number.isFinite(Number(score))
    ? Math.max(0, Math.min(100, Number(score)))
    : 0;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (normalizedScore / 100) * circumference;
  return `
    <div class="gauge-wrap">
      <svg width="126" height="126" viewBox="0 0 100 100" style="transform: rotate(-90deg); display: block; margin: 0 auto;">
        <circle cx="50" cy="50" r="${radius}" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="8"/>
        <circle class="gauge-arc" cx="50" cy="50" r="${radius}" fill="none" stroke="var(--primary)" stroke-width="8"
          stroke-dasharray="${circumference}" stroke-dashoffset="${circumference}" stroke-linecap="round"
          data-final-offset="${offset}"/>
        <text x="50" y="-46" fill="var(--ink)" font-size="16" font-weight="bold" text-anchor="middle"
          style="transform: rotate(90deg);" dominant-baseline="middle">${normalizedScore.toFixed(1)}<tspan font-size="9" fill="var(--muted)">%</tspan></text>
      </svg>
      <span class="gauge-label">average score</span>
    </div>
  `;
}

function getActivityChartSvg(data) {
  const items = [
    { label: "Content", count: data.materials, color: "var(--cyan)" },
    { label: "Assignments", count: data.assignments, color: "var(--accent)" },
    { label: "Quizzes", count: data.quizzes, color: "var(--lime)" },
    { label: "Quiz questions", count: data.quizQuestions, color: "var(--indigo)" },
    { label: "Submissions", count: data.submissions, color: "var(--primary)" },
  ];
  const maxValue = Math.max(...items.map((item) => item.count), 1);
  return `
    <div class="analytics-bars">
      ${items
        .map(
          (item) => `
        <div class="analytics-bar-row">
          <span class="analytics-bar-label">${item.label}</span>
          <span class="analytics-bar-track">
            <span class="chart-bar" style="width:${Math.round(
              (item.count / maxValue) * 100,
            )}%; background:${item.color};"></span>
          </span>
          <span class="analytics-bar-count">${item.count}</span>
        </div>`,
        )
        .join("")}
    </div>
  `;
}

function renderAnalytics(data, courseName) {
  const grade = gradeFor(data.averageScore);
  const kpis = [
    ["Students", data.students, "var(--cyan)"],
    ["Content", data.materials, "var(--cyan)"],
    ["Assignments", data.assignments, "var(--accent)"],
    ["Quizzes", data.quizzes, "var(--lime)"],
    ["Quiz questions", data.quizQuestions, "var(--indigo)"],
    ["Submissions", data.submissions, "var(--primary)"],
  ];
  return `
    <header class="analytics-overview">
      <div>
        <p class="panel-label">Course summary</p>
        <h3 class="analytics-course-name">${esc(courseName || "Course performance")}</h3>
      </div>
      ${grade ? `<span class="analytics-grade" aria-hidden="true">Grade ${grade}</span>` : ""}
    </header>
    <ul class="analytics-kpis">
      ${kpis
        .map(
          ([label, count, color]) => `
        <li class="analytics-kpi">
          <span class="analytics-kpi-dot" style="background:${color}"></span>
          <span>${label}</span>
          <strong>${count}</strong>
        </li>`,
        )
        .join("")}
    </ul>
    <div class="analytics-main">
      <article class="analytics-card analytics-card--score">
        <p>Course average score</p>
        <div class="analytics-value">${getScoreGaugeSvg(data.averageScore)}</div>
      </article>
      <article class="analytics-card analytics-card--activity">
        <p>Activity &amp; resources</p>
        <div class="analytics-value">${getActivityChartSvg(data)}</div>
      </article>
    </div>
  `;
}

function fillCourseSelects() {
  document.querySelectorAll(".course-select").forEach((select) => {
    const current = select.value;
    select.innerHTML =
      '<option value="">Select course</option>' +
      courses
        .map((c) => `<option value="${c.id}">${esc(c.title)}</option>`)
        .join("");
    select.value = current;
  });
}

async function loadDashboard() {
  try {
    const container = document.querySelector("#teacher-activity");
    if (!container || !window.HiveActivity) return;
    const activities = await api("/api/teacher/activity");
    window.HiveActivity.render(container, activities);
  } catch (x) {
    inform(x.message, "error");
  }
}

async function loadCourses() {
  courses = await api("/api/teacher/courses");
  const categories = await api("/api/teacher/categories");

  document.querySelector("#course-category").innerHTML =
    '<option value="">Uncategorized</option>' +
    categories
      .map(
        (c) => `
    <option value="${c.id}">${esc(c.name)}</option>
  `,
      )
      .join("");

  fillCourseSelects();

  document.querySelector("#course-list").innerHTML = courses.length
    ? courses
        .map(
          (c) => `
    <article class="list-card">
      <div class="list-card__main">
        <div class="list-card__title">
          <strong>${esc(c.title)}</strong>
          <span class="status status-${c.status.toLowerCase()}">${c.status}</span>
        </div>
        <p class="list-card__body">${esc(c.description || "No description")}</p>
        <div class="list-card__meta">
          <span class="chip chip--accent">${esc(c.categoryName || "Uncategorized")}</span>
          <span class="chip">${c.studentCount} students</span>
        </div>
      </div>
      <div class="list-card__actions">
        <button class="btn--sm btn--primary" data-content-course="${c.id}" type="button">View material</button>
        <button class="btn--sm" data-edit-course="${c.id}" type="button">Edit course</button>
      </div>
    </article>
  `,
        )
        .join("")
    : '<p class="empty-state">Create your first course to begin.</p>';
}

async function loadAssignments() {
  assignments = await api("/api/teacher/assignments");

  document.querySelector("#assignment-list").innerHTML =
    assignments
      .map((a) => {
        const isDraft = a.status === "DRAFT";
        const statusClass = isDraft ? "status-pending" : "status-active";

        let actions = "";
        if (isDraft) {
          actions = `
        <button class="btn--sm" data-manage-assignment="${a.id}" type="button">Questions</button>
        <button class="btn--sm btn--mint" data-publish-assignment="${a.id}" type="button">Publish</button>
      `;
        } else {
          actions = `
        <button class="btn--sm" data-view-assignment-questions="${a.id}" type="button">View Questions</button>
      `;
        }
        actions += `<button class="btn--sm btn--danger table-action delete" data-delete-assignment="${a.id}" type="button">Delete</button>`;

        return `
      <article class="list-card">
        <div class="list-card__main">
          <div class="list-card__title">
            <strong>${esc(a.title)}</strong>
            <span class="status ${statusClass}">${esc(a.status)}</span>
          </div>
          <div class="list-card__meta">
            <span class="chip">${esc(a.course_title)}</span>
            <span class="chip">${a.submissions || 0} submissions</span>
            <span class="chip ${a.awaiting_grade > 0 ? "chip--warn" : "chip--good"}">${a.awaiting_grade || 0} awaiting grades</span>
          </div>
        </div>
        <div class="list-card__actions">${actions}</div>
      </article>
    `;
      })
      .join("") || '<p class="empty-state">No assignments yet.</p>';

  document.querySelector("#submission-assignment").innerHTML =
    '<option value="">Select assignment</option>' +
    assignments
      .map(
        (a) => `
    <option value="${a.id}">${esc(a.course_title)} — ${esc(a.title)}</option>
  `,
      )
      .join("");

  const quizzes = await api("/api/teacher/quizzes");
  document.querySelector("#quiz-submission-quiz").innerHTML =
    '<option value="">Select quiz</option>' +
    quizzes
      .filter((q) => q.status === "PUBLISHED")
      .map(
        (q) =>
          `<option value="${q.id}">${esc(q.course_title)} &mdash; ${esc(q.title)}</option>`,
      )
      .join("");

  document.querySelector("#quiz-list").innerHTML =
    quizzes
      .map((q) => {
        const isDraft = q.status === "DRAFT";
        const statusClass = isDraft ? "status-pending" : "status-active";
        const qCount = q.question_count || 0;

        let actions = "";
        if (isDraft) {
          actions = `
        <button class="btn--sm" data-manage-quiz="${q.id}" type="button">Manage Questions</button>
        <button class="btn--sm btn--mint" data-publish-quiz="${q.id}" type="button">Publish Quiz</button>
      `;
        } else {
          actions = `
        <button class="btn--sm" data-view-quiz="${q.id}" type="button">View Questions</button>
      `;
        }
        actions += `<button class="btn--sm btn--danger table-action delete" data-delete-quiz="${q.id}" type="button">Delete</button>`;

        return `
      <article class="list-card">
        <div class="list-card__main">
          <div class="list-card__title">
            <strong>${esc(q.title)}</strong>
            <span class="status ${statusClass}">${esc(q.status)}</span>
          </div>
          <p class="list-card__body">${esc(q.description || "")}</p>
          <div class="list-card__meta">
            <span class="chip">${esc(q.course_title)}</span>
            <span class="chip chip--accent">${qCount} question${qCount === 1 ? "" : "s"}</span>
          </div>
        </div>
        <div class="list-card__actions">${actions}</div>
      </article>
    `;
      })
      .join("") || '<p class="empty-state">No quizzes yet.</p>';
}

async function loadAnnouncements() {
  const rows = await api("/api/teacher/announcements");
  document.querySelector("#announcement-list").innerHTML =
    rows
      .map(
        (a) => `
    <article class="announcement-card list-card">
      <div class="list-card__main">
        <div class="announcement-card__meta">
          <span class="chip">${esc(a.course_title)}</span>
          <time datetime="${new Date(a.created_at).toISOString()}">${new Date(a.created_at).toLocaleString()}</time>
        </div>
        <div class="list-card__title"><strong>${esc(a.title)}</strong></div>
        <p class="announcement-card__body">${formatBody(a.message)}</p>
      </div>
      <div class="list-card__actions">
        <button class="btn--sm btn--danger table-action delete" data-delete-announcement="${a.id}" type="button">Delete</button>
      </div>
    </article>
  `,
      )
      .join("") || '<p class="empty-state">No announcements yet.</p>';
}

async function showContent(courseId) {
  const select = document.querySelector(
    '#content-form select[name="courseId"]',
  );
  if (select) select.value = courseId;

  const rows = await api(`/api/teacher/courses/${courseId}/content`);
  document.querySelector("#content-list").innerHTML =
    rows
      .map(
        (r) => `
    <article class="list-card">
      <div class="list-card__main">
        <div class="list-card__title">
          <strong>${esc(r.title)}</strong>
          <span class="status status-${r.type.toLowerCase()}">${esc(r.type)}</span>
        </div>
        <p class="list-card__body">${formatBody(r.body)}</p>
      </div>
      <div class="list-card__actions">
        <button class="btn--sm btn--danger table-action delete" data-delete-content="${r.id}" data-course-id="${courseId}" type="button">Delete</button>
      </div>
    </article>
  `,
      )
      .join("") ||
    '<p class="empty-state">No material for this course yet.</p>';
}

const MIN_QUIZ_OPTIONS = 2;
const MAX_QUIZ_OPTIONS = 8;

function getQuizOptionInputs() {
  return [...document.querySelectorAll("#quiz-option-list .quiz-option-input")];
}

function syncCorrectAnswerSelect() {
  const select = document.querySelector("#correct-answer-select");
  const previous = select.value;
  const options = getQuizOptionInputs()
    .map((input) => input.value.trim())
    .filter(Boolean);

  select.innerHTML =
    '<option value="">Select the correct option</option>' +
    options
      .map((option) => `<option value="${esc(option)}">${esc(option)}</option>`)
      .join("");

  if (options.includes(previous)) select.value = previous;
}

function updateQuizOptionControls() {
  const count = getQuizOptionInputs().length;
  const addButton = document.querySelector("#add-quiz-option");
  if (addButton) addButton.disabled = count >= MAX_QUIZ_OPTIONS;
  document.querySelectorAll(".quiz-option-remove").forEach((button) => {
    button.disabled = count <= MIN_QUIZ_OPTIONS;
  });
}

function renumberQuizOptionPlaceholders() {
  getQuizOptionInputs().forEach((input, index) => {
    input.placeholder = `Option ${index + 1}`;
  });
}

function addQuizOptionRow(value = "") {
  const list = document.querySelector("#quiz-option-list");
  if (!list || getQuizOptionInputs().length >= MAX_QUIZ_OPTIONS) return;

  const row = document.createElement("div");
  row.className = "quiz-option-row";

  const input = document.createElement("input");
  input.className = "quiz-option-input";
  input.type = "text";
  input.maxLength = 1000;
  input.placeholder = `Option ${getQuizOptionInputs().length + 1}`;
  input.required = true;
  input.value = value;
  input.addEventListener("input", syncCorrectAnswerSelect);

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "table-action delete quiz-option-remove";
  removeButton.setAttribute("aria-label", "Remove option");
  removeButton.textContent = "Remove";
  removeButton.addEventListener("click", () => {
    if (getQuizOptionInputs().length <= MIN_QUIZ_OPTIONS) return;
    row.remove();
    renumberQuizOptionPlaceholders();
    syncCorrectAnswerSelect();
    updateQuizOptionControls();
  });

  row.append(input, removeButton);
  list.appendChild(row);
  syncCorrectAnswerSelect();
  updateQuizOptionControls();
}

function resetQuizOptions() {
  const list = document.querySelector("#quiz-option-list");
  if (!list) return;
  list.replaceChildren();
  addQuizOptionRow();
  addQuizOptionRow();
  const select = document.querySelector("#correct-answer-select");
  if (select) select.value = "";
}

function collectQuizOptions() {
  return getQuizOptionInputs()
    .map((input) => input.value.trim())
    .filter(Boolean);
}

async function loadQuizQuestions(quizId, isReadOnly) {
  try {
    const questions = await api(`/api/teacher/quizzes/${quizId}/questions`);
    const panel = document.querySelector("#question-panel");
    panel.classList.remove("hidden");

    document.querySelector("#question-quiz-id").value = quizId;

    const form = document.querySelector("#question-form");
    if (isReadOnly) {
      form.classList.add("hidden");
      panel.querySelector("h3").textContent =
        "Quiz questions (Published - Read Only)";
    } else {
      form.classList.remove("hidden");
      panel.querySelector("h3").textContent = "Add quiz question";
      resetQuizOptions();
    }

    document.querySelector("#question-list").innerHTML =
      questions
        .map((q, idx) => {
          let deleteBtn = "";
          if (!isReadOnly) {
            deleteBtn = `<button class="table-action delete" data-delete-question="${q.id}" data-quiz-id="${quizId}" type="button" style="margin: 0; padding: 4px 8px; font-size: 11px; float: right;">Delete</button>`;
          }

          return `
        <article class="question-item-card">
          ${deleteBtn}
          <strong>Q${idx + 1}: ${formatBody(q.questionText)}</strong>
          <span class="status status-active" style="display: inline-block; margin-left: 8px; padding: 2px 6px;">${q.points} pts</span>
          <ul style="margin: 8px 0 0 18px; padding: 0;">
            ${q.options
              .map(
                (opt) => `
              <li style="margin-top: 4px; ${opt.trim() === q.correctAnswer.trim() ? "font-weight: bold; color: var(--mint);" : ""}">
                ${esc(opt)} ${opt.trim() === q.correctAnswer.trim() ? "✓" : ""}
              </li>
            `,
              )
              .join("")}
          </ul>
        </article>
      `;
        })
        .join("") ||
      '<p class="empty-state">No questions in this quiz yet.</p>';

    panel.scrollIntoView({ behavior: "smooth" });
  } catch (x) {
    inform(x.message, "error");
  }
}

document.querySelectorAll(".admin-nav a").forEach((link) =>
  link.addEventListener("click", (e) => {
    e.preventDefault();
    document
      .querySelectorAll(".teacher-view")
      .forEach((v) => v.classList.add("hidden"));
    document
      .querySelector(link.getAttribute("href"))
      .classList.remove("hidden");
    document
      .querySelectorAll(".admin-nav a")
      .forEach((a) => a.classList.remove("active"));
    link.classList.add("active");
    if (link.getAttribute("href") === "#analytics") autoSelectAnalyticsCourse();
  }),
);

function autoSelectAnalyticsCourse() {
  const select = document.querySelector("#analytics-course");
  if (!select || select.value || select.options.length < 2) return;
  select.selectedIndex = 1;
  select.dispatchEvent(new Event("change"));
}

document.querySelectorAll(".page-shortcuts a").forEach((shortcut) =>
  shortcut.addEventListener("click", (event) => {
    event.preventDefault();
    const destination = shortcut.getAttribute("href");
    document.querySelector(`.admin-nav a[href="${destination}"]`)?.click();
  }),
);

document.querySelector("#course-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const d = formData(e.target);
  d.categoryId = d.categoryId || null;
  try {
    await api("/api/teacher/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(d),
    });
    e.target.reset();
    inform("Course created and sent for approval.");
    await loadCourses();
    await loadDashboard();
  } catch (x) {
    inform(x.message, "error");
  }
});

document
  .querySelector("#content-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    const courseId = e.target.elements.courseId.value;
    try {
      if (e.target.elements.type.value === "PDF") {
        const file = e.target.elements.file.files[0];
        if (!file) throw new Error("Choose a PDF file to share.");
        const data = new FormData();
        data.append("courseId", courseId);
        data.append("title", e.target.elements.title.value);
        data.append("file", file);
        await api("/api/teacher/content/pdf", { method: "POST", body: data });
      } else {
        await api("/api/teacher/content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData(e.target)),
        });
      }
      e.target.reset();
      syncContentInputs();
      inform("Learning material added.");
      await showContent(courseId);
      await loadDashboard();
    } catch (x) {
      inform(x.message, "error");
    }
  });

function syncContentInputs() {
  const form = document.querySelector("#content-form");
  const isPdf = form.elements.type.value === "PDF";
  form.elements.body.classList.toggle("hidden", isPdf);
  form.elements.body.required = !isPdf && form.elements.type.value === "VIDEO";
  form.elements.file.classList.toggle("hidden", !isPdf);
  document
    .querySelector("#content-upload-help")
    .classList.toggle("hidden", !isPdf);
  if (isPdf) form.elements.body.value = "";
  else form.elements.file.value = "";
  form.elements.body.placeholder =
    form.elements.type.value === "VIDEO"
      ? "Paste a YouTube, Vimeo, or direct video URL"
      : "Resource body (supports markdown like **bold**, *italics*, `code`)";
}

document
  .querySelector("#content-type")
  .addEventListener("change", syncContentInputs);
syncContentInputs();

document
  .querySelector('#content-form select[name="courseId"]')
  .addEventListener("change", (e) => {
    const courseId = e.target.value;
    if (courseId) {
      showContent(courseId);
    } else {
      document.querySelector("#content-list").innerHTML = "";
    }
  });

document.querySelector("#content-list").addEventListener("click", async (e) => {
  const id = e.target.dataset.deleteContent;
  const courseId = e.target.dataset.courseId;
  if (!id) return;
  if (!confirm("Are you sure you want to delete this resource?")) return;
  try {
    await api(`/api/teacher/content/${id}`, { method: "DELETE" });
    inform("Learning material deleted.");
    await showContent(courseId);
    await loadDashboard();
  } catch (x) {
    inform(x.message, "error");
  }
});

document
  .querySelector("#assignment-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api("/api/teacher/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData(e.target)),
      });
      e.target.reset();
      inform("Assignment created as DRAFT.");
      await loadAssignments();
      await loadDashboard();
    } catch (x) {
      inform(x.message, "error");
    }
  });

document
  .querySelector("#assignment-list")
  .addEventListener("click", async (e) => {
    const manageId = e.target.dataset.manageAssignment;
    const viewId = e.target.dataset.viewAssignmentQuestions;
    if (manageId || viewId) {
      await loadAssignmentQuestions(manageId || viewId, !!viewId);
      return;
    }

    const publishId = e.target.dataset.publishAssignment;
    if (publishId) {
      try {
        await api(`/api/teacher/assignments/${publishId}/publish`, {
          method: "PATCH",
        });
        inform("Assignment published successfully.");
        await loadAssignments();
        await loadDashboard();
      } catch (x) {
        inform(x.message, "error");
      }
      return;
    }

    const id = e.target.dataset.deleteAssignment;
    if (!id) return;
    if (
      !confirm(
        "Are you sure you want to delete this assignment? (This will also delete all submissions for it)",
      )
    )
      return;
    try {
      await api(`/api/teacher/assignments/${id}`, { method: "DELETE" });
      inform("Assignment deleted.");
      await loadAssignments();
      await loadDashboard();
    } catch (x) {
      inform(x.message, "error");
    }
  });

document.querySelector("#quiz-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/api/teacher/quizzes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData(e.target)),
    });
    e.target.reset();
    inform("Quiz created.");
    await loadAssignments();
    await loadDashboard();
  } catch (x) {
    inform(x.message, "error");
  }
});

document.querySelector("#quiz-list").addEventListener("click", async (e) => {
  const manageId = e.target.dataset.manageQuiz;
  const viewId = e.target.dataset.viewQuiz;
  const publishId = e.target.dataset.publishQuiz;
  const deleteId = e.target.dataset.deleteQuiz;

  if (deleteId) {
    if (!confirm("Are you sure you want to delete this quiz?")) return;
    try {
      await api(`/api/teacher/quizzes/${deleteId}`, { method: "DELETE" });
      inform("Quiz deleted.");
      const qQuizIdInput = document.querySelector("#question-quiz-id");
      if (qQuizIdInput && qQuizIdInput.value == deleteId) {
        document.querySelector("#question-panel").classList.add("hidden");
      }
      await loadAssignments();
      await loadDashboard();
    } catch (x) {
      inform(x.message, "error");
    }
    return;
  }

  if (publishId) {
    try {
      await api(`/api/teacher/quizzes/${publishId}/publish`, {
        method: "PATCH",
      });
      inform("Quiz published successfully.");
      await loadAssignments();
      await loadDashboard();
    } catch (x) {
      inform(x.message, "error");
    }
    return;
  }

  const quizId = manageId || viewId;
  if (!quizId) return;

  const isReadOnly = !!viewId;
  await loadQuizQuestions(quizId, isReadOnly);
});

document.querySelector("#close-questions").addEventListener("click", () => {
  document.querySelector("#question-panel").classList.add("hidden");
  resetQuizOptions();
});

document
  .querySelector("#add-quiz-option")
  .addEventListener("click", () => addQuizOptionRow());

document
  .querySelector("#question-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    const quizId = document.querySelector("#question-quiz-id").value;
    const form = e.target;
    const questionText = form.elements.questionText.value.trim();
    const correctAnswer = form.elements.correctAnswer.value.trim();
    const points = parseInt(form.elements.points.value, 10);
    const options = collectQuizOptions();

    if (options.length < MIN_QUIZ_OPTIONS || options.length > MAX_QUIZ_OPTIONS) {
      return inform(
        `Please provide between ${MIN_QUIZ_OPTIONS} and ${MAX_QUIZ_OPTIONS} answer options.`,
        "error",
      );
    }
    if (new Set(options).size !== options.length) {
      return inform("Each answer option must be unique.", "error");
    }
    if (!options.includes(correctAnswer)) {
      return inform(
        "Select the correct answer from the options you entered.",
        "error",
      );
    }
    if (!Number.isFinite(points) || points < 1 || points > 100) {
      return inform("Points must be between 1 and 100.", "error");
    }

    try {
      await api(`/api/teacher/quizzes/${quizId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionText, options, correctAnswer, points }),
      });
      form.elements.questionText.value = "";
      form.elements.points.value = "1";
      resetQuizOptions();
      inform("Question added successfully.");
      await loadQuizQuestions(quizId, false);
      await loadAssignments();
    } catch (x) {
      inform(x.message, "error");
    }
  });

document
  .querySelector("#question-list")
  .addEventListener("click", async (e) => {
    const id = e.target.dataset.deleteQuestion;
    const quizId = e.target.dataset.quizId;
    if (!id) return;
    if (!confirm("Are you sure you want to delete this question?")) return;
    try {
      await api(`/api/teacher/quizzes/${quizId}/questions/${id}`, {
        method: "DELETE",
      });
      inform("Question deleted.");
      await loadQuizQuestions(quizId, false);
      await loadAssignments();
    } catch (x) {
      inform(x.message, "error");
    }
  });

document
  .querySelector("#announcement-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api("/api/teacher/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData(e.target)),
      });
      e.target.reset();
      inform("Announcement published.");
      await loadAnnouncements();
    } catch (x) {
      inform(x.message, "error");
    }
  });

document
  .querySelector("#announcement-list")
  .addEventListener("click", async (e) => {
    const id = e.target.dataset.deleteAnnouncement;
    if (!id) return;
    if (!confirm("Are you sure you want to delete this announcement?")) return;
    try {
      await api(`/api/teacher/announcements/${id}`, { method: "DELETE" });
      inform("Announcement deleted.");
      await loadAnnouncements();
    } catch (x) {
      inform(x.message, "error");
    }
  });

document.querySelector("#course-list").addEventListener("click", async (e) => {
  const id = e.target.dataset.contentCourse || e.target.dataset.editCourse;
  if (!id) return;
  if (e.target.dataset.contentCourse) {
    document.querySelectorAll(".admin-nav a").forEach((a) => {
      if (a.getAttribute("href") === "#courses") a.click();
    });
    return showContent(id);
  }

  const course = courses.find((c) => c.id == id);
  const title = prompt("Course title", course.title);
  if (!title) return;
  const description = prompt("Course description", course.description || "");
  if (description === null) return;

  try {
    await api(`/api/teacher/courses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        categoryId: course.categoryId,
      }),
    });
    inform("Course updated and sent for approval.");
    await loadCourses();
  } catch (x) {
    inform(x.message, "error");
  }
});

async function loadSubmissionAnswers(submissionId, containerId) {
  try {
    const answers = await api(
      `/api/teacher/submissions/${submissionId}/answers`,
    );
    const container = document.getElementById(containerId);
    if (!answers.length) {
      container.innerHTML =
        '<p style="color:var(--muted); font-size:12px; margin: 4px 0 0;">No structured answers submitted.</p>';
      return;
    }
    container.innerHTML = answers
      .map(
        (ans, idx) => `
      <div class="question-item-card" style="margin-top: 10px; border-left: 4px solid var(--primary); padding: 16px;">
        <strong style="display:block; font-size:14px; margin-bottom: 6px;">Question ${idx + 1}: ${esc(ans.question_text)}</strong>
        <div class="submitted-answer-text" style="color: #ffffff; background: rgba(255, 255, 255, 0.02);">${esc(ans.answer_text)}</div>
      </div>
    `,
      )
      .join("");
  } catch (x) {
    console.error(x);
  }
}

const loadedSubmissionAnswers = new Set();

document
  .querySelector("#submission-assignment")
  .addEventListener("change", async (e) => {
    const list = document.querySelector("#submission-list");
    const search = document.querySelector("#assignment-student-search");
    const download = document.querySelector("#assignment-download-csv");
    assignmentSubmissions = [];
    assignmentCurrent = null;
    loadedSubmissionAnswers.clear();
    list.replaceChildren();
    hideGradePanel();
    if (!e.target.value) {
      search.hidden = true;
      search.value = "";
      download.hidden = true;
      download.disabled = true;
      updateAssignmentProgress();
      return;
    }
    search.hidden = false;
    search.value = "";
    download.hidden = true;
    download.disabled = true;
    try {
      assignmentSubmissions = await api(
        `/api/teacher/assignments/${e.target.value}/submissions`,
      );
      if (!assignmentSubmissions.length) {
        list.innerHTML = '<p class="empty-state">No submissions yet.</p>';
        updateAssignmentProgress();
        return;
      }
      renderAssignmentList();
      download.hidden = false;
      download.disabled = false;
      if (window.__autoAdvanceGrading) {
        window.__autoAdvanceGrading = false;
        const next = assignmentSubmissions.find((s) => s.score == null);
        if (next) openGradeFor(next.id);
      }
      list.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (x) {
      inform(x.message, "error");
    }
  });

const submissionCardHtml = (submission) => {
  const graded = submission.score != null;
  return `<article class="list-card submission-card" data-submission-id="${submission.id}" data-name="${esc(submission.student_name)}" data-email="${esc(submission.email)}">
    <div class="list-card__main">
      <div class="list-card__title">
        <strong>${esc(submission.student_name)}</strong>
        <span class="status ${graded ? "status-graded" : "status-pending"}">${graded ? "Graded" : "Awaiting grading"}</span>
      </div>
      <div class="list-card__meta">
        <span class="chip">${esc(submission.email)}</span>
        <span class="chip">Submitted ${new Date(submission.submitted_at).toLocaleString()}</span>
        <span class="chip ${graded ? "chip--good" : "chip--warn"}">Score: ${submission.score ?? "Not graded"} / ${submission.max_score}</span>
        ${submission.feedback ? `<span class="chip">Feedback: ${esc(submission.feedback)}</span>` : ""}
      </div>
      <div class="submission-card__answers" hidden><div id="sub-answers-${submission.id}">Loading answers...</div></div>
      <div class="submission-card__actions">
        <button class="btn--sm" data-toggle-answers="${submission.id}" type="button">View answers</button>
        <button class="btn--sm btn--primary" data-open-grade="${submission.id}" type="button">Grade / feedback</button>
      </div>
    </div>
  </article>`;
};

function renderAssignmentList() {
  const list = document.querySelector("#submission-list");
  if (!assignmentSubmissions.length) return;
  list.innerHTML = assignmentSubmissions
    .map(submissionCardHtml)
    .join("");
  filterSubmissionCards("#submission-list", "#assignment-student-search");
  updateAssignmentProgress();
}

function loadSubmissionAnswersOnce(submissionId, containerId) {
  if (loadedSubmissionAnswers.has(submissionId)) return;
  loadedSubmissionAnswers.add(submissionId);
  loadSubmissionAnswers(submissionId, containerId);
}

async function openGradeFor(submissionId, focus = true) {
  const submission = assignmentSubmissions.find((s) => s.id == submissionId);
  if (!submission) return;
  assignmentCurrent = submission;
  const card = document.querySelector(
    `#submission-list .submission-card[data-submission-id="${submissionId}"]`,
  );
  if (card) {
    const answersBox = card.querySelector(".submission-card__answers");
    if (answersBox) {
      answersBox.hidden = false;
      loadSubmissionAnswersOnce(submissionId, `sub-answers-${submissionId}`);
    }
  }
  openGradePanel(submission);
  if (focus) {
    document
      .querySelector("#assignment-grade-panel")
      .scrollIntoView({ behavior: "smooth", block: "start" });
    const score = document.querySelector("#assignment-grade-score");
    score.focus();
    score.select();
  }
}

document
  .querySelector("#submission-list")
  .addEventListener("click", (e) => {
    const target = e.target.closest("button");
    if (!target) return;
    const subId = target.dataset.openGrade || target.dataset.toggleAnswers;
    if (!subId) return;
    if (target.dataset.toggleAnswers) {
      const box = document.querySelector(
        `#submission-list [data-submission-id="${subId}"] .submission-card__answers`,
      );
      if (box) {
        box.hidden = !box.hidden;
        if (!box.hidden)
          loadSubmissionAnswersOnce(subId, `sub-answers-${subId}`);
      }
      return;
    }
    openGradeFor(subId);
  });

async function saveAssignmentGrade(advance) {
  const submission = assignmentCurrent;
  if (!submission) return;
  const scoreInput = document.querySelector("#assignment-grade-score");
  const feedbackInput = document.querySelector("#assignment-grade-feedback");
  const scoreRaw = scoreInput.value.trim();
  const numericScore = Number(scoreRaw);
  if (scoreRaw === "" || !Number.isFinite(numericScore) || numericScore < 0)
    return inform("Enter a valid non-negative score.", "error");
  if (numericScore > submission.max_score)
    return inform(
      `Score cannot exceed the maximum of ${submission.max_score}.`,
      "error",
    );
  const button = advance
    ? document.querySelector("#assignment-grade-next")
    : document.querySelector("#assignment-grade-save");
  button.disabled = true;
  try {
    await api(`/api/teacher/submissions/${submission.id}/grade`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        score: numericScore,
        feedback: feedbackInput.value.trim(),
      }),
    });
    submission.score = numericScore;
    submission.feedback = feedbackInput.value.trim();
    inform("Grade and feedback saved.");
    if (advance) {
      renderAssignmentList();
      const next = assignmentSubmissions.find((s) => s.score == null);
      if (next) {
        window.__autoAdvanceGrading = true;
        document
          .querySelector("#submission-assignment")
          .dispatchEvent(new Event("change"));
      } else {
        inform("All submissions have been graded.");
      }
    } else {
      renderAssignmentList();
      hideGradePanel();
    }
    await loadDashboard();
  } catch (x) {
    inform(x.message, "error");
  } finally {
    button.disabled = false;
  }
}
document
  .querySelector("#assignment-grade-save")
  .addEventListener("click", () => saveAssignmentGrade(false));
document
  .querySelector("#assignment-grade-next")
  .addEventListener("click", () => saveAssignmentGrade(true));

function selectedOptionText(selectId) {
  const select = document.querySelector(selectId);
  return select?.selectedOptions[0]?.textContent || "";
}

document
  .querySelector("#assignment-download-csv")
  .addEventListener("click", () => {
    if (!assignmentSubmissions.length) return;
    const filename = `${safeFilename(selectedOptionText("#submission-assignment"))}-grades.csv`;
    const headers = [
      "Student name",
      "Email",
      "Submitted at",
      "Score",
      "Max score",
      "Percentage",
      "Grade",
      "Feedback",
    ];
    const rows = assignmentSubmissions.map((s) => {
      const pct =
        s.max_score && Number(s.max_score) > 0
          ? Math.round((Number(s.score || 0) / Number(s.max_score)) * 100)
          : "";
      return [
        s.student_name,
        s.email,
        new Date(s.submitted_at).toLocaleString(),
        s.score ?? "",
        s.max_score,
        pct,
        s.score != null ? gradeFor(pct) : "",
        s.feedback ?? "",
      ];
    });
    downloadCsv(filename, headers, rows);
    inform(`Downloaded ${assignmentSubmissions.length} student grades.`);
  });

async function loadQuizSubmissionAnswers(submissionId, containerId) {
  try {
    const answers = await api(
      `/api/teacher/quiz-submissions/${submissionId}/answers`,
    );
    const container = document.getElementById(containerId);
    container.innerHTML =
      answers
        .map((answer, index) => {
const correct = isCorrectAnswer(answer.is_correct);
          return `
      <div class="list-card__quiz-answer ${correct ? "correct" : "incorrect"}">
        <div class="list-card__quiz-answer__top">
          <strong>Q${index + 1}: ${esc(answer.question_text)}</strong>
        </div>
        <div class="list-card__quiz-answer__row ${correct ? "answer-good" : "answer-bad"}">
          <span class="list-card__quiz-answer__label">Student's answer</span>
          <strong>${esc(answer.selected_answer || "No answer")}</strong>
        </div>
        <div class="list-card__quiz-answer__row answer-good">
          <span class="list-card__quiz-answer__label">Correct answer</span>
          <strong>${esc(answer.correct_answer)}</strong>
        </div>
      </div>
    `;
        })
        .join("") ||
      '<p class="empty-state">No answer details were recorded.</p>';
  } catch (x) {
    const container = document.getElementById(containerId);
    if (container) container.textContent = "Unable to load answer details.";
    inform(x.message, "error");
  }
}

const loadedQuizAnswers = new Set();

document
  .querySelector("#quiz-submission-quiz")
  .addEventListener("change", async (event) => {
    const quizId = event.target.value;
    const list = document.querySelector("#quiz-submission-list");
    const search = document.querySelector("#quiz-student-search");
    const download = document.querySelector("#quiz-download-csv");
    quizSubmissions = [];
    loadedQuizAnswers.clear();
    list.replaceChildren();
    if (!quizId) {
      search.hidden = true;
      search.value = "";
      download.hidden = true;
      download.disabled = true;
      return;
    }
    search.hidden = false;
    search.value = "";
    download.hidden = true;
    download.disabled = true;
    try {
      quizSubmissions = await api(`/api/teacher/quizzes/${quizId}/submissions`);
      if (!quizSubmissions.length) {
        list.innerHTML =
          '<p class="empty-state">No students have submitted this quiz yet.</p>';
        search.hidden = true;
        return;
      }
      renderQuizList();
      download.hidden = false;
      download.disabled = false;
      list.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (x) {
      inform(x.message, "error");
    }
  });

const quizSubmissionCardHtml = (submission) =>
  `<article class="list-card submission-card" data-submission-id="${submission.id}" data-name="${esc(submission.student_name)}" data-email="${esc(submission.email)}">
    <div class="list-card__main">
      <div class="list-card__title">
        <strong>${esc(submission.student_name)}</strong>
        <span class="status status-graded">Quiz submission</span>
      </div>
      <div class="list-card__meta">
        <span class="chip">${esc(submission.email)}</span>
        <span class="chip">Submitted ${new Date(submission.submitted_at).toLocaleString()}</span>
        <span class="chip chip--good">Score: ${submission.score}</span>
      </div>
      <div class="submission-card__answers quiz-answers-scroll" hidden><div id="quiz-submission-answers-${submission.id}">Loading answers...</div></div>
      <div class="submission-card__actions">
        <button class="btn--sm" data-toggle-quiz-answers="${submission.id}" type="button">View answers</button>
      </div>
    </div>
  </article>`;

function renderQuizList() {
  const list = document.querySelector("#quiz-submission-list");
  list.innerHTML = quizSubmissions.map(quizSubmissionCardHtml).join("");
  filterSubmissionCards("#quiz-submission-list", "#quiz-student-search");
}

document
  .querySelector("#quiz-submission-list")
  .addEventListener("click", (e) => {
    const target = e.target.closest("button");
    if (!target) return;
    const subId = target.dataset.toggleQuizAnswers;
    if (!subId) return;
    const box = document.querySelector(
      `#quiz-submission-list [data-submission-id="${subId}"] .submission-card__answers`,
    );
    if (!box) return;
    box.hidden = !box.hidden;
    if (!box.hidden) {
      const containerId = `quiz-submission-answers-${subId}`;
      if (!loadedQuizAnswers.has(subId)) {
        loadedQuizAnswers.add(subId);
        loadQuizSubmissionAnswers(subId, containerId);
      }
    }
  });

document
  .querySelector("#quiz-download-csv")
  .addEventListener("click", () => {
    if (!quizSubmissions.length) return;
    const filename = `${safeFilename(selectedOptionText("#quiz-submission-quiz"))}-marks.csv`;
    const headers = [
      "Student name",
      "Email",
      "Submitted at",
      "Marks",
    ];
    const rows = quizSubmissions.map((s) => [
      s.student_name,
      s.email,
      new Date(s.submitted_at).toLocaleString(),
      s.score ?? "",
    ]);
    downloadCsv(filename, headers, rows);
    inform(`Downloaded ${quizSubmissions.length} student marks.`);
  });

document
  .querySelector("#analytics-course")
  .addEventListener("change", async (e) => {
    const select = e.target;
    const courseId = select.value;
    const courseName = select.options[select.selectedIndex]?.text.trim();
    const container = document.querySelector("#analytics-results");
    if (!courseId) {
      container.innerHTML = `
        <div class="analytics-empty">
          <strong>Select a course to view its performance.</strong>
          <span>Enrollment, assessment activity, and average scores will appear here.</span>
        </div>`;
      return;
    }
    container.innerHTML = '<div class="analytics-loading" role="status">Loading course performance…</div>';
    try {
      const data = await api(`/api/teacher/courses/${courseId}/analytics`);
      container.innerHTML = renderAnalytics(data, courseName);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const arc = container.querySelector(".gauge-arc");
          if (arc) {
            arc.setAttribute("stroke-dashoffset", arc.dataset.finalOffset);
          }
          container
            .querySelectorAll(".chart-bar")
            .forEach((bar) => (bar.style.transform = "scaleX(1)"));
        });
      });
    } catch (x) {
      inform(x.message, "error");
      container.innerHTML = `
        <div class="analytics-empty analytics-error">
          <strong>Course performance could not be loaded.</strong>
          <span>Please choose the course again or try refreshing the page.</span>
        </div>`;
    }
  });

async function loadAssignmentQuestions(assignmentId, isReadOnly) {
  try {
    const questions = await api(
      `/api/teacher/assignments/${assignmentId}/questions`,
    );
    const panel = document.querySelector("#assignment-question-panel");
    panel.classList.remove("hidden");

    document.querySelector("#question-assignment-id").value = assignmentId;

    const form = document.querySelector("#assignment-question-form");
    if (isReadOnly) {
      form.classList.add("hidden");
      panel.querySelector("h3").textContent =
        "Assignment Questions (Published - Read Only)";
    } else {
      form.classList.remove("hidden");
      panel.querySelector("h3").textContent = "Manage Assignment Questions";
    }

    document.querySelector("#assignment-question-list").innerHTML =
      questions
        .map((q, idx) => {
          let deleteBtn = "";
          if (!isReadOnly) {
            deleteBtn = `<button class="table-action delete" data-delete-assignment-question="${q.id}" data-assignment-id="${assignmentId}" type="button" style="margin: 0; padding: 4px 8px; font-size: 11px; float: right;">Delete</button>`;
          }

          return `
        <article class="question-item-card">
          ${deleteBtn}
          <strong>Q${idx + 1}: ${formatBody(q.question_text)}</strong>
        </article>
      `;
        })
        .join("") ||
      '<p class="empty-state">No questions in this assignment yet.</p>';

    panel.scrollIntoView({ behavior: "smooth" });
  } catch (x) {
    inform(x.message, "error");
  }
}

document
  .querySelector("#close-assignment-questions")
  .addEventListener("click", () => {
    document
      .querySelector("#assignment-question-panel")
      .classList.add("hidden");
  });

document
  .querySelector("#assignment-question-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    const assignmentId = document.querySelector(
      "#question-assignment-id",
    ).value;
    const form = e.target;
    const questionText = form.elements.questionText.value.trim();
    if (!questionText) return inform("Please enter question text", "error");

    try {
      await api(`/api/teacher/assignments/${assignmentId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionText }),
      });
      form.reset();
      inform("Question added successfully.");
      await loadAssignmentQuestions(assignmentId, false);
    } catch (x) {
      inform(x.message, "error");
    }
  });

document
  .querySelector("#assignment-question-panel")
  .addEventListener("click", async (e) => {
    const id = e.target.dataset.deleteAssignmentQuestion;
    const assignmentId = e.target.dataset.assignmentId;
    if (!id) return;
    if (!confirm("Are you sure you want to delete this question?")) return;
    try {
      await api(`/api/teacher/assignments/${assignmentId}/questions/${id}`, {
        method: "DELETE",
      });
      inform("Question deleted.");
      await loadAssignmentQuestions(assignmentId, false);
    } catch (x) {
      inform(x.message, "error");
    }
  });

resetQuizOptions();

document
  .querySelector("#assignment-student-search")
  .addEventListener("input", () => {
    filterSubmissionCards("#submission-list", "#assignment-student-search");
  });
document.querySelector("#quiz-student-search").addEventListener("input", () => {
  filterSubmissionCards("#quiz-submission-list", "#quiz-student-search");
});

(async () => {
  try {
    const user = await api("/api/auth/me");
    if (user.role !== "TEACHER") return location.replace("/");
    document.querySelector("#user-name").textContent = user.fullName;
    if (window.HiveActivity && HiveActivity.self) HiveActivity.self(user.fullName);

    const results = await Promise.allSettled([
      loadDashboard(),
      loadCourses(),
      loadAssignments(),
      loadAnnouncements(),
    ]);

    const failures = results
      .filter((result) => result.status === "rejected")
      .map((result) => result.reason);
    const authFailure = failures.find(
      (error) => error.status === 401 || error.status === 403,
    );
    if (authFailure) return location.replace("/");
    if (failures.length)
      inform(
        `Some teacher workspace data could not load: ${failures.map((error) => error.message).join("; ")}`,
        "error",
      );
  } catch (e) {
    if (e.status === 401 || e.status === 403) return location.replace("/");
    inform(`Unable to load the teacher workspace: ${e.message}`, "error");
  }
})();

document.querySelector("#logout").addEventListener("click", async () => {
  await fetch((window.APP_API || "") + "/api/auth/logout", { method: "DELETE" });
  location.assign("/");
});
