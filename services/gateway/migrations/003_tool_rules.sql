CREATE TABLE tool_rules (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role       text NOT NULL CHECK (role IN ('member')),
  pattern    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, pattern)
);
INSERT INTO tool_rules (role, pattern) VALUES
  ('member', 'woo__create_product'),
  ('member', 'woo__update_order_status');
