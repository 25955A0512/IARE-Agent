package in.iare.agent.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.ToString;

/** DTO for POST /api/auth/register */
@Data
@ToString(exclude = {"password"})
public class RegisterRequest {

    @NotBlank(message = "Full name is required")
    @Size(min = 2, max = 120)
    private String fullName;

    @NotBlank(message = "Roll number or email is required")
    private String email;

    @NotBlank(message = "Password is required")
    @Size(min = 6, message = "Password must be at least 6 characters")
    private String password;
}
