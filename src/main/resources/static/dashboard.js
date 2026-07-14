const requiredRole = document.body.dataset.role;
const message = document.querySelector('#student-message');
let courses = [], assignments = [];

const api = async (path, options = {}) => {
  const method = options.method || 'GET';
  const r = await fetch(path, options);
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    const error = new Error(`${e.detail || e.message || e.error || `HTTP ${r.status}`} (${method} ${path})`);
    error.status = r.status;
    throw error;
  }
  const body = await r.text();
  return body ? JSON.parse(body) : null;
};

const inform = (text, type = 'success') => {
  if (!message) return;
  message.textContent = text;
  message.className = `message visible ${type}`;
};

const esc = value => String(value ?? '').replace(/[&<>"]/g, char => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;'
}[char]));

const formatBody = text => {
  let formatted = esc(text || '');
  formatted = formatted.replace(/\n/g, '<br>');
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
  formatted = formatted.replace(/`(.*?)`/g, '<code style="background:var(--indigo-soft); padding:2px 4px; border-radius:4px; font-family:monospace; font-size:92%;">$1</code>');
  return formatted;
};

// Sidebar Tab Switching
document.querySelectorAll('.admin-nav a').forEach(link => link.addEventListener('click', e => {
  e.preventDefault();
  document.querySelectorAll('.student-view').forEach(v => v.classList.add('hidden'));
  document.querySelector(link.getAttribute('href')).classList.remove('hidden');
  document.querySelectorAll('.admin-nav a').forEach(a => a.classList.remove('active'));
  link.classList.add('active');
  
  // Hide details/work sub-panels when navigating
  document.querySelector('#assignment-work-panel').classList.add('hidden');
  document.querySelector('#assignment-details-panel').classList.add('hidden');
  
  if (message) message.className = 'message';
  
  const href = link.getAttribute('href');
  if (href === '#overview') loadDashboard();
  if (href === '#directory') loadDirectory();
  if (href === '#courses') loadMyCourses();
  if (href === '#assignments') loadAssignments();
}));

async function loadDashboard() {
  try {
    const data = await api('/api/student/dashboard');
    const stats = [
      ['Enrolled Courses', data.enrolledCourses],
      ['Available Courses', data.availableCourses],
      ['Pending Assignments', data.pendingAssignments],
      ['Completed Assignments', data.completedAssignments],
      ['Average Score', `${data.averageScore.toFixed(1)}%`]
    ];
    document.querySelector('#student-stats').innerHTML = stats.map(([label, value]) => `
      <article>
        <p>${label}</p>
        <strong>${value}</strong>
      </article>
    `).join('');
  } catch (x) {
    inform(x.message, 'error');
  }
}

async function loadDirectory() {
  try {
    courses = await api('/api/student/courses');
    const list = document.querySelector('#directory-list');
    list.innerHTML = courses.map(c => {
      let button = '';
      if (c.enrolled) {
        button = '<span class="status status-active">Enrolled</span>';
      } else {
        button = `<button data-enroll-course="${c.id}" type="button" style="margin: 0; padding: 6px 12px; font-size: 11px;">Enroll</button>`;
      }
      return `
        <article style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
          <div>
            <strong>${esc(c.title)}</strong>
            <p style="margin-top: 4px; font-size: 12px; color: var(--muted);">${esc(c.description || 'No description')} · Instructor: ${esc(c.teacher_name)} · ${c.student_count} students</p>
          </div>
          <div>${button}</div>
        </article>
      `;
    }).join('') || '<p class="empty-state">No courses are currently available.</p>';
  } catch (x) {
    inform(x.message, 'error');
  }
}

document.querySelector('#directory-list').addEventListener('click', async e => {
  const courseId = e.target.dataset.enrollCourse;
  if (!courseId) return;
  try {
    await api(`/api/student/courses/${courseId}/enroll`, { method: 'POST' });
    inform('Enrolled in course successfully!');
    await loadDirectory();
  } catch (x) {
    inform(x.message, 'error');
  }
});

async function loadMyCourses() {
  try {
    courses = await api('/api/student/courses');
    const enrolled = courses.filter(c => c.enrolled);
    const select = document.querySelector('#course-select-content');
    const currentValue = select.value;
    
    select.innerHTML = '<option value="">Select an enrolled course</option>' + enrolled.map(c => `
      <option value="${c.id}">${esc(c.title)}</option>
    `).join('');
    select.value = enrolled.some(c => c.id == currentValue) ? currentValue : '';
    
    if (select.value) {
      await showCourseContent(select.value);
    } else {
      document.querySelector('#content-list').innerHTML = '';
    }
  } catch (x) {
    inform(x.message, 'error');
  }
}

async function showCourseContent(courseId) {
  try {
    const list = document.querySelector('#content-list');
    const content = await api(`/api/student/courses/${courseId}/content`);
    list.innerHTML = content.map(r => `
      <article style="margin-top: 10px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <strong>${esc(r.title)}</strong>
          <span class="status" style="padding: 2px 6px;">${esc(r.type)}</span>
        </div>
        <p style="margin-top: 8px; line-height: 1.6; color:#374151;">${formatBody(r.body)}</p>
      </article>
    `).join('') || '<p class="empty-state">No materials published in this course yet.</p>';
  } catch (x) {
    inform(x.message, 'error');
  }
}

document.querySelector('#course-select-content').addEventListener('change', e => {
  if (e.target.value) {
    showCourseContent(e.target.value);
  } else {
    document.querySelector('#content-list').innerHTML = '';
  }
});

async function loadAssignments() {
  try {
    assignments = await api('/api/student/assignments');
    const list = document.querySelector('#student-assignment-list');
    list.innerHTML = assignments.map(a => {
      let statusClass = 'status-pending';
      let actionBtn = '';
      
      if (a.submission_status === 'PENDING') {
        actionBtn = `<button data-work-assignment="${a.id}" type="button" style="margin: 0; padding: 6px 12px; font-size: 11px;">Start Work</button>`;
      } else if (a.submission_status === 'SUBMITTED') {
        statusClass = 'status-pending';
        actionBtn = `<button data-view-submission="${a.id}" type="button" style="margin: 0; padding: 6px 12px; font-size: 11px; background:var(--muted); box-shadow:none;">View Answer</button>`;
      } else {
        statusClass = 'status-active';
        actionBtn = `<button data-view-submission="${a.id}" type="button" style="margin: 0; padding: 6px 12px; font-size: 11px; background:linear-gradient(135deg, var(--mint), #0f9f6e);">View Grade</button>`;
      }
      
      const dueInfo = a.due_at ? `Due: ${new Date(a.due_at).toLocaleString()}` : 'No due date';
      const scoreInfo = a.score !== null ? `Grade: ${a.score} / ${a.max_score}` : `Max Score: ${a.max_score}`;

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
    }).join('') || '<p class="empty-state">No published assignments found in your enrolled courses.</p>';
  } catch (x) {
    inform(x.message, 'error');
  }
}

// Assignment Actions Click Handlers
document.querySelector('#student-assignment-list').addEventListener('click', async e => {
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
    const assignment = assignments.find(a => a.id == assignmentId);
    const questions = await api(`/api/student/assignments/${assignmentId}/questions`);
    
    document.querySelector('#work-assignment-id').value = assignmentId;
    document.querySelector('#work-assignment-title').textContent = esc(assignment.title);
    document.querySelector('#work-assignment-instructions').innerHTML = formatBody(assignment.instructions || 'Follow the instructions and submit answers to all questions below.');
    
    const container = document.querySelector('#work-questions-container');
    container.innerHTML = questions.map((q, idx) => `
      <div style="padding: 15px; border: 1px solid var(--line); border-radius: 12px; background: #fff;">
        <strong style="display: block; margin-bottom: 8px; font-size: 14px; color: var(--ink);">Question ${idx + 1}: ${formatBody(q.question_text)}</strong>
        <textarea name="q-${q.id}" placeholder="Type your answer here..." required style="width: 100%; min-height: 80px; padding: 10px; border: 1px solid #ccd7e7; border-radius: 10px; font-family: inherit; font-size: 14px; resize: vertical; outline: none; transition: border-color 0.2s;"></textarea>
      </div>
    `).join('') || '<p style="color:var(--muted); padding: 15px;">No questions defined for this assignment. Click submit below to submit anyway.</p>';
    
    document.querySelector('#assignment-work-panel').classList.remove('hidden');
    document.querySelector('#assignment-details-panel').classList.add('hidden');
    
    document.querySelector('#assignment-work-panel').scrollIntoView({ behavior: 'smooth' });
  } catch (x) {
    inform(x.message, 'error');
  }
}

document.querySelector('#close-assignment-work').addEventListener('click', () => {
  document.querySelector('#assignment-work-panel').classList.add('hidden');
});

document.querySelector('#assignment-submission-form').addEventListener('submit', async e => {
  e.preventDefault();
  const assignmentId = document.querySelector('#work-assignment-id').value;
  const form = e.target;
  
  const answers = {};
  const textareas = form.querySelectorAll('textarea');
  textareas.forEach(ta => {
    const qId = ta.name.replace('q-', '');
    answers[qId] = ta.value.trim();
  });
  
  try {
    await api(`/api/student/assignments/${assignmentId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(answers)
    });
    
    inform('Assignment submitted successfully!', 'success');
    document.querySelector('#assignment-work-panel').classList.add('hidden');
    await loadAssignments();
  } catch (x) {
    inform(x.message, 'error');
  }
});

async function viewSubmissionDetails(assignmentId) {
  try {
    const details = await api(`/api/student/assignments/${assignmentId}/submission`);
    
    document.querySelector('#details-assignment-title').textContent = esc(details.assignment_title);
    
    const gradeBox = document.querySelector('#details-grade-info');
    const graded = details.score !== null;
    gradeBox.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div>
          <h4 style="margin: 0; font-size: 14px; color: var(--indigo);">Grading Status: <strong>${graded ? 'Graded' : 'Submitted (Awaiting Grading)'}</strong></h4>
          <p style="margin: 5px 0 0; font-size: 12px; color: var(--muted);">Submitted on: ${new Date(details.submitted_at).toLocaleString()}</p>
        </div>
        <div style="font-size: 18px; font-weight: bold; color: var(--ink);">
          Score: ${graded ? details.score : '--'} / ${details.max_score}
        </div>
      </div>
      ${graded ? `
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(85, 72, 232, 0.15);">
          <strong style="display:block; font-size:12px; color:#4f46e5; text-transform:uppercase; letter-spacing:0.05em;">Teacher Feedback:</strong>
          <p style="margin: 4px 0 0; font-size: 13px; line-height: 1.5; color:#374151;">${formatBody(details.feedback || 'No feedback provided.')}</p>
        </div>
      ` : ''}
    `;
    
    const answersContainer = document.querySelector('#details-answers-container');
    answersContainer.innerHTML = details.answers.map((ans, idx) => `
      <div style="padding: 15px; border: 1px solid var(--line); border-radius: 12px; background: #fff;">
        <strong style="display: block; margin-bottom: 8px; font-size: 13px; color: var(--ink);">Question ${idx + 1}: ${formatBody(ans.question_text)}</strong>
        <div style="padding: 10px 12px; border-radius: 8px; background: #f8fafc; border: 1px solid #f1f5f9; font-size: 14px; color: #334155; white-space: pre-wrap;">${esc(ans.answer_text)}</div>
      </div>
    `).join('') || '<p style="color:var(--muted); text-align:center;">No answers found.</p>';
    
    document.querySelector('#assignment-details-panel').classList.remove('hidden');
    document.querySelector('#assignment-work-panel').classList.add('hidden');
    
    document.querySelector('#assignment-details-panel').scrollIntoView({ behavior: 'smooth' });
  } catch (x) {
    inform(x.message, 'error');
  }
}

document.querySelector('#close-assignment-details').addEventListener('click', () => {
  document.querySelector('#assignment-details-panel').classList.add('hidden');
});

// App Startup Bootstrapping
(async () => {
  try {
    const user = await api('/api/auth/me');
    if (user.role !== requiredRole) return location.replace('/');
    document.querySelector('#user-name').textContent = user.fullName;
    await loadDashboard();
  } catch (e) {
    location.replace('/');
  }
})();

document.querySelector('#logout').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'DELETE' });
  location.assign('/');
});
