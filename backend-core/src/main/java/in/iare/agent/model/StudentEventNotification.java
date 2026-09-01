package in.iare.agent.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * Entity representing an in-app priority notification or reminder for a student
 * triggered by mandatory Telegram events/circulars.
 */
@Entity
@Table(name = "student_event_notifications")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentEventNotification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "event_id", nullable = false)
    private Event event;

    @Column(name = "notification_type", nullable = false, length = 50)
    private String notificationType; // 'IMMEDIATE_ALERT', 'UPCOMING_REMINDER'

    @Column(nullable = false, length = 255)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    @Column(name = "is_read", nullable = false)
    @Builder.Default
    private boolean read = false;

    @Column(name = "scheduled_for")
    private Instant scheduledFor;

    @Column(name = "sent_at", nullable = false)
    @Builder.Default
    private Instant sentAt = Instant.now();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
