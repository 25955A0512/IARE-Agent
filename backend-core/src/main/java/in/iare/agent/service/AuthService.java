package in.iare.agent.service;

import in.iare.agent.dto.AuthResponse;
import in.iare.agent.dto.LoginRequest;
import in.iare.agent.dto.RegisterRequest;
import in.iare.agent.dto.SamvidhaSyncRequest;
import in.iare.agent.dto.StudentDashboardResponse;
import in.iare.agent.model.AuditLog;
import in.iare.agent.model.Role;
import in.iare.agent.model.User;
import in.iare.agent.repository.UserRepository;
import in.iare.agent.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/** Handles user registration, login, token refresh, and Samvidha roll-number sign-in. */
@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final in.iare.agent.repository.StudentProfileRepository studentProfileRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final AuditLogService auditLogService;
    private final @Lazy SamvidhaService samvidhaService;

    /** Register a new student user. */
    @Transactional
    public AuthResponse register(RegisterRequest req) {
        String normalizedEmail = normalizeEmailOrRoll(req.getEmail());
        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new IllegalArgumentException("Email already registered: " + normalizedEmail);
        }

        User user = User.builder()
                .email(normalizedEmail)
                .passwordHash(passwordEncoder.encode(req.getPassword()))
                .fullName(req.getFullName().trim())
                .role(Role.STUDENT)
                .build();
        user = userRepository.save(user);

        // Auto sync Samvidha profile if roll number
        String roll = extractRollIfPresent(normalizedEmail);
        if (roll != null) {
            try {
                StudentDashboardResponse dash = samvidhaService.syncStudentData(
                        SamvidhaSyncRequest.builder().rollNo(roll).password(req.getPassword()).consent(true).build(),
                        user
                );
                if (dash != null && dash.getFullName() != null) {
                    user.setFullName(dash.getFullName());
                    user = userRepository.save(user);
                }
            } catch (Exception e) {
                log.warn("Initial Samvidha sync during registration failed: {}", e.getMessage());
            }
        }

        auditLogService.log(user.getId(), AuditLog.EventType.REGISTER,
                "{\"role\":\"STUDENT\"}");
        log.info("New user registered: {}", user.getEmail());

        return buildAuthResponse(user);
    }

    /** Authenticate and return tokens. Supports both standard email and roll number sign-in. */
    @Transactional
    public AuthResponse login(LoginRequest req) {
        String normalizedEmail = normalizeEmailOrRoll(req.getEmail());
        Optional<User> userOpt = userRepository.findByEmail(normalizedEmail);

        User user;
        if (userOpt.isPresent()) {
            user = userOpt.get();
            boolean dbPasswordMatches = passwordEncoder.matches(req.getPassword(), user.getPasswordHash());

            if (!dbPasswordMatches) {
                // If password changed on Samvidha, test live Samvidha
                String roll = extractRollIfPresent(normalizedEmail);
                if (roll != null) {
                    try {
                        StudentDashboardResponse dash = samvidhaService.syncStudentData(
                                SamvidhaSyncRequest.builder().rollNo(roll).password(req.getPassword()).consent(true).build(),
                                user
                        );
                        // If live Samvidha login succeeded, update local password hash and name
                        user.setPasswordHash(passwordEncoder.encode(req.getPassword()));
                        if (dash != null && dash.getFullName() != null) {
                            user.setFullName(dash.getFullName());
                        }
                        user = userRepository.save(user);
                    } catch (BadCredentialsException e) {
                        auditLogService.log(user.getId(), AuditLog.EventType.LOGIN_FAILURE,
                                "{\"reason\":\"bad_samvidha_password\"}");
                        throw e;
                    }
                } else {
                    auditLogService.log(user.getId(), AuditLog.EventType.LOGIN_FAILURE,
                            "{\"reason\":\"bad_password\"}");
                    throw new BadCredentialsException("Invalid credentials");
                }
            } else {
                // Auto sync Samvidha in background asynchronously on every student login for lightning speed
                String roll = extractRollIfPresent(normalizedEmail);
                if (roll != null && req.getPassword() != null) {
                    final User studentUser = user;
                    final String rawPass = req.getPassword();
                    java.util.concurrent.CompletableFuture.runAsync(() -> {
                        try {
                            samvidhaService.syncStudentData(
                                    SamvidhaSyncRequest.builder().rollNo(roll).password(rawPass).consent(true).build(),
                                    studentUser
                            );
                        } catch (Exception e) {
                            log.debug("Background auto-sync note on login: {}", e.getMessage());
                        }
                    });
                }
            }
        } else {
            // Auto-provision if valid Roll Number format (e.g. 21951A0501, 22951A6612, 25955A0522)
            String roll = extractRollIfPresent(normalizedEmail);
            if (roll != null && req.getPassword() != null && !req.getPassword().isBlank()) {
                log.info("Authenticating and provisioning student user from Roll Number: {}", roll);
                user = User.builder()
                        .email(normalizedEmail)
                        .passwordHash(passwordEncoder.encode(req.getPassword()))
                        .fullName(roll)
                        .role(Role.STUDENT)
                        .build();
                user = userRepository.save(user);

                // Authenticate against live Samvidha and ingest real student data
                try {
                    StudentDashboardResponse dash = samvidhaService.syncStudentData(
                            SamvidhaSyncRequest.builder().rollNo(roll).password(req.getPassword()).consent(true).build(),
                            user
                    );
                    if (dash != null && dash.getFullName() != null) {
                        user.setFullName(dash.getFullName());
                        user = userRepository.save(user);
                    }
                } catch (BadCredentialsException e) {
                    userRepository.delete(user);
                    throw e;
                } catch (Exception e) {
                    log.warn("Samvidha auto-sync notice during login: {}", e.getMessage());
                }
            } else {
                throw new BadCredentialsException("Invalid credentials");
            }
        }

        if (!user.isEnabled()) {
            throw new BadCredentialsException("Account is disabled");
        }

        auditLogService.log(user.getId(), AuditLog.EventType.LOGIN_SUCCESS,
                "{\"role\":\"" + user.getRole().name() + "\"}");
        log.info("User logged in: {}", user.getEmail());

        return buildAuthResponse(user);
    }

    /** Refresh access token using a valid refresh token. */
    @Transactional(readOnly = true)
    public AuthResponse refresh(String refreshToken) {
        if (!jwtTokenProvider.isValid(refreshToken)) {
            throw new BadCredentialsException("Invalid or expired refresh token");
        }
        String email = jwtTokenProvider.extractEmail(refreshToken);
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BadCredentialsException("User not found"));

        auditLogService.log(user.getId(), AuditLog.EventType.TOKEN_REFRESH, null);
        return buildAuthResponse(user);
    }

    private String normalizeEmailOrRoll(String input) {
        String trimmed = input.trim().toLowerCase();
        if (!trimmed.contains("@")) {
            return trimmed + "@iare.ac.in";
        }
        return trimmed;
    }

    private String extractRollIfPresent(String email) {
        String username = email.contains("@") ? email.substring(0, email.indexOf("@")) : email;
        username = username.trim().toUpperCase();
        // Matches standard 10-char IARE roll numbers e.g. 21951A0501, 22951A6612, 25955A0512
        if (username.matches("^[0-9]{2}[0-9A-Z]{8}$") && username.length() == 10) {
            return username;
        }
        return null;
    }

    private AuthResponse buildAuthResponse(User user) {
        String roll = extractRollIfPresent(user.getEmail());
        String photoUrl = null;
        String fullName = user.getFullName();

        var profileOpt = studentProfileRepository.findByUser(user);
        if (profileOpt.isPresent()) {
            var profile = profileOpt.get();
            if (profile.getRollNo() != null) roll = profile.getRollNo();
            if (profile.getProfilePhotoUrl() != null) photoUrl = profile.getProfilePhotoUrl();
            if (profile.getFullName() != null && !profile.getFullName().isBlank()) fullName = profile.getFullName();
        }

        return AuthResponse.builder()
                .accessToken(jwtTokenProvider.generateAccessToken(user))
                .refreshToken(jwtTokenProvider.generateRefreshToken(user))
                .tokenType("Bearer")
                .expiresIn(jwtTokenProvider.getExpiryMs() / 1000)
                .email(user.getEmail())
                .fullName(fullName)
                .rollNo(roll)
                .profilePhotoUrl(photoUrl)
                .role(user.getRole().name())
                .onboardingCompleted(user.isOnboardingCompleted())
                .build();
    }
}
