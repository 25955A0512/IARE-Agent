package in.iare.agent.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EventDto {
    private Long id;
    private Long sourceTelegramGroupId;
    private Long sourceTelegramMessageId;
    private String title;
    private String description;
    private String rawText;
    private boolean hasImage;
    private String imageUrl;
    private String eventDate;
    private String eventTime;
    private String location;
    private String organizer;
    private Integer targetSemester;
    private String targetBranch;
    private String targetSection;
    private String targetAudienceRaw;
    private boolean mandatory;
    private Instant registrationDeadline;
    private String actionUrl;
    private Instant createdAt;
}
