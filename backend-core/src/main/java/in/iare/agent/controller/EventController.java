package in.iare.agent.controller;

import in.iare.agent.dto.EventDto;
import in.iare.agent.dto.EventIngestRequest;
import in.iare.agent.dto.EventsFeedResponse;
import in.iare.agent.dto.StudentNotificationDto;
import in.iare.agent.model.User;
import in.iare.agent.service.EventService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Controller for Telegram Event Intelligence, Circulars feed, and Priority Notifications.
 */
@RestController
@RequestMapping("/api/events")
@RequiredArgsConstructor
@Slf4j
public class EventController {

    private final EventService eventService;

    @Value("${app.ai-service.shared-secret:CHANGE-ME-INTERNAL-SECRET}")
    private String sharedSecret;

    @GetMapping
    @PreAuthorize("hasAnyRole('STUDENT', 'FACULTY', 'ADMIN')")
    public ResponseEntity<EventsFeedResponse> getEventsFeed(
            @RequestParam(required = false, defaultValue = "false") boolean mandatoryOnly,
            @AuthenticationPrincipal User currentUser) {
        EventsFeedResponse feed = eventService.getEventsFeed(currentUser, mandatoryOnly);
        return ResponseEntity.ok(feed);
    }

    @GetMapping("/notifications")
    @PreAuthorize("hasAnyRole('STUDENT', 'FACULTY', 'ADMIN')")
    public ResponseEntity<List<StudentNotificationDto>> getUnreadNotifications(
            @AuthenticationPrincipal User currentUser) {
        List<StudentNotificationDto> notifications = eventService.getUnreadNotifications(currentUser);
        return ResponseEntity.ok(notifications);
    }

    @PostMapping("/notifications/{id}/read")
    @PreAuthorize("hasAnyRole('STUDENT', 'FACULTY', 'ADMIN')")
    public ResponseEntity<Map<String, Object>> markNotificationRead(
            @PathVariable Long id,
            @AuthenticationPrincipal User currentUser) {
        eventService.markNotificationAsRead(id, currentUser);
        return ResponseEntity.ok(Map.of("success", true, "notificationId", id));
    }

    @PostMapping("/internal/ingest")
    public ResponseEntity<EventDto> ingestEventFromAiService(
            @RequestHeader(value = "X-Internal-Secret", required = false) String secretHeader,
            @RequestBody EventIngestRequest request) {

        if (secretHeader == null || !secretHeader.equals(sharedSecret)) {
            log.warn("Unauthorized event ingest attempt rejected (invalid X-Internal-Secret)");
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        EventDto created = eventService.ingestEvent(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @DeleteMapping("/internal/clear-all")
    public ResponseEntity<Map<String, Object>> clearAllEvents(
            @RequestHeader(value = "X-Internal-Secret", required = false) String secretHeader) {
        if (secretHeader == null || !secretHeader.equals(sharedSecret)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        eventService.clearAllEvents();
        return ResponseEntity.ok(Map.of("success", true, "message", "Cleared all events"));
    }
}
