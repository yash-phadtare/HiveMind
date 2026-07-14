package com.lms.backend.teacher;

import com.lms.backend.admin.CourseStatus;

public record TeacherCourseResponse(Long id, String title, String description, Long categoryId, String categoryName,
        CourseStatus status, long studentCount) {
}
