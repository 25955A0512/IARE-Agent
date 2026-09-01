package in.iare.agent.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;
import java.net.InetSocketAddress;
import java.net.Socket;

/**
 * DataSourceConfig — Probes Supabase connectivity at startup.
 * If Supabase host is reachable: uses PostgreSQL (Supabase).
 * If not (no internet / DNS failure): silently falls back to H2 in-memory DB.
 * This ensures the app always starts for local development even without internet.
 */
@Configuration
public class DataSourceConfig {

    private static final Logger log = LoggerFactory.getLogger(DataSourceConfig.class);

    @Value("${spring.datasource.url:jdbc:h2:mem:iare_agent;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE}")
    private String configuredUrl;

    @Value("${spring.datasource.username:sa}")
    private String username;

    @Value("${spring.datasource.password:}")
    private String password;

    @Bean
    @Primary
    public DataSource dataSource() {
        // If URL is a Postgres URL, probe connectivity first
        if (configuredUrl.startsWith("jdbc:postgresql://")) {
            String host = extractHost(configuredUrl);
            int port = extractPort(configuredUrl);
            boolean reachable = isReachable(host, port, 3000);
            if (!reachable) {
                log.warn("DataSourceConfig: Supabase host '{}:{}' is unreachable — falling back to H2 in-memory database for local development.", host, port);
                return buildH2DataSource();
            }
            log.info("DataSourceConfig: Supabase host '{}:{}' is reachable — using PostgreSQL.", host, port);
            return buildPostgresDataSource();
        }

        // Already an H2 URL or other
        log.info("DataSourceConfig: Using configured datasource URL: {}", maskUrl(configuredUrl));
        return buildDataSource(configuredUrl, username, password, "org.h2.Driver");
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private DataSource buildPostgresDataSource() {
        HikariConfig cfg = new HikariConfig();
        cfg.setJdbcUrl(configuredUrl);
        cfg.setUsername(username);
        cfg.setPassword(password);
        cfg.setDriverClassName("org.postgresql.Driver");
        cfg.setConnectionTimeout(8000);
        cfg.setMaximumPoolSize(5);
        cfg.setMinimumIdle(1);
        cfg.setPoolName("IARESupa-Pool");
        return new HikariDataSource(cfg);
    }

    private DataSource buildH2DataSource() {
        String h2Url = "jdbc:h2:mem:iare_agent;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE;MODE=PostgreSQL";
        return buildDataSource(h2Url, "sa", "", "org.h2.Driver");
    }

    private DataSource buildDataSource(String url, String user, String pass, String driver) {
        HikariConfig cfg = new HikariConfig();
        cfg.setJdbcUrl(url);
        cfg.setUsername(user);
        cfg.setPassword(pass);
        cfg.setDriverClassName(driver);
        cfg.setConnectionTimeout(5000);
        cfg.setMaximumPoolSize(10);
        cfg.setPoolName("IARE-Pool");
        return new HikariDataSource(cfg);
    }

    private boolean isReachable(String host, int port, int timeoutMs) {
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(host, port), timeoutMs);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private String extractHost(String jdbcUrl) {
        // jdbc:postgresql://host:port/db?...
        try {
            String withoutScheme = jdbcUrl.replace("jdbc:postgresql://", "");
            String hostPort = withoutScheme.split("/")[0];
            return hostPort.contains(":") ? hostPort.split(":")[0] : hostPort;
        } catch (Exception e) {
            return "localhost";
        }
    }

    private int extractPort(String jdbcUrl) {
        try {
            String withoutScheme = jdbcUrl.replace("jdbc:postgresql://", "");
            String hostPort = withoutScheme.split("/")[0];
            if (hostPort.contains(":")) {
                return Integer.parseInt(hostPort.split(":")[1]);
            }
        } catch (Exception ignored) {}
        return 5432;
    }

    private String maskUrl(String url) {
        return url.replaceAll("password=[^&?]*", "password=***");
    }
}
