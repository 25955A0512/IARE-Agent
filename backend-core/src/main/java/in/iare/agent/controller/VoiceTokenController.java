package in.iare.agent.controller;

import in.iare.agent.model.User;
import in.iare.agent.service.AIProxyService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Issues short-lived Gemini Live session tokens for real-time voice.
 *
 * Per AGENTS.md ephemeral-token pattern:
 * - ai-service fetches the ephemeral token from Google server-side
 * - backend-core relays ONLY the short-lived token to the authenticated client
 * - The raw GEMINI_API_KEY never leaves ai-service's environment
 *
 * GET /api/voice/session-token — requires authentication
 */
@RestController
@RequestMapping("/api/voice")
@RequiredArgsConstructor
public class VoiceTokenController {

    private final AIProxyService aiProxyService;
    private final in.iare.agent.service.AuditLogService auditLogService;

    @GetMapping("/session-token")
    @PreAuthorize("hasAnyRole('STUDENT', 'FACULTY', 'ADMIN')")
    public ResponseEntity<Map<String, Object>> getSessionToken(
            @AuthenticationPrincipal User caller) {
        Map<String, Object> tokenData = aiProxyService.getGeminiLiveToken(caller);
        return ResponseEntity.ok(tokenData);
    }

    @PostMapping("/log-mode")
    @PreAuthorize("hasAnyRole('STUDENT', 'FACULTY', 'ADMIN')")
    public ResponseEntity<Map<String, Object>> logVoiceMode(
            @RequestBody Map<String, Object> payload,
            @AuthenticationPrincipal User caller) {
        Long userId = (caller != null) ? caller.getId() : null;
        String mode = String.valueOf(payload.getOrDefault("mode", "unknown"));
        String reason = String.valueOf(payload.getOrDefault("reason", "none"));
        auditLogService.log(userId, in.iare.agent.model.AuditLog.EventType.VOICE_SESSION_MODE,
                "{\"mode\":\"" + mode + "\",\"reason\":\"" + reason + "\"}");
        return ResponseEntity.ok(Map.of("logged", true));
    }
}
