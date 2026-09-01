package in.iare.agent.controller;

import in.iare.agent.dto.OnboardingSurveyRequest;
import in.iare.agent.dto.OnboardingSurveyResponse;
import in.iare.agent.model.User;
import in.iare.agent.service.OnboardingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/student/onboarding")
@RequiredArgsConstructor
@Slf4j
public class OnboardingController {

    private final OnboardingService onboardingService;

    @GetMapping
    @PreAuthorize("hasAnyRole('STUDENT', 'FACULTY', 'ADMIN')")
    public ResponseEntity<OnboardingSurveyResponse> getOnboarding(
            @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(onboardingService.getOnboarding(currentUser));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('STUDENT', 'FACULTY', 'ADMIN')")
    public ResponseEntity<OnboardingSurveyResponse> submitOnboarding(
            @RequestBody OnboardingSurveyRequest request,
            @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(onboardingService.saveOnboarding(request, currentUser));
    }

    @PutMapping
    @PreAuthorize("hasAnyRole('STUDENT', 'FACULTY', 'ADMIN')")
    public ResponseEntity<OnboardingSurveyResponse> updateOnboarding(
            @RequestBody OnboardingSurveyRequest request,
            @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(onboardingService.saveOnboarding(request, currentUser));
    }
}
