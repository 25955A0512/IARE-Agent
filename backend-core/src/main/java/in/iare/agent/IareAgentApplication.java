package in.iare.agent;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;

/**
 * Entry point for IARE Agent backend-core.
 * This service is the only internet-facing component.
 * All AI processing is delegated to ai-service via an internal shared-secret channel.
 *
 * DataSourceAutoConfiguration is excluded because DataSourceConfig.java provides
 * a smarter @Primary DataSource bean that probes Supabase connectivity at startup
 * and falls back to H2 in-memory DB when offline — so the app always starts locally.
 */
@SpringBootApplication(exclude = {DataSourceAutoConfiguration.class})
public class IareAgentApplication {
    public static void main(String[] args) {
        SpringApplication.run(IareAgentApplication.class, args);
    }
}

