package com.lms.backend.admin;

import java.util.List;

public record AdminAnalyticsResponse(long students, long teachers, long courses, long pendingCourses,
        long enrollments, long quizzes, List<CategoryAnalytics> coursesByCategory,
        List<EnrollmentAnalytics> enrollmentsByMonth) {
    public record CategoryAnalytics(String category, long courses, long enrollments) {
    }

    public record EnrollmentAnalytics(String month, long enrollments) {
    }
}
