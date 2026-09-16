package com.lms.backend.auth;

import java.util.Locale;
import java.util.List;

import com.lms.backend.audit.AuditAction;
import com.lms.backend.audit.AuditRepository;
import com.lms.backend.user.User;
import com.lms.backend.user.UserRepository;
import com.lms.backend.user.OrganizationRepository;
import com.lms.backend.user.AccountStatus;
import com.lms.backend.user.Role;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    private final UserRepository users;
    private final OrganizationRepository organizations;
    private final PasswordEncoder passwordEncoder;
    private final AuditRepository audit;

    public AuthService(UserRepository users, OrganizationRepository organizations, PasswordEncoder passwordEncoder,
                       AuditRepository audit) {
        this.users = users;
        this.organizations = organizations;
        this.passwordEncoder = passwordEncoder;
        this.audit = audit;
    }

    public AuthResponse register(RegisterRequest request) {
        if (request.role() == Role.ORGANIZATION) {
            throw new IllegalArgumentException("Organization accounts can only be created during application setup.");
        }
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        if (users.findByEmail(email).isPresent()) {
            throw new IllegalArgumentException("An account with this email already exists.");
        }
        if (!organizations.existsById(request.organizationId())) {
            throw new IllegalArgumentException("The selected organization does not exist.");
        }
        AccountStatus status = AccountStatus.PENDING;
        User user = users.save(request.fullName().trim(), email,
                passwordEncoder.encode(request.password()), request.role(), status, request.organizationId());
        AuditAction action = user.role() == Role.TEACHER ? AuditAction.TEACHER_REGISTERED : AuditAction.STUDENT_REGISTERED;
        audit.record(action, user.organizationId(), user.id(), user.fullName(), user.role().name(), null, null,
                user.role() == Role.STUDENT ? user.id() : null, null);
        return response(user);
    }

    @Transactional
    public AuthResponse registerOrganization(OrganizationRegistrationRequest request) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        String organizationName = request.organizationName().trim();
        if (users.findByEmail(email).isPresent()) {
            throw new IllegalArgumentException("An account with this email already exists.");
        }
        if (organizations.existsByName(organizationName)) {
            throw new IllegalArgumentException("An organization with this name already exists.");
        }
        Long organizationId = organizations.create(organizationName);
        User user = users.save(request.fullName().trim(), email, passwordEncoder.encode(request.password()),
                Role.ORGANIZATION, AccountStatus.ACTIVE, organizationId);
        return response(user);
    }

    public User authenticate(LoginRequest request) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        User user = users.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Invalid email or password."));
        if (!passwordEncoder.matches(request.password(), user.passwordHash())) {
            throw new IllegalArgumentException("Invalid email or password.");
        }
        if (user.status() == AccountStatus.PENDING) {
            throw new IllegalArgumentException("Your account is waiting for institution approval.");
        }
        if (user.status() != AccountStatus.ACTIVE) {
            throw new IllegalArgumentException("This account is not active. Please contact your organization.");
        }
        return user;
    }

    public AuthResponse response(User user) {
        return new AuthResponse(user.id(), user.fullName(), user.email(), user.role(), user.organizationId());
    }

    public List<OrganizationResponse> organizations() {
        return organizations.findAll();
    }
}
