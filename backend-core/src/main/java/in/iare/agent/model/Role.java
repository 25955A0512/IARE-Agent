package in.iare.agent.model;

/**
 * User roles enforced at method level via @PreAuthorize.
 * Three roles from day one per AGENTS.md security standards.
 */
public enum Role {
    STUDENT,
    FACULTY,
    ADMIN
}
