import { parseFileTool } from "./parse-file.js";
import { profileColumnsTool } from "./profile-columns.js";
import { suggestCleaningTool } from "./suggest-cleaning.js";
import { executeCleaningTool } from "./execute-cleaning.js";
import { proposeMappingsTool } from "./propose-mappings.js";
import { confirmMappingsTool } from "./confirm-mappings.js";
import { runHarmonizationTool } from "./run-harmonization.js";
import { runQueryTool } from "./run-query.js";
import { generateArtifactTool } from "./generate-artifact.js";
import { explainLineageTool } from "./explain-lineage.js";
import { runQualityCheckTool } from "./run-quality-check.js";
import { runScriptTool } from "./run-script.js";
import { updateSemanticTool } from "./update-semantic.js";
import { proposeTargetSchemaTool } from "./propose-schema.js";

export const pipelineTools = {
  parse_file: parseFileTool,
  profile_columns: profileColumnsTool,
  suggest_cleaning: suggestCleaningTool,
  execute_cleaning: executeCleaningTool,
  propose_target_schema: proposeTargetSchemaTool,
  propose_mappings: proposeMappingsTool,
  confirm_mappings: confirmMappingsTool,
  run_harmonization: runHarmonizationTool,
};

export const analystTools = {
  run_query: runQueryTool,
  generate_artifact: generateArtifactTool,
  explain_lineage: explainLineageTool,
  run_script: runScriptTool,
};

export const sharedTools = {
  run_quality_check: runQualityCheckTool,
  update_semantic_layer: updateSemanticTool,
};

export const allTools = {
  ...pipelineTools,
  ...analystTools,
  ...sharedTools,
};
