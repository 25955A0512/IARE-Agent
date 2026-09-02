package in.iare.agent.controller;

import in.iare.agent.dto.AuthResponse;
import in.iare.agent.dto.LoginRequest;
import in.iare.agent.dto.RegisterRequest;
import in.iare.agent.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Authentication endpoints (public — no JWT required).
 * POST /api/auth/register
 * POST /api/auth/login
 * POST /api/auth/refresh
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping({"/register", "/register/"})
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest req) {
        AuthResponse response = authService.register(req);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping({"/login", "/login/"})
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest req) {
        AuthResponse response = authService.login(req);
        return ResponseEntity.ok(response);
    }

    @PostMapping({"/refresh", "/refresh/"})
    public ResponseEntity<AuthResponse> refresh(@RequestBody Map<String, String> body) {
        String refreshToken = body.get("refreshToken");
        if (refreshToken == null || refreshToken.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        AuthResponse response = authService.refresh(refreshToken);
        return ResponseEntity.ok(response);
    }
}
