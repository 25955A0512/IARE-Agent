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
public class ChatMessageDto {
    private Long id;
    private String sessionId;
    private String role;
    private String content;
    private String mode;
    private String agentType;
    private Object navResult;
    private Instant createdAt;
}
