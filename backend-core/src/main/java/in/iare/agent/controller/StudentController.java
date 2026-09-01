package in.iare.agent.controller;

import in.iare.agent.dto.SamvidhaSyncRequest;
import in.iare.agent.dto.StudentDashboardResponse;
import in.iare.agent.model.StudentProfile;
import in.iare.agent.model.User;
import in.iare.agent.repository.StudentProfileRepository;
import in.iare.agent.service.SamvidhaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/student")
@RequiredArgsConstructor
@Slf4j
public class StudentController {

    private final SamvidhaService samvidhaService;
    private final StudentProfileRepository profileRepository;

    /**
     * Trigger background synchronization with Samvidha for a student.
     * Takes roll number and password, connects in background, and ingests academic data.
     */
    @PostMapping("/samvidha-sync")
    @PreAuthorize("hasAnyRole('STUDENT', 'FACULTY', 'ADMIN')")
    public ResponseEntity<StudentDashboardResponse> syncSamvidha(
            @Valid @RequestBody SamvidhaSyncRequest request,
            @AuthenticationPrincipal User currentUser) {

        StudentDashboardResponse response = samvidhaService.syncStudentData(request, currentUser);
        return ResponseEntity.ok(response);
    }

    /**
     * Retrieve the real-time student monitoring dashboard.
     */
    @GetMapping("/dashboard")
    @PreAuthorize("hasAnyRole('STUDENT', 'FACULTY', 'ADMIN')")
    public ResponseEntity<StudentDashboardResponse> getDashboard(
            @RequestParam(required = false) String rollNo,
            @AuthenticationPrincipal User currentUser) {

        String targetRoll = rollNo;
        if (targetRoll == null || targetRoll.isBlank()) {
            if (currentUser != null) {
                targetRoll = profileRepository.findByUser(currentUser)
                        .map(StudentProfile::getRollNo)
                        .orElse(null);

                if (targetRoll == null && currentUser.getEmail() != null) {
                    // Try extracting roll number from email e.g. 21951A0501@iare.ac.in
                    String email = currentUser.getEmail();
                    if (email.contains("@")) {
                        targetRoll = email.substring(0, email.indexOf("@")).toUpperCase();
                    }
                }
            }
        }

        if (targetRoll == null || targetRoll.isBlank()) {
            targetRoll = "21951A0501"; // default sample roll for demo
        }

        try {
            StudentDashboardResponse response = samvidhaService.getStudentDashboard(targetRoll);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            // If profile doesn't exist yet, do an initial sync
            StudentDashboardResponse response = samvidhaService.syncStudentData(
                    SamvidhaSyncRequest.builder().rollNo(targetRoll).password("").consent(true).build(),
                    currentUser
            );
            return ResponseEntity.ok(response);
        }
    }
}
