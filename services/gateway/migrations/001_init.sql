CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role          text NOT NULL CHECK (role IN ('admin','member')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  disabled_at   timestamptz
);

CREATE TABLE invites (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL,
  role       text NOT NULL CHECK (role IN ('admin','member')),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_by uuid REFERENCES users(id)
);

CREATE TABLE api_keys (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         text NOT NULL,
  prefix       text NOT NULL,
  key_hash     text NOT NULL UNIQUE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);

CREATE TABLE servers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]([a-z0-9-]{0,22}[a-z0-9])?$'),
  name            text NOT NULL,
  url             text NOT NULL,
  auth_type       text NOT NULL DEFAULT 'none' CHECK (auth_type IN ('none','bearer','header')),
  header_name     text,
  credential_enc  text,
  enabled         boolean NOT NULL DEFAULT true,
  status          text NOT NULL DEFAULT 'unknown',
  status_reason   text,
  last_checked_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id            bigserial PRIMARY KEY,
  ts            timestamptz NOT NULL DEFAULT now(),
  user_id       uuid REFERENCES users(id) ON DELETE SET NULL,
  user_email    text,
  source        text NOT NULL CHECK (source IN ('mcp','chat')),
  server_slug   text,
  tool          text NOT NULL,
  duration_ms   integer NOT NULL,
  status        text NOT NULL CHECK (status IN ('ok','error','timeout','denied')),
  error_message text
);
CREATE INDEX audit_log_ts_idx ON audit_log (ts DESC);
