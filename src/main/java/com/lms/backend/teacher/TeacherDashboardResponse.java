package com.lms.backend.teacher;

public record TeacherDashboardResponse(long courses, long pendingCourses, long students, long lessons,
        long assignments, long quizzes, long submissionsToGrade) {
}
