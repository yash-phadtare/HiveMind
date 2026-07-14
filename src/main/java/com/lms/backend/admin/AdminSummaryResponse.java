package com.lms.backend.admin;

public record AdminSummaryResponse(long totalUsers, long activeStudents, long activeTeachers, long pendingTeachers,
        long totalCourses, long pendingCourses, long totalEnrollments, long totalQuizzes) {
}
