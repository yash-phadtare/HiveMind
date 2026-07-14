package com.lms.backend.user;

public record User(Long id, String fullName, String email, String passwordHash, Role role, AccountStatus status,
        Long organizationId) {
}
