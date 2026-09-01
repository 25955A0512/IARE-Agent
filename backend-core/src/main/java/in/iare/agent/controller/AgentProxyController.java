package in.iare.agent.controller;

import in.iare.agent.dto.AgentQueryRequest;
import in.iare.agent.model.User;
import in.iare.agent.service.AIProxyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Proxy controller — forwards authenticated user queries to ai-service.
 * ai-service is NEVER called directly from the frontend (AGENTS.md requirement).
 *
 * POST /api/agent/query — requires STUDENT, FACULTY, or ADMIN role
 */
@RestController
@RequestMapping("/api/agent")
@RequiredArgsConstructor
public class AgentProxyController {

    private final AIProxyService aiProxyService;

    @PostMapping("/query")
    @PreAuthorize("hasAnyRole('STUDENT', 'FACULTY', 'ADMIN')")
    public ResponseEntity<Map<String, Object>> query(
            @Valid @RequestBody AgentQueryRequest req,
            @AuthenticationPrincipal User caller) {

        Map<String, Object> result = aiProxyService.query(
                req.getMessage(), req.getMode(), req.getSessionId(), caller);
        return ResponseEntity.ok(result);
    }
}
