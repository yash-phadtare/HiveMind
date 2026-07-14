package com.lms.backend.admin;

import java.time.LocalDateTime;

public record AdminCourseResponse(Long id, String title, String description, Long teacherId, String teacherName,
        Long categoryId, String categoryName, CourseStatus status, LocalDateTime createdAt) {
}
