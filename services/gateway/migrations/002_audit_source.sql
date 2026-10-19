ALTER TABLE audit_log DROP CONSTRAINT audit_log_source_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_source_check CHECK (source IN ('mcp','chat','api'));
