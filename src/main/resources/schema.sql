CREATE TABLE IF NOT EXISTS users (
    id BIGINT NOT NULL AUTO_INCREMENT,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL,
    organization_id BIGINT,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_users_email UNIQUE (email),
    CONSTRAINT chk_users_role CHECK (role IN ('ORGANIZATION', 'TEACHER', 'STUDENT'))
);

CREATE TABLE IF NOT EXISTS organizations (
    id BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(150) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_organizations_name UNIQUE (name)
);

INSERT IGNORE INTO organizations (name) VALUES ('Default Organization');

SET @organization_column_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'organization_id');
SET @sql = IF(@organization_column_exists = 0, 'ALTER TABLE users ADD COLUMN organization_id BIGINT', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @role_check_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND CONSTRAINT_NAME = 'chk_users_role');
SET @sql = IF(@role_check_exists > 0, 'ALTER TABLE users DROP CHECK chk_users_role', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
UPDATE users SET role = 'ORGANIZATION' WHERE role = 'ADMIN';
UPDATE users SET organization_id = (SELECT id FROM organizations WHERE name = 'Default Organization') WHERE organization_id IS NULL;
ALTER TABLE users ADD CONSTRAINT chk_users_role CHECK (role IN ('ORGANIZATION', 'TEACHER', 'STUDENT'));

SET @status_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'status'
);

SET @sql = IF(
    @status_exists = 0,
    'ALTER TABLE users ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT ''ACTIVE''',
    'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS course_categories (
    id BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    organization_id BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_course_categories_name UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS courses (
    id BIGINT NOT NULL AUTO_INCREMENT,
    title VARCHAR(180) NOT NULL,
    description TEXT,
    teacher_id BIGINT NOT NULL,
    category_id BIGINT,
    organization_id BIGINT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_courses_teacher FOREIGN KEY (teacher_id) REFERENCES users(id),
    CONSTRAINT fk_courses_category FOREIGN KEY (category_id) REFERENCES course_categories(id),
    CONSTRAINT chk_courses_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'))
);

-- Migrate databases created before course approval and categorization were introduced.
SET @course_description_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'description');
SET @sql = IF(@course_description_exists = 0, 'ALTER TABLE courses ADD COLUMN description TEXT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @course_category_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'category_id');
SET @sql = IF(@course_category_exists = 0, 'ALTER TABLE courses ADD COLUMN category_id BIGINT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @course_status_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'status');
SET @sql = IF(@course_status_exists = 0, 'ALTER TABLE courses ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT ''PENDING''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE courses SET status = 'PENDING' WHERE status IS NULL;

-- Older schemas may use a restrictive ENUM or a different status check. Convert it
-- before teachers submit courses with the current PENDING approval state.
ALTER TABLE courses MODIFY COLUMN status VARCHAR(20) NOT NULL DEFAULT 'PENDING';
UPDATE courses SET status = 'PENDING' WHERE status NOT IN ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');
SET @course_status_check_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses' AND CONSTRAINT_NAME = 'chk_courses_status');
SET @sql = IF(@course_status_check_exists > 0, 'ALTER TABLE courses DROP CHECK chk_courses_status', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
ALTER TABLE courses ADD CONSTRAINT chk_courses_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'));

-- Replace the legacy category foreign key with the organization-aware category table.
SET @course_category_fk_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses' AND CONSTRAINT_NAME = 'fk_courses_category' AND REFERENCED_TABLE_NAME IS NOT NULL);
SET @sql = IF(@course_category_fk_exists > 0, 'ALTER TABLE courses DROP FOREIGN KEY fk_courses_category', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
UPDATE courses SET category_id = NULL WHERE category_id IS NOT NULL AND category_id NOT IN (SELECT id FROM course_categories);
ALTER TABLE courses ADD CONSTRAINT fk_courses_category FOREIGN KEY (category_id) REFERENCES course_categories(id);

SET @course_created_at_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'created_at');
SET @sql = IF(@course_created_at_exists = 0, 'ALTER TABLE courses ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS enrollments (
    id BIGINT NOT NULL AUTO_INCREMENT,
    student_id BIGINT NOT NULL,
    course_id BIGINT NOT NULL,
    enrolled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_enrollments_student_course UNIQUE (student_id, course_id),
    CONSTRAINT fk_enrollments_student FOREIGN KEY (student_id) REFERENCES users(id),
    CONSTRAINT fk_enrollments_course FOREIGN KEY (course_id) REFERENCES courses(id)
);

CREATE TABLE IF NOT EXISTS quizzes (
    id BIGINT NOT NULL AUTO_INCREMENT,
    course_id BIGINT NOT NULL,
    title VARCHAR(180) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_quizzes_course FOREIGN KEY (course_id) REFERENCES courses(id)
);

SET @quiz_description_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quizzes' AND COLUMN_NAME = 'description');
SET @sql = IF(@quiz_description_exists = 0, 'ALTER TABLE quizzes ADD COLUMN description TEXT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @quiz_status_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quizzes' AND COLUMN_NAME = 'status');
SET @sql = IF(@quiz_status_exists = 0, 'ALTER TABLE quizzes ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT ''DRAFT''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @quiz_published_at_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quizzes' AND COLUMN_NAME = 'published_at');
SET @sql = IF(@quiz_published_at_exists = 0, 'ALTER TABLE quizzes ADD COLUMN published_at TIMESTAMP NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS quiz_questions (
    id BIGINT NOT NULL AUTO_INCREMENT, quiz_id BIGINT NOT NULL, question_text TEXT NOT NULL,
    options_text TEXT NOT NULL, correct_answer VARCHAR(1000) NOT NULL, points INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id),
    CONSTRAINT fk_quiz_questions_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes(id)
);

SET @category_organization_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'course_categories' AND COLUMN_NAME = 'organization_id');
SET @sql = IF(@category_organization_exists = 0, 'ALTER TABLE course_categories ADD COLUMN organization_id BIGINT', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
UPDATE course_categories SET organization_id = (SELECT id FROM organizations WHERE name = 'Default Organization') WHERE organization_id IS NULL;

-- Category names are unique within an organization, not across every organization.
SET @category_name_unique_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'course_categories' AND INDEX_NAME = 'uk_course_categories_name');
SET @sql = IF(@category_name_unique_exists > 0, 'ALTER TABLE course_categories DROP INDEX uk_course_categories_name', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @category_organization_name_unique_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'course_categories' AND INDEX_NAME = 'uk_course_categories_organization_name');
SET @sql = IF(@category_organization_name_unique_exists = 0, 'ALTER TABLE course_categories ADD CONSTRAINT uk_course_categories_organization_name UNIQUE (organization_id, name)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @course_organization_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'organization_id');
SET @sql = IF(@course_organization_exists = 0, 'ALTER TABLE courses ADD COLUMN organization_id BIGINT', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
UPDATE courses c JOIN users u ON u.id = c.teacher_id SET c.organization_id = u.organization_id WHERE c.organization_id IS NULL;

CREATE TABLE IF NOT EXISTS course_content (
    id BIGINT NOT NULL AUTO_INCREMENT, course_id BIGINT NOT NULL, title VARCHAR(180) NOT NULL,
    type VARCHAR(20) NOT NULL, body TEXT, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id), CONSTRAINT fk_content_course FOREIGN KEY (course_id) REFERENCES courses(id),
    CONSTRAINT chk_content_type CHECK (type IN ('LESSON', 'NOTE', 'PDF', 'VIDEO'))
);

CREATE TABLE IF NOT EXISTS assignments (
    id BIGINT NOT NULL AUTO_INCREMENT, course_id BIGINT NOT NULL, title VARCHAR(180) NOT NULL,
    instructions TEXT, due_at DATETIME NULL, max_score INT NOT NULL DEFAULT 100,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id),
    CONSTRAINT fk_assignments_course FOREIGN KEY (course_id) REFERENCES courses(id)
);

-- Migrate databases created before the teacher assignment workspace was added.
SET @assignment_instructions_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assignments' AND COLUMN_NAME = 'instructions');
SET @sql = IF(@assignment_instructions_exists = 0, 'ALTER TABLE assignments ADD COLUMN instructions TEXT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @assignment_due_at_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assignments' AND COLUMN_NAME = 'due_at');
SET @sql = IF(@assignment_due_at_exists = 0, 'ALTER TABLE assignments ADD COLUMN due_at DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @assignment_max_score_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assignments' AND COLUMN_NAME = 'max_score');
SET @sql = IF(@assignment_max_score_exists = 0, 'ALTER TABLE assignments ADD COLUMN max_score INT NOT NULL DEFAULT 100', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS assignment_submissions (
    id BIGINT NOT NULL AUTO_INCREMENT, assignment_id BIGINT NOT NULL, student_id BIGINT NOT NULL,
    content TEXT, submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, score DECIMAL(8,2) NULL,
    feedback TEXT, graded_at TIMESTAMP NULL, PRIMARY KEY (id),
    CONSTRAINT uk_assignment_student UNIQUE (assignment_id, student_id),
    CONSTRAINT fk_submission_assignment FOREIGN KEY (assignment_id) REFERENCES assignments(id),
    CONSTRAINT fk_submission_student FOREIGN KEY (student_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS announcements (
    id BIGINT NOT NULL AUTO_INCREMENT, course_id BIGINT NOT NULL, title VARCHAR(180) NOT NULL,
    message TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id),
    CONSTRAINT fk_announcement_course FOREIGN KEY (course_id) REFERENCES courses(id)
);

-- Add status column to assignments table
SET @assignment_status_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assignments' AND COLUMN_NAME = 'status');
SET @sql = IF(@assignment_status_exists = 0, 'ALTER TABLE assignments ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT \'DRAFT\'', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Table for assignment questions
CREATE TABLE IF NOT EXISTS assignment_questions (
    id BIGINT NOT NULL AUTO_INCREMENT,
    assignment_id BIGINT NOT NULL,
    question_text TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_assignment_questions_assignment FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE
);

-- Table for student answers to assignment questions
CREATE TABLE IF NOT EXISTS assignment_question_answers (
    id BIGINT NOT NULL AUTO_INCREMENT,
    submission_id BIGINT NOT NULL,
    question_id BIGINT NOT NULL,
    answer_text TEXT NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_submission_question UNIQUE (submission_id, question_id),
    CONSTRAINT fk_answers_submission FOREIGN KEY (submission_id) REFERENCES assignment_submissions(id) ON DELETE CASCADE,
    CONSTRAINT fk_answers_question FOREIGN KEY (question_id) REFERENCES assignment_questions(id) ON DELETE CASCADE
);

-- Table for quiz submissions
CREATE TABLE IF NOT EXISTS quiz_submissions (
    id BIGINT NOT NULL AUTO_INCREMENT,
    quiz_id BIGINT NOT NULL,
    student_id BIGINT NOT NULL,
    score DECIMAL(8,2) NOT NULL,
    submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_quiz_submissions_student UNIQUE (quiz_id, student_id),
    CONSTRAINT fk_quiz_submissions_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
    CONSTRAINT fk_quiz_submissions_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table for quiz answers
CREATE TABLE IF NOT EXISTS quiz_answers (
    id BIGINT NOT NULL AUTO_INCREMENT,
    submission_id BIGINT NOT NULL,
    question_id BIGINT NOT NULL,
    selected_answer VARCHAR(1000) NOT NULL,
    is_correct BOOLEAN NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_quiz_answers_submission_question UNIQUE (submission_id, question_id),
    CONSTRAINT fk_quiz_answers_submission FOREIGN KEY (submission_id) REFERENCES quiz_submissions(id) ON DELETE CASCADE,
    CONSTRAINT fk_quiz_answers_question FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE
);
