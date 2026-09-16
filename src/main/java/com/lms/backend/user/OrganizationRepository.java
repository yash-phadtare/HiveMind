package com.lms.backend.user;

import java.sql.Statement;
import java.util.List;
import java.util.Objects;

import com.lms.backend.auth.OrganizationResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

@Repository
public class OrganizationRepository {
    private final JdbcClient jdbc;
    private final JdbcTemplate jdbcTemplate;

    public OrganizationRepository(JdbcClient jdbc, JdbcTemplate jdbcTemplate) {
        this.jdbc = jdbc;
        this.jdbcTemplate = jdbcTemplate;
    }

    public boolean existsById(Long id) {
        return jdbc.sql("SELECT COUNT(*) FROM organizations WHERE id = :id")
                .param("id", id).query(Long.class).single() > 0;
    }

    public boolean existsByName(String name) {
        return jdbc.sql("SELECT COUNT(*) FROM organizations WHERE LOWER(name) = LOWER(:name)")
                .param("name", name).query(Long.class).single() > 0;
    }

    public Long create(String name) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            var statement = connection.prepareStatement("INSERT INTO organizations (name) VALUES (?)",
                    Statement.RETURN_GENERATED_KEYS);
            statement.setString(1, name);
            return statement;
        }, keyHolder);
        return Objects.requireNonNull(keyHolder.getKey(), "No generated key was returned for the organization.")
                .longValue();
    }

    public List<OrganizationResponse> findAll() {
        return jdbc.sql("SELECT id, name FROM organizations ORDER BY name")
                .query((rs, rowNum) -> new OrganizationResponse(rs.getLong("id"), rs.getString("name"))).list();
    }
}
