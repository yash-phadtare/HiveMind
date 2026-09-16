package com.lms.backend.config;

import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

import org.springframework.stereotype.Component;

@Component
public class AuthRateLimiter {
    private static final int MAX_ATTEMPTS = 10;
    private static final Duration WINDOW = Duration.ofMinutes(15);

    private final ConcurrentMap<String, Deque<Long>> attempts = new ConcurrentHashMap<>();

    public boolean allow(String key) {
        long now = System.currentTimeMillis();
        long cutoff = now - WINDOW.toMillis();
        Deque<Long> deque = attempts.computeIfAbsent(key, ignored -> new ArrayDeque<>());
        synchronized (deque) {
            while (!deque.isEmpty() && deque.peekFirst() < cutoff) {
                deque.pollFirst();
            }
            if (deque.size() >= MAX_ATTEMPTS) {
                return false;
            }
            deque.addLast(now);
            return true;
        }
    }

    public void reset(String key) {
        attempts.remove(key);
    }
}