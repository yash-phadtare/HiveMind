const message = document.querySelector('#teacher-message');
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
  message.textContent = text;
  message.className = `message visible ${type}`;
};

const formData = form => Object.fromEntries(new FormData(form));

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

function getScoreGaugeSvg(score) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return `
    <svg width="110" height="110" viewBox="0 0 100 100" style="transform: rotate(-90deg); margin: 0 auto; display: block;">
      <circle cx="50" cy="50" r="${radius}" fill="none" stroke="#e2e8f0" stroke-width="8"/>
      <circle cx="50" cy="50" r="${radius}" fill="none" stroke="var(--indigo)" stroke-width="8"
        stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" stroke-linecap="round"
        style="transition: stroke-dashoffset 0.8s ease-in-out;"/>
      <text x="50" y="-46" fill="var(--ink)" font-size="16" font-weight="bold" text-anchor="middle"
        style="transform: rotate(90deg);" dominant-baseline="middle">${score.toFixed(1)}%</text>
    </svg>
  `;
}

function getActivityChartSvg(data) {
  const maxValue = Math.max(data.materials, data.assignments, data.quizzes, data.submissions, 1);
  const items = [
    { label: 'Content', count: data.materials, color: '#3b82f6' },
    { label: 'Tasks', count: data.assignments, color: '#f59e0b' },
    { label: 'Quizzes', count: data.quizzes, color: '#10b981' },
    { label: 'Submits', count: data.submissions, color: '#8b5cf6' }
  ];
  
  return `
    <svg width="100%" height="110" viewBox="0 0 200 110" style="background: transparent; overflow: visible;">
      ${items.map((item, idx) => {
        const y = 5 + idx * 26;
        const width = (item.count / maxValue) * 110;
        return `
          <text x="0" y="${y + 12}" fill="var(--muted)" font-size="9" font-weight="bold">${item.label}</text>
          <rect x="50" y="${y}" width="${width}" height="14" fill="${item.color}" rx="3"/>
          <text x="${55 + width}" y="${y + 12}" fill="var(--ink)" font-size="10" font-weight="bold">${item.count}</text>
        `;
      }).join('')}
    </svg>
  `;
}

function fillCourseSelects() {
  document.querySelectorAll('.course-select').forEach(select => {
    const current = select.value;
    select.innerHTML = '<option value="">Select course</option>' + courses.map(c => `<option value="${c.id}">${esc(c.title)}</option>`).join('');
    select.value = current;
  });
}

async function loadDashboard() {
  const data = await api('/api/teacher/dashboard');
  const labels = [
    ['Courses', data.courses],
    ['Pending approval', data.pendingCourses],
    ['Students', data.students],
    ['Lessons & materials', data.lessons],
    ['Assignments', data.assignments],
    ['Quizzes', data.quizzes],
    ['Awaiting grades', data.submissionsToGrade]
  ];
  document.querySelector('#teacher-stats').innerHTML = labels.map(([label, value]) => `
    <article>
      <p>${label}</p>
      <strong>${value}</strong>
    </article>
  `).join('');
}

async function loadCourses() {
  courses = await api('/api/teacher/courses');
  const categories = await api('/api/teacher/categories');
  
  document.querySelector('#course-category').innerHTML = '<option value="">Uncategorized</option>' + categories.map(c => `
    <option value="${c.id}">${esc(c.name)}</option>
  `).join('');
  
  fillCourseSelects();
  
  document.querySelector('#course-list').innerHTML = courses.length ? courses.map(c => `
    <article>
      <strong>${esc(c.title)}</strong>
      <span class="status status-${c.status.toLowerCase()}">${c.status}</span>
      <p>${esc(c.description || 'No description')} · ${c.studentCount} students · ${esc(c.categoryName || 'Uncategorized')}</p>
      <button data-edit-course="${c.id}" type="button">Edit course</button>
      <button data-content-course="${c.id}" type="button">View material</button>
    </article>
  `).join('') : '<p class="empty-state">Create your first course to begin.</p>';
}

async function loadAssignments() {
  assignments = await api('/api/teacher/assignments');
  
  document.querySelector('#assignment-list').innerHTML = assignments.map(a => {
    const isDraft = a.status === 'DRAFT';
    const statusClass = isDraft ? 'status-pending' : 'status-active';
    
    let actions = '';
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
  }).join('') || '<p class="empty-state">No assignments yet.</p>';
  
  document.querySelector('#submission-assignment').innerHTML = '<option value="">Select assignment</option>' + assignments.map(a => `
    <option value="${a.id}">${esc(a.course_title)} — ${esc(a.title)}</option>
  `).join('');
  
  const quizzes = await api('/api/teacher/quizzes');
  
  document.querySelector('#quiz-list').innerHTML = quizzes.map(q => {
    const isDraft = q.status === 'DRAFT';
    const statusClass = isDraft ? 'status-pending' : 'status-active';
    const qCount = q.question_count || 0;
    
    let actions = '';
    if (isDraft) {
      actions = `
        <button data-manage-quiz="${q.id}" type="button" style="margin: 0 4px 0 0; padding: 6px 10px; font-size: 11px;">Manage Questions</button>
        <button class="publish-btn" data-publish-quiz="${q.id}" type="button" style="margin: 0 4px 0 0; padding: 6px 10px; font-size: 11px; background: linear-gradient(135deg, #10b981, #059669); box-shadow: none;">Publish Quiz</button>
      `;
    } else {
      actions = `
        <button data-view-quiz="${q.id}" type="button" style="margin: 0 4px 0 0; padding: 6px 10px; font-size: 11px;">View Questions</button>
      `;
    }
    actions += `<button class="table-action delete" data-delete-quiz="${q.id}" type="button" style="margin: 0; padding: 6px 10px; font-size: 11px;">Delete</button>`;
    
    return `
      <article>
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <strong>${esc(q.title)}</strong>
          <span class="status ${statusClass}">${esc(q.status)}</span>
        </div>
        <p>${esc(q.course_title)} &middot; ${qCount} questions ${q.description ? `&middot; ${esc(q.description)}` : ''}</p>
        <div style="margin-top: 8px;">
          ${actions}
        </div>
      </article>
    `;
  }).join('') || '<p class="empty-state">No quizzes yet.</p>';
}

async function loadAnnouncements() {
  const rows = await api('/api/teacher/announcements');
  document.querySelector('#announcement-list').innerHTML = rows.map(a => `
    <article style="display: flex; justify-content: space-between; align-items: start;">
      <div>
        <strong>${esc(a.title)}</strong>
        <p>${esc(a.course_title)} &middot; ${formatBody(a.message)}</p>
      </div>
      <button class="table-action delete" data-delete-announcement="${a.id}" type="button" style="margin: 0; padding: 4px 8px; font-size: 11px;">Delete</button>
    </article>
  `).join('') || '<p class="empty-state">No announcements yet.</p>';
}

async function showContent(courseId) {
  const select = document.querySelector('#content-form select[name="courseId"]');
  if (select) select.value = courseId;
  
  const rows = await api(`/api/teacher/courses/${courseId}/content`);
  document.querySelector('#content-list').innerHTML = rows.map(r => `
    <article style="display: flex; justify-content: space-between; align-items: start;">
      <div>
        <strong>${esc(r.title)}</strong>
        <span class="status" style="margin-left: 8px;">${esc(r.type)}</span>
        <p style="margin-top: 6px;">${formatBody(r.body)}</p>
      </div>
      <button class="table-action delete" data-delete-content="${r.id}" data-course-id="${courseId}" type="button" style="margin: 0; padding: 4px 8px; font-size: 11px;">Delete</button>
    </article>
  `).join('') || '<p class="empty-state">No material for this course yet.</p>';
}

async function loadQuizQuestions(quizId, isReadOnly) {
  try {
    const questions = await api(`/api/teacher/quizzes/${quizId}/questions`);
    const panel = document.querySelector('#question-panel');
    panel.classList.remove('hidden');
    
    document.querySelector('#question-quiz-id').value = quizId;
    
    const form = document.querySelector('#question-form');
    if (isReadOnly) {
      form.classList.add('hidden');
      panel.querySelector('h3').textContent = 'Quiz questions (Published - Read Only)';
    } else {
      form.classList.remove('hidden');
      panel.querySelector('h3').textContent = 'Add quiz question';
    }
    
    document.querySelector('#question-list').innerHTML = questions.map((q, idx) => {
      let deleteBtn = '';
      if (!isReadOnly) {
        deleteBtn = `<button class="table-action delete" data-delete-question="${q.id}" data-quiz-id="${quizId}" type="button" style="margin: 0; padding: 4px 8px; font-size: 11px; float: right;">Delete</button>`;
      }
      
      return `
        <article style="margin-top: 10px; overflow: hidden; border: 1px solid var(--line); border-radius: 10px; padding: 10px; background: #fff;">
          ${deleteBtn}
          <strong>Q${idx + 1}: ${formatBody(q.questionText)}</strong>
          <span class="status status-active" style="display: inline-block; margin-left: 8px; padding: 2px 6px;">${q.points} pts</span>
          <ul style="margin: 8px 0 0 18px; padding: 0;">
            ${q.options.map(opt => `
              <li style="margin-top: 4px; ${opt.trim() === q.correctAnswer.trim() ? 'font-weight: bold; color: var(--mint);' : ''}">
                ${esc(opt)} ${opt.trim() === q.correctAnswer.trim() ? '✓' : ''}
              </li>
            `).join('')}
          </ul>
        </article>
      `;
    }).join('') || '<p class="empty-state">No questions in this quiz yet.</p>';
    
    panel.scrollIntoView({ behavior: 'smooth' });
  } catch (x) {
    inform(x.message, 'error');
  }
}

document.querySelectorAll('.admin-nav a').forEach(link => link.addEventListener('click', e => {
  e.preventDefault();
  document.querySelectorAll('.teacher-view').forEach(v => v.classList.add('hidden'));
  document.querySelector(link.getAttribute('href')).classList.remove('hidden');
  document.querySelectorAll('.admin-nav a').forEach(a => a.classList.remove('active'));
  link.classList.add('active');
}));

document.querySelector('#course-form').addEventListener('submit', async e => {
  e.preventDefault();
  const d = formData(e.target);
  d.categoryId = d.categoryId || null;
  try {
    await api('/api/teacher/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(d)
    });
    e.target.reset();
    inform('Course created and sent for approval.');
    await loadCourses();
    await loadDashboard();
  } catch (x) {
    inform(x.message, 'error');
  }
});

document.querySelector('#content-form').addEventListener('submit', async e => {
  e.preventDefault();
  const courseId = e.target.elements.courseId.value;
  try {
    await api('/api/teacher/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData(e.target))
    });
    e.target.reset();
    inform('Learning material added.');
    await showContent(courseId);
    await loadDashboard();
  } catch (x) {
    inform(x.message, 'error');
  }
});

document.querySelector('#content-form select[name="courseId"]').addEventListener('change', e => {
  const courseId = e.target.value;
  if (courseId) {
    showContent(courseId);
  } else {
    document.querySelector('#content-list').innerHTML = '';
  }
});

document.querySelector('#content-list').addEventListener('click', async e => {
  const id = e.target.dataset.deleteContent;
  const courseId = e.target.dataset.courseId;
  if (!id) return;
  if (!confirm('Are you sure you want to delete this resource?')) return;
  try {
    await api(`/api/teacher/content/${id}`, { method: 'DELETE' });
    inform('Learning material deleted.');
    await showContent(courseId);
    await loadDashboard();
  } catch (x) {
    inform(x.message, 'error');
  }
});

document.querySelector('#assignment-form').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await api('/api/teacher/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData(e.target))
    });
    e.target.reset();
    inform('Assignment created as DRAFT.');
    await loadAssignments();
    await loadDashboard();
  } catch (x) {
    inform(x.message, 'error');
  }
});

document.querySelector('#assignment-list').addEventListener('click', async e => {
  const manageId = e.target.dataset.manageAssignment;
  const viewId = e.target.dataset.viewAssignmentQuestions;
  if (manageId || viewId) {
    await loadAssignmentQuestions(manageId || viewId, !!viewId);
    return;
  }

  const publishId = e.target.dataset.publishAssignment;
  if (publishId) {
    try {
      await api(`/api/teacher/assignments/${publishId}/publish`, { method: 'PATCH' });
      inform('Assignment published successfully.');
      await loadAssignments();
      await loadDashboard();
    } catch (x) {
      inform(x.message, 'error');
    }
    return;
  }
  
  const id = e.target.dataset.deleteAssignment;
  if (!id) return;
  if (!confirm('Are you sure you want to delete this assignment? (This will also delete all submissions for it)')) return;
  try {
    await api(`/api/teacher/assignments/${id}`, { method: 'DELETE' });
    inform('Assignment deleted.');
    await loadAssignments();
    await loadDashboard();
  } catch (x) {
    inform(x.message, 'error');
  }
});

document.querySelector('#quiz-form').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await api('/api/teacher/quizzes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData(e.target))
    });
    e.target.reset();
    inform('Quiz created.');
    await loadAssignments();
    await loadDashboard();
  } catch (x) {
    inform(x.message, 'error');
  }
});

document.querySelector('#quiz-list').addEventListener('click', async e => {
  const manageId = e.target.dataset.manageQuiz;
  const viewId = e.target.dataset.viewQuiz;
  const publishId = e.target.dataset.publishQuiz;
  const deleteId = e.target.dataset.deleteQuiz;
  
  if (deleteId) {
    if (!confirm('Are you sure you want to delete this quiz?')) return;
    try {
      await api(`/api/teacher/quizzes/${deleteId}`, { method: 'DELETE' });
      inform('Quiz deleted.');
      const qQuizIdInput = document.querySelector('#question-quiz-id');
      if (qQuizIdInput && qQuizIdInput.value == deleteId) {
        document.querySelector('#question-panel').classList.add('hidden');
      }
      await loadAssignments();
      await loadDashboard();
    } catch (x) {
      inform(x.message, 'error');
    }
    return;
  }
  
  if (publishId) {
    try {
      await api(`/api/teacher/quizzes/${publishId}/publish`, { method: 'PATCH' });
      inform('Quiz published successfully.');
      await loadAssignments();
      await loadDashboard();
    } catch (x) {
      inform(x.message, 'error');
    }
    return;
  }
  
  const quizId = manageId || viewId;
  if (!quizId) return;
  
  const isReadOnly = !!viewId;
  await loadQuizQuestions(quizId, isReadOnly);
});

document.querySelector('#close-questions').addEventListener('click', () => {
  document.querySelector('#question-panel').classList.add('hidden');
});

document.querySelector('#question-form').addEventListener('submit', async e => {
  e.preventDefault();
  const quizId = document.querySelector('#question-quiz-id').value;
  const form = e.target;
  const questionText = form.elements.questionText.value.trim();
  const optionsVal = form.elements.options.value;
  const correctAnswer = form.elements.correctAnswer.value.trim();
  const points = parseInt(form.elements.points.value);
  
  const options = optionsVal.split('|').map(o => o.trim()).filter(Boolean);
  
  if (options.length < 2 || options.length > 8) {
    return inform('Please provide between 2 and 8 options, separated by |', 'error');
  }
  if (!options.some(o => o === correctAnswer)) {
    return inform('Correct answer must exactly match one of the options.', 'error');
  }
  
  try {
    await api(`/api/teacher/quizzes/${quizId}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionText, options, correctAnswer, points })
    });
    form.reset();
    inform('Question added successfully.');
    await loadQuizQuestions(quizId, false);
    await loadAssignments();
  } catch (x) {
    inform(x.message, 'error');
  }
});

document.querySelector('#question-list').addEventListener('click', async e => {
  const id = e.target.dataset.deleteQuestion;
  const quizId = e.target.dataset.quizId;
  if (!id) return;
  if (!confirm('Are you sure you want to delete this question?')) return;
  try {
    await api(`/api/teacher/quizzes/${quizId}/questions/${id}`, { method: 'DELETE' });
    inform('Question deleted.');
    await loadQuizQuestions(quizId, false);
    await loadAssignments();
  } catch (x) {
    inform(x.message, 'error');
  }
});

document.querySelector('#announcement-form').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await api('/api/teacher/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData(e.target))
    });
    e.target.reset();
    inform('Announcement published.');
    await loadAnnouncements();
  } catch (x) {
    inform(x.message, 'error');
  }
});

document.querySelector('#announcement-list').addEventListener('click', async e => {
  const id = e.target.dataset.deleteAnnouncement;
  if (!id) return;
  if (!confirm('Are you sure you want to delete this announcement?')) return;
  try {
    await api(`/api/teacher/announcements/${id}`, { method: 'DELETE' });
    inform('Announcement deleted.');
    await loadAnnouncements();
  } catch (x) {
    inform(x.message, 'error');
  }
});

document.querySelector('#course-list').addEventListener('click', async e => {
  const id = e.target.dataset.contentCourse || e.target.dataset.editCourse;
  if (!id) return;
  if (e.target.dataset.contentCourse) {
    document.querySelectorAll('.admin-nav a').forEach(a => {
      if (a.getAttribute('href') === '#courses') a.click();
    });
    return showContent(id);
  }
  
  const course = courses.find(c => c.id == id);
  const title = prompt('Course title', course.title);
  if (!title) return;
  const description = prompt('Course description', course.description || '');
  if (description === null) return;
  
  try {
    await api(`/api/teacher/courses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, categoryId: course.categoryId })
    });
    inform('Course updated and sent for approval.');
    await loadCourses();
  } catch (x) {
    inform(x.message, 'error');
  }
});

async function loadSubmissionAnswers(submissionId, containerId) {
  try {
    const answers = await api(`/api/teacher/submissions/${submissionId}/answers`);
    const container = document.getElementById(containerId);
    if (!answers.length) {
      container.innerHTML = '<p style="color:var(--muted); font-size:12px; margin: 4px 0 0;">No structured answers submitted.</p>';
      return;
    }
    container.innerHTML = answers.map((ans, idx) => `
      <div style="margin-top: 8px; padding: 10px; border-left: 3px solid var(--indigo); background: var(--indigo-soft); border-radius: 8px;">
        <strong style="display:block; font-size:12px; color:var(--ink);">Question ${idx + 1}: ${esc(ans.question_text)}</strong>
        <span style="display:block; font-size:13px; margin-top:4px; color:#374151; white-space: pre-wrap;">Answer: ${esc(ans.answer_text)}</span>
      </div>
    `).join('');
  } catch (x) {
    console.error(x);
  }
}

document.querySelector('#submission-assignment').addEventListener('change', async e => {
  if (!e.target.value) return document.querySelector('#submission-list').replaceChildren();
  try {
    const rows = await api(`/api/teacher/assignments/${e.target.value}/submissions`);
    document.querySelector('#submission-list').innerHTML = rows.map(s => {
      const containerId = `sub-answers-${s.id}`;
      setTimeout(() => loadSubmissionAnswers(s.id, containerId), 0);
      return `
        <article style="display: flex; flex-direction: column; gap: 8px;">
          <div>
            <strong>${esc(s.student_name)} (${esc(s.email)})</strong>
            <p style="font-size: 12px; color: var(--muted); margin-top: 4px;">Submitted at: ${new Date(s.submitted_at).toLocaleString()}</p>
          </div>
          <div id="${containerId}" style="margin: 4px 0;">Loading answers...</div>
          <p style="margin: 0; font-weight: 500;">Score: ${s.score ?? 'Not graded'} / ${s.max_score} ${s.feedback ? `&middot; Feedback: ${esc(s.feedback)}` : ''}</p>
          <button data-grade="${s.id}" type="button" style="align-self: start; margin-top: 4px;">Grade / feedback</button>
        </article>
      `;
    }).join('') || '<p class="empty-state">No submissions yet.</p>';
  } catch (x) {
    inform(x.message, 'error');
  }
});

document.querySelector('#submission-list').addEventListener('click', async e => {
  const id = e.target.dataset.grade;
  if (!id) return;
  const score = prompt('Score');
  if (score === null) return;
  const numericScore = Number(score);
  if (score.trim() === '' || !Number.isFinite(numericScore) || numericScore < 0) return inform('Enter a valid non-negative score.', 'error');
  const feedback = prompt('Feedback', '');
  if (feedback === null) return;
  
  try {
    await api(`/api/teacher/submissions/${id}/grade`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score: numericScore, feedback })
    });
    inform('Grade and feedback saved.');
    document.querySelector('#submission-assignment').dispatchEvent(new Event('change'));
    await loadDashboard();
  } catch (x) {
    inform(x.message, 'error');
  }
});

document.querySelector('#analytics-course').addEventListener('change', async e => {
  const courseId = e.target.value;
  const container = document.querySelector('#analytics-results');
  if (!courseId) {
    container.innerHTML = '';
    return;
  }
  try {
    const data = await api(`/api/teacher/courses/${courseId}/analytics`);
    
    const stats = [
      ['Students Enrolled', `<strong style="font-size: 38px; color: var(--indigo); display: block; text-align: center; margin: 15px 0;">${data.students}</strong>`],
      ['Quiz Questions', `<strong style="font-size: 38px; color: var(--mint); display: block; text-align: center; margin: 15px 0;">${data.quizQuestions}</strong>`],
      ['Course Average Score', getScoreGaugeSvg(data.averageScore)],
      ['Activity & Resources', getActivityChartSvg(data)]
    ];
    
    container.innerHTML = stats.map(([label, value]) => `
      <article style="display: flex; flex-direction: column; justify-content: space-between;">
        <p>${label}</p>
        <div style="flex-grow: 1; display: flex; align-items: center; justify-content: center;">${value}</div>
      </article>
    `).join('');
  } catch (x) {
    inform(x.message, 'error');
  }
});

async function loadAssignmentQuestions(assignmentId, isReadOnly) {
  try {
    const questions = await api(`/api/teacher/assignments/${assignmentId}/questions`);
    const panel = document.querySelector('#assignment-question-panel');
    panel.classList.remove('hidden');
    
    document.querySelector('#question-assignment-id').value = assignmentId;
    
    const form = document.querySelector('#assignment-question-form');
    if (isReadOnly) {
      form.classList.add('hidden');
      panel.querySelector('h3').textContent = 'Assignment Questions (Published - Read Only)';
    } else {
      form.classList.remove('hidden');
      panel.querySelector('h3').textContent = 'Manage Assignment Questions';
    }
    
    document.querySelector('#assignment-question-list').innerHTML = questions.map((q, idx) => {
      let deleteBtn = '';
      if (!isReadOnly) {
        deleteBtn = `<button class="table-action delete" data-delete-assignment-question="${q.id}" data-assignment-id="${assignmentId}" type="button" style="margin: 0; padding: 4px 8px; font-size: 11px; float: right;">Delete</button>`;
      }
      
      return `
        <article style="margin-top: 10px; overflow: hidden; border: 1px solid var(--line); border-radius: 10px; padding: 10px; background: #fff;">
          ${deleteBtn}
          <strong>Q${idx + 1}: ${formatBody(q.question_text)}</strong>
        </article>
      `;
    }).join('') || '<p class="empty-state">No questions in this assignment yet.</p>';
    
    panel.scrollIntoView({ behavior: 'smooth' });
  } catch (x) {
    inform(x.message, 'error');
  }
}

document.querySelector('#close-assignment-questions').addEventListener('click', () => {
  document.querySelector('#assignment-question-panel').classList.add('hidden');
});

document.querySelector('#assignment-question-form').addEventListener('submit', async e => {
  e.preventDefault();
  const assignmentId = document.querySelector('#question-assignment-id').value;
  const form = e.target;
  const questionText = form.elements.questionText.value.trim();
  if (!questionText) return inform('Please enter question text', 'error');

  try {
    await api(`/api/teacher/assignments/${assignmentId}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionText })
    });
    form.reset();
    inform('Question added successfully.');
    await loadAssignmentQuestions(assignmentId, false);
  } catch (x) {
    inform(x.message, 'error');
  }
});

document.querySelector('#assignment-question-panel').addEventListener('click', async e => {
  const id = e.target.dataset.deleteAssignmentQuestion;
  const assignmentId = e.target.dataset.assignmentId;
  if (!id) return;
  if (!confirm('Are you sure you want to delete this question?')) return;
  try {
    await api(`/api/teacher/assignments/${assignmentId}/questions/${id}`, { method: 'DELETE' });
    inform('Question deleted.');
    await loadAssignmentQuestions(assignmentId, false);
  } catch (x) {
    inform(x.message, 'error');
  }
});

(async () => {
  try {
    const user = await api('/api/auth/me');
    if (user.role !== 'TEACHER') return location.replace('/');
    document.querySelector('#user-name').textContent = user.fullName;
    
    const results = await Promise.allSettled([
      loadDashboard(),
      loadCourses(),
      loadAssignments(),
      loadAnnouncements()
    ]);
    
    const failures = results.filter(result => result.status === 'rejected').map(result => result.reason);
    const authFailure = failures.find(error => error.status === 401 || error.status === 403);
    if (authFailure) return location.replace('/');
    if (failures.length) inform(`Some teacher workspace data could not load: ${failures.map(error => error.message).join('; ')}`, 'error');
  } catch (e) {
    if (e.status === 401 || e.status === 403) return location.replace('/');
    inform(`Unable to load the teacher workspace: ${e.message}`, 'error');
  }
})();

document.querySelector('#logout').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'DELETE' });
  location.assign('/');
});
