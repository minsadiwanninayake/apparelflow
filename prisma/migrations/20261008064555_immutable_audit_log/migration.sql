CREATE OR REPLACE FUNCTION block_audit_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'verification_logs is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER verification_logs_no_update
BEFORE UPDATE OR DELETE ON verification_logs
FOR EACH ROW EXECUTE FUNCTION block_audit_change();