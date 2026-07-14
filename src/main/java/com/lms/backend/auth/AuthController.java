package com.lms.backend.auth;

import com.lms.backend.user.User;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private static final String USER_SESSION_KEY = "authenticatedUser";
    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public AuthResponse register(@Valid @RequestBody RegisterRequest request) {
        try {
            return authService.register(request);
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, exception.getMessage());
        }
    }

    @PostMapping("/register-organization")
    public AuthResponse registerOrganization(@Valid @RequestBody OrganizationRegistrationRequest request) {
        try {
            return authService.registerOrganization(request);
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, exception.getMessage());
        }
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request, HttpSession session) {
        try {
            User user = authService.authenticate(request);
            session.setAttribute(USER_SESSION_KEY, authService.response(user));
            return authService.response(user);
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, exception.getMessage());
        }
    }

    @GetMapping("/organizations")
    public java.util.List<OrganizationResponse> organizations() {
        return authService.organizations();
    }

    @GetMapping("/me")
    public AuthResponse currentUser(HttpSession session) {
        Object user = session.getAttribute(USER_SESSION_KEY);
        if (user instanceof AuthResponse response) {
            return response;
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please log in.");
    }

    @DeleteMapping("/logout")
    public void logout(HttpSession session) {
        session.invalidate();
    }
}
