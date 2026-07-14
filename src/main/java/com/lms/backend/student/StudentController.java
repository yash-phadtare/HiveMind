package com.lms.backend.student;

import java.util.List;
import java.util.Map;

import com.lms.backend.auth.AuthResponse;
import com.lms.backend.user.Role;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/student")
public class StudentController {
    private static final String USER_SESSION_KEY = "authenticatedUser";
    private final StudentRepository repository;

    public StudentController(StudentRepository repository) {
        this.repository = repository;
    }

    private AuthResponse student(HttpSession session) {
        Object user = session.getAttribute(USER_SESSION_KEY);
        if (user instanceof AuthResponse response && response.role() == Role.STUDENT) return response;
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Student access is required.");
    }

    @GetMapping("/dashboard")
    public Map<String, Object> dashboard(HttpSession session) {
        AuthResponse user = student(session);
        return repository.dashboard(user.id(), user.organizationId());
    }

    @GetMapping("/courses")
    public List<Map<String, Object>> courses(HttpSession session) {
        AuthResponse user = student(session);
        return repository.courses(user.id(), user.organizationId());
    }

    @PostMapping("/courses/{courseId}/enroll")
    public void enroll(@PathVariable Long courseId, HttpSession session) {
        AuthResponse user = student(session);
        try {
            repository.enroll(user.id(), courseId, user.organizationId());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    @GetMapping("/courses/{courseId}/content")
    public List<Map<String, Object>> content(@PathVariable Long courseId, HttpSession session) {
        AuthResponse user = student(session);
        try {
            return repository.content(user.id(), courseId);
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, e.getMessage());
        }
    }

    @GetMapping("/assignments")
    public List<Map<String, Object>> assignments(HttpSession session) {
        AuthResponse user = student(session);
        return repository.assignments(user.id());
    }

    @GetMapping("/assignments/{assignmentId}/questions")
    public List<Map<String, Object>> assignmentQuestions(@PathVariable Long assignmentId, HttpSession session) {
        AuthResponse user = student(session);
        try {
            return repository.assignmentQuestions(user.id(), assignmentId);
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, e.getMessage());
        }
    }

    @PostMapping("/assignments/{assignmentId}/submit")
    public void submitAssignment(@PathVariable Long assignmentId, @RequestBody Map<String, String> answers, HttpSession session) {
        AuthResponse user = student(session);
        try {
            repository.submitAssignment(user.id(), assignmentId, answers);
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    @GetMapping("/assignments/{assignmentId}/submission")
    public Map<String, Object> submissionDetails(@PathVariable Long assignmentId, HttpSession session) {
        AuthResponse user = student(session);
        return repository.submissionDetails(user.id(), assignmentId);
    }

    @GetMapping("/courses/{courseId}/announcements")
    public List<Map<String, Object>> announcements(@PathVariable Long courseId, HttpSession session) {
        AuthResponse user = student(session);
        try {
            return repository.announcements(user.id(), courseId);
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, e.getMessage());
        }
    }

    @GetMapping("/courses/{courseId}/quizzes")
    public List<Map<String, Object>> quizzes(@PathVariable Long courseId, HttpSession session) {
        AuthResponse user = student(session);
        try {
            return repository.quizzes(user.id(), courseId);
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, e.getMessage());
        }
    }

    @GetMapping("/quizzes/{quizId}/questions")
    public List<Map<String, Object>> quizQuestions(@PathVariable Long quizId, HttpSession session) {
        AuthResponse user = student(session);
        try {
            return repository.quizQuestions(user.id(), quizId);
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, e.getMessage());
        }
    }

    @PostMapping("/quizzes/{quizId}/submit")
    public Map<String, Object> submitQuiz(@PathVariable Long quizId, @RequestBody Map<String, String> answers, HttpSession session) {
        AuthResponse user = student(session);
        try {
            return repository.submitQuiz(user.id(), quizId, answers);
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    @GetMapping("/quizzes/{quizId}/submission")
    public Map<String, Object> quizSubmissionDetails(@PathVariable Long quizId, HttpSession session) {
        AuthResponse user = student(session);
        return repository.quizSubmissionDetails(user.id(), quizId);
    }
}
