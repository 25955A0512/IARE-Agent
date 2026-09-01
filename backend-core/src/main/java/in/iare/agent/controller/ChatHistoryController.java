package in.iare.agent.controller;

import in.iare.agent.dto.ChatHistoryResponse;
import in.iare.agent.dto.ChatSessionDto;
import in.iare.agent.model.ChatSession;
import in.iare.agent.model.User;
import in.iare.agent.service.ChatMemoryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
@Slf4j
public class ChatHistoryController {

    private final ChatMemoryService chatMemoryService;

    @GetMapping("/sessions")
    @PreAuthorize("hasAnyRole('STUDENT', 'FACULTY', 'ADMIN')")
    public ResponseEntity<ChatHistoryResponse> getSessions(
            @AuthenticationPrincipal User currentUser) {
        List<ChatSessionDto> sessions = chatMemoryService.getUserSessions(currentUser);
        return ResponseEntity.ok(ChatHistoryResponse.builder()
                .sessions(sessions)
                .totalSessions(sessions.size())
                .build());
    }

    @GetMapping("/sessions/{sessionId}")
    @PreAuthorize("hasAnyRole('STUDENT', 'FACULTY', 'ADMIN')")
    public ResponseEntity<ChatSessionDto> getSession(
            @PathVariable String sessionId,
            @AuthenticationPrincipal User currentUser) {
        ChatSessionDto session = chatMemoryService.getSessionWithMessages(sessionId, currentUser);
        return ResponseEntity.ok(session);
    }

    @PostMapping("/sessions")
    @PreAuthorize("hasAnyRole('STUDENT', 'FACULTY', 'ADMIN')")
    public ResponseEntity<ChatSessionDto> createSession(
            @RequestBody(required = false) Map<String, String> body,
            @AuthenticationPrincipal User currentUser) {
        String title = (body != null && body.containsKey("title")) ? body.get("title") : "New Conversation";
        ChatSession session = chatMemoryService.getOrCreateSession(null, currentUser, title);
        return ResponseEntity.ok(chatMemoryService.getSessionWithMessages(session.getId(), currentUser));
    }

    @DeleteMapping("/sessions/{sessionId}")
    @PreAuthorize("hasAnyRole('STUDENT', 'FACULTY', 'ADMIN')")
    public ResponseEntity<Map<String, Object>> deleteSession(
            @PathVariable String sessionId,
            @AuthenticationPrincipal User currentUser) {
        chatMemoryService.deleteSession(sessionId, currentUser);
        return ResponseEntity.ok(Map.of("success", true, "deletedSessionId", sessionId));
    }
}
