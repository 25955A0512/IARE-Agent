package in.iare.agent.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString(exclude = {"password"})
public class SamvidhaSyncRequest {

    @NotBlank(message = "Roll number is required")
    private String rollNo;

    @NotBlank(message = "Password is required")
    private String password;

    @Builder.Default
    private Boolean consent = true;
}
