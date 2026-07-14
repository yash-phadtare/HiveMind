package com.lms.backend.config;

import com.lms.backend.user.AccountStatus;
import com.lms.backend.user.Role;
import com.lms.backend.user.UserRepository;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
@EnableConfigurationProperties(AdminBootstrapProperties.class)
public class AdminBootstrapConfiguration {
    @Bean
    ApplicationRunner bootstrapAdministrator(AdminBootstrapProperties properties, UserRepository users,
                                              PasswordEncoder passwordEncoder, JdbcClient jdbc) {
        return arguments -> {
            if (!properties.bootstrapEnabled() || users.findByEmail(properties.email().trim().toLowerCase()).isPresent()) {
                return;
            }
            Long organizationId = jdbc.sql("SELECT id FROM organizations WHERE name = 'Default Organization'").query(Long.class).single();
            users.save(properties.fullName().trim(), properties.email().trim().toLowerCase(),
                    passwordEncoder.encode(properties.password()), Role.ORGANIZATION, AccountStatus.ACTIVE, organizationId);
        };
    }
}
