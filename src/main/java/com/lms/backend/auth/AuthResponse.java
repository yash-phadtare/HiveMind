package com.lms.backend.auth;

import com.lms.backend.user.Role;

public record AuthResponse(Long id, String fullName, String email, Role role, Long organizationId) {
}
