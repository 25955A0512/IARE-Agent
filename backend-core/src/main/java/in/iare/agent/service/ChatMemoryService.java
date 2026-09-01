package in.iare.agent.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import in.iare.agent.dto.ChatMessageDto;
import in.iare.agent.dto.ChatSessionDto;
import in.iare.agent.model.ChatMessage;
import in.iare.agent.model.ChatSession;
import in.iare.agent.model.User;
import in.iare.agent.repository.ChatMessageRepository;
import in.iare.agent.repository.ChatSessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service for persistent conversation memory across sessions.
 *
 * Rules:
 * - Stores every user and assistant message per user in Supabase.
 * - Retrieves recent conversation context (last ~15-20 messages) for prompt continuity.
 * - Summarizes older history into a compact memory note (`summaryMemory`) when message count exceeds 20.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ChatMemoryService {

    private final ChatSessionRepository sessionRepository;
    private final ChatMessageRepository messageRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public ChatSession getOrCreateSession(String sessionId, User user, String initialMessage) {
        if (sessionId != null && !sessionId.isBlank()) {
            Optional<ChatSession> existing = sessionRepository.findByIdAndUser(sessionId, user);
            if (existing.isPresent()) {
                return existing.get();
            }
        }

        String newId = (sessionId != null && !sessionId.isBlank()) ? sessionId : UUID.randomUUID().toString();
        String title = generateTitleFromMessage(initialMessage);

        ChatSession session = ChatSession.builder()
                .id(newId)
                .user(user)
                .title(title)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        return sessionRepository.save(session);
    }

    @Transactional(readOnly = true)
    public List<ChatSessionDto> getUserSessions(User user) {
        List<ChatSession> sessions = sessionRepository.findByUserOrderByUpdatedAtDesc(user);
        return sessions.stream().map(this::toSessionDtoWithoutMessages).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ChatSessionDto getSessionWithMessages(String sessionId, User user) {
        ChatSession session = sessionRepository.findByIdAndUser(sessionId, user)
                .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));

        List<ChatMessage> messages = messageRepository.findBySessionOrderByCreatedAtAsc(session);
        List<ChatMessageDto> msgDtos = messages.stream().map(this::toMessageDto).collect(Collectors.toList());

        ChatSessionDto dto = toSessionDtoWithoutMessages(session);
        dto.setMessages(msgDtos);
        dto.setMessageCount(msgDtos.size());
        if (!msgDtos.isEmpty()) {
            dto.setLastMessageSnippet(msgDtos.get(msgDtos.size() - 1).getContent());
        }
        return dto;
    }

    @Transactional
    public ChatMessage saveUserMessage(ChatSession session, User user, String content, String mode) {
        ChatMessage msg = ChatMessage.builder()
                .session(session)
                .user(user)
                .role("user")
                .content(content)
                .mode(mode != null ? mode : "text")
                .agentType("user")
                .createdAt(Instant.now())
                .build();

        ChatMessage saved = messageRepository.save(msg);
        session.setUpdatedAt(Instant.now());
        if ("New Conversation".equals(session.getTitle())) {
            session.setTitle(generateTitleFromMessage(content));
        }
        sessionRepository.save(session);
        return saved;
    }

    @Transactional
    public ChatMessage saveAssistantMessage(
            ChatSession session,
            User user,
            String content,
            String mode,
            String agentType,
            String navResultJson
    ) {
        ChatMessage msg = ChatMessage.builder()
                .session(session)
                .user(user)
                .role("assistant")
                .content(content)
                .mode(mode != null ? mode : "text")
                .agentType(agentType != null ? agentType : "general_assistant")
                .navResultJson(navResultJson)
                .createdAt(Instant.now())
                .build();

        ChatMessage saved = messageRepository.save(msg);
        session.setUpdatedAt(Instant.now());

        // Check if message count threshold reached to compact older memory
        compactSessionMemoryIfNeeded(session);

        sessionRepository.save(session);
        return saved;
    }

    @Transactional
    public void deleteSession(String sessionId, User user) {
        ChatSession session = sessionRepository.findByIdAndUser(sessionId, user)
                .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));
        sessionRepository.delete(session);
    }

    /**
     * Extracts recent conversation turns (up to 20) and memory summary for AI prompt context.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getConversationContextForAI(ChatSession session) {
        Map<String, Object> context = new HashMap<>();
        if (session == null) {
            return context;
        }

        context.put("session_id", session.getId());
        if (session.getSummaryMemory() != null && !session.getSummaryMemory().isBlank()) {
            context.put("summary_memory", session.getSummaryMemory());
        }

        List<ChatMessage> allMessages = messageRepository.findBySessionOrderByCreatedAtAsc(session);
        // Take last 20 messages
        int startIndex = Math.max(0, allMessages.size() - 20);
        List<ChatMessage> recent = allMessages.subList(startIndex, allMessages.size());

        List<Map<String, String>> messageHistory = recent.stream().map(m -> {
            Map<String, String> item = new HashMap<>();
            item.put("role", m.getRole());
            item.put("content", m.getContent());
            return item;
        }).collect(Collectors.toList());

        context.put("recent_messages", messageHistory);
        return context;
    }

    /**
     * Compacts older conversation history (beyond 20 messages) into a concise summary.
     */
    private void compactSessionMemoryIfNeeded(ChatSession session) {
        List<ChatMessage> all = messageRepository.findBySessionOrderByCreatedAtAsc(session);
        if (all.size() <= 20) {
            return;
        }

        int olderCount = all.size() - 15;
        List<ChatMessage> olderMessages = all.subList(0, olderCount);

        StringBuilder sb = new StringBuilder();
        if (session.getSummaryMemory() != null && !session.getSummaryMemory().isBlank()) {
            sb.append(session.getSummaryMemory()).append("\n");
        }

        sb.append("Key topics discussed previously:\n");
        for (ChatMessage m : olderMessages) {
            String role = m.getRole().equalsIgnoreCase("user") ? "Student" : "Assistant";
            String preview = m.getContent().length() > 100 ? m.getContent().substring(0, 100) + "..." : m.getContent();
            sb.append("• ").append(role).append(": ").append(preview.replaceAll("\\n", " ")).append("\n");
        }

        String summary = sb.toString();
        if (summary.length() > 1500) {
            summary = summary.substring(summary.length() - 1500);
        }
        session.setSummaryMemory(summary);
    }

    private String generateTitleFromMessage(String message) {
        if (message == null || message.isBlank()) {
            return "New Conversation";
        }
        String clean = message.trim().replaceAll("[\\n\\r]+", " ");
        if (clean.length() <= 40) {
            return clean;
        }
        return clean.substring(0, 37) + "...";
    }

    private ChatSessionDto toSessionDtoWithoutMessages(ChatSession session) {
        long count = messageRepository.countBySession(session);
        return ChatSessionDto.builder()
                .id(session.getId())
                .title(session.getTitle())
                .summaryMemory(session.getSummaryMemory())
                .messageCount((int) count)
                .createdAt(session.getCreatedAt())
                .updatedAt(session.getUpdatedAt())
                .build();
    }

    private ChatMessageDto toMessageDto(ChatMessage m) {
        Object parsedNav = null;
        if (m.getNavResultJson() != null && !m.getNavResultJson().isBlank()) {
            try {
                parsedNav = objectMapper.readValue(m.getNavResultJson(), Object.class);
            } catch (Exception ignored) {}
        }

        return ChatMessageDto.builder()
                .id(m.getId())
                .sessionId(m.getSession().getId())
                .role(m.getRole())
                .content(m.getContent())
                .mode(m.getMode())
                .agentType(m.getAgentType())
                .navResult(parsedNav)
                .createdAt(m.getCreatedAt())
                .build();
    }
}
