package com.lms.backend.teacher;

import java.util.List;
import java.util.Map;

import com.lms.backend.auth.AuthResponse;
import com.lms.backend.audit.AuditAction;
import com.lms.backend.audit.AuditRepository;
import com.lms.backend.content.ContentFileStorage;
import com.lms.backend.user.Role;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/teacher")
public class TeacherController {
    private static final String USER_SESSION_KEY = "authenticatedUser";
    private final TeacherRepository repository;
    private final ContentFileStorage fileStorage;
    private final AuditRepository audit;
    public TeacherController(TeacherRepository repository, ContentFileStorage fileStorage, AuditRepository audit) { this.repository = repository; this.fileStorage = fileStorage; this.audit = audit; }

    @GetMapping("/activity") public List<Map<String, Object>> activity(HttpSession session) { AuthResponse teacher = teacher(session); return repository.activity(teacher.id(), teacher.organizationId()); }
    @GetMapping("/courses") public List<TeacherCourseResponse> courses(HttpSession session) { return repository.courses(teacher(session).id()); }
    @GetMapping("/categories") public List<Map<String, Object>> categories(HttpSession session) {
        return repository.categories(teacher(session).organizationId()).stream()
                .map(row -> Map.<String, Object>of("id", row[0], "name", row[1])).toList();
    }
    @PostMapping("/courses") public TeacherCourseResponse createCourse(@Valid @RequestBody TeacherRequests.Course request, HttpSession session) {
        AuthResponse teacher = teacher(session); validCategory(request.categoryId(), teacher.organizationId());
        Long courseId = repository.createCourse(request, teacher.id(), teacher.organizationId());
        audit.record(AuditAction.COURSE_SUBMITTED, teacher.organizationId(), teacher.id(), teacher.fullName(), "COURSE", request.title().trim(), courseId, null, null);
        return repository.course(courseId, teacher.id()).orElseThrow();
    }
    @PatchMapping("/courses/{id}") public TeacherCourseResponse updateCourse(@PathVariable Long id, @Valid @RequestBody TeacherRequests.Course request, HttpSession session) {
        AuthResponse teacher = teacher(session); TeacherCourseResponse course = requireCourse(id, teacher); validCategory(request.categoryId(), teacher.organizationId()); repository.updateCourse(id, request, teacher.id()); audit.record(AuditAction.COURSE_SUBMITTED, teacher.organizationId(), teacher.id(), teacher.fullName(), "COURSE", course.title(), id, null, null); return requireCourse(id, teacher);
    }
    @GetMapping("/courses/{courseId}/content") public List<Map<String,Object>> content(@PathVariable Long courseId, HttpSession session) { requireCourse(courseId, teacher(session)); return repository.content(courseId); }
    @PostMapping("/content") public void addContent(@Valid @RequestBody TeacherRequests.Content request, HttpSession session) { requireCourse(request.courseId(), teacher(session)); repository.addContent(request); }
    @PostMapping("/content/pdf")
    public void addPdfContent(@RequestParam Long courseId, @RequestParam String title, @RequestParam MultipartFile file, HttpSession session) {
        requireCourse(courseId, teacher(session));
        if (title == null || title.isBlank() || title.length() > 180) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A PDF title is required.");
        try {
            repository.addContent(new TeacherRequests.Content(courseId, title, TeacherRequests.ContentType.PDF, "file:" + fileStorage.storePdf(file)));
        } catch (IllegalArgumentException | IllegalStateException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, exception.getMessage());
        }
    }
    @GetMapping("/assignments") public List<Map<String,Object>> assignments(HttpSession session) { return repository.assignments(teacher(session).id()); }
    @PostMapping("/assignments") public void addAssignment(@Valid @RequestBody TeacherRequests.Assignment request, HttpSession session) { requireCourse(request.courseId(), teacher(session)); repository.addAssignment(request); }
    @PatchMapping("/assignments/{id}/publish") public void publishAssignment(@PathVariable Long id, HttpSession session) { if (!repository.publishAssignment(id, teacher(session).id())) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Assignment not found."); }
    @PatchMapping("/assignments/{id}") public void updateAssignment(@PathVariable Long id, @Valid @RequestBody TeacherRequests.Assignment request, HttpSession session) { repository.updateAssignment(id, request, teacher(session).id()); }
    @GetMapping("/quizzes") public List<Map<String,Object>> quizzes(HttpSession session) { return repository.quizzes(teacher(session).id()); }
    @PostMapping("/quizzes") public void addQuiz(@Valid @RequestBody TeacherRequests.Quiz request, HttpSession session) { requireCourse(request.courseId(), teacher(session)); repository.addQuiz(request); }
    @GetMapping("/quizzes/{quizId}/questions") public List<TeacherQuizQuestionResponse> quizQuestions(@PathVariable Long quizId, HttpSession session) { AuthResponse teacher = teacher(session); if (!repository.ownsQuiz(quizId, teacher.id())) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Quiz not found."); return repository.quizQuestions(quizId); }
    @PostMapping("/quizzes/{quizId}/questions") public void addQuizQuestion(@PathVariable Long quizId, @Valid @RequestBody TeacherRequests.QuizQuestion request, HttpSession session) { AuthResponse teacher = teacher(session); if (!repository.ownsQuiz(quizId, teacher.id())) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Quiz not found."); if (!request.options().stream().map(String::trim).anyMatch(option -> option.equals(request.correctAnswer().trim()))) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The correct answer must be one of the options."); repository.addQuizQuestion(quizId, request); }
    @PatchMapping("/quizzes/{quizId}/publish") public void publishQuiz(@PathVariable Long quizId, HttpSession session) { if (!repository.publishQuiz(quizId, teacher(session).id())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Add at least one question before publishing this quiz."); }
    @GetMapping("/courses/{courseId}/analytics") public TeacherCourseAnalyticsResponse analytics(@PathVariable Long courseId, HttpSession session) { requireCourse(courseId, teacher(session)); return repository.analytics(courseId); }
    @GetMapping("/assignments/{assignmentId}/submissions") public List<Map<String,Object>> submissions(@PathVariable Long assignmentId, HttpSession session) { return repository.submissions(assignmentId, teacher(session).id()); }
    @GetMapping("/students/progress") public List<Map<String, Object>> studentProgress(HttpSession session) { return repository.studentProgress(teacher(session).id()); }
    @PatchMapping("/submissions/{submissionId}/grade") public void grade(@PathVariable Long submissionId, @Valid @RequestBody TeacherRequests.Grade request, HttpSession session) {
        AuthResponse teacher = teacher(session);
        if (!repository.canGrade(submissionId, request.score(), teacher.id())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Submission not found or score exceeds the assignment maximum.");
        }
        repository.grade(submissionId, request, teacher.id());
        java.util.Map<String, Object> context = repository.assignmentContext(submissionId);
        Number maxScore = (Number) context.get("max_score");
        int percentage = maxScore != null && maxScore.doubleValue() > 0
                ? (int) Math.round(request.score() * 100.0 / maxScore.doubleValue()) : 0;
        audit.record(AuditAction.ASSIGNMENT_GRADED, numberlong(context.get("organization_id")), teacher.id(), teacher.fullName(),
                "ASSIGNMENT", (String) context.get("title"), numberlong(context.get("course_id")), numberlong(context.get("student_id")), percentage + "%");
    }
    @GetMapping("/assignments/{assignmentId}/questions")
    public List<Map<String, Object>> assignmentQuestions(@PathVariable Long assignmentId, HttpSession session) {
        AuthResponse teacher = teacher(session);
        if (!repository.ownsAssignment(assignmentId, teacher.id())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Assignment not found.");
        }
        return repository.assignmentQuestions(assignmentId);
    }

    @PostMapping("/assignments/{assignmentId}/questions")
    public void addAssignmentQuestion(@PathVariable Long assignmentId, @RequestBody Map<String, String> request, HttpSession session) {
        AuthResponse teacher = teacher(session);
        if (!repository.ownsAssignment(assignmentId, teacher.id())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Assignment not found.");
        }
        String questionText = request.get("questionText");
        if (questionText == null || questionText.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Question text cannot be blank.");
        }
        repository.addAssignmentQuestion(assignmentId, questionText);
    }

    @DeleteMapping("/assignments/{assignmentId}/questions/{questionId}")
    public void deleteAssignmentQuestion(@PathVariable Long assignmentId, @PathVariable Long questionId, HttpSession session) {
        AuthResponse teacher = teacher(session);
        if (!repository.ownsAssignment(assignmentId, teacher.id())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Assignment not found.");
        }
        repository.deleteAssignmentQuestion(questionId, assignmentId);
    }

    @GetMapping("/submissions/{submissionId}/answers")
    public List<Map<String, Object>> submissionAnswers(@PathVariable Long submissionId, HttpSession session) {
        teacher(session);
        return repository.submissionAnswers(submissionId);
    }

    @GetMapping("/announcements") public List<Map<String,Object>> announcements(HttpSession session) { return repository.announcements(teacher(session).id()); }
    @PostMapping("/announcements") public void announce(@Valid @RequestBody TeacherRequests.Announcement request, HttpSession session) { requireCourse(request.courseId(), teacher(session)); repository.announce(request); }
    @DeleteMapping("/content/{id}") public void deleteContent(@PathVariable Long id, HttpSession session) {
        AuthResponse teacher = teacher(session);
        repository.contentFile(id, teacher.id()).ifPresent(fileStorage::delete);
        repository.deleteContent(id, teacher.id());
    }
    @PatchMapping("/content/{id}") public void updateContent(@PathVariable Long id, @Valid @RequestBody TeacherRequests.Content request, HttpSession session) {
        AuthResponse teacher = teacher(session);
        if (request.type() != TeacherRequests.ContentType.PDF) {
            repository.contentFile(id, teacher.id()).ifPresent(fileStorage::delete);
        }
        repository.updateContent(id, request, teacher.id());
    }
    @DeleteMapping("/quizzes/{id}") public void deleteQuiz(@PathVariable Long id, HttpSession session) { repository.deleteQuiz(id, teacher(session).id()); }
    @DeleteMapping("/assignments/{id}") public void deleteAssignment(@PathVariable Long id, HttpSession session) { repository.deleteAssignment(id, teacher(session).id()); }
    @DeleteMapping("/announcements/{id}") public void deleteAnnouncement(@PathVariable Long id, HttpSession session) { repository.deleteAnnouncement(id, teacher(session).id()); }
    @DeleteMapping("/quizzes/{quizId}/questions/{questionId}") public void deleteQuizQuestion(@PathVariable Long quizId, @PathVariable Long questionId, HttpSession session) { repository.deleteQuizQuestion(questionId, quizId, teacher(session).id()); }

    @GetMapping("/quizzes/{quizId}/submissions")
    public List<Map<String, Object>> quizSubmissions(@PathVariable Long quizId, HttpSession session) {
        AuthResponse teacher = teacher(session);
        if (!repository.ownsQuiz(quizId, teacher.id())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Quiz not found.");
        }
        return repository.quizSubmissions(quizId);
    }

    @GetMapping("/quiz-submissions/{submissionId}/answers")
    public List<Map<String, Object>> quizSubmissionAnswers(@PathVariable Long submissionId, HttpSession session) {
        AuthResponse teacher = teacher(session);
        if (!repository.ownsQuizSubmission(submissionId, teacher.id())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Quiz submission not found.");
        }
        return repository.quizSubmissionAnswers(submissionId);
    }

    private AuthResponse teacher(HttpSession session) {
        Object user = session.getAttribute(USER_SESSION_KEY);
        if (user instanceof AuthResponse response && response.role() == Role.TEACHER) return response;
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Teacher access is required.");
    }
    private TeacherCourseResponse requireCourse(Long id, AuthResponse teacher) { return repository.course(id, teacher.id()).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found.")); }
    private void validCategory(Long categoryId, Long organizationId) { if (categoryId != null && repository.categories(organizationId).stream().noneMatch(row -> categoryId.equals(row[0]))) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Category not found."); }
    private Long numberlong(Object value) { return value instanceof Number number ? number.longValue() : null; }
}
