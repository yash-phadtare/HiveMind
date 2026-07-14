package com.lms.backend.teacher;

public record TeacherCourseAnalyticsResponse(Long courseId, long students, long materials,
        long assignments, long submissions, long quizzes, long quizQuestions, double averageScore) {
}
