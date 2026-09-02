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
import java.net.URI;

/**
 * DataSourceConfig — Handles database connection with automatic URL normalization.
 * Extracts clean host:port/path from generic URIs (user:password@host:port/db) and
 * supplies credentials separately to HikariCP for standard PostgreSQL JDBC compatibility.
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
        String raw = configuredUrl != null ? configuredUrl.trim() : "";

        // Check if PostgreSQL
        if (raw.startsWith("jdbc:postgresql://") || raw.startsWith("postgresql://") || raw.startsWith("postgres://")) {
            String host = extractHost(raw);
            int port = extractPort(raw);
            boolean reachable = isReachable(host, port, 4000);
            if (!reachable) {
                log.warn("DataSourceConfig: PostgreSQL host '{}:{}' is unreachable — falling back to H2 in-memory database for local dev.", host, port);
                return buildH2DataSource();
            }
            log.info("DataSourceConfig: PostgreSQL host '{}:{}' is reachable — connecting with org.postgresql.Driver.", host, port);
            return buildPostgresDataSource(raw);
        }

        // H2 or fallback
        log.info("DataSourceConfig: Using datasource URL: {}", maskUrl(raw));
        String driver = raw.contains("postgresql") ? "org.postgresql.Driver" : "org.h2.Driver";
        return buildDataSource(raw, username, password, driver);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private DataSource buildPostgresDataSource(String rawUrl) {
        HikariConfig cfg = new HikariConfig();
        cfg.setDriverClassName("org.postgresql.Driver");

        String effectiveUser = this.username;
        String effectivePass = this.password;
        String cleanJdbcUrl = rawUrl;

        try {
            // Strip jdbc: prefix if present so java.net.URI can parse cleanly
            String uriString = rawUrl.startsWith("jdbc:") ? rawUrl.substring(5) : rawUrl;
            URI uri = new URI(uriString);

            String host = uri.getHost();
            int port = uri.getPort() == -1 ? 5432 : uri.getPort();
            String path = uri.getPath(); // includes leading '/' e.g. /iare_agent

            // Standard clean JDBC format without @ credentials: jdbc:postgresql://host:port/database
            cleanJdbcUrl = "jdbc:postgresql://" + host + ":" + port + (path != null ? path : "");
            if (uri.getQuery() != null && !uri.getQuery().isBlank()) {
                cleanJdbcUrl += "?" + uri.getQuery();
            }

            // Extract credentials from userInfo (user:password) if present
            if (uri.getUserInfo() != null) {
                String[] userInfo = uri.getUserInfo().split(":", 2);
                if (userInfo.length > 0 && !userInfo[0].isBlank()) {
                    effectiveUser = userInfo[0];
                }
                if (userInfo.length > 1 && !userInfo[1].isBlank()) {
                    effectivePass = userInfo[1];
                }
            }
        } catch (Exception e) {
            log.warn("DataSourceConfig: URI parsing fallback for {}: {}", maskUrl(rawUrl), e.getMessage());
            cleanJdbcUrl = rawUrl.startsWith("jdbc:") ? rawUrl : "jdbc:" + rawUrl;
        }

        log.info("DataSourceConfig: Configured clean PostgreSQL JDBC URL: {}", maskUrl(cleanJdbcUrl));
        cfg.setJdbcUrl(cleanJdbcUrl);
        if (effectiveUser != null && !effectiveUser.isBlank() && !"sa".equals(effectiveUser)) {
            cfg.setUsername(effectiveUser);
        }
        if (effectivePass != null && !effectivePass.isBlank()) {
            cfg.setPassword(effectivePass);
        }
        cfg.setConnectionTimeout(10000);
        cfg.setInitializationFailTimeout(8000);
        cfg.setMaximumPoolSize(5);
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

    private String extractHost(String rawUrl) {
        try {
            String uriString = rawUrl.startsWith("jdbc:") ? rawUrl.substring(5) : rawUrl;
            URI uri = new URI(uriString);
            if (uri.getHost() != null) {
                return uri.getHost();
            }
        } catch (Exception ignored) {}
        try {
            String clean = rawUrl.replace("jdbc:postgresql://", "").replace("postgresql://", "").replace("postgres://", "");
            String hostPort = clean.split("/")[0];
            if (hostPort.contains("@")) {
                hostPort = hostPort.substring(hostPort.indexOf("@") + 1);
            }
            return hostPort.contains(":") ? hostPort.split(":")[0] : hostPort;
        } catch (Exception e) {
            return "localhost";
        }
    }

    private int extractPort(String rawUrl) {
        try {
            String uriString = rawUrl.startsWith("jdbc:") ? rawUrl.substring(5) : rawUrl;
            URI uri = new URI(uriString);
            if (uri.getPort() != -1) {
                return uri.getPort();
            }
        } catch (Exception ignored) {}
        return 5432;
    }

    private String maskUrl(String url) {
        return url.replaceAll(":[^:@/]+@", ":***@");
    }
}
