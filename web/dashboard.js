const requiredRole = document.body.dataset.role;
const message = document.querySelector("#student-message");
let courses = [],
  assignments = [],
  quizzes = [];

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
  if (!message) return;
  message.textContent = text;
  message.className = `message visible ${type}`;
};

const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );

const ICONS = {
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  compass:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z"/></svg>',
  clock:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  users:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  clipboard:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 12l2 2 4-4"/></svg>',
  check:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>',
  trend:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/></svg>',
  zap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  chart:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>',
  inbox:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
  dot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="6"/></svg>',
};

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

const resourceUrl = (value) => {
  try {
    const url = new URL(String(value ?? "").trim());
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch (_) {
    return null;
  }
};

const videoEmbedUrl = (value) => {
  const url = resourceUrl(value);
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be"))
      return `https://www.youtube.com/embed/${parsed.pathname.slice(1)}`;
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (parsed.hostname.includes("vimeo.com")) {
      const id = parsed.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch (_) {
    /* Invalid URLs are rendered as plain text below. */
  }
  return null;
};

const resourceDisplay = (resource) => {
  const url = resourceUrl(resource.body);
  if (
    resource.type === "PDF" &&
    String(resource.body || "").startsWith("file:")
  ) {
    return `<a class="student-resource-link" href="/api/student/content/${resource.id}/file" target="_blank" rel="noopener noreferrer">Open PDF resource <span aria-hidden="true">↗</span></a>`;
  }
  if (resource.type === "VIDEO" && videoEmbedUrl(resource.body)) {
    return `<div class="student-video-frame"><iframe src="${esc(videoEmbedUrl(resource.body))}" title="${esc(resource.title)}" loading="lazy" allowfullscreen></iframe></div>`;
  }
  if (["PDF", "VIDEO"].includes(resource.type) && url) {
    return `<a class="student-resource-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Open ${resource.type === "PDF" ? "PDF resource" : "video"} <span aria-hidden="true">↗</span></a>`;
  }
  return `<p class="student-resource-body">${formatBody(resource.body || "No description provided.")}</p>`;
};

const isCorrectAnswer = (value) =>
  value === true || value === 1 || value === "1" || value === "true";

// Sidebar Tab Switching
document.querySelectorAll(".admin-nav a").forEach((link) =>
  link.addEventListener("click", (e) => {
    e.preventDefault();
    document
      .querySelectorAll(".student-view")
      .forEach((v) => v.classList.add("hidden"));
    document
      .querySelector(link.getAttribute("href"))
      .classList.remove("hidden");
    document
      .querySelectorAll(".admin-nav a")
      .forEach((a) => a.classList.remove("active"));
    link.classList.add("active");

    // Hide details/work sub-panels when navigating
    document.querySelector("#assignment-work-panel").classList.add("hidden");
    document.querySelector("#assignment-details-panel").classList.add("hidden");
    document.querySelector("#quiz-work-panel").classList.add("hidden");
    document.querySelector("#quiz-details-panel").classList.add("hidden");

    if (message) message.className = "message";

    const href = link.getAttribute("href");
    if (href === "#overview") loadDashboard();
    if (href === "#directory") loadDirectory();
    if (href === "#courses") loadMyCourses();
    if (href === "#announcements") loadAnnouncements();
    if (href === "#assignments") loadAssignments();
    if (href === "#quizzes") loadQuizzes();
  }),
);

document.querySelectorAll(".page-shortcuts a").forEach((shortcut) =>
  shortcut.addEventListener("click", (event) => {
    event.preventDefault();
    const destination = shortcut.getAttribute("href");
    document.querySelector(`.admin-nav a[href="${destination}"]`)?.click();
  }),
);

async function loadDashboard() {
  try {
    const container = document.querySelector("#student-activity");
    if (!container || !window.HiveActivity) return;
    const activities = await api("/api/student/activity");
    window.HiveActivity.render(container, activities);
  } catch (x) {
    inform(x.message, "error");
  }
}

async function loadDirectory() {
  try {
    courses = await api("/api/student/courses");
    const list = document.querySelector("#directory-list");
    list.innerHTML =
      courses
        .map((c) => {
          const action = c.enrolled
            ? '<span class="status status-enrolled">Enrolled</span>'
            : `<button class="btn--sm btn--primary" data-enroll-course="${c.id}" type="button">Enroll</button>`;
          return `
        <article class="course-directory-card list-card">
          <div class="course-directory-card__content">
            <div class="list-card__title">
              <strong>${esc(c.title)}</strong>
            </div>
            <p class="list-card__body">${esc(c.description || "No description")}</p>
            <div class="list-card__meta">
              <span class="chip chip--accent">${esc(c.category_name || "General")}</span>
              <span class="chip">Instructor · ${esc(c.teacher_name)}</span>
              <span class="chip">${c.student_count} students</span>
            </div>
          </div>
          <div class="course-directory-card__action">${action}</div>
        </article>
      `;
        })
        .join("") ||
      '<p class="empty-state">No courses are currently available.</p>';
  } catch (x) {
    inform(x.message, "error");
  }
}

document
  .querySelector("#directory-list")
  .addEventListener("click", async (e) => {
    const courseId = e.target.dataset.enrollCourse;
    if (!courseId) return;
    try {
      await api(`/api/student/courses/${courseId}/enroll`, { method: "POST" });
      inform("Enrolled in course successfully!");
      await loadDirectory();
    } catch (x) {
      inform(x.message, "error");
    }
  });

async function loadMyCourses() {
  try {
    courses = await api("/api/student/courses");
    const enrolled = courses.filter((c) => c.enrolled);
    const select = document.querySelector("#course-select-content");
    const currentValue = select.value;

    select.innerHTML =
      '<option value="">Select an enrolled course</option>' +
      enrolled
        .map(
          (c) => `
      <option value="${c.id}">${esc(c.title)}</option>
    `,
        )
        .join("");
    select.value = enrolled.some((c) => c.id == currentValue)
      ? currentValue
      : enrolled[0]
        ? String(enrolled[0].id)
        : "";

    if (select.value) {
      await showCourseContent(select.value);
    } else {
      document.querySelector("#content-list").innerHTML = "";
    }
  } catch (x) {
    inform(x.message, "error");
  }
}

async function showCourseContent(courseId) {
  try {
    const list = document.querySelector("#content-list");
    const content = await api(`/api/student/courses/${courseId}/content`);
    list.innerHTML =
      content
        .map(
          (r) => `
      <article class="student-resource-card">
        <div class="student-resource-heading">
          <div><span class="student-resource-icon">${r.type === "VIDEO" ? "▶" : r.type === "PDF" ? "PDF" : "✦"}</span><strong>${esc(r.title)}</strong></div>
          <span class="status">${esc(r.type)}</span>
        </div>
        ${resourceDisplay(r)}
        <small class="student-resource-date">Shared ${new Date(r.created_at).toLocaleDateString()}</small>
      </article>
    `,
        )
        .join("") ||
      '<p class="empty-state">No materials published in this course yet.</p>';
  } catch (x) {
    inform(x.message, "error");
  }
}

document
  .querySelector("#course-select-content")
  .addEventListener("change", (e) => {
    if (e.target.value) {
      showCourseContent(e.target.value);
    } else {
      document.querySelector("#content-list").innerHTML = "";
    }
  });

async function loadAssignments() {
  try {
    assignments = await api("/api/student/assignments");
    const list = document.querySelector("#student-assignment-list");
    list.innerHTML =
      assignments
        .map((a) => {
          let statusClass = "status-pending";
          let actionBtn = "";

          if (a.submission_status === "PENDING") {
            actionBtn = `<button class="btn--sm btn--primary" data-work-assignment="${a.id}" type="button">Start Work</button>`;
          } else if (a.submission_status === "SUBMITTED") {
            statusClass = "status-pending";
            actionBtn = `<button class="btn--sm btn--muted" data-view-submission="${a.id}" type="button">View Answer</button>`;
          } else {
            statusClass = "status-active";
            actionBtn = `<button class="btn--sm btn--mint" data-view-submission="${a.id}" type="button">View Grade</button>`;
          }

          const dueInfo = a.due_at
            ? new Date(a.due_at).toLocaleString()
            : "No due date";
          const scoreInfo =
            a.score !== null
              ? `Grade ${a.score} / ${a.max_score}`
              : `Max ${a.max_score}`;

          return `
        <article class="list-card">
          <div class="list-card__main">
            <div class="list-card__title">
              <strong>${esc(a.title)}</strong>
              <span class="status ${statusClass}">${esc(a.submission_status)}</span>
            </div>
            <div class="list-card__meta">
              <span class="chip">${esc(a.course_title)}</span>
              <span class="chip chip--warn">${esc(dueInfo)}</span>
              <span class="chip chip--good">${scoreInfo}</span>
            </div>
          </div>
          <div class="list-card__actions">${actionBtn}</div>
        </article>
      `;
        })
        .join("") ||
      '<p class="empty-state">No published assignments found in your enrolled courses.</p>';
  } catch (x) {
    inform(x.message, "error");
  }
}

// Assignment Actions Click Handlers
document
  .querySelector("#student-assignment-list")
  .addEventListener("click", async (e) => {
    const workId = e.target.dataset.workAssignment;
    const viewId = e.target.dataset.viewSubmission;

    if (workId) {
      await startAssignmentWork(workId);
    } else if (viewId) {
      await viewSubmissionDetails(viewId);
    }
  });

async function startAssignmentWork(assignmentId) {
  try {
    const assignment = assignments.find((a) => a.id == assignmentId);
    const questions = await api(
      `/api/student/assignments/${assignmentId}/questions`,
    );

    document.querySelector("#work-assignment-id").value = assignmentId;
    document.querySelector("#work-assignment-title").textContent = esc(
      assignment.title,
    );
    document.querySelector("#work-assignment-instructions").innerHTML =
      formatBody(
        assignment.instructions ||
          "Follow the instructions and submit answers to all questions below.",
      );

    const container = document.querySelector("#work-questions-container");
    container.innerHTML =
      questions
        .map(
          (q, idx) => `
      <div class="question-item-card">
        <strong style="display: block; margin-bottom: 8px; font-size: 15px;">Question ${idx + 1}: ${formatBody(q.question_text)}</strong>
        <textarea name="q-${q.id}" placeholder="Type your answer here..." required style="min-height: 100px; resize: vertical; margin-top: 8px;"></textarea>
      </div>
    `,
        )
        .join("") ||
      '<p style="color:var(--muted); padding: 15px;">No questions defined for this assignment. Click submit below to submit anyway.</p>';

    document.querySelector("#assignment-work-panel").classList.remove("hidden");
    document.querySelector("#assignment-details-panel").classList.add("hidden");

    document
      .querySelector("#assignment-work-panel")
      .scrollIntoView({ behavior: "smooth" });
  } catch (x) {
    inform(x.message, "error");
  }
}

document
  .querySelector("#close-assignment-work")
  .addEventListener("click", () => {
    document.querySelector("#assignment-work-panel").classList.add("hidden");
  });

document
  .querySelector("#assignment-submission-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    const assignmentId = document.querySelector("#work-assignment-id").value;
    const form = e.target;

    const answers = {};
    const textareas = form.querySelectorAll("textarea");
    textareas.forEach((ta) => {
      const qId = ta.name.replace("q-", "");
      answers[qId] = ta.value.trim();
    });

    try {
      await api(`/api/student/assignments/${assignmentId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answers),
      });

      inform("Assignment submitted successfully!", "success");
      document.querySelector("#assignment-work-panel").classList.add("hidden");
      await loadAssignments();
    } catch (x) {
      inform(x.message, "error");
    }
  });

async function viewSubmissionDetails(assignmentId) {
  try {
    const details = await api(
      `/api/student/assignments/${assignmentId}/submission`,
    );
    if (!details || !details.assignment_title) {
      return inform("No submission found for this assignment.", "error");
    }

    document.querySelector("#details-assignment-title").textContent = esc(
      details.assignment_title,
    );

    const gradeBox = document.querySelector("#details-grade-info");
    const graded = details.score !== null;
    gradeBox.innerHTML = `
      <div class="list-card__title" style="margin-bottom: 4px">
        <span class="status ${graded ? "status-graded" : "status-pending"}">${graded ? "Graded" : "Awaiting grading"}</span>
        <strong>Score: ${graded ? details.score : "--"} / ${details.max_score}</strong>
      </div>
      <p style="margin: 0; font-size: 12.5px; color: var(--muted);">Submitted on: ${new Date(details.submitted_at).toLocaleString()}</p>
      ${
        graded
          ? `
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--glass-border);">
          <strong style="display:block; font-size:11px; color:var(--indigo); text-transform:uppercase; letter-spacing:0.06em;">Teacher Feedback</strong>
          <p style="margin: 4px 0 0; font-size: 13px; line-height: 1.6; color: var(--muted);">${formatBody(details.feedback || "No feedback provided.")}</p>
        </div>
      `
          : ""
      }
    `;

    const answersContainer = document.querySelector(
      "#details-answers-container",
    );
    answersContainer.innerHTML =
      details.answers
        .map(
          (ans, idx) => `
      <div class="question-item-card">
        <strong style="display: block; margin-bottom: 8px; font-size: 15px;">Question ${idx + 1}: ${formatBody(ans.question_text)}</strong>
        <div class="submitted-answer-text">${esc(ans.answer_text)}</div>
      </div>
    `,
        )
        .join("") ||
      '<p style="color:var(--muted); text-align:center;">No answers found.</p>';

    document
      .querySelector("#assignment-details-panel")
      .classList.remove("hidden");
    document.querySelector("#assignment-work-panel").classList.add("hidden");

    document
      .querySelector("#assignment-details-panel")
      .scrollIntoView({ behavior: "smooth" });
  } catch (x) {
    inform(x.message, "error");
  }
}

document
  .querySelector("#close-assignment-details")
  .addEventListener("click", () => {
    document.querySelector("#assignment-details-panel").classList.add("hidden");
  });

function fillEnrolledCourseSelect(selectId) {
  const select = document.querySelector(selectId);
  const currentValue = select.value;
  const enrolled = courses.filter((course) => course.enrolled);
  select.innerHTML =
    '<option value="">Select an enrolled course</option>' +
    enrolled
      .map(
        (course) =>
          `<option value="${course.id}">${esc(course.title)}</option>`,
      )
      .join("");
  select.value = enrolled.some((course) => course.id == currentValue)
    ? currentValue
    : enrolled[0]
      ? String(enrolled[0].id)
      : "";
  return select.value;
}

async function loadAnnouncements() {
  try {
    courses = await api("/api/student/courses");
    const courseId = fillEnrolledCourseSelect("#course-select-announcements");
    if (courseId) await showAnnouncements(courseId);
    else
      document.querySelector("#announcement-list").innerHTML =
        '<p class="empty-state">Choose a course to view announcements.</p>';
  } catch (x) {
    inform(x.message, "error");
  }
}

async function showAnnouncements(courseId) {
  try {
    const announcements = await api(
      `/api/student/courses/${courseId}/announcements`,
    );
    document.querySelector("#announcement-list").innerHTML =
      announcements
        .map(
          (item) => `
      <article class="announcement-card list-card">
        <div class="list-card__main">
          <div class="announcement-card__meta">
            <time datetime="${new Date(item.created_at).toISOString()}">${new Date(item.created_at).toLocaleString()}</time>
          </div>
          <div class="list-card__title"><strong>${esc(item.title)}</strong></div>
          <p class="announcement-card__body">${formatBody(item.message)}</p>
        </div>
      </article>
    `,
        )
        .join("") ||
      '<p class="empty-state">No announcements for this course yet.</p>';
  } catch (x) {
    inform(x.message, "error");
  }
}

document
  .querySelector("#course-select-announcements")
  .addEventListener("change", (event) => {
    if (event.target.value) showAnnouncements(event.target.value);
    else
      document.querySelector("#announcement-list").innerHTML =
        '<p class="empty-state">Choose a course to view announcements.</p>';
  });

async function loadQuizzes() {
  try {
    courses = await api("/api/student/courses");
    const courseId = fillEnrolledCourseSelect("#course-select-quizzes");
    if (courseId) await showQuizzes(courseId);
    else
      document.querySelector("#quiz-list").innerHTML =
        '<p class="empty-state">Choose a course to view its quizzes.</p>';
  } catch (x) {
    inform(x.message, "error");
  }
}

async function showQuizzes(courseId) {
  try {
    quizzes = await api(`/api/student/courses/${courseId}/quizzes`);
    document.querySelector("#quiz-list").innerHTML =
      quizzes
        .map((quiz) => {
          const submitted = quiz.submitted_at != null;
          const action = submitted
            ? `<button class="btn--sm btn--mint" data-view-quiz="${quiz.id}" type="button">View results</button>`
            : `<button class="btn--sm btn--primary" data-take-quiz="${quiz.id}" type="button">Take quiz</button>`;
          return `<article class="student-quiz-card list-card">
        <div class="student-quiz-card__content">
          <strong>${esc(quiz.title)}</strong>
          <p>${esc(quiz.description || "No description")}</p>
          <span class="student-quiz-card__meta chip chip--accent">${quiz.question_count} question${quiz.question_count == 1 ? "" : "s"}</span>
          ${submitted ? `<span class="student-quiz-card__meta chip chip--good">Score: ${quiz.score}</span>` : ""}
        </div>
        ${action}
      </article>`;
        })
        .join("") ||
      '<p class="empty-state">No published quizzes for this course yet.</p>';
  } catch (x) {
    inform(x.message, "error");
  }
}

document
  .querySelector("#course-select-quizzes")
  .addEventListener("change", (event) => {
    if (event.target.value) showQuizzes(event.target.value);
    else
      document.querySelector("#quiz-list").innerHTML =
        '<p class="empty-state">Choose a course to view its quizzes.</p>';
  });

document
  .querySelector("#quiz-list")
  .addEventListener("click", async (event) => {
    if (event.target.dataset.takeQuiz)
      await startQuiz(event.target.dataset.takeQuiz);
    if (event.target.dataset.viewQuiz)
      await viewQuizResults(event.target.dataset.viewQuiz);
  });

async function startQuiz(quizId) {
  try {
    const quiz = quizzes.find((item) => item.id == quizId);
    const questions = await api(`/api/student/quizzes/${quizId}/questions`);
    document.querySelector("#work-quiz-id").value = quizId;
    document.querySelector("#quiz-work-title").textContent = quiz.title;
    const totalPoints = questions.reduce(
      (total, question) => total + Number(question.points || 0),
      0,
    );
    document.querySelector("#quiz-work-meta").textContent =
      `${questions.length} question${questions.length == 1 ? "" : "s"} · ${totalPoints} point${totalPoints == 1 ? "" : "s"}`;
    document.querySelector("#quiz-questions-container").innerHTML =
      questions
        .map(
          (question, index) => `
      <fieldset class="student-quiz-question">
        <legend><span class="student-quiz-question__number">Question ${index + 1}</span>${esc(question.question_text)} <span class="student-quiz-question__points">${question.points} point${question.points == 1 ? "" : "s"}</span></legend>
        ${question.options.map((option, optionIndex) => `<label class="student-quiz-option"><input type="radio" name="quiz-${question.id}" value="${esc(option)}" ${optionIndex === 0 ? "required" : ""}><span>${esc(option)}</span></label>`).join("")}
      </fieldset>`,
        )
        .join("") || '<p class="empty-state">This quiz has no questions.</p>';
    updateQuizProgress();
    document.querySelector("#quiz-work-panel").classList.remove("hidden");
    document.querySelector("#quiz-details-panel").classList.add("hidden");
    document
      .querySelector("#quiz-work-panel")
      .scrollIntoView({ behavior: "smooth" });
  } catch (x) {
    inform(x.message, "error");
  }
}

function updateQuizProgress() {
  const questions = document.querySelectorAll(".student-quiz-question");
  const answered = [...questions].filter((question) =>
    question.querySelector('input[type="radio"]:checked'),
  ).length;
  const progress = document.querySelector("#quiz-progress");
  const submitButton = document.querySelector(
    '#quiz-submission-form button[type="submit"]',
  );
  if (progress)
    progress.textContent = questions.length
      ? `${answered} of ${questions.length} answered`
      : "No questions available";
  if (submitButton) submitButton.disabled = questions.length === 0;
}

document
  .querySelector("#quiz-submission-form")
  .addEventListener("change", updateQuizProgress);

document
  .querySelector("#quiz-submission-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    const quizId = document.querySelector("#work-quiz-id").value;
    const submitButton = event.target.querySelector('button[type="submit"]');
    const answers = {};
    event.target
      .querySelectorAll('input[type="radio"]:checked')
      .forEach((input) => {
        answers[input.name.replace("quiz-", "")] = input.value;
      });
    try {
      submitButton.disabled = true;
      submitButton.textContent = "Submitting…";
      const result = await api(`/api/student/quizzes/${quizId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answers),
      });
      inform(
        `Quiz submitted. Score: ${result.score} / ${result.maxScore}`,
        "success",
      );
      document.querySelector("#quiz-work-panel").classList.add("hidden");
      await showQuizzes(document.querySelector("#course-select-quizzes").value);
      await viewQuizResults(quizId);
    } catch (x) {
      submitButton.disabled = false;
      submitButton.textContent = "Submit Quiz";
      inform(x.message, "error");
    }
  });

async function viewQuizResults(quizId) {
  try {
    const details = await api(`/api/student/quizzes/${quizId}/submission`);
    const maxScore = details.answers.reduce(
      (total, answer) => total + Number(answer.points),
      0,
    );
    document.querySelector("#quiz-details-title").textContent =
      details.quiz_title;
    document.querySelector("#quiz-score-info").innerHTML =
      `<div class="quiz-score-hero">
        <span class="status status-graded">Completed</span>
        <strong class="quiz-score-hero__value">Score: ${details.score} / ${maxScore}</strong>
      </div>
      <p style="margin-top: 10px; color:var(--muted); font-size: 12.5px;">Submitted ${new Date(details.submitted_at).toLocaleString()}</p>`;
    document.querySelector("#quiz-answers-container").innerHTML =
      details.answers
        .map((answer, index) => {
          const correct = isCorrectAnswer(answer.is_correct);
          return `
      <article class="student-quiz-result ${correct ? "correct" : "incorrect"}">
        <strong>${index + 1}. ${esc(answer.question_text)}</strong>
        <p>Your answer: ${esc(answer.selected_answer || "No answer")}</p>
        <p><span class="quiz-result-label">${correct ? "Correct" : "Incorrect"}</span> Correct answer: ${esc(answer.correct_answer)} &middot; ${answer.points} point(s)</p>
      </article>`;
        })
        .join("");
    document.querySelector("#quiz-details-panel").classList.remove("hidden");
    document.querySelector("#quiz-work-panel").classList.add("hidden");
    document
      .querySelector("#quiz-details-panel")
      .scrollIntoView({ behavior: "smooth" });
  } catch (x) {
    inform(x.message, "error");
  }
}

document
  .querySelector("#close-quiz-work")
  .addEventListener("click", () =>
    document.querySelector("#quiz-work-panel").classList.add("hidden"),
  );
document
  .querySelector("#close-quiz-details")
  .addEventListener("click", () =>
    document.querySelector("#quiz-details-panel").classList.add("hidden"),
  );

// App Startup Bootstrapping
(async () => {
  try {
    const user = await api("/api/auth/me");
    if (user.role !== requiredRole) return location.replace("/");
    document.querySelector("#user-name").textContent = user.fullName;
    if (window.HiveActivity && HiveActivity.self) HiveActivity.self(user.fullName);
    await loadDashboard();
  } catch (e) {
    location.replace("/");
  }
})();

document.querySelector("#logout").addEventListener("click", async () => {
  await fetch((window.APP_API || "") + "/api/auth/logout", { method: "DELETE" });
  location.assign("/");
});
