package com.lms.backend.auth;

import java.util.Locale;

import com.lms.backend.config.AuthRateLimiter;
import com.lms.backend.user.User;
import jakarta.servlet.http.HttpServletRequest;
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
    private final AuthRateLimiter rateLimiter;

    public AuthController(AuthService authService, AuthRateLimiter rateLimiter) {
        this.authService = authService;
        this.rateLimiter = rateLimiter;
    }

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    @PostMapping("/register")
    public AuthResponse register(@Valid @RequestBody RegisterRequest request, HttpServletRequest httpRequest) {
        String bucket = "register:" + clientIp(httpRequest);
        if (!rateLimiter.allow(bucket)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Too many sign-up attempts. Please wait a few minutes and try again.");
        }
        try {
            AuthResponse response = authService.register(request);
            rateLimiter.reset(bucket);
            return response;
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, exception.getMessage());
        }
    }

    @PostMapping("/register-organization")
    public AuthResponse registerOrganization(@Valid @RequestBody OrganizationRegistrationRequest request,
            HttpServletRequest httpRequest) {
        String bucket = "register:" + clientIp(httpRequest);
        if (!rateLimiter.allow(bucket)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Too many sign-up attempts. Please wait a few minutes and try again.");
        }
        try {
            AuthResponse response = authService.registerOrganization(request);
            rateLimiter.reset(bucket);
            return response;
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, exception.getMessage());
        }
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request, HttpSession session,
            HttpServletRequest httpRequest) {
        String bucket = "login:" + clientIp(httpRequest) + "|"
                + request.email().trim().toLowerCase(Locale.ROOT);
        if (!rateLimiter.allow(bucket)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Too many sign-in attempts for this account. Please wait a few minutes and try again.");
        }
        User user;
        try {
            user = authService.authenticate(request);
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, exception.getMessage());
        }
        rateLimiter.reset(bucket);
        httpRequest.changeSessionId();
        session.setAttribute(USER_SESSION_KEY, authService.response(user));
        return authService.response(user);
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
