package in.iare.agent.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatSessionDto {
    private String id;
    private String title;
    private String summaryMemory;
    private int messageCount;
    private String lastMessageSnippet;
    private Instant createdAt;
    private Instant updatedAt;
    private List<ChatMessageDto> messages;
}
