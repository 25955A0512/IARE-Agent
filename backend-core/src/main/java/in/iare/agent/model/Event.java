package in.iare.agent.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * Entity representing an extracted official campus event, circular, or placement drive
 * processed from consented Telegram groups by EventIntelligenceAgent.
 */
@Entity
@Table(name = "events")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Event {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "source_telegram_group_id")
    private Long sourceTelegramGroupId;

    @Column(name = "source_telegram_message_id")
    private Long sourceTelegramMessageId;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "raw_text", columnDefinition = "TEXT")
    private String rawText;

    @Column(name = "has_image", nullable = false)
    @Builder.Default
    private boolean hasImage = false;

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    @Column(name = "event_date", length = 100)
    private String eventDate;

    @Column(name = "event_time", length = 100)
    private String eventTime;

    @Column(length = 255)
    private String location;

    @Column(length = 255)
    private String organizer;

    @Column(name = "target_semester")
    private Integer targetSemester;

    @Column(name = "target_branch", length = 100)
    private String targetBranch;

    @Column(name = "target_section", length = 20)
    private String targetSection;

    @Column(name = "target_audience_raw", length = 255)
    private String targetAudienceRaw;

    @Column(name = "is_mandatory", nullable = false)
    @Builder.Default
    private boolean mandatory = false;

    @Column(name = "registration_deadline")
    private Instant registrationDeadline;

    @Column(name = "action_url", length = 500)
    private String actionUrl;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
