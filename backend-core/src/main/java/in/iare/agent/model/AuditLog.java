package in.iare.agent.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Audit log entry. Records security-relevant events without storing sensitive content.
 * Per AGENTS.md: records who, what, when — NOT full query content.
 */
@Entity
@Table(name = "audit_log",
       indexes = {
           @Index(name = "idx_audit_user_id", columnList = "userId"),
           @Index(name = "idx_audit_created_at", columnList = "createdAt")
       })
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** The user who triggered this event (null for anonymous attempts). */
    @Column(nullable = true)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private EventType eventType;

    @Column(nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    /**
     * Non-sensitive contextual metadata as a JSON string.
     * Example: {"role":"STUDENT","ip":"127.0.0.1"}
     * Never includes passwords, tokens, or full query text.
     */
    @Column(length = 500)
    private String metadata;

    public enum EventType {
        LOGIN_SUCCESS,
        LOGIN_FAILURE,
        REGISTER,
        AGENT_QUERY,
        VOICE_SESSION_REQUESTED,
        VOICE_SESSION_MODE,
        TOKEN_REFRESH,
        SAMVIDHA_SYNC,
        ONBOARDING_COMPLETED,
        CHAT_SESSION_CREATED
    }
}
