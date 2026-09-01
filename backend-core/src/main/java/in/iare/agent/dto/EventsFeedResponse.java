package in.iare.agent.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EventsFeedResponse {
    private List<EventDto> events;
    private int totalCount;
    private int mandatoryCount;
    private List<StudentNotificationDto> unreadNotifications;
}
