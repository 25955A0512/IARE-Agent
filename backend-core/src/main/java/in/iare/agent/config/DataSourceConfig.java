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
 * DataSourceConfig — Handles database connection with automatic URL normalization.
 * Normalizes postgresql:// and postgres:// to jdbc:postgresql://.
 * Probes host reachability and connects via PostgreSQL driver, with fallback to H2 for offline dev.
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
        String url = normalizeJdbcUrl(configuredUrl);

        // PostgreSQL configuration
        if (url.startsWith("jdbc:postgresql://")) {
            String host = extractHost(url);
            int port = extractPort(url);
            boolean reachable = isReachable(host, port, 4000);
            if (!reachable) {
                log.warn("DataSourceConfig: PostgreSQL host '{}:{}' is unreachable — falling back to H2 in-memory database for local dev.", host, port);
                return buildH2DataSource();
            }
            log.info("DataSourceConfig: PostgreSQL host '{}:{}' is reachable — connecting with org.postgresql.Driver.", host, port);
            return buildPostgresDataSource(url);
        }

        // H2 or fallback
        log.info("DataSourceConfig: Using datasource URL: {}", maskUrl(url));
        String driver = url.contains("postgresql") ? "org.postgresql.Driver" : "org.h2.Driver";
        return buildDataSource(url, username, password, driver);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private String normalizeJdbcUrl(String rawUrl) {
        if (rawUrl == null || rawUrl.isBlank()) {
            return "jdbc:h2:mem:iare_agent;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE";
        }
        String trimmed = rawUrl.trim();
        if (trimmed.startsWith("postgres://")) {
            return trimmed.replaceFirst("postgres://", "jdbc:postgresql://");
        } else if (trimmed.startsWith("postgresql://")) {
            return trimmed.replaceFirst("postgresql://", "jdbc:postgresql://");
        }
        return trimmed;
    }

    private DataSource buildPostgresDataSource(String jdbcUrl) {
        HikariConfig cfg = new HikariConfig();
        cfg.setJdbcUrl(jdbcUrl);
        if (username != null && !username.isBlank() && !"sa".equals(username)) {
            cfg.setUsername(username);
        }
        if (password != null && !password.isBlank()) {
            cfg.setPassword(password);
        }
        cfg.setDriverClassName("org.postgresql.Driver");
        cfg.setConnectionTimeout(15000);
        cfg.setMaximumPoolSize(10);
        cfg.setMinimumIdle(1);
        cfg.setPoolName("IAREPostgres-Pool");
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
        cfg.setConnectionTimeout(10000);
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
        try {
            String clean = jdbcUrl.replace("jdbc:postgresql://", "");
            String hostPort = clean.split("/")[0];
            if (hostPort.contains("@")) {
                hostPort = hostPort.substring(hostPort.indexOf("@") + 1);
            }
            return hostPort.contains(":") ? hostPort.split(":")[0] : hostPort;
        } catch (Exception e) {
            return "localhost";
        }
    }

    private int extractPort(String jdbcUrl) {
        try {
            String clean = jdbcUrl.replace("jdbc:postgresql://", "");
            String hostPort = clean.split("/")[0];
            if (hostPort.contains("@")) {
                hostPort = hostPort.substring(hostPort.indexOf("@") + 1);
            }
            if (hostPort.contains(":")) {
                return Integer.parseInt(hostPort.split(":")[1]);
            }
        } catch (Exception ignored) {}
        return 5432;
    }

    private String maskUrl(String url) {
        return url.replaceAll(":[^:@/]+@", ":***@");
    }
}
