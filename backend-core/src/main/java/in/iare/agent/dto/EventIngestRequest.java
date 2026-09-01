package in.iare.agent.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Payload sent from ai-service to POST /api/events/internal/ingest.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EventIngestRequest {

    @JsonProperty("source_telegram_group_id")
    private Long sourceTelegramGroupId;

    @JsonProperty("source_telegram_message_id")
    private Long sourceTelegramMessageId;

    private String title;
    private String description;

    @JsonProperty("raw_text")
    private String rawText;

    @JsonProperty("has_image")
    @Builder.Default
    private boolean hasImage = false;

    @JsonProperty("image_url")
    private String imageUrl;

    @JsonProperty("event_date")
    private String eventDate;

    @JsonProperty("event_time")
    private String eventTime;

    private String location;
    private String organizer;

    @JsonProperty("target_semester")
    private Integer targetSemester;

    @JsonProperty("target_branch")
    private String targetBranch;

    @JsonProperty("target_section")
    private String targetSection;

    @JsonProperty("target_audience_raw")
    private String targetAudienceRaw;

    @JsonProperty("is_mandatory")
    @Builder.Default
    private boolean mandatory = false;

    @JsonProperty("registration_deadline")
    private Instant registrationDeadline;

    @JsonProperty("action_url")
    private String actionUrl;
}
