package com.lms.backend.user;

import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class UserRepository {
    private final JdbcClient jdbcClient;

    public UserRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public Optional<User> findByEmail(String email) {
        return jdbcClient.sql("""
                SELECT id, full_name, email, password_hash, role, status, organization_id
                FROM users WHERE email = :email
                """)
                .param("email", email)
                .query((resultSet, rowNum) -> new User(
                        resultSet.getLong("id"),
                        resultSet.getString("full_name"),
                        resultSet.getString("email"),
                        resultSet.getString("password_hash"),
                        Role.valueOf(resultSet.getString("role")),
                        AccountStatus.valueOf(resultSet.getString("status")), resultSet.getLong("organization_id")))
                .optional();
    }

    public User save(String fullName, String email, String passwordHash, Role role, AccountStatus status, Long organizationId) {
        jdbcClient.sql("""
                INSERT INTO users (full_name, email, password_hash, role, status, organization_id)
                VALUES (:fullName, :email, :passwordHash, :role, :status, :organizationId)
                """)
                .param("fullName", fullName)
                .param("email", email)
                .param("passwordHash", passwordHash)
                .param("role", role.name()).param("organizationId", organizationId)
                .param("status", status.name())
                .update();
        return findByEmail(email).orElseThrow();
    }

    public Optional<User> findById(Long id) {
        return jdbcClient.sql("SELECT id, full_name, email, password_hash, role, status, organization_id FROM users WHERE id = :id")
                .param("id", id)
                .query((resultSet, rowNum) -> new User(resultSet.getLong("id"), resultSet.getString("full_name"),
                        resultSet.getString("email"), resultSet.getString("password_hash"),
                        Role.valueOf(resultSet.getString("role")), AccountStatus.valueOf(resultSet.getString("status")), resultSet.getLong("organization_id")))
                .optional();
    }

    public List<User> findAll(AccountStatus status) {
        return findAll(status, null);
    }

    public List<User> findAll(AccountStatus status, Long organizationId) {
        String query = status == null
                ? "SELECT id, full_name, email, password_hash, role, status, organization_id FROM users WHERE (:organizationId IS NULL OR organization_id = :organizationId) ORDER BY created_at DESC"
                : "SELECT id, full_name, email, password_hash, role, status, organization_id FROM users WHERE status = :status AND (:organizationId IS NULL OR organization_id = :organizationId) ORDER BY created_at DESC";
        var statement = jdbcClient.sql(query);
        if (status != null) statement.param("status", status.name());
        statement.param("organizationId", organizationId);
        return statement.query((resultSet, rowNum) -> new User(resultSet.getLong("id"), resultSet.getString("full_name"),
                resultSet.getString("email"), resultSet.getString("password_hash"), Role.valueOf(resultSet.getString("role")),
                AccountStatus.valueOf(resultSet.getString("status")), resultSet.getLong("organization_id"))).list();
    }

    public void updateStatus(Long id, AccountStatus status, Long organizationId) {
        jdbcClient.sql("UPDATE users SET status = :status WHERE id = :id AND organization_id = :organizationId")
                .param("status", status.name()).param("id", id).param("organizationId", organizationId).update();
    }

    public void deleteById(Long id, Long organizationId) {
        jdbcClient.sql("DELETE FROM users WHERE id = :id AND organization_id = :organizationId")
                .param("id", id).param("organizationId", organizationId).update();
    }

    public boolean hasRelatedRecords(Long id) {
        return jdbcClient.sql("""
                SELECT (SELECT COUNT(*) FROM courses WHERE teacher_id = :id)
                     + (SELECT COUNT(*) FROM enrollments WHERE student_id = :id)
                     + (SELECT COUNT(*) FROM assignment_submissions WHERE student_id = :id)
                     + (SELECT COUNT(*) FROM quiz_submissions WHERE student_id = :id)
                """).param("id", id).query(Long.class).single() > 0;
    }
}
