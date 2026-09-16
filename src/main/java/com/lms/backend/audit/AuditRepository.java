package com.lms.backend.audit;

import java.util.List;
import java.util.Map;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class AuditRepository {
    private final JdbcClient jdbc;

    public AuditRepository(JdbcClient jdbc) { this.jdbc = jdbc; }

    public void record(AuditAction action, Long organizationId, Long actorId, String actorName,
                       String entityType, String entityName, Long courseId, Long studentId, String detail) {
        jdbc.sql("""
                INSERT INTO audit_log (organization_id, actor_id, actor_name, action, entity_type, entity_name, course_id, student_id, detail)
                VALUES (:organizationId, :actorId, :actorName, :action, :entityType, :entityName, :courseId, :studentId, :detail)
                """)
                .param("organizationId", organizationId)
                .param("actorId", actorId)
                .param("actorName", actorName)
                .param("action", action.name())
                .param("entityType", entityType)
                .param("entityName", entityName)
                .param("courseId", courseId)
                .param("studentId", studentId)
                .param("detail", detail)
                .update();
    }

    private static final String FEED_SELECT = """
            SELECT LOWER(a.action) type, a.entity_name title,
              COALESCE(a.actor_name, (SELECT u.full_name FROM users u WHERE u.id = a.actor_id)) actor,
              CASE WHEN a.action IN ('ASSIGNMENT_GRADED', 'QUIZ_COMPLETED')
                   THEN COALESCE(CAST(REPLACE(a.detail, '%', '') AS DECIMAL(10, 1)), 0)
                   ELSE NULL END metric,
              a.created_at stamp
            FROM audit_log a
            """;

    public List<Map<String, Object>> recentForOrganization(Long organizationId, int limit) {
        return jdbc.sql(FEED_SELECT + " WHERE a.organization_id = :organizationId ORDER BY a.created_at DESC, a.id DESC LIMIT :limit")
                .param("organizationId", organizationId).param("limit", limit).query().listOfRows();
    }

    public List<Map<String, Object>> recentForTeacher(Long teacherId, Long organizationId, int limit) {
        return jdbc.sql(FEED_SELECT + """
                 WHERE a.organization_id = :organizationId
                   AND (a.course_id IN (SELECT id FROM courses WHERE teacher_id = :teacherId) OR a.actor_id = :teacherId)
                 ORDER BY a.created_at DESC, a.id DESC LIMIT :limit
                """)
                .param("organizationId", organizationId).param("teacherId", teacherId).param("limit", limit)
                .query().listOfRows();
    }

    public List<Map<String, Object>> recentForStudent(Long studentId, Long organizationId, int limit) {
        return jdbc.sql(FEED_SELECT + """
                 WHERE a.organization_id = :organizationId
                   AND (a.student_id = :studentId OR a.actor_id = :studentId)
                 ORDER BY a.created_at DESC, a.id DESC LIMIT :limit
                """)
                .param("organizationId", organizationId).param("studentId", studentId).param("limit", limit)
                .query().listOfRows();
    }

    public List<Map<String, Object>> auditLog(Long organizationId, AuditAction action, int limit) {
        String filter = action == null ? "" : " AND a.action = :action ";
        return jdbc.sql("""
                SELECT a.id, a.action, a.entity_name,
                  COALESCE(a.actor_name, (SELECT u.full_name FROM users u WHERE u.id = a.actor_id)) actor_name,
                  a.detail, a.created_at stamp
                FROM audit_log a WHERE a.organization_id = :organizationId
                """ + filter + " ORDER BY a.created_at DESC, a.id DESC LIMIT :limit")
                .param("organizationId", organizationId)
                .param("action", action == null ? null : action.name())
                .param("limit", limit)
                .query().listOfRows();
    }
}