-- Migration: Add node_id scoping to enable multiple nodes of the same type per project.
-- Each Transform node owns its own schema + mappings.
-- Each Harmonize node owns its own semantic entities.
-- Each Quality node owns its own alerts.

ALTER TABLE target_schemas
  ADD COLUMN IF NOT EXISTS node_id TEXT REFERENCES pipeline_nodes(id) ON DELETE SET NULL;

ALTER TABLE field_mappings
  ADD COLUMN IF NOT EXISTS node_id TEXT REFERENCES pipeline_nodes(id) ON DELETE SET NULL;

ALTER TABLE semantic_entities
  ADD COLUMN IF NOT EXISTS node_id TEXT REFERENCES pipeline_nodes(id) ON DELETE SET NULL;

ALTER TABLE quality_alerts
  ADD COLUMN IF NOT EXISTS node_id TEXT REFERENCES pipeline_nodes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_target_schemas_node_id ON target_schemas(node_id);
CREATE INDEX IF NOT EXISTS idx_field_mappings_node_id ON field_mappings(node_id);
CREATE INDEX IF NOT EXISTS idx_semantic_entities_node_id ON semantic_entities(node_id);
CREATE INDEX IF NOT EXISTS idx_quality_alerts_node_id ON quality_alerts(node_id);
