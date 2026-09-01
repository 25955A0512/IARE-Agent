package in.iare.agent.service;

import in.iare.agent.model.AuditLog;
import in.iare.agent.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * Records audit events asynchronously so they never slow down the request path.
 * Per AGENTS.md: records who/what/when — NOT full query content.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    @Async
    public void log(Long userId, AuditLog.EventType eventType, String metadata) {
        try {
            AuditLog entry = AuditLog.builder()
                    .userId(userId)
                    .eventType(eventType)
                    .metadata(metadata)
                    .build();
            auditLogRepository.save(entry);
        } catch (Exception e) {
            // Audit failures must never break the main request
            log.error("Audit log write failed: {}", e.getMessage());
        }
    }
}
