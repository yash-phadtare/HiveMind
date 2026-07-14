package com.lms.backend.teacher;

import java.time.LocalDateTime;
import java.util.List;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class TeacherRequests {
    private TeacherRequests() { }

    public record Course(@NotBlank @Size(max = 180) String title, @Size(max = 10000) String description, Long categoryId) { }
    public record Content(@NotNull Long courseId, @NotBlank @Size(max = 180) String title,
            @NotNull ContentType type, @Size(max = 10000) String body) { }
    public record Assignment(@NotNull Long courseId, @NotBlank @Size(max = 180) String title,
            @Size(max = 10000) String instructions, LocalDateTime dueAt,
            @NotNull @Min(1) @Max(10000) Integer maxScore) { }
    public record Quiz(@NotNull Long courseId, @NotBlank @Size(max = 180) String title,
            @Size(max = 5000) String description) { }
    public record QuizQuestion(@NotBlank @Size(max = 10000) String questionText,
            @NotNull @Size(min = 2, max = 8) List<@NotBlank @Size(max = 1000) String> options,
            @NotBlank @Size(max = 1000) String correctAnswer, @NotNull @Min(1) @Max(100) Integer points) { }
    public record Grade(@NotNull @Min(0) Double score, @Size(max = 5000) String feedback) { }
    public record Announcement(@NotNull Long courseId, @NotBlank @Size(max = 180) String title,
            @NotBlank @Size(max = 10000) String message) { }

    public enum ContentType { LESSON, NOTE, PDF, VIDEO }
}
