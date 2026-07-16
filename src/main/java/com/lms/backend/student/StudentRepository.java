package com.lms.backend.student;

import java.sql.Statement;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class StudentRepository {
    private final JdbcClient jdbc;
    private final JdbcTemplate jdbcTemplate;

    public StudentRepository(JdbcClient jdbc, JdbcTemplate jdbcTemplate) {
        this.jdbc = jdbc;
        this.jdbcTemplate = jdbcTemplate;
    }

    public Map<String, Object> dashboard(Long studentId, Long organizationId) {
        Long enrolledCoursesCount = jdbc.sql("SELECT COUNT(*) FROM enrollments WHERE student_id = :studentId")
                .param("studentId", studentId).query(Long.class).single();

        Long availableCoursesCount = jdbc.sql("""
                SELECT COUNT(*) FROM courses
                WHERE organization_id = :organizationId AND status = 'APPROVED'
                  AND id NOT IN (SELECT course_id FROM enrollments WHERE student_id = :studentId)
                """)
                .param("organizationId", organizationId)
                .param("studentId", studentId)
                .query(Long.class).single();

        Long pendingAssignmentsCount = jdbc.sql("""
                SELECT COUNT(*) FROM assignments a
                JOIN enrollments e ON e.course_id = a.course_id
                LEFT JOIN assignment_submissions s ON s.assignment_id = a.id AND s.student_id = :studentId
                WHERE e.student_id = :studentId AND a.status = 'PUBLISHED' AND s.id IS NULL
                """)
                .param("studentId", studentId).query(Long.class).single();

        Long completedAssignmentsCount = jdbc.sql("SELECT COUNT(*) FROM assignment_submissions WHERE student_id = :studentId")
                .param("studentId", studentId).query(Long.class).single();

        Double averageScore = jdbc.sql("SELECT COALESCE(AVG(score), 0.0) FROM assignment_submissions WHERE student_id = :studentId")
                .param("studentId", studentId).query(Double.class).single();

        Long completedQuizzesCount = jdbc.sql("SELECT COUNT(*) FROM quiz_submissions WHERE student_id = :studentId")
                .param("studentId", studentId).query(Long.class).single();

        Double averageQuizScore = jdbc.sql("SELECT COALESCE(AVG(score), 0.0) FROM quiz_submissions WHERE student_id = :studentId")
                .param("studentId", studentId).query(Double.class).single();

        return Map.of(
                "enrolledCourses", enrolledCoursesCount,
                "availableCourses", availableCoursesCount,
                "pendingAssignments", pendingAssignmentsCount,
                "completedAssignments", completedAssignmentsCount,
                "averageScore", averageScore,
                "completedQuizzes", completedQuizzesCount,
                "averageQuizScore", averageQuizScore
        );
    }

    public List<Map<String, Object>> courses(Long studentId, Long organizationId) {
        return jdbc.sql("""
                SELECT c.id, c.title, c.description, u.full_name as teacher_name,
                  c.category_id, cc.name as category_name,
                  (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) as student_count,
                  EXISTS(SELECT 1 FROM enrollments WHERE student_id = :studentId AND course_id = c.id) as enrolled
                FROM courses c
                JOIN users u ON u.id = c.teacher_id
                LEFT JOIN course_categories cc ON cc.id = c.category_id
                WHERE c.organization_id = :organizationId AND c.status = 'APPROVED'
                ORDER BY c.created_at DESC
                """)
                .param("studentId", studentId)
                .param("organizationId", organizationId)
                .query().listOfRows();
    }

    public void enroll(Long studentId, Long courseId, Long organizationId) {
        boolean exists = jdbc.sql("SELECT COUNT(*) FROM courses WHERE id = :courseId AND organization_id = :organizationId AND status = 'APPROVED'")
                .param("courseId", courseId)
                .param("organizationId", organizationId)
                .query(Long.class).single() > 0;
        if (!exists) {
            throw new IllegalArgumentException("Course not found or not approved.");
        }
        jdbc.sql("INSERT IGNORE INTO enrollments (student_id, course_id) VALUES (:studentId, :courseId)")
                .param("studentId", studentId)
                .param("courseId", courseId)
                .update();
    }

    public List<Map<String, Object>> content(Long studentId, Long courseId) {
        boolean enrolled = jdbc.sql("SELECT COUNT(*) FROM enrollments WHERE student_id = :studentId AND course_id = :courseId")
                .param("studentId", studentId)
                .param("courseId", courseId)
                .query(Long.class).single() > 0;
        if (!enrolled) {
            throw new IllegalStateException("Student is not enrolled in this course.");
        }
        return jdbc.sql("SELECT id, title, type, body, created_at FROM course_content WHERE course_id = :courseId ORDER BY created_at DESC")
                .param("courseId", courseId)
                .query().listOfRows();
    }

    public Optional<String> contentFile(Long studentId, Long contentId) {
        return jdbc.sql("""
                SELECT cc.body FROM course_content cc
                JOIN enrollments e ON e.course_id = cc.course_id
                WHERE cc.id = :contentId AND e.student_id = :studentId AND cc.type = 'PDF' AND cc.body LIKE 'file:%'
                """)
                .param("contentId", contentId).param("studentId", studentId)
                .query(String.class).list().stream().findFirst();
    }

    public List<Map<String, Object>> assignments(Long studentId) {
        return jdbc.sql("""
                SELECT a.id, a.title, a.instructions, a.due_at, a.max_score, c.title as course_title,
                  s.submitted_at, s.score, s.feedback,
                  CASE
                    WHEN s.id IS NULL THEN 'PENDING'
                    WHEN s.score IS NULL THEN 'SUBMITTED'
                    ELSE 'GRADED'
                  END as submission_status
                FROM assignments a
                JOIN courses c ON c.id = a.course_id
                JOIN enrollments e ON e.course_id = c.id
                LEFT JOIN assignment_submissions s ON s.assignment_id = a.id AND s.student_id = :studentId
                WHERE e.student_id = :studentId AND a.status = 'PUBLISHED'
                ORDER BY a.due_at IS NULL, a.due_at
                """)
                .param("studentId", studentId)
                .query().listOfRows();
    }

    public List<Map<String, Object>> assignmentQuestions(Long studentId, Long assignmentId) {
        boolean authorized = jdbc.sql("""
                SELECT COUNT(*) FROM assignments a
                JOIN enrollments e ON e.course_id = a.course_id
                WHERE a.id = :assignmentId AND e.student_id = :studentId AND a.status = 'PUBLISHED'
                """)
                .param("assignmentId", assignmentId)
                .param("studentId", studentId)
                .query(Long.class).single() > 0;
        if (!authorized) {
            throw new IllegalStateException("Not authorized to view these assignment questions.");
        }
        return jdbc.sql("SELECT id, question_text FROM assignment_questions WHERE assignment_id = :assignmentId ORDER BY id")
                .param("assignmentId", assignmentId)
                .query().listOfRows();
    }

    @Transactional
    public void submitAssignment(Long studentId, Long assignmentId, Map<String, String> answers) {
        boolean authorized = jdbc.sql("""
                SELECT COUNT(*) FROM assignments a
                JOIN enrollments e ON e.course_id = a.course_id
                WHERE a.id = :assignmentId AND e.student_id = :studentId AND a.status = 'PUBLISHED'
                """)
                .param("assignmentId", assignmentId)
                .param("studentId", studentId)
                .query(Long.class).single() > 0;
        if (!authorized) {
            throw new IllegalStateException("Not authorized to submit this assignment.");
        }

        boolean pastDue = jdbc.sql("SELECT COUNT(*) FROM assignments WHERE id = :assignmentId AND due_at IS NOT NULL AND due_at < CURRENT_TIMESTAMP")
                .param("assignmentId", assignmentId)
                .query(Long.class).single() > 0;
        if (pastDue) {
            throw new IllegalStateException("The submission deadline for this assignment has passed.");
        }

        Optional<Map<String, Object>> existingSubmission = jdbc.sql("SELECT id, score FROM assignment_submissions WHERE assignment_id = :assignmentId AND student_id = :studentId")
                .param("assignmentId", assignmentId)
                .param("studentId", studentId)
                .query().listOfRows().stream().findFirst();

        if (existingSubmission.isPresent() && existingSubmission.get().get("score") != null) {
            throw new IllegalStateException("This assignment has already been graded and cannot be resubmitted.");
        }

        String content = answers.containsKey("content") ? answers.get("content") : "Multiple answers submitted";

        Long submissionId;
        if (existingSubmission.isEmpty()) {
            jdbc.sql("""
                    INSERT INTO assignment_submissions (assignment_id, student_id, content, submitted_at)
                    VALUES (:assignmentId, :studentId, :content, CURRENT_TIMESTAMP)
                    """)
                    .param("assignmentId", assignmentId)
                    .param("studentId", studentId)
                    .param("content", content)
                    .update();
            submissionId = jdbc.sql("SELECT id FROM assignment_submissions WHERE assignment_id = :assignmentId AND student_id = :studentId")
                    .param("assignmentId", assignmentId)
                    .param("studentId", studentId)
                    .query(Long.class).single();
        } else {
            submissionId = ((Number) existingSubmission.get().get("id")).longValue();
            jdbc.sql("UPDATE assignment_submissions SET submitted_at = CURRENT_TIMESTAMP, content = :content WHERE id = :submissionId")
                    .param("submissionId", submissionId)
                    .param("content", content)
                    .update();
        }

        for (Map.Entry<String, String> entry : answers.entrySet()) {
            if (entry.getKey().equals("content")) continue;
            Long questionId;
            try {
                questionId = Long.parseLong(entry.getKey());
            } catch (NumberFormatException e) {
                continue;
            }
            String answerText = entry.getValue();

            boolean questionBelongs = jdbc.sql("SELECT COUNT(*) FROM assignment_questions WHERE id = :questionId AND assignment_id = :assignmentId")
                    .param("questionId", questionId)
                    .param("assignmentId", assignmentId)
                    .query(Long.class).single() > 0;
            if (!questionBelongs) continue;

            jdbc.sql("""
                    INSERT INTO assignment_question_answers (submission_id, question_id, answer_text)
                    VALUES (:submissionId, :questionId, :answerText)
                    ON DUPLICATE KEY UPDATE answer_text = VALUES(answer_text)
                    """)
                    .param("submissionId", submissionId)
                    .param("questionId", questionId)
                    .param("answerText", answerText)
                    .update();
        }
    }

    public Map<String, Object> submissionDetails(Long studentId, Long assignmentId) {
        Optional<Map<String, Object>> submission = jdbc.sql("""
                SELECT s.id, s.submitted_at, s.score, s.feedback, a.max_score, a.title as assignment_title, a.instructions, s.content
                FROM assignment_submissions s
                JOIN assignments a ON a.id = s.assignment_id
                WHERE s.assignment_id = :assignmentId AND s.student_id = :studentId
                """)
                .param("assignmentId", assignmentId)
                .param("studentId", studentId)
                .query((rs, rowNum) -> {
                    Map<String, Object> row = new java.util.HashMap<>();
                    row.put("id", rs.getLong("id"));
                    row.put("submitted_at", rs.getTimestamp("submitted_at"));
                    row.put("score", rs.getObject("score"));
                    row.put("feedback", rs.getString("feedback"));
                    row.put("max_score", rs.getInt("max_score"));
                    row.put("assignment_title", rs.getString("assignment_title"));
                    row.put("instructions", rs.getString("instructions"));
                    row.put("content", rs.getString("content"));
                    return row;
                }).list().stream().findFirst();

        if (submission.isEmpty()) return Map.of();

        Long submissionId = ((Number) submission.get().get("id")).longValue();
        List<Map<String, Object>> answers = jdbc.sql("""
                SELECT q.id as question_id, q.question_text, COALESCE(ans.answer_text, '') as answer_text
                FROM assignment_questions q
                LEFT JOIN assignment_question_answers ans ON ans.question_id = q.id AND ans.submission_id = :submissionId
                WHERE q.assignment_id = :assignmentId
                ORDER BY q.id
                """)
                .param("submissionId", submissionId)
                .param("assignmentId", assignmentId)
                .query().listOfRows();

        java.util.HashMap<String, Object> result = new java.util.HashMap<>(submission.get());
        result.put("answers", answers);
        return result;
    }

    public List<Map<String, Object>> announcements(Long studentId, Long courseId) {
        boolean enrolled = jdbc.sql("SELECT COUNT(*) FROM enrollments WHERE student_id = :studentId AND course_id = :courseId")
                .param("studentId", studentId)
                .param("courseId", courseId)
                .query(Long.class).single() > 0;
        if (!enrolled) {
            throw new IllegalStateException("Student is not enrolled in this course.");
        }
        return jdbc.sql("SELECT id, title, message, created_at FROM announcements WHERE course_id = :courseId ORDER BY created_at DESC")
                .param("courseId", courseId)
                .query().listOfRows();
    }

    public List<Map<String, Object>> quizzes(Long studentId, Long courseId) {
        boolean enrolled = jdbc.sql("SELECT COUNT(*) FROM enrollments WHERE student_id = :studentId AND course_id = :courseId")
                .param("studentId", studentId)
                .param("courseId", courseId)
                .query(Long.class).single() > 0;
        if (!enrolled) {
            throw new IllegalStateException("Student is not enrolled in this course.");
        }
        return jdbc.sql("""
                SELECT q.id, q.title, q.description, q.published_at,
                  (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = q.id) as question_count,
                  qs.submitted_at, qs.score
                FROM quizzes q
                LEFT JOIN quiz_submissions qs ON qs.quiz_id = q.id AND qs.student_id = :studentId
                WHERE q.course_id = :courseId AND q.status = 'PUBLISHED'
                ORDER BY q.published_at DESC
                """)
                .param("studentId", studentId)
                .param("courseId", courseId)
                .query().listOfRows();
    }

    public List<Map<String, Object>> quizQuestions(Long studentId, Long quizId) {
        boolean authorized = jdbc.sql("""
                SELECT COUNT(*) FROM quizzes q
                JOIN enrollments e ON e.course_id = q.course_id
                WHERE q.id = :quizId AND e.student_id = :studentId AND q.status = 'PUBLISHED'
                """)
                .param("quizId", quizId)
                .param("studentId", studentId)
                .query(Long.class).single() > 0;
        if (!authorized) {
            throw new IllegalStateException("Not authorized to view these quiz questions.");
        }

        List<Map<String, Object>> questions = jdbc.sql("SELECT id, question_text, options_text, points FROM quiz_questions WHERE quiz_id = :quizId ORDER BY id")
                .param("quizId", quizId)
                .query().listOfRows();

        return questions.stream().map(q -> {
            java.util.Map<String, Object> map = new java.util.HashMap<>(q);
            String optionsText = (String) map.remove("options_text");
            List<String> optionsList = optionsText != null ? List.of(optionsText.split("\\u001F", -1)) : List.of();
            map.put("options", optionsList);
            return map;
        }).toList();
    }

    @Transactional
    public Map<String, Object> submitQuiz(Long studentId, Long quizId, Map<String, String> answers) {
        boolean authorized = jdbc.sql("""
                SELECT COUNT(*) FROM quizzes q
                JOIN enrollments e ON e.course_id = q.course_id
                WHERE q.id = :quizId AND e.student_id = :studentId AND q.status = 'PUBLISHED'
                """)
                .param("quizId", quizId)
                .param("studentId", studentId)
                .query(Long.class).single() > 0;
        if (!authorized) {
            throw new IllegalStateException("Not authorized to submit this quiz.");
        }

        boolean alreadySubmitted = jdbc.sql("SELECT COUNT(*) FROM quiz_submissions WHERE quiz_id = :quizId AND student_id = :studentId")
                .param("quizId", quizId)
                .param("studentId", studentId)
                .query(Long.class).single() > 0;
        if (alreadySubmitted) {
            throw new IllegalStateException("You have already submitted this quiz.");
        }

        List<Map<String, Object>> questions = jdbc.sql("SELECT id, correct_answer, points FROM quiz_questions WHERE quiz_id = :quizId")
                .param("quizId", quizId)
                .query().listOfRows();

        double totalScore = 0.0;
        double maxPossibleScore = 0.0;
        
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            var statement = connection.prepareStatement("""
                    INSERT INTO quiz_submissions (quiz_id, student_id, score, submitted_at)
                    VALUES (?, ?, 0, CURRENT_TIMESTAMP)
                    """, Statement.RETURN_GENERATED_KEYS);
            statement.setLong(1, quizId);
            statement.setLong(2, studentId);
            return statement;
        }, keyHolder);
        Number idVal = keyHolder.getKey();
        if (idVal == null) throw new IllegalStateException("Failed to insert quiz submission.");
        long submissionId = idVal.longValue();

        for (Map<String, Object> q : questions) {
            Long questionId = ((Number) q.get("id")).longValue();
            String correctAnswer = ((String) q.get("correct_answer")).trim();
            int points = ((Number) q.get("points")).intValue();
            maxPossibleScore += points;

            String studentAnswerText = answers.get(String.valueOf(questionId));
            if (studentAnswerText == null) {
                studentAnswerText = "";
            }
            studentAnswerText = studentAnswerText.trim();

            boolean isCorrect = studentAnswerText.equalsIgnoreCase(correctAnswer);
            if (isCorrect) {
                totalScore += points;
            }

            jdbc.sql("""
                    INSERT INTO quiz_answers (submission_id, question_id, selected_answer, is_correct)
                    VALUES (:submissionId, :questionId, :selectedAnswer, :isCorrect)
                    """)
                    .param("submissionId", submissionId)
                    .param("questionId", questionId)
                    .param("selectedAnswer", studentAnswerText)
                    .param("isCorrect", isCorrect)
                    .update();
        }

        jdbc.sql("UPDATE quiz_submissions SET score = :score WHERE id = :submissionId")
                .param("score", totalScore)
                .param("submissionId", submissionId)
                .update();

        return Map.of(
                "submissionId", submissionId,
                "score", totalScore,
                "maxScore", maxPossibleScore
        );
    }

    public Map<String, Object> quizSubmissionDetails(Long studentId, Long quizId) {
        Optional<Map<String, Object>> submission = jdbc.sql("""
                SELECT s.id, s.submitted_at, s.score, q.title as quiz_title, q.description
                FROM quiz_submissions s
                JOIN quizzes q ON q.id = s.quiz_id
                WHERE s.quiz_id = :quizId AND s.student_id = :studentId
                """)
                .param("quizId", quizId)
                .param("studentId", studentId)
                .query((rs, rowNum) -> {
                    Map<String, Object> row = new java.util.HashMap<>();
                    row.put("id", rs.getLong("id"));
                    row.put("submitted_at", rs.getTimestamp("submitted_at"));
                    row.put("score", rs.getBigDecimal("score"));
                    row.put("quiz_title", rs.getString("quiz_title"));
                    row.put("description", rs.getString("description"));
                    return row;
                }).list().stream().findFirst();

        if (submission.isEmpty()) {
            throw new IllegalStateException("Quiz submission not found.");
        }

        Long submissionId = ((Number) submission.get().get("id")).longValue();
        List<Map<String, Object>> answers = jdbc.sql("""
                SELECT q.id as question_id, q.question_text, q.options_text, q.correct_answer, q.points,
                  COALESCE(ans.selected_answer, '') as selected_answer, COALESCE(ans.is_correct, false) as is_correct
                FROM quiz_questions q
                LEFT JOIN quiz_answers ans ON ans.question_id = q.id AND ans.submission_id = :submissionId
                WHERE q.quiz_id = :quizId
                ORDER BY q.id
                """)
                .param("submissionId", submissionId)
                .param("quizId", quizId)
                .query().listOfRows();

        List<Map<String, Object>> processedAnswers = answers.stream().map(a -> {
            java.util.Map<String, Object> map = new java.util.HashMap<>(a);
            String optionsText = (String) map.remove("options_text");
            List<String> optionsList = optionsText != null ? List.of(optionsText.split("\\u001F", -1)) : List.of();
            map.put("options", optionsList);
            return map;
        }).toList();

        java.util.HashMap<String, Object> result = new java.util.HashMap<>(submission.get());
        result.put("answers", processedAnswers);
        return result;
    }
}
