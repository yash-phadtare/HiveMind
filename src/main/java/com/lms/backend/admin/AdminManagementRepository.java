package com.lms.backend.admin;

import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class AdminManagementRepository {
    private final JdbcClient jdbc;

    public AdminManagementRepository(JdbcClient jdbc) { this.jdbc = jdbc; }

    public List<AdminCourseResponse> findCourses(CourseStatus status, Long organizationId) {
        String sql = """
                SELECT c.id, c.title, c.description, c.teacher_id, u.full_name teacher_name,
                       c.category_id, cc.name category_name, c.status, c.created_at
                FROM courses c JOIN users u ON u.id = c.teacher_id
                LEFT JOIN course_categories cc ON cc.id = c.category_id
                """ + (status == null ? " WHERE c.organization_id = :organizationId ORDER BY c.created_at DESC" : " WHERE c.status = :status AND c.organization_id = :organizationId ORDER BY c.created_at DESC");
        var query = jdbc.sql(sql);
        if (status != null) query.param("status", status.name());
        query.param("organizationId", organizationId);
        return query.query((rs, n) -> new AdminCourseResponse(rs.getLong("id"), rs.getString("title"),
                rs.getString("description"), rs.getLong("teacher_id"), rs.getString("teacher_name"),
                rs.getObject("category_id", Long.class), rs.getString("category_name"),
                CourseStatus.valueOf(rs.getString("status")), rs.getTimestamp("created_at").toLocalDateTime())).list();
    }

    public Optional<AdminCourseResponse> findCourse(Long id, Long organizationId) {
        return findCourses(null, organizationId).stream().filter(course -> course.id().equals(id)).findFirst();
    }

    public void updateCourseStatus(Long id, CourseStatus status, Long organizationId) {
        jdbc.sql("UPDATE courses SET status = :status WHERE id = :id AND organization_id = :organizationId")
                .param("status", status.name()).param("id", id).param("organizationId", organizationId).update();
    }

    public List<AdminCategoryResponse> findCategories(Long organizationId) {
        return jdbc.sql("""
                SELECT cc.id, cc.name, cc.description, COUNT(c.id) course_count
                FROM course_categories cc LEFT JOIN courses c ON c.category_id = cc.id AND c.organization_id = :organizationId
                WHERE cc.organization_id = :organizationId GROUP BY cc.id, cc.name, cc.description ORDER BY cc.name
                """).param("organizationId", organizationId).query((rs, n) -> new AdminCategoryResponse(rs.getLong("id"), rs.getString("name"),
                rs.getString("description"), rs.getLong("course_count"))).list();
    }

    public AdminCategoryResponse createCategory(String name, String description, Long organizationId) {
        jdbc.sql("INSERT INTO course_categories (name, description, organization_id) VALUES (:name, :description, :organizationId)")
                .param("name", name).param("description", description).param("organizationId", organizationId).update();
        return findCategoryByName(name, organizationId).orElseThrow();
    }

    public Optional<AdminCategoryResponse> findCategory(Long id, Long organizationId) {
        return findCategories(organizationId).stream().filter(category -> category.id().equals(id)).findFirst();
    }

    private Optional<AdminCategoryResponse> findCategoryByName(String name, Long organizationId) {
        return findCategories(organizationId).stream().filter(category -> category.name().equals(name)).findFirst();
    }

    public void updateCategory(Long id, String name, String description, Long organizationId) {
        jdbc.sql("UPDATE course_categories SET name = :name, description = :description WHERE id = :id AND organization_id = :organizationId")
                .param("id", id).param("name", name).param("description", description).param("organizationId", organizationId).update();
    }

    public void deleteCategory(Long id, Long organizationId) {
        jdbc.sql("DELETE FROM course_categories WHERE id = :id AND organization_id = :organizationId")
                .param("id", id).param("organizationId", organizationId).update();
    }

    public long countCourses(Long organizationId) {
        return jdbc.sql("SELECT COUNT(*) FROM courses WHERE organization_id = :organizationId").param("organizationId", organizationId).query(Long.class).single();
    }

    public long countCourses(CourseStatus status, Long organizationId) {
        return jdbc.sql("SELECT COUNT(*) FROM courses WHERE status = :status AND organization_id = :organizationId").param("status", status.name()).param("organizationId", organizationId).query(Long.class).single();
    }

    public long countEnrollments(Long organizationId) {
        return jdbc.sql("SELECT COUNT(*) FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE c.organization_id = :organizationId").param("organizationId", organizationId).query(Long.class).single();
    }

    public long countQuizzes(Long organizationId) {
        return jdbc.sql("SELECT COUNT(*) FROM quizzes q JOIN courses c ON c.id = q.course_id WHERE c.organization_id = :organizationId").param("organizationId", organizationId).query(Long.class).single();
    }

    public List<AdminAnalyticsResponse.CategoryAnalytics> categoryAnalytics(Long organizationId) {
        return jdbc.sql("""
                SELECT COALESCE(cc.name, 'Uncategorized') category, COUNT(DISTINCT c.id) courses, COUNT(e.id) enrollments
                FROM courses c LEFT JOIN course_categories cc ON cc.id = c.category_id
                LEFT JOIN enrollments e ON e.course_id = c.id
                WHERE c.organization_id = :organizationId GROUP BY cc.id, cc.name ORDER BY courses DESC, category
                """).param("organizationId", organizationId).query((rs, n) -> new AdminAnalyticsResponse.CategoryAnalytics(rs.getString("category"),
                rs.getLong("courses"), rs.getLong("enrollments"))).list();
    }

    public List<AdminAnalyticsResponse.EnrollmentAnalytics> enrollmentAnalytics(Long organizationId) {
        return jdbc.sql("""
                SELECT DATE_FORMAT(enrolled_at, '%Y-%m') month, COUNT(*) enrollments
                FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE c.organization_id = :organizationId
                GROUP BY DATE_FORMAT(e.enrolled_at, '%Y-%m') ORDER BY month DESC LIMIT 12
                """).param("organizationId", organizationId).query((rs, n) -> new AdminAnalyticsResponse.EnrollmentAnalytics(rs.getString("month"),
                rs.getLong("enrollments"))).list();
    }
}
