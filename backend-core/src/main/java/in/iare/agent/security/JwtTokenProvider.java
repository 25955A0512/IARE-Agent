package in.iare.agent.security;

import in.iare.agent.model.User;
import io.jsonwebtoken.*;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;

/**
 * JWT creation and validation.
 * Uses HMAC-SHA256 (HS256) with a secret key from environment variables.
 * Per AGENTS.md: secrets loaded from environment only, never hardcoded.
 */
@Component
@Slf4j
public class JwtTokenProvider {

    private final SecretKey key;
    private final long expiryMs;
    private final long refreshExpiryMs;

    public JwtTokenProvider(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.expiry-ms}") long expiryMs,
            @Value("${app.jwt.refresh-expiry-ms}") long refreshExpiryMs) {
        // Accept either a Base64-encoded key or a raw string (for dev convenience)
        SecretKey resolvedKey;
        try {
            resolvedKey = Keys.hmacShaKeyFor(Decoders.BASE64.decode(secret));
        } catch (Exception e) {
            // Fallback: use raw bytes (works for dev; prod should use Base64)
            resolvedKey = Keys.hmacShaKeyFor(secret.getBytes());
        }
        this.key = resolvedKey;
        this.expiryMs = expiryMs;
        this.refreshExpiryMs = refreshExpiryMs;
    }

    /** Generate a short-lived access token for an authenticated user. */
    public String generateAccessToken(User user) {
        return Jwts.builder()
                .subject(user.getEmail())
                .claim("userId", user.getId())
                .claim("role", user.getRole().name())
                .claim("name", user.getFullName())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expiryMs))
                .signWith(key)
                .compact();
    }

    /** Generate a long-lived refresh token (contains only the subject). */
    public String generateRefreshToken(User user) {
        return Jwts.builder()
                .subject(user.getEmail())
                .claim("type", "refresh")
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + refreshExpiryMs))
                .signWith(key)
                .compact();
    }

    /** Extract the subject (email) from a token, or null if invalid. */
    public String extractEmail(String token) {
        try {
            return parseToken(token).getPayload().getSubject();
        } catch (JwtException | IllegalArgumentException e) {
            log.debug("JWT extraction failed: {}", e.getMessage());
            return null;
        }
    }

    /** Validate the token — returns true only if signature is valid and not expired. */
    public boolean isValid(String token) {
        try {
            parseToken(token);
            return true;
        } catch (ExpiredJwtException e) {
            log.debug("JWT expired");
        } catch (JwtException e) {
            log.debug("JWT invalid: {}", e.getMessage());
        }
        return false;
    }

    public long getExpiryMs() { return expiryMs; }

    private Jws<Claims> parseToken(String token) {
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token);
    }
}
