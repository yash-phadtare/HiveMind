package com.lms.backend.content;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class ContentFileStorage {
    private final Path uploadDirectory;

    public ContentFileStorage(@Value("${app.content-upload-dir:uploads/content}") String uploadDirectory) {
        this.uploadDirectory = Path.of(uploadDirectory).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.uploadDirectory);
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to create the content upload directory.", exception);
        }
    }

    public String storePdf(MultipartFile file) {
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("Choose a PDF file to upload.");
        String originalName = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase();
        if (!"application/pdf".equalsIgnoreCase(file.getContentType()) && !originalName.endsWith(".pdf")) {
            throw new IllegalArgumentException("Only PDF files can be uploaded.");
        }
        if (file.getSize() > 20L * 1024 * 1024) throw new IllegalArgumentException("PDF files must be 20 MB or smaller.");
        String filename = UUID.randomUUID() + ".pdf";
        try {
            Files.copy(file.getInputStream(), uploadDirectory.resolve(filename), StandardCopyOption.REPLACE_EXISTING);
            return filename;
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to save the PDF file.", exception);
        }
    }

    public Resource load(String filename) {
        try {
            Path file = uploadDirectory.resolve(filename).normalize();
            if (!file.startsWith(uploadDirectory) || !Files.isRegularFile(file)) throw new IllegalArgumentException("File not found.");
            return new UrlResource(file.toUri());
        } catch (IOException exception) {
            throw new IllegalArgumentException("File not found.", exception);
        }
    }

    public void delete(String filename) {
        if (filename == null || filename.isBlank()) return;
        Path file = uploadDirectory.resolve(Path.of(filename).getFileName().toString()).normalize();
        if (!file.startsWith(uploadDirectory)) return;
        try {
            Files.deleteIfExists(file);
        } catch (IOException ignored) {
            // Best-effort cleanup; an orphaned file is preferable to failing the request.
        }
    }
}
