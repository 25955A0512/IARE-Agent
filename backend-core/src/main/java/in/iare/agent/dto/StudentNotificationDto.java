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
public class StudentNotificationDto {
    private Long id;
    private Long eventId;
    private String eventTitle;
    private String eventDate;
    private String eventLocation;
    private String actionUrl;
    private boolean mandatory;
    private String notificationType;
    private String title;
    private String message;
    private boolean read;
    private Instant scheduledFor;
    private Instant sentAt;
    private Instant createdAt;
}
