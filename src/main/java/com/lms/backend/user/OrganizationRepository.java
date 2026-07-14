package com.lms.backend.user;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.util.List;
import com.lms.backend.auth.OrganizationResponse;

@Repository
public class OrganizationRepository {
    private final JdbcClient jdbc;

    public OrganizationRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
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
        jdbc.sql("INSERT INTO organizations (name) VALUES (:name)").param("name", name).update();
        return jdbc.sql("SELECT id FROM organizations WHERE name = :name").param("name", name).query(Long.class).single();
    }

    public List<OrganizationResponse> findAll() {
        return jdbc.sql("SELECT id, name FROM organizations ORDER BY name")
                .query((rs, rowNum) -> new OrganizationResponse(rs.getLong("id"), rs.getString("name"))).list();
    }
}
