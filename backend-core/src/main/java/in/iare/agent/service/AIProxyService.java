package in.iare.agent.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import in.iare.agent.dto.EventDto;
import in.iare.agent.dto.StudentDashboardResponse;
import in.iare.agent.model.AuditLog;
import in.iare.agent.model.ChatSession;
import in.iare.agent.model.StudentOnboarding;
import in.iare.agent.model.User;
import in.iare.agent.repository.StudentOnboardingRepository;
import in.iare.agent.repository.StudentProfileRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Proxies requests from authenticated users to the internal ai-service.
 * Handles persistent memory, weakness tracking, and academic context injection.
 *
 * Security contract (AGENTS.md):
 * - ai-service is INTERNAL ONLY and is never callable from web/mobile clients directly.
 * - Every call attaches the X-Internal-Secret header.
 * - This service is the only caller of ai-service from within backend-core.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AIProxyService {

    private final WebClient.Builder webClientBuilder;
    private final AuditLogService auditLogService;
    private final StudentProfileRepository profileRepository;
    private final StudentOnboardingRepository onboardingRepository;
    private final ChatMemoryService chatMemoryService;
    private final WeaknessService weaknessService;
    private final ObjectMapper objectMapper;
    private final @Lazy SamvidhaService samvidhaService;
    private final @Lazy EventService eventService;

    @Value("${app.ai-service.url}")
    private String aiServiceUrl;

    @Value("${app.ai-service.shared-secret}")
    private String sharedSecret;

    public String getNormalizedAiServiceUrl() {
        if (aiServiceUrl == null || aiServiceUrl.isBlank()) {
            return "http://127.0.0.1:8001";
        }
        String trimmed = aiServiceUrl.trim().replaceAll("/+$", "");
        if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
            if (trimmed.contains("onrender.com")) {
                trimmed = "https://" + trimmed;
            } else {
                trimmed = "http://" + trimmed;
            }
        }
        try {
            java.net.URI uri = new java.net.URI(trimmed);
            if (uri.getPort() == -1 && !trimmed.contains("onrender.com")) {
                trimmed = trimmed + ":8001";
            }
        } catch (Exception ignored) {}
        return trimmed;
    }

    /**
     * Forward a chat/navigation/general query to ai-service and return the response.
     * Integrates persistent conversation memory and student context.
     */
    public Map<String, Object> query(String message, String mode, String requestedSessionId, User caller) {
        Long userId = (caller != null) ? caller.getId() : null;
        auditLogService.log(userId, AuditLog.EventType.AGENT_QUERY,
                "{\"mode\":\"" + mode + "\"}");

        ChatSession session = null;
        if (caller != null) {
            session = chatMemoryService.getOrCreateSession(requestedSessionId, caller, message);
            chatMemoryService.saveUserMessage(session, caller, message, mode);
        }

        try {
            String targetUrl = getNormalizedAiServiceUrl();
            WebClient client = webClientBuilder.baseUrl(targetUrl).build();

            Map<String, Object> payload = new HashMap<>();
            payload.put("message", message);
            payload.put("mode", mode);

            if (session != null) {
                Map<String, Object> convContext = chatMemoryService.getConversationContextForAI(session);
                payload.putAll(convContext);
            }

            // Attach student academic context & weak topics if available
            if (caller != null) {
                profileRepository.findByUser(caller).ifPresent(profile -> {
                    try {
                        StudentDashboardResponse dash = samvidhaService.getStudentDashboard(profile.getRollNo());
                        payload.put("student_context", dash);
                    } catch (Exception e) {
                        log.debug("Could not attach student context: {}", e.getMessage());
                    }
                });

                // Attach onboarding survey context
                onboardingRepository.findByUser(caller).ifPresent(ob -> {
                    Map<String, Object> obMap = new HashMap<>();
                    obMap.put("semester", ob.getSemester());
                    obMap.put("branch", ob.getBranch());
                    obMap.put("section", ob.getSection());
                    obMap.put("enrolled_courses", ob.getEnrolledCourses());
                    obMap.put("difficult_subjects", ob.getDifficultSubjects());
                    obMap.put("college_goals", ob.getCollegeGoals());
                    payload.put("onboarding_context", obMap);
                });

                // Attach detected weak areas
                List<String> weakTopics = weaknessService.getWeakTopicsForStudent(caller);
                if (!weakTopics.isEmpty()) {
                    payload.put("weak_topics", weakTopics);
                }

                // Attach active cohort events & circulars from Telegram Event Intelligence
                try {
                    List<EventDto> activeEvents = eventService.getEventsForStudent(caller, false, false);
                    if (activeEvents != null && !activeEvents.isEmpty()) {
                        payload.put("active_events", activeEvents);
                    }
                } catch (Exception e) {
                    log.debug("Could not attach active events: {}", e.getMessage());
                }
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> response = client.post()
                    .uri("/internal/chat")
                    .header("X-Internal-Secret", sharedSecret)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(payload)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, resp ->
                            resp.bodyToMono(String.class)
                                    .flatMap(body -> Mono.error(
                                            new RuntimeException("AI Service error (" + resp.statusCode() + "): " + body))))
                    .bodyToMono(Map.class)
                    .block();

            if (response == null) {
                response = new HashMap<>();
                response.put("success", false);
                response.put("message", "Empty response from AI service");
            }

            // Extract assistant text and metadata
            String answer = (String) response.getOrDefault("message", "");
            String agentType = (String) response.getOrDefault("agent", "general_assistant");

            // Extract tagged topic for weakness tracking
            Object topicObj = response.get("topic");
            Object subjectObj = response.get("subject");
            if (topicObj != null && caller != null) {
                String taggedTopic = topicObj.toString();
                String taggedSubject = (subjectObj != null) ? subjectObj.toString() : "General";
                weaknessService.recordTopicAsked(caller, taggedSubject, taggedTopic, message);
            }

            // Serialize nav result if present
            String navJson = null;
            if (response.containsKey("route_stops") && response.get("route_stops") != null) {
                try {
                    navJson = objectMapper.writeValueAsString(response);
                } catch (Exception ignored) {}
            }

            // Save assistant message to persistent memory
            if (session != null && caller != null) {
                chatMemoryService.saveAssistantMessage(session, caller, answer, mode, agentType, navJson);
                response.put("sessionId", session.getId());
                response.put("sessionTitle", session.getTitle());
            }

            return response;
        } catch (Exception e) {
            String targetUrl = getNormalizedAiServiceUrl();
            log.error("Failed to call ai-service at {}: {}", targetUrl, e.getMessage());
            throw new RuntimeException("Could not connect to AI microservice at " + targetUrl + " (" + e.getMessage() + ")");
        }
    }

    /**
     * Request a short-lived Gemini Live session token from ai-service.
     * Only the ephemeral token is returned to the client — never the raw API key.
     */
    public Map<String, Object> getGeminiLiveToken(User caller) {
        auditLogService.log(caller.getId(), AuditLog.EventType.VOICE_SESSION_REQUESTED, null);

        WebClient client = webClientBuilder.baseUrl(getNormalizedAiServiceUrl()).build();

        @SuppressWarnings("unchecked")
        Map<String, Object> response = client.post()
                .uri("/internal/gemini-live-token")
                .header("X-Internal-Secret", sharedSecret)
                .retrieve()
                .onStatus(HttpStatusCode::isError, resp ->
                        resp.bodyToMono(String.class)
                                .flatMap(body -> Mono.error(
                                        new RuntimeException("Token request failed: " + body))))
                .bodyToMono(Map.class)
                .block();

        return response;
    }

    /**
     * Proxies single in-memory Samvidha timetable scrape to internal ai-service.
     * Password is used strictly in-flight and never logged or stored.
     */
    public Map<String, Object> scrapeSamvidhaTimetable(String rollNo, String password) {
        log.info("Requesting in-memory Samvidha timetable scrape via ai-service for roll: {}", rollNo);
        WebClient client = webClientBuilder.baseUrl(getNormalizedAiServiceUrl()).build();

        Map<String, String> payload = new HashMap<>();
        payload.put("roll_no", rollNo);
        payload.put("password", password);

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = client.post()
                    .uri("/internal/samvidha/scrape-timetable")
                    .header("X-Internal-Secret", sharedSecret)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(payload)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, resp ->
                            resp.bodyToMono(String.class)
                                    .flatMap(body -> Mono.error(
                                            new RuntimeException("Scrape error (" + resp.statusCode() + "): " + body))))
                    .bodyToMono(Map.class)
                    .block();

            return (response != null) ? response : Map.of("success", false, "error", "Couldn't connect to Samvidha right now — you can try again later or skip this step");
        } catch (Exception e) {
            log.warn("Samvidha timetable scrape proxy error for {}: {}", rollNo, e.getMessage());
            return Map.of("success", false, "error", "Couldn't connect to Samvidha right now — you can try again later or skip this step");
        }
    }
}
