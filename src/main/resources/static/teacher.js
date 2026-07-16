const message = document.querySelector("#teacher-message");
let courses = [],
  assignments = [],
  assignmentSubmissions = [],
  quizSubmissions = [];

const api = async (path, options = {}) => {
  const method = options.method || "GET";
  const r = await fetch(path, options);
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

function getScoreGaugeSvg(score) {
  const normalizedScore = Number.isFinite(Number(score))
    ? Math.max(0, Math.min(100, Number(score)))
    : 0;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (normalizedScore / 100) * circumference;
  return `
    <svg width="110" height="110" viewBox="0 0 100 100" style="transform: rotate(-90deg); margin: 0 auto; display: block;">
      <circle cx="50" cy="50" r="${radius}" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="8"/>
      <circle cx="50" cy="50" r="${radius}" fill="none" stroke="var(--primary)" stroke-width="8"
        stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" stroke-linecap="round"
        style="transition: stroke-dashoffset 0.8s ease-in-out;"/>
      <text x="50" y="-46" fill="var(--ink)" font-size="16" font-weight="bold" text-anchor="middle"
        style="transform: rotate(90deg);" dominant-baseline="middle">${normalizedScore.toFixed(1)}%</text>
    </svg>
  `;
}

function getActivityChartSvg(data) {
  const maxValue = Math.max(
    data.materials,
    data.assignments,
    data.quizzes,
    data.submissions,
    1,
  );
  const items = [
    { label: "Content", count: data.materials, color: "#3b82f6" },
    { label: "Tasks", count: data.assignments, color: "#f59e0b" },
    { label: "Quizzes", count: data.quizzes, color: "#10b981" },
    { label: "Submits", count: data.submissions, color: "#8b5cf6" },
  ];

  return `
    <svg width="100%" height="110" viewBox="0 0 200 110" style="background: transparent; overflow: visible;">
      ${items
        .map((item, idx) => {
          const y = 5 + idx * 26;
          const width = (item.count / maxValue) * 110;
          return `
          <text x="0" y="${y + 12}" fill="var(--muted)" font-size="9" font-weight="bold">${item.label}</text>
          <rect x="50" y="${y}" width="${width}" height="14" fill="${item.color}" rx="3"/>
          <text x="${55 + width}" y="${y + 12}" fill="var(--ink)" font-size="10" font-weight="bold">${item.count}</text>
        `;
        })
        .join("")}
    </svg>
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
  const data = await api("/api/teacher/dashboard");
  const labels = [
    ["Courses", data.courses],
    ["Pending approval", data.pendingCourses],
    ["Students", data.students],
    ["Lessons & materials", data.lessons],
    ["Assignments", data.assignments],
    ["Quizzes", data.quizzes],
    ["Awaiting grades", data.submissionsToGrade],
  ];
  document.querySelector("#teacher-stats").innerHTML = labels
    .map(
      ([label, value]) => `
    <article>
      <p>${label}</p>
      <strong>${value}</strong>
    </article>
  `,
    )
    .join("");
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
    <article>
      <strong>${esc(c.title)}</strong>
      <span class="status status-${c.status.toLowerCase()}">${c.status}</span>
      <p>${esc(c.description || "No description")} · ${c.studentCount} students · ${esc(c.categoryName || "Uncategorized")}</p>
      <button data-edit-course="${c.id}" type="button">Edit course</button>
      <button data-content-course="${c.id}" type="button">View material</button>
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
        <button data-manage-assignment="${a.id}" type="button" style="margin: 0 4px 0 0; padding: 6px 10px; font-size: 11px;">Questions</button>
        <button class="publish-btn" data-publish-assignment="${a.id}" type="button" style="margin: 0 4px 0 0; padding: 6px 10px; font-size: 11px; background: linear-gradient(135deg, #10b981, #059669); box-shadow: none;">Publish</button>
      `;
        } else {
          actions = `
        <button data-view-assignment-questions="${a.id}" type="button" style="margin: 0 4px 0 0; padding: 6px 10px; font-size: 11px;">View Questions</button>
      `;
        }
        actions += `<button class="table-action delete" data-delete-assignment="${a.id}" type="button" style="margin: 0; padding: 6px 10px; font-size: 11px;">Delete</button>`;

        return `
      <article style="display: flex; justify-content: space-between; align-items: start;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <strong>${esc(a.title)}</strong>
            <span class="status ${statusClass}">${esc(a.status)}</span>
          </div>
          <p style="margin-top: 6px;">${esc(a.course_title)} · ${a.submissions || 0} submissions · ${a.awaiting_grade || 0} awaiting grades</p>
        </div>
        <div style="display: flex; gap: 4px;">
          ${actions}
        </div>
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
        <button data-manage-quiz="${q.id}" type="button" style="margin: 0; padding: 6px 10px; font-size: 11px;">Manage Questions</button>
        <button class="publish-btn" data-publish-quiz="${q.id}" type="button" style="margin: 0; padding: 6px 10px; font-size: 11px; background: linear-gradient(135deg, #10b981, #059669); box-shadow: none;">Publish Quiz</button>
      `;
        } else {
          actions = `
        <button data-view-quiz="${q.id}" type="button" style="margin: 0; padding: 6px 10px; font-size: 11px;">View Questions</button>
      `;
        }
        actions += `<button class="table-action delete" data-delete-quiz="${q.id}" type="button" style="margin: 0; padding: 6px 10px; font-size: 11px;">Delete</button>`;

        return `
      <article style="display: flex; justify-content: space-between; align-items: start; gap: 16px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <strong>${esc(q.title)}</strong>
            <span class="status ${statusClass}">${esc(q.status)}</span>
          </div>
          <p style="margin-top: 6px;">${esc(q.course_title)} &middot; ${qCount} question${qCount === 1 ? "" : "s"}${q.description ? ` &middot; ${esc(q.description)}` : ""}</p>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 4px; justify-content: end;">
          ${actions}
        </div>
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
    <article style="display: flex; justify-content: space-between; align-items: start;">
      <div>
        <strong>${esc(a.title)}</strong>
        <p>${esc(a.course_title)} &middot; ${formatBody(a.message)}</p>
      </div>
      <button class="table-action delete" data-delete-announcement="${a.id}" type="button" style="margin: 0; padding: 4px 8px; font-size: 11px;">Delete</button>
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
    <article style="display: flex; justify-content: space-between; align-items: start;">
      <div>
        <strong>${esc(r.title)}</strong>
        <span class="status" style="margin-left: 8px;">${esc(r.type)}</span>
        <p style="margin-top: 6px;">${formatBody(r.body)}</p>
      </div>
      <button class="table-action delete" data-delete-content="${r.id}" data-course-id="${courseId}" type="button" style="margin: 0; padding: 4px 8px; font-size: 11px;">Delete</button>
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
  }),
);

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

document
  .querySelector("#submission-assignment")
  .addEventListener("change", async (e) => {
    const studentSelect = document.querySelector(
      "#assignment-submission-student",
    );
    const list = document.querySelector("#submission-list");
    assignmentSubmissions = [];
    studentSelect.innerHTML = '<option value="">Select student</option>';
    studentSelect.disabled = true;
    list.replaceChildren();
    if (!e.target.value) return;
    try {
      assignmentSubmissions = await api(
        `/api/teacher/assignments/${e.target.value}/submissions`,
      );
      if (!assignmentSubmissions.length) {
        list.innerHTML = '<p class="empty-state">No submissions yet.</p>';
        return;
      }
      studentSelect.disabled = false;
      studentSelect.innerHTML += assignmentSubmissions
        .map(
          (s) =>
            `<option value="${s.id}">${esc(s.student_name)} (${esc(s.email)})</option>`,
        )
        .join("");
      list.innerHTML =
        '<p class="empty-state">Select a student to view their submission.</p>';
    } catch (x) {
      inform(x.message, "error");
    }
  });

document
  .querySelector("#assignment-submission-student")
  .addEventListener("change", async (event) => {
    const list = document.querySelector("#submission-list");
    const submission = assignmentSubmissions.find(
      (item) => item.id == event.target.value,
    );
    if (!submission) return list.replaceChildren();
    const answerContainerId = `sub-answers-${submission.id}`;
    list.innerHTML = `<article style="display:flex; flex-direction:column; gap:8px;">
    <div><strong>${esc(submission.student_name)} (${esc(submission.email)})</strong><p>Submitted: ${new Date(submission.submitted_at).toLocaleString()}</p></div>
    <div id="${answerContainerId}">Loading answers...</div>
    <p style="font-weight:500;">Score: ${submission.score ?? "Not graded"} / ${submission.max_score}${submission.feedback ? ` &middot; Feedback: ${esc(submission.feedback)}` : ""}</p>
    <button data-grade="${submission.id}" type="button" style="align-self:start;">Grade / feedback</button>
  </article>`;
    await loadSubmissionAnswers(submission.id, answerContainerId);
  });

document
  .querySelector("#submission-list")
  .addEventListener("click", async (e) => {
    const id = e.target.dataset.grade;
    if (!id) return;
    const score = prompt("Score");
    if (score === null) return;
    const numericScore = Number(score);
    if (
      score.trim() === "" ||
      !Number.isFinite(numericScore) ||
      numericScore < 0
    )
      return inform("Enter a valid non-negative score.", "error");
    const feedback = prompt("Feedback", "");
    if (feedback === null) return;

    try {
      await api(`/api/teacher/submissions/${id}/grade`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: numericScore, feedback }),
      });
      inform("Grade and feedback saved.");
      document
        .querySelector("#submission-assignment")
        .dispatchEvent(new Event("change"));
      await loadDashboard();
    } catch (x) {
      inform(x.message, "error");
    }
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
      <div class="question-item-card teacher-graded-answer ${correct ? "correct" : "incorrect"}" style="margin-top: 10px; padding: 16px;">
        <strong style="display:block; font-size:14px; margin-bottom: 6px;">Question ${index + 1}: ${esc(answer.question_text)}</strong>
        <div class="submitted-answer-text" style="margin-top: 8px;">
          Student's answer (${correct ? "Correct" : "Incorrect"}): <strong>${esc(answer.selected_answer || "No answer")}</strong>
        </div>
        <div class="submitted-answer-text correct-answer-display" style="background: rgba(255, 255, 255, 0.01); margin-top: 6px;">
          Correct answer: <strong>${esc(answer.correct_answer)}</strong> (${answer.points} point(s))
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

document
  .querySelector("#quiz-submission-quiz")
  .addEventListener("change", async (event) => {
    const quizId = event.target.value;
    const list = document.querySelector("#quiz-submission-list");
    const studentSelect = document.querySelector("#quiz-submission-student");
    quizSubmissions = [];
    studentSelect.innerHTML = '<option value="">Select student</option>';
    studentSelect.disabled = true;
    list.replaceChildren();
    if (!quizId) return;
    try {
      quizSubmissions = await api(`/api/teacher/quizzes/${quizId}/submissions`);
      if (!quizSubmissions.length) {
        list.innerHTML =
          '<p class="empty-state">No students have submitted this quiz yet.</p>';
        return;
      }
      studentSelect.disabled = false;
      studentSelect.innerHTML += quizSubmissions
        .map(
          (s) =>
            `<option value="${s.id}">${esc(s.student_name)} (${esc(s.email)})</option>`,
        )
        .join("");
      list.innerHTML =
        '<p class="empty-state">Select a student to view their quiz results.</p>';
    } catch (x) {
      inform(x.message, "error");
    }
  });

document
  .querySelector("#quiz-submission-student")
  .addEventListener("change", async (event) => {
    const list = document.querySelector("#quiz-submission-list");
    const submission = quizSubmissions.find(
      (item) => item.id == event.target.value,
    );
    if (!submission) return list.replaceChildren();
    const answerContainerId = `quiz-submission-answers-${submission.id}`;
    list.innerHTML = `<article><strong>${esc(submission.student_name)} (${esc(submission.email)})</strong><p>Submitted: ${new Date(submission.submitted_at).toLocaleString()} &middot; Score: ${submission.score}</p><div id="${answerContainerId}" style="margin-top:8px;">Loading answers...</div></article>`;
    await loadQuizSubmissionAnswers(submission.id, answerContainerId);
  });

async function loadStudentProgress() {
  const students = await api("/api/teacher/students/progress");
  const list = document.querySelector("#student-progress-list");
  list.innerHTML =
    students
      .map((student) => {
        const assignments =
          student.assignments
            .map((assignment) => {
              const status = assignment.submitted_at
                ? assignment.score == null
                  ? "Submitted"
                  : `Graded: ${assignment.score} / ${assignment.max_score}`
                : "Not submitted";
              return `<li><strong>${esc(assignment.course_title)} — ${esc(assignment.title)}</strong>: ${status}
        ${assignment.submitted_at ? `<button type="button" data-open-assignment-submission="${assignment.id}">View submission</button>` : ""}</li>`;
            })
            .join("") || "<li>No published assignments.</li>";
        const quizzes =
          student.quizzes
            .map((quiz) => {
              const status = quiz.submitted_at
                ? `Score: ${quiz.score}`
                : "Not submitted";
              return `<li><strong>${esc(quiz.course_title)} — ${esc(quiz.title)}</strong>: ${status}
        ${quiz.submitted_at ? `<button type="button" data-open-quiz-result="${quiz.id}">View results</button>` : ""}</li>`;
            })
            .join("") || "<li>No published quizzes.</li>";
        return `<details>
      <summary style="cursor:pointer;"><strong>${esc(student.full_name)}</strong> <span style="color:var(--muted);">${esc(student.email)}</span></summary>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:18px; margin-top:14px;">
        <div><h4 style="margin:0 0 8px;">Assignments</h4><ul style="margin:0; padding-left:18px; display:grid; gap:8px;">${assignments}</ul></div>
        <div><h4 style="margin:0 0 8px;">Quizzes</h4><ul style="margin:0; padding-left:18px; display:grid; gap:8px;">${quizzes}</ul></div>
      </div>
    </details>`;
      })
      .join("") ||
    '<p class="empty-state">No students are enrolled in your courses yet.</p>';
}

document
  .querySelector("#student-progress-list")
  ?.addEventListener("click", (event) => {
    const assignmentId = event.target.dataset.openAssignmentSubmission;
    const quizId = event.target.dataset.openQuizResult;
    if (assignmentId) {
      const select = document.querySelector("#submission-assignment");
      select.value = assignmentId;
      select.dispatchEvent(new Event("change"));
    }
    if (quizId) {
      const select = document.querySelector("#quiz-submission-quiz");
      select.value = quizId;
      select.dispatchEvent(new Event("change"));
    }
  });

document
  .querySelector("#analytics-course")
  .addEventListener("change", async (e) => {
    const courseId = e.target.value;
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

      const stats = [
        [
          "Students Enrolled",
          `<strong class="analytics-number">${data.students}</strong>`,
        ],
        [
          "Quiz Questions",
          `<strong class="analytics-number analytics-number-secondary">${data.quizQuestions}</strong>`,
        ],
        ["Course Average Score", getScoreGaugeSvg(data.averageScore)],
        ["Activity & Resources", getActivityChartSvg(data)],
      ];

      container.innerHTML = stats
        .map(
          ([label, value]) => `
      <article class="analytics-card">
        <p>${label}</p>
        <div class="analytics-value">${value}</div>
      </article>
    `,
        )
        .join("");
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

(async () => {
  try {
    const user = await api("/api/auth/me");
    if (user.role !== "TEACHER") return location.replace("/");
    document.querySelector("#user-name").textContent = user.fullName;

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
  await fetch("/api/auth/logout", { method: "DELETE" });
  location.assign("/");
});
