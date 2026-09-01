package in.iare.agent.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Unified auth response carrying access + refresh tokens. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthResponse {
    private String accessToken;
    private String refreshToken;
    @Builder.Default
    private String tokenType = "Bearer";
    private long expiresIn;   // seconds
    private String email;
    private String fullName;
    private String role;
    private String rollNo;
    private String profilePhotoUrl;
    private boolean onboardingCompleted;
}
