package in.iare.agent.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.ToString;

/**
 * DTO for POST /api/auth/login.
 * Accepts roll number (e.g. 21951A0501), email, or username.
 */
@Data
@ToString(exclude = {"password"})
public class LoginRequest {

    @NotBlank(message = "Roll number or email is required")
    private String email;

    @NotBlank(message = "Password is required")
    private String password;
}
