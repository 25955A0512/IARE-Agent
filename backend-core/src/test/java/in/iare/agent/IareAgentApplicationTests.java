package in.iare.agent;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

/**
 * Smoke test — verifies the Spring application context loads without errors.
 * Uses H2 in-memory database and dev-safe defaults (no external dependencies needed).
 */
@SpringBootTest
@TestPropertySource(properties = {
    "app.jwt.secret=dGVzdC1zZWNyZXQtMzItY2hhcnMtbG9uZy1rZXktaGVyZQ==",
    "app.ai-service.shared-secret=test-shared-secret",
    "spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
    "app.cors.allowed-origins=http://localhost:5173"
})
class IareAgentApplicationTests {

    @Test
    void contextLoads() {
        // If the context loads without throwing, we're green
    }
}
