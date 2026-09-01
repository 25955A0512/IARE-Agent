package in.iare.agent.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/** DTO for POST /api/agent/query */
@Data
public class AgentQueryRequest {
    @NotBlank(message = "Message cannot be empty")
    private String message;

    /** Optional: "text" (default) or "voice_fallback" */
    private String mode = "text";

    /** Optional: existing session ID for conversation continuity */
    private String sessionId;
}
