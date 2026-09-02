package in.iare.agent;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.h2.H2ConsoleAutoConfiguration;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;

/**
 * Entry point for IARE Agent backend-core.
 * This service is the only internet-facing component.
 * All AI processing is delegated to ai-service via an internal shared-secret channel.
 *
 * DataSourceAutoConfiguration and H2ConsoleAutoConfiguration are excluded because
 * DataSourceConfig.java provides a smart @Primary DataSource bean.
 */
@SpringBootApplication(exclude = {
    DataSourceAutoConfiguration.class,
    H2ConsoleAutoConfiguration.class
})
public class IareAgentApplication {
    public static void main(String[] args) {
        SpringApplication.run(IareAgentApplication.class, args);
    }
}

