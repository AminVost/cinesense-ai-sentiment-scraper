-- Execute once on a MySQL 8.0+ database with utf8mb4. No automatic runtime DDL.
CREATE TABLE IF NOT EXISTS cs_users (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 email VARCHAR(254) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS cs_sessions (
 token_hash CHAR(64) NOT NULL PRIMARY KEY,
 user_id BIGINT UNSIGNED NOT NULL,
 expires_at DATETIME(3) NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_sessions_expiry (expires_at),
 CONSTRAINT fk_cs_session_user FOREIGN KEY(user_id) REFERENCES cs_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS cs_review_cache (
 tmdb_id BIGINT UNSIGNED NOT NULL,
 source ENUM('tmdb','youtube','digimoviez') NOT NULL,
 payload JSON NOT NULL,
 cached_count INT NOT NULL,
 fetched_at DATETIME(3) NOT NULL,
 expires_at DATETIME(3) NOT NULL,
 PRIMARY KEY(tmdb_id, source),
 INDEX idx_cache_expiry(expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS cs_fetch_leases (
 tmdb_id BIGINT UNSIGNED NOT NULL,
 source ENUM('tmdb','youtube','digimoviez') NOT NULL,
 holder CHAR(36) NOT NULL,
 expires_at DATETIME(3) NOT NULL,
 PRIMARY KEY(tmdb_id, source),
 INDEX idx_lease_expiry(expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS cs_user_history (
 user_id BIGINT UNSIGNED NOT NULL,
 tmdb_id BIGINT UNSIGNED NOT NULL,
 last_viewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY(user_id,tmdb_id),
 INDEX idx_history_latest(user_id,last_viewed_at),
 CONSTRAINT fk_cs_history_user FOREIGN KEY(user_id) REFERENCES cs_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
