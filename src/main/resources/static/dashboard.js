const requiredRole = document.body.dataset.role;
const message = document.querySelector("#student-message");
let courses = [],
  assignments = [],
  quizzes = [];

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
    const data = await api("/api/student/dashboard");
    const stats = [
      ["Enrolled Courses", data.enrolledCourses],
      ["Available Courses", data.availableCourses],
      ["Pending Assignments", data.pendingAssignments],
      ["Completed Assignments", data.completedAssignments],
      ["Assignment average", `${data.averageScore.toFixed(1)}%`],
      ["Completed quizzes", data.completedQuizzes],
      ["Quiz average", `${data.averageQuizScore.toFixed(1)}%`],
    ];
    document.querySelector("#student-stats").innerHTML = stats
      .map(
        ([label, value]) => `
      <article>
        <p>${label}</p>
        <strong>${value}</strong>
      </article>
    `,
      )
      .join("");
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
          let button = "";
          if (c.enrolled) {
            button = '<span class="status status-active">Enrolled</span>';
          } else {
            button = `<button data-enroll-course="${c.id}" type="button" style="margin: 0; padding: 6px 12px; font-size: 11px;">Enroll</button>`;
          }
          return `
        <article style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
          <div>
            <strong>${esc(c.title)}</strong>
            <p style="margin-top: 4px; font-size: 12px; color: var(--muted);">${esc(c.description || "No description")} · Instructor: ${esc(c.teacher_name)} · ${c.student_count} students</p>
          </div>
          <div>${button}</div>
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
            actionBtn = `<button data-work-assignment="${a.id}" type="button" style="margin: 0; padding: 6px 12px; font-size: 11px;">Start Work</button>`;
          } else if (a.submission_status === "SUBMITTED") {
            statusClass = "status-pending";
            actionBtn = `<button data-view-submission="${a.id}" type="button" style="margin: 0; padding: 6px 12px; font-size: 11px; background:var(--muted); box-shadow:none;">View Answer</button>`;
          } else {
            statusClass = "status-active";
            actionBtn = `<button data-view-submission="${a.id}" type="button" style="margin: 0; padding: 6px 12px; font-size: 11px; background:linear-gradient(135deg, var(--mint), #0f9f6e);">View Grade</button>`;
          }

          const dueInfo = a.due_at
            ? `Due: ${new Date(a.due_at).toLocaleString()}`
            : "No due date";
          const scoreInfo =
            a.score !== null
              ? `Grade: ${a.score} / ${a.max_score}`
              : `Max Score: ${a.max_score}`;

          return `
        <article style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <strong>${esc(a.title)}</strong>
              <span class="status ${statusClass}">${esc(a.submission_status)}</span>
            </div>
            <p style="margin-top: 4px; font-size: 12px; color: var(--muted);">${esc(a.course_title)} · ${dueInfo} · ${scoreInfo}</p>
          </div>
          <div>${actionBtn}</div>
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

    document.querySelector("#details-assignment-title").textContent = esc(
      details.assignment_title,
    );

    const gradeBox = document.querySelector("#details-grade-info");
    const graded = details.score !== null;
    gradeBox.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div>
          <h4 style="margin: 0; font-size: 14px; color: var(--indigo);">Grading Status: <strong>${graded ? "Graded" : "Submitted (Awaiting Grading)"}</strong></h4>
          <p style="margin: 5px 0 0; font-size: 12px; color: var(--muted);">Submitted on: ${new Date(details.submitted_at).toLocaleString()}</p>
        </div>
        <div style="font-size: 18px; font-weight: bold; color: var(--ink);">
          Score: ${graded ? details.score : "--"} / ${details.max_score}
        </div>
      </div>
      ${
        graded
          ? `
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(85, 72, 232, 0.15);">
          <strong style="display:block; font-size:12px; color:#4f46e5; text-transform:uppercase; letter-spacing:0.05em;">Teacher Feedback:</strong>
          <p style="margin: 4px 0 0; font-size: 13px; line-height: 1.5; color:#374151;">${formatBody(details.feedback || "No feedback provided.")}</p>
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
      <article>
        <strong>${esc(item.title)}</strong>
        <p>${formatBody(item.message)}</p>
        <small style="color:var(--muted);">${new Date(item.created_at).toLocaleString()}</small>
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
            ? `<button data-view-quiz="${quiz.id}" type="button">View results</button>`
            : `<button data-take-quiz="${quiz.id}" type="button">Take quiz</button>`;
          return `<article style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
        <div><strong>${esc(quiz.title)}</strong><p>${esc(quiz.description || "No description")} &middot; ${quiz.question_count} question(s)${submitted ? ` &middot; Score: ${quiz.score}` : ""}</p></div>
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
    document.querySelector("#quiz-questions-container").innerHTML =
      questions
        .map(
          (question, index) => `
      <fieldset class="student-quiz-question">
        <legend>${index + 1}. ${esc(question.question_text)} <span style="color:var(--muted); font-size:12px;">(${question.points} point${question.points == 1 ? "" : "s"})</span></legend>
        ${question.options.map((option, optionIndex) => `<label class="student-quiz-option"><input type="radio" name="quiz-${question.id}" value="${esc(option)}" ${optionIndex === 0 ? "required" : ""}><span>${esc(option)}</span></label>`).join("")}
      </fieldset>`,
        )
        .join("") || '<p class="empty-state">This quiz has no questions.</p>';
    document.querySelector("#quiz-work-panel").classList.remove("hidden");
    document.querySelector("#quiz-details-panel").classList.add("hidden");
    document
      .querySelector("#quiz-work-panel")
      .scrollIntoView({ behavior: "smooth" });
  } catch (x) {
    inform(x.message, "error");
  }
}

document
  .querySelector("#quiz-submission-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    const quizId = document.querySelector("#work-quiz-id").value;
    const answers = {};
    event.target
      .querySelectorAll('input[type="radio"]:checked')
      .forEach((input) => {
        answers[input.name.replace("quiz-", "")] = input.value;
      });
    try {
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
      `<strong>Score: ${details.score} / ${maxScore}</strong><p style="margin:6px 0 0; color:var(--muted);">Submitted ${new Date(details.submitted_at).toLocaleString()}</p>`;
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
    await loadDashboard();
  } catch (e) {
    location.replace("/");
  }
})();

document.querySelector("#logout").addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "DELETE" });
  location.assign("/");
});
