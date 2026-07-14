package com.lms.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.admin")
public record AdminBootstrapProperties(
        boolean bootstrapEnabled,
        String email,
        String password,
        String fullName) {
}
