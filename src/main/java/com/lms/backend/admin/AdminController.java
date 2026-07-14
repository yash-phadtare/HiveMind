package com.lms.backend.admin;

import java.util.List;

import com.lms.backend.auth.AuthResponse;
import com.lms.backend.user.AccountStatus;
import com.lms.backend.user.Role;
import com.lms.backend.user.User;
import com.lms.backend.user.UserRepository;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/organization")
public class AdminController {
    private static final String USER_SESSION_KEY = "authenticatedUser";
    private final UserRepository users;
    private final AdminManagementRepository management;

    public AdminController(UserRepository users, AdminManagementRepository management) {
        this.users = users;
        this.management = management;
    }

    @GetMapping("/summary")
    public AdminSummaryResponse summary(HttpSession session) {
        AuthResponse organization = requireOrganization(session);
        List<User> allUsers = users.findAll(null, organization.organizationId());
        return new AdminSummaryResponse(allUsers.size(), count(allUsers, Role.STUDENT, AccountStatus.ACTIVE),
                count(allUsers, Role.TEACHER, AccountStatus.ACTIVE), count(allUsers, Role.TEACHER, AccountStatus.PENDING),
                management.countCourses(organization.organizationId()), management.countCourses(CourseStatus.PENDING, organization.organizationId()), management.countEnrollments(organization.organizationId()),
                management.countQuizzes(organization.organizationId()));
    }

    @GetMapping("/users")
    public List<AdminUserResponse> listUsers(@RequestParam(required = false) AccountStatus status,
            @RequestParam(required = false) Role role, HttpSession session) {
        AuthResponse organization = requireOrganization(session);
        return users.findAll(status, organization.organizationId()).stream().filter(user -> role == null || user.role() == role)
                .map(AdminUserResponse::from).toList();
    }

    @PatchMapping("/users/{id}/approve")
    public AdminUserResponse approve(@PathVariable Long id, HttpSession session) {
        return setStatus(id, AccountStatus.ACTIVE, session);
    }

    @PatchMapping("/users/{id}/reject")
    public AdminUserResponse reject(@PathVariable Long id, HttpSession session) {
        return setStatus(id, AccountStatus.REJECTED, session);
    }

    @PatchMapping("/users/{id}/suspend")
    public AdminUserResponse suspend(@PathVariable Long id, HttpSession session) {
        return setStatus(id, AccountStatus.SUSPENDED, session);
    }

    @PatchMapping("/users/{id}/activate")
    public AdminUserResponse activate(@PathVariable Long id, HttpSession session) {
        return setStatus(id, AccountStatus.ACTIVE, session);
    }

    @DeleteMapping("/users/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, HttpSession session) {
        AuthResponse organization = requireOrganization(session);
        if (organization.id().equals(id)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot delete your own account.");
        User user = requireUser(id);
        requireSameOrganization(user, organization);
        rejectOrganizationAccountChange(user);
        if (users.hasRelatedRecords(id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This account has course, enrollment, or submission records. Suspend it instead.");
        }
        users.deleteById(id, organization.organizationId());
    }

    @GetMapping("/courses")
    public List<AdminCourseResponse> listCourses(@RequestParam(required = false) CourseStatus status, HttpSession session) {
        return management.findCourses(status, requireOrganization(session).organizationId());
    }

    @PatchMapping("/courses/{id}/approve")
    public AdminCourseResponse approveCourse(@PathVariable Long id, HttpSession session) {
        return setCourseStatus(id, CourseStatus.APPROVED, session);
    }

    @PatchMapping("/courses/{id}/reject")
    public AdminCourseResponse rejectCourse(@PathVariable Long id, HttpSession session) {
        return setCourseStatus(id, CourseStatus.REJECTED, session);
    }

    @PatchMapping("/courses/{id}/suspend")
    public AdminCourseResponse suspendCourse(@PathVariable Long id, HttpSession session) {
        return setCourseStatus(id, CourseStatus.SUSPENDED, session);
    }

    @GetMapping("/categories")
    public List<AdminCategoryResponse> listCategories(HttpSession session) {
        return management.findCategories(requireOrganization(session).organizationId());
    }

    @PostMapping("/categories")
    public AdminCategoryResponse createCategory(@Valid @RequestBody CategoryRequest request, HttpSession session) {
        AuthResponse organization = requireOrganization(session);
        String name = request.name().trim();
        if (management.findCategories(organization.organizationId()).stream().anyMatch(category -> category.name().equalsIgnoreCase(name))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A category with this name already exists.");
        }
        return management.createCategory(name, cleanDescription(request.description()), organization.organizationId());
    }

    @PatchMapping("/categories/{id}")
    public AdminCategoryResponse updateCategory(@PathVariable Long id, @Valid @RequestBody CategoryRequest request,
            HttpSession session) {
        AuthResponse organization = requireOrganization(session);
        AdminCategoryResponse existing = requireCategory(id, organization.organizationId());
        String name = request.name().trim();
        if (management.findCategories(organization.organizationId()).stream().anyMatch(category -> !category.id().equals(id) && category.name().equalsIgnoreCase(name))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A category with this name already exists.");
        }
        management.updateCategory(id, name, cleanDescription(request.description()), organization.organizationId());
        return new AdminCategoryResponse(id, name, cleanDescription(request.description()), existing.courseCount());
    }

    @DeleteMapping("/categories/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCategory(@PathVariable Long id, HttpSession session) {
        AuthResponse organization = requireOrganization(session);
        AdminCategoryResponse category = requireCategory(id, organization.organizationId());
        if (category.courseCount() > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Move or remove courses in this category before deleting it.");
        }
        management.deleteCategory(id, organization.organizationId());
    }

    @GetMapping("/reports/analytics")
    public AdminAnalyticsResponse analytics(HttpSession session) {
        AuthResponse organization = requireOrganization(session);
        List<User> allUsers = users.findAll(null, organization.organizationId());
        return new AdminAnalyticsResponse(count(allUsers, Role.STUDENT, AccountStatus.ACTIVE),
                count(allUsers, Role.TEACHER, AccountStatus.ACTIVE), management.countCourses(organization.organizationId()),
                management.countCourses(CourseStatus.PENDING, organization.organizationId()), management.countEnrollments(organization.organizationId()), management.countQuizzes(organization.organizationId()),
                management.categoryAnalytics(organization.organizationId()), management.enrollmentAnalytics(organization.organizationId()));
    }

    @GetMapping(value = "/reports/analytics.csv", produces = "text/csv")
    public ResponseEntity<String> analyticsCsv(HttpSession session) {
        AdminAnalyticsResponse report = analytics(session);
        StringBuilder csv = new StringBuilder("metric,value\n");
        csv.append("active_students,").append(report.students()).append('\n');
        csv.append("active_teachers,").append(report.teachers()).append('\n');
        csv.append("courses,").append(report.courses()).append('\n');
        csv.append("pending_courses,").append(report.pendingCourses()).append('\n');
        csv.append("enrollments,").append(report.enrollments()).append('\n');
        csv.append("quizzes,").append(report.quizzes()).append("\n\ncategory,courses,enrollments\n");
        report.coursesByCategory().forEach(row -> csv.append(csvValue(row.category())).append(',').append(row.courses())
                .append(',').append(row.enrollments()).append('\n'));
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=organization-analytics.csv")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csv.toString());
    }

    private AdminUserResponse setStatus(Long id, AccountStatus status, HttpSession session) {
        AuthResponse organization = requireOrganization(session);
        if (organization.id().equals(id)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot change your own account status.");
        User user = requireUser(id);
        requireSameOrganization(user, organization);
        rejectOrganizationAccountChange(user);
        users.updateStatus(id, status, organization.organizationId());
        return AdminUserResponse.from(new User(user.id(), user.fullName(), user.email(), user.passwordHash(), user.role(), status, user.organizationId()));
    }

    private AdminCourseResponse setCourseStatus(Long id, CourseStatus status, HttpSession session) {
        AuthResponse organization = requireOrganization(session);
        AdminCourseResponse course = management.findCourse(id, organization.organizationId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found."));
        management.updateCourseStatus(id, status, organization.organizationId());
        return new AdminCourseResponse(course.id(), course.title(), course.description(), course.teacherId(), course.teacherName(),
                course.categoryId(), course.categoryName(), status, course.createdAt());
    }

    private AdminCategoryResponse requireCategory(Long id, Long organizationId) {
        return management.findCategory(id, organizationId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Category not found."));
    }

    private String cleanDescription(String description) {
        return description == null || description.isBlank() ? null : description.trim();
    }

    private String csvValue(String value) {
        return '"' + value.replace("\"", "\"\"") + '"';
    }

    private AuthResponse requireOrganization(HttpSession session) {
        Object currentUser = session.getAttribute(USER_SESSION_KEY);
        if (currentUser instanceof AuthResponse response && response.role() == Role.ORGANIZATION) return response;
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Organization access is required.");
    }

    private User requireUser(Long id) {
        return users.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));
    }

    private void rejectOrganizationAccountChange(User user) {
        if (user.role() == Role.ORGANIZATION) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Organization accounts cannot be managed from this dashboard.");
        }
    }

    private void requireSameOrganization(User user, AuthResponse organization) {
        if (!organization.organizationId().equals(user.organizationId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found.");
        }
    }

    private long count(List<User> users, Role role, AccountStatus status) {
        return users.stream().filter(user -> user.role() == role && user.status() == status).count();
    }
}
