package com.lms.backend.admin;

import com.lms.backend.user.AccountStatus;
import com.lms.backend.user.Role;
import com.lms.backend.user.User;

public record AdminUserResponse(Long id, String fullName, String email, Role role, AccountStatus status) {
    static AdminUserResponse from(User user) {
        return new AdminUserResponse(user.id(), user.fullName(), user.email(), user.role(), user.status());
    }
}
