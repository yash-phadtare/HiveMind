const adminMessage = document.querySelector('#admin-message');

function showMessage(text = '', type = 'error') {
  adminMessage.textContent = text;
  adminMessage.className = text ? `message visible ${type}` : 'message';
}

async function request(path, options = {}) {
  const response = await fetch(path, options);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || error.message || 'Unable to complete this action.');
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
  const result = node('button', `table-action ${style || ''}`, text);
  result.type = 'button'; result.dataset.action = action; result.dataset.id = id;
  return result;
}

function status(status) { return node('span', `status status-${status.toLowerCase()}`, status); }
function emptyRow(table, columns, text) { const row = table.insertRow(); const cell = row.insertCell(); cell.colSpan = columns; cell.className = 'empty-state'; cell.textContent = text; }

function setQueryFilters(filters) {
  const params = new URLSearchParams(window.location.search);
  filters.forEach(filter => {
    const parameter = filter.id === 'course-status-filter' ? 'status' : filter.id.replace('-filter', '');
    if (params.has(parameter)) filter.value = params.get(parameter);
  });
}

async function initOverview() {
  try {
    const summary = await request('/api/organization/summary');
    [['total-users', summary.totalUsers], ['active-students', summary.activeStudents], ['active-teachers', summary.activeTeachers], ['pending-teachers', summary.pendingTeachers], ['total-courses', summary.totalCourses], ['pending-courses', summary.pendingCourses], ['total-enrollments', summary.totalEnrollments], ['total-quizzes', summary.totalQuizzes]]
      .forEach(([id, value]) => { document.querySelector(`#${id}`).textContent = value; });
  } catch (error) { showMessage(`Could not load dashboard statistics: ${error.message}`); }
}

async function initUsers() {
  const table = document.querySelector('#users-table');
  const roleFilter = document.querySelector('#role-filter');
  const statusFilter = document.querySelector('#status-filter');
  setQueryFilters([roleFilter, statusFilter]);
  async function load() {
    try {
      const params = new URLSearchParams();
      if (roleFilter.value) params.set('role', roleFilter.value);
      if (statusFilter.value) params.set('status', statusFilter.value);
      const users = await request(`/api/organization/users${params.size ? `?${params}` : ''}`);
      table.replaceChildren();
      if (!users.length) return emptyRow(table, 4, 'No accounts match these filters.');
      users.forEach(user => {
        const row = table.insertRow(); const identity = row.insertCell();
        identity.append(node('strong', '', user.fullName), node('small', '', user.email));
        row.insertCell().textContent = user.role; row.insertCell().append(status(user.status));
        const actions = node('div', 'table-actions');
        if (user.role === 'ORGANIZATION') actions.append(node('span', 'muted-action', 'Protected account'));
        else if (user.status === 'PENDING') actions.append(actionButton('approve', user.id, 'Approve', 'approve'), actionButton('reject', user.id, 'Reject', 'reject'));
        else if (user.status === 'ACTIVE') actions.append(actionButton('suspend', user.id, 'Suspend', 'suspend'), actionButton('delete', user.id, 'Delete', 'delete'));
        else actions.append(actionButton('activate', user.id, 'Activate', 'approve'), actionButton('delete', user.id, 'Delete', 'delete'));
        row.insertCell().append(actions);
      });
    } catch (error) { table.replaceChildren(); emptyRow(table, 4, 'Unable to load accounts.'); showMessage(error.message); }
  }
  table.addEventListener('click', async event => {
    const button = event.target.closest('[data-action]'); if (!button) return;
    if (button.dataset.action === 'delete' && !confirm('Delete this account permanently?')) return;
    button.disabled = true;
    try { const remove = button.dataset.action === 'delete'; await request(`/api/organization/users/${button.dataset.id}${remove ? '' : `/${button.dataset.action}`}`, { method: remove ? 'DELETE' : 'PATCH' }); showMessage('Account updated successfully.', 'success'); await load(); }
    catch (error) { button.disabled = false; showMessage(error.message); }
  });
  [roleFilter, statusFilter].forEach(filter => filter.addEventListener('change', load));
  await load();
}

async function initCourses() {
  const table = document.querySelector('#courses-table'); const filter = document.querySelector('#course-status-filter');
  setQueryFilters([filter]);
  async function load() {
    try {
      const courses = await request(`/api/organization/courses${filter.value ? `?status=${filter.value}` : ''}`);
      table.replaceChildren(); if (!courses.length) return emptyRow(table, 5, 'No courses match this status.');
      courses.forEach(course => { const row = table.insertRow(); const title = row.insertCell(); title.append(node('strong', '', course.title), node('small', '', course.description || 'No description')); row.insertCell().textContent = course.teacherName; row.insertCell().textContent = course.categoryName || 'Uncategorized'; row.insertCell().append(status(course.status)); const actions = node('div', 'table-actions'); if (course.status === 'PENDING') actions.append(actionButton('approve', course.id, 'Approve', 'approve'), actionButton('reject', course.id, 'Reject', 'reject')); else if (course.status === 'APPROVED') actions.append(actionButton('suspend', course.id, 'Suspend', 'suspend')); else actions.append(actionButton('approve', course.id, 'Approve', 'approve')); row.insertCell().append(actions); });
    } catch (error) { table.replaceChildren(); emptyRow(table, 5, 'Unable to load courses.'); showMessage(error.message); }
  }
  table.addEventListener('click', async event => { const button = event.target.closest('[data-action]'); if (!button) return; button.disabled = true; try { await request(`/api/organization/courses/${button.dataset.id}/${button.dataset.action}`, { method: 'PATCH' }); showMessage('Course status updated successfully.', 'success'); await load(); } catch (error) { button.disabled = false; showMessage(error.message); } });
  filter.addEventListener('change', load); await load();
}

async function initCategories() {
  const table = document.querySelector('#categories-table'); const form = document.querySelector('#category-form');
  async function load() { try { const categories = await request('/api/organization/categories'); table.replaceChildren(); if (!categories.length) return emptyRow(table, 3, 'No categories yet.'); categories.forEach(category => { const row = table.insertRow(); const details = row.insertCell(); details.append(node('strong', '', category.name), node('small', '', category.description || 'No description')); row.insertCell().textContent = category.courseCount; const actions = node('div', 'table-actions'); actions.append(actionButton('edit', category.id, 'Edit', 'approve')); if (!category.courseCount) actions.append(actionButton('delete', category.id, 'Delete', 'delete')); row.insertCell().append(actions); }); } catch (error) { table.replaceChildren(); emptyRow(table, 3, 'Unable to load categories.'); showMessage(error.message); } }
  form.addEventListener('submit', async event => { event.preventDefault(); try { await request('/api/organization/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: document.querySelector('#category-name').value, description: document.querySelector('#category-description').value }) }); form.reset(); showMessage('Category created successfully.', 'success'); await load(); } catch (error) { showMessage(error.message); } });
  table.addEventListener('click', async event => { const button = event.target.closest('[data-action]'); if (!button) return; try { if (button.dataset.action === 'delete') { if (!confirm('Delete this empty category?')) return; await request(`/api/organization/categories/${button.dataset.id}`, { method: 'DELETE' }); showMessage('Category deleted successfully.', 'success'); } else { const row = button.closest('tr'); const name = prompt('Category name', row.querySelector('strong').textContent); if (!name) return; const current = row.querySelector('small').textContent; const description = prompt('Category description', current === 'No description' ? '' : current); if (description === null) return; await request(`/api/organization/categories/${button.dataset.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, description }) }); showMessage('Category updated successfully.', 'success'); } await load(); } catch (error) { showMessage(error.message); } });
  await load();
}

async function initReports() {
  const table = document.querySelector('#analytics-table'); const summary = document.querySelector('#analytics-summary');
  try { const report = await request('/api/organization/reports/analytics'); [['Students', report.students], ['Teachers', report.teachers], ['Courses', report.courses], ['Enrollments', report.enrollments], ['Quizzes', report.quizzes]].forEach(([label, value]) => { const card = node('article'); card.append(node('p', '', label), node('strong', '', value)); summary.append(card); }); if (!report.coursesByCategory.length) return emptyRow(table, 3, 'No course analytics yet.'); report.coursesByCategory.forEach(item => { const row = table.insertRow(); row.insertCell().textContent = item.category; row.insertCell().textContent = item.courses; row.insertCell().textContent = item.enrollments; }); } catch (error) { emptyRow(table, 3, 'Unable to load analytics.'); showMessage(error.message); }
}

window.adminReady.then(authorized => {
  if (!authorized) return;
  return ({ overview: initOverview, users: initUsers, courses: initCourses, categories: initCategories, reports: initReports }[document.body.dataset.adminPage] || (() => {}))();
});
