package com.lms.backend.teacher;

import java.util.List;

public record TeacherQuizQuestionResponse(Long id, String questionText, List<String> options,
        String correctAnswer, int points) {
}
