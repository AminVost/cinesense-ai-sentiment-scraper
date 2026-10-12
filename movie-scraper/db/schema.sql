-- CineSense production schema. Apply once to a managed MySQL 8.0+ database.
-- Use a dedicated least-privilege app user and encrypted TLS connections.
CREATE TABLE IF NOT EXISTS cs_users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  verified_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_cs_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cs_sessions (
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_cs_session_user (user_id),
  INDEX idx_cs_session_expiry (expires_at),
  CONSTRAINT fk_cs_session_user FOREIGN KEY (user_id) REFERENCES cs_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cs_email_tokens (
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  purpose ENUM('verify','reset') NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_cs_tokens_user (user_id),
  INDEX idx_cs_tokens_expiry (expires_at),
  CONSTRAINT fk_cs_email_token_user FOREIGN KEY (user_id) REFERENCES cs_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Source reviews are independent from each user's account/history.
-- Expires_at is absolute (20 days); failed refresh must NOT extend freshness.
CREATE TABLE IF NOT EXISTS cs_source_cache (
  tmdb_id BIGINT UNSIGNED NOT NULL,
  source ENUM('tmdb','youtube','digimoviez') NOT NULL,
  fetched_count TINYINT UNSIGNED NOT NULL,
  payload_json LONGTEXT NOT NULL,
  fetched_at DATETIME(3) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  PRIMARY KEY (tmdb_id, source),
  INDEX idx_cs_cache_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Lease-based distributed single-flight avoids duplicate costly provider fetches.
CREATE TABLE IF NOT EXISTS cs_refresh_locks (
  tmdb_id BIGINT UNSIGNED NOT NULL,
  source ENUM('tmdb','youtube','digimoviez') NOT NULL,
  owner_token CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  PRIMARY KEY (tmdb_id, source),
  INDEX idx_cs_locks_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cs_user_history (
  user_id BIGINT UNSIGNED NOT NULL,
  tmdb_id BIGINT UNSIGNED NOT NULL,
  movie_title VARCHAR(220) NOT NULL,
  sources_json VARCHAR(128) NOT NULL,
  last_viewed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, tmdb_id),
  INDEX idx_cs_history_last (last_viewed_at),
  CONSTRAINT fk_cs_history_user FOREIGN KEY (user_id) REFERENCES cs_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- MySQL-backed atomic rate counters: shared across all Vercel instances.
CREATE TABLE IF NOT EXISTS cs_rate_counters (
  bucket_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  count INT UNSIGNED NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  INDEX idx_cs_rate_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
