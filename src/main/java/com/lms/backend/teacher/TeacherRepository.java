package com.lms.backend.teacher;

import java.sql.Statement;
import java.sql.Types;
import java.util.List;
import java.util.Optional;

import com.lms.backend.admin.CourseStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

@Repository
public class TeacherRepository {
    private final JdbcClient jdbc;
    private final JdbcTemplate jdbcTemplate;

    public TeacherRepository(JdbcClient jdbc, JdbcTemplate jdbcTemplate) {
        this.jdbc = jdbc;
        this.jdbcTemplate = jdbcTemplate;
    }

    public TeacherDashboardResponse dashboard(Long teacherId) {
        return jdbc.sql("""
                SELECT (SELECT COUNT(*) FROM courses WHERE teacher_id = :teacherId),
                  (SELECT COUNT(*) FROM courses WHERE teacher_id = :teacherId AND status = 'PENDING'),
                  (SELECT COUNT(DISTINCT e.student_id) FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE c.teacher_id=:teacherId),
                  (SELECT COUNT(*) FROM course_content cc JOIN courses c ON c.id=cc.course_id WHERE c.teacher_id=:teacherId),
                  (SELECT COUNT(*) FROM assignments a JOIN courses c ON c.id=a.course_id WHERE c.teacher_id=:teacherId),
                  (SELECT COUNT(*) FROM quizzes q JOIN courses c ON c.id=q.course_id WHERE c.teacher_id=:teacherId),
                  (SELECT COUNT(*) FROM assignment_submissions s JOIN assignments a ON a.id=s.assignment_id JOIN courses c ON c.id=a.course_id WHERE c.teacher_id=:teacherId AND s.score IS NULL)
                """).param("teacherId", teacherId).query((rs, n) -> new TeacherDashboardResponse(rs.getLong(1), rs.getLong(2), rs.getLong(3), rs.getLong(4), rs.getLong(5), rs.getLong(6), rs.getLong(7))).single();
    }

    public List<TeacherCourseResponse> courses(Long teacherId) {
        return jdbc.sql("""
                SELECT c.id,c.title,c.description,c.category_id,cc.name,c.status,COUNT(e.id) students
                FROM courses c LEFT JOIN course_categories cc ON cc.id=c.category_id LEFT JOIN enrollments e ON e.course_id=c.id
                WHERE c.teacher_id=:teacherId GROUP BY c.id,c.title,c.description,c.category_id,cc.name,c.status ORDER BY c.created_at DESC""")
                .param("teacherId", teacherId).query((rs,n)->new TeacherCourseResponse(rs.getLong(1),rs.getString(2),rs.getString(3),rs.getObject(4,Long.class),rs.getString(5),courseStatus(rs.getString(6)),rs.getLong(7))).list();
    }
    public Optional<TeacherCourseResponse> course(Long id, Long teacherId) { return courses(teacherId).stream().filter(c -> c.id().equals(id)).findFirst(); }
    public long createCourse(TeacherRequests.Course request, Long teacherId, Long organizationId) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        String description = blankToNull(request.description());
        jdbcTemplate.update(connection -> {
            var statement = connection.prepareStatement("""
                    INSERT INTO courses (title, description, teacher_id, category_id, organization_id, status)
                    VALUES (?, ?, ?, ?, ?, 'PENDING')
                    """, Statement.RETURN_GENERATED_KEYS);
            statement.setString(1, request.title().trim());
            if (description == null) statement.setNull(2, Types.LONGVARCHAR); else statement.setString(2, description);
            statement.setLong(3, teacherId);
            if (request.categoryId() == null) statement.setNull(4, Types.BIGINT); else statement.setLong(4, request.categoryId());
            if (organizationId == null) statement.setNull(5, Types.BIGINT); else statement.setLong(5, organizationId);
            return statement;
        }, keyHolder);
        Number id = keyHolder.getKey();
        if (id == null) throw new IllegalStateException("Course was created but no generated ID was returned.");
        return id.longValue();
    }
    public void updateCourse(Long id, TeacherRequests.Course r, Long teacherId) { jdbc.sql("UPDATE courses SET title=:title,description=:description,category_id=:categoryId,status='PENDING' WHERE id=:id AND teacher_id=:teacherId").param("id",id).param("teacherId",teacherId).param("title",r.title().trim()).param("description",blankToNull(r.description())).param("categoryId",r.categoryId()).update(); }
    public List<Object[]> categories(Long organizationId) { return jdbc.sql("SELECT id,name FROM course_categories WHERE organization_id=:organizationId ORDER BY name").param("organizationId",organizationId).query((rs,n)->new Object[]{rs.getLong(1),rs.getString(2)}).list(); }
    public boolean ownsCourse(Long courseId, Long teacherId) { return jdbc.sql("SELECT COUNT(*) FROM courses WHERE id=:id AND teacher_id=:teacherId").param("id",courseId).param("teacherId",teacherId).query(Long.class).single()>0; }
    public List<java.util.Map<String,Object>> content(Long courseId) { return jdbc.sql("SELECT id,title,type,body,created_at FROM course_content WHERE course_id=:courseId ORDER BY created_at DESC").param("courseId",courseId).query().listOfRows(); }
    public void addContent(TeacherRequests.Content r) { jdbc.sql("INSERT INTO course_content(course_id,title,type,body) VALUES(:courseId,:title,:type,:body)").param("courseId",r.courseId()).param("title",r.title().trim()).param("type",r.type().name()).param("body",blankToNull(r.body())).update(); }
    public List<java.util.Map<String,Object>> assignments(Long teacherId) { return jdbc.sql("SELECT a.id,a.title,a.instructions,a.due_at,a.max_score,a.status,a.course_id,c.title course_title,COUNT(s.id) submissions,SUM(CASE WHEN s.id IS NOT NULL AND s.score IS NULL THEN 1 ELSE 0 END) awaiting_grade FROM assignments a JOIN courses c ON c.id=a.course_id LEFT JOIN assignment_submissions s ON s.assignment_id=a.id WHERE c.teacher_id=:teacherId GROUP BY a.id,a.title,a.instructions,a.due_at,a.max_score,a.status,a.course_id,c.title ORDER BY a.due_at IS NULL,a.due_at").param("teacherId",teacherId).query().listOfRows(); }
    public void addAssignment(TeacherRequests.Assignment r) { jdbc.sql("INSERT INTO assignments(course_id,title,instructions,due_at,max_score,status) VALUES(:courseId,:title,:instructions,:dueAt,:maxScore,'DRAFT')").param("courseId",r.courseId()).param("title",r.title().trim()).param("instructions",blankToNull(r.instructions())).param("dueAt",r.dueAt()).param("maxScore",r.maxScore()).update(); }
    public boolean publishAssignment(Long assignmentId, Long teacherId) { return jdbc.sql("UPDATE assignments a JOIN courses c ON c.id=a.course_id SET a.status='PUBLISHED' WHERE a.id=:assignmentId AND c.teacher_id=:teacherId").param("assignmentId",assignmentId).param("teacherId",teacherId).update() > 0; }
    public List<java.util.Map<String,Object>> quizzes(Long teacherId) { return jdbc.sql("SELECT q.id,q.title,q.description,q.status,q.published_at,c.title course_title,q.created_at,COUNT(qq.id) question_count FROM quizzes q JOIN courses c ON c.id=q.course_id LEFT JOIN quiz_questions qq ON qq.quiz_id=q.id WHERE c.teacher_id=:teacherId GROUP BY q.id,q.title,q.description,q.status,q.published_at,c.title,q.created_at ORDER BY q.created_at DESC").param("teacherId",teacherId).query().listOfRows(); }
    public void addQuiz(TeacherRequests.Quiz r) { jdbc.sql("INSERT INTO quizzes(course_id,title,description,status) VALUES(:courseId,:title,:description,'DRAFT')").param("courseId",r.courseId()).param("title",r.title().trim()).param("description",blankToNull(r.description())).update(); }
    public boolean ownsQuiz(Long quizId, Long teacherId) { return jdbc.sql("SELECT COUNT(*) FROM quizzes q JOIN courses c ON c.id=q.course_id WHERE q.id=:quizId AND c.teacher_id=:teacherId").param("quizId",quizId).param("teacherId",teacherId).query(Long.class).single() > 0; }
    public List<TeacherQuizQuestionResponse> quizQuestions(Long quizId) { return jdbc.sql("SELECT id,question_text,options_text,correct_answer,points FROM quiz_questions WHERE quiz_id=:quizId ORDER BY id").param("quizId",quizId).query((rs,n) -> new TeacherQuizQuestionResponse(rs.getLong("id"), rs.getString("question_text"), List.of(rs.getString("options_text").split("\\u001F", -1)), rs.getString("correct_answer"), rs.getInt("points"))).list(); }
    public void addQuizQuestion(Long quizId, TeacherRequests.QuizQuestion request) { jdbc.sql("INSERT INTO quiz_questions(quiz_id,question_text,options_text,correct_answer,points) VALUES(:quizId,:questionText,:options,:correctAnswer,:points)").param("quizId",quizId).param("questionText",request.questionText().trim()).param("options",String.join("\u001F", request.options().stream().map(String::trim).toList())).param("correctAnswer",request.correctAnswer().trim()).param("points",request.points()).update(); }
    public boolean publishQuiz(Long quizId, Long teacherId) { return jdbc.sql("UPDATE quizzes q JOIN courses c ON c.id=q.course_id SET q.status='PUBLISHED',q.published_at=CURRENT_TIMESTAMP WHERE q.id=:quizId AND c.teacher_id=:teacherId AND EXISTS (SELECT 1 FROM quiz_questions qq WHERE qq.quiz_id=q.id)").param("quizId",quizId).param("teacherId",teacherId).update() > 0; }
    public TeacherCourseAnalyticsResponse analytics(Long courseId) { return jdbc.sql("SELECT c.id,(SELECT COUNT(*) FROM enrollments e WHERE e.course_id=c.id),(SELECT COUNT(*) FROM course_content cc WHERE cc.course_id=c.id),(SELECT COUNT(*) FROM assignments a WHERE a.course_id=c.id),(SELECT COUNT(*) FROM assignment_submissions s JOIN assignments a ON a.id=s.assignment_id WHERE a.course_id=c.id),(SELECT COUNT(*) FROM quizzes q WHERE q.course_id=c.id),(SELECT COUNT(*) FROM quiz_questions qq JOIN quizzes q ON q.id=qq.quiz_id WHERE q.course_id=c.id),COALESCE((SELECT AVG(s.score) FROM assignment_submissions s JOIN assignments a ON a.id=s.assignment_id WHERE a.course_id=c.id),0) FROM courses c WHERE c.id=:courseId").param("courseId",courseId).query((rs,n) -> new TeacherCourseAnalyticsResponse(rs.getLong(1),rs.getLong(2),rs.getLong(3),rs.getLong(4),rs.getLong(5),rs.getLong(6),rs.getLong(7),rs.getDouble(8))).single(); }
    public List<java.util.Map<String,Object>> submissions(Long assignmentId, Long teacherId) { return jdbc.sql("SELECT s.id,u.full_name student_name,u.email,s.submitted_at,s.content,s.score,s.feedback,a.max_score FROM assignment_submissions s JOIN assignments a ON a.id=s.assignment_id JOIN courses c ON c.id=a.course_id JOIN users u ON u.id=s.student_id WHERE s.assignment_id=:assignmentId AND c.teacher_id=:teacherId ORDER BY s.submitted_at DESC").param("assignmentId",assignmentId).param("teacherId",teacherId).query().listOfRows(); }
    public List<java.util.Map<String, Object>> studentProgress(Long teacherId) {
        List<java.util.Map<String, Object>> students = jdbc.sql("""
                SELECT DISTINCT u.id, u.full_name, u.email
                FROM users u
                JOIN enrollments e ON e.student_id = u.id
                JOIN courses c ON c.id = e.course_id
                WHERE c.teacher_id = :teacherId
                ORDER BY u.full_name
                """).param("teacherId", teacherId).query().listOfRows();

        for (java.util.Map<String, Object> student : students) {
            Long studentId = ((Number) student.get("id")).longValue();
            List<java.util.Map<String, Object>> assignmentRows = jdbc.sql("""
                    SELECT a.id, a.title, c.title AS course_title, a.max_score, s.submitted_at, s.score, s.feedback
                    FROM assignments a
                    JOIN courses c ON c.id = a.course_id
                    JOIN enrollments e ON e.course_id = c.id AND e.student_id = :studentId
                    LEFT JOIN assignment_submissions s ON s.assignment_id = a.id AND s.student_id = :studentId
                    WHERE c.teacher_id = :teacherId AND a.status = 'PUBLISHED'
                    ORDER BY c.title, a.due_at IS NULL, a.due_at
                    """).param("studentId", studentId).param("teacherId", teacherId).query().listOfRows();
            List<java.util.Map<String, Object>> quizRows = jdbc.sql("""
                    SELECT q.id, q.title, c.title AS course_title, s.submitted_at, s.score
                    FROM quizzes q
                    JOIN courses c ON c.id = q.course_id
                    JOIN enrollments e ON e.course_id = c.id AND e.student_id = :studentId
                    LEFT JOIN quiz_submissions s ON s.quiz_id = q.id AND s.student_id = :studentId
                    WHERE c.teacher_id = :teacherId AND q.status = 'PUBLISHED'
                    ORDER BY c.title, q.published_at DESC
                    """).param("studentId", studentId).param("teacherId", teacherId).query().listOfRows();
            student.put("assignments", assignmentRows);
            student.put("quizzes", quizRows);
        }
        return students;
    }
    public void grade(Long submissionId, TeacherRequests.Grade r, Long teacherId) { jdbc.sql("UPDATE assignment_submissions s JOIN assignments a ON a.id=s.assignment_id JOIN courses c ON c.id=a.course_id SET s.score=:score,s.feedback=:feedback,s.graded_at=CURRENT_TIMESTAMP WHERE s.id=:id AND c.teacher_id=:teacherId").param("id",submissionId).param("teacherId",teacherId).param("score",r.score()).param("feedback",blankToNull(r.feedback())).update(); }
    public boolean canGrade(Long submissionId, double score, Long teacherId) {
        return jdbc.sql("SELECT COUNT(*) FROM assignment_submissions s JOIN assignments a ON a.id=s.assignment_id JOIN courses c ON c.id=a.course_id WHERE s.id=:id AND c.teacher_id=:teacherId AND :score <= a.max_score")
                .param("id", submissionId).param("teacherId", teacherId).param("score", score).query(Long.class).single() > 0;
    }
    public List<java.util.Map<String,Object>> announcements(Long teacherId) { return jdbc.sql("SELECT an.id,an.title,an.message,an.created_at,c.title course_title FROM announcements an JOIN courses c ON c.id=an.course_id WHERE c.teacher_id=:teacherId ORDER BY an.created_at DESC").param("teacherId",teacherId).query().listOfRows(); }
    public void announce(TeacherRequests.Announcement r) { jdbc.sql("INSERT INTO announcements(course_id,title,message) VALUES(:courseId,:title,:message)").param("courseId",r.courseId()).param("title",r.title().trim()).param("message",r.message().trim()).update(); }
    public void deleteContent(Long id, Long teacherId) { jdbc.sql("DELETE FROM course_content WHERE id = :id AND course_id IN (SELECT id FROM courses WHERE teacher_id = :teacherId)").param("id", id).param("teacherId", teacherId).update(); }
    public void deleteQuiz(Long id, Long teacherId) {
        jdbc.sql("DELETE FROM quiz_questions WHERE quiz_id = :id AND quiz_id IN (SELECT q.id FROM quizzes q JOIN courses c ON c.id=q.course_id WHERE c.teacher_id = :teacherId)").param("id", id).param("teacherId", teacherId).update();
        jdbc.sql("DELETE FROM quizzes WHERE id = :id AND course_id IN (SELECT id FROM courses WHERE teacher_id = :teacherId)").param("id", id).param("teacherId", teacherId).update();
    }
    public void deleteAssignment(Long id, Long teacherId) {
        jdbc.sql("DELETE FROM assignment_submissions WHERE assignment_id = :id AND assignment_id IN (SELECT a.id FROM assignments a JOIN courses c ON c.id=a.course_id WHERE c.teacher_id = :teacherId)").param("id", id).param("teacherId", teacherId).update();
        jdbc.sql("DELETE FROM assignments WHERE id = :id AND course_id IN (SELECT id FROM courses WHERE teacher_id = :teacherId)").param("id", id).param("teacherId", teacherId).update();
    }
    public void deleteAnnouncement(Long id, Long teacherId) { jdbc.sql("DELETE FROM announcements WHERE id = :id AND course_id IN (SELECT id FROM courses WHERE teacher_id = :teacherId)").param("id", id).param("teacherId", teacherId).update(); }
    public void deleteQuizQuestion(Long questionId, Long quizId, Long teacherId) {
        if (ownsQuiz(quizId, teacherId)) {
            jdbc.sql("DELETE FROM quiz_questions WHERE id = :questionId AND quiz_id = :quizId").param("questionId", questionId).param("quizId", quizId).update();
        }
    }
    public void updateAssignment(Long id, TeacherRequests.Assignment r, Long teacherId) {
        jdbc.sql("UPDATE assignments SET title=:title, instructions=:instructions, due_at=:dueAt, max_score=:maxScore WHERE id=:id AND course_id IN (SELECT id FROM courses WHERE teacher_id=:teacherId)")
            .param("id", id).param("teacherId", teacherId).param("title", r.title().trim()).param("instructions", blankToNull(r.instructions())).param("dueAt", r.dueAt()).param("maxScore", r.maxScore()).update();
    }
    public void updateContent(Long id, TeacherRequests.Content r, Long teacherId) {
        jdbc.sql("UPDATE course_content SET title=:title, type=:type, body=:body WHERE id=:id AND course_id IN (SELECT id FROM courses WHERE teacher_id=:teacherId)")
            .param("id", id).param("teacherId", teacherId).param("title", r.title().trim()).param("type", r.type().name()).param("body", blankToNull(r.body())).update();
    }
    public boolean ownsAssignment(Long assignmentId, Long teacherId) {
        return jdbc.sql("SELECT COUNT(*) FROM assignments a JOIN courses c ON c.id=a.course_id WHERE a.id=:assignmentId AND c.teacher_id=:teacherId")
                .param("assignmentId", assignmentId).param("teacherId", teacherId).query(Long.class).single() > 0;
    }

    public List<java.util.Map<String, Object>> assignmentQuestions(Long assignmentId) {
        return jdbc.sql("SELECT id, question_text FROM assignment_questions WHERE assignment_id = :assignmentId ORDER BY id")
                .param("assignmentId", assignmentId).query().listOfRows();
    }

    public void addAssignmentQuestion(Long assignmentId, String questionText) {
        jdbc.sql("INSERT INTO assignment_questions(assignment_id, question_text) VALUES(:assignmentId, :questionText)")
                .param("assignmentId", assignmentId).param("questionText", questionText.trim()).update();
    }

    public void deleteAssignmentQuestion(Long questionId, Long assignmentId) {
        jdbc.sql("DELETE FROM assignment_questions WHERE id = :questionId AND assignment_id = :assignmentId")
                .param("questionId", questionId).param("assignmentId", assignmentId).update();
    }

    public List<java.util.Map<String, Object>> submissionAnswers(Long submissionId) {
        return jdbc.sql("SELECT q.question_text, a.answer_text FROM assignment_question_answers a JOIN assignment_questions q ON q.id = a.question_id WHERE a.submission_id = :submissionId ORDER BY q.id")
                .param("submissionId", submissionId).query().listOfRows();
    }

    public List<java.util.Map<String, Object>> quizSubmissions(Long quizId) {
        return jdbc.sql("""
                SELECT s.id, u.full_name student_name, u.email, s.submitted_at, s.score
                FROM quiz_submissions s
                JOIN users u ON u.id = s.student_id
                WHERE s.quiz_id = :quizId
                ORDER BY s.submitted_at DESC
                """)
                .param("quizId", quizId)
                .query().listOfRows();
    }

    public List<java.util.Map<String, Object>> quizSubmissionAnswers(Long submissionId) {
        return jdbc.sql("""
                SELECT q.question_text, a.selected_answer, q.correct_answer, a.is_correct, q.points
                FROM quiz_answers a
                JOIN quiz_questions q ON q.id = a.question_id
                WHERE a.submission_id = :submissionId
                ORDER BY q.id
                """)
                .param("submissionId", submissionId)
                .query().listOfRows();
    }

    public boolean ownsQuizSubmission(Long submissionId, Long teacherId) {
        return jdbc.sql("""
                SELECT COUNT(*)
                FROM quiz_submissions s
                JOIN quizzes q ON q.id = s.quiz_id
                JOIN courses c ON c.id = q.course_id
                WHERE s.id = :submissionId AND c.teacher_id = :teacherId
                """)
                .param("submissionId", submissionId)
                .param("teacherId", teacherId)
                .query(Long.class).single() > 0;
    }

    private CourseStatus courseStatus(String value) {
        try { return CourseStatus.valueOf(value); }
        catch (IllegalArgumentException | NullPointerException ignored) { return CourseStatus.PENDING; }
    }
    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
}
