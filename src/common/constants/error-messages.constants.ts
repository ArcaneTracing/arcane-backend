export const ERROR_MESSAGES = {
  NOT_FOUND: "{0} not found.",
  NOT_FOUND_WITH_ID: "{0} with ID {1} not found.",

  USER_NOT_FOUND: "User not found.",
  USER_NOT_FOUND_BY_EMAIL: "User with email {0} not found.",
  USER_ALREADY_MEMBER: "User is already a member of this {0}.",
  USER_NOT_IN_ORGANISATION: "User does not belong to this organisation.",
  INVITE_REQUIRED: "Invitation required to create an account.",

  PROJECT_NOT_FOUND: "Project with ID {0} not found.",
  CANNOT_REMOVE_PROJECT_CREATOR: "Cannot remove the project creator.",

  ORGANISATION_NOT_FOUND: "Organisation with ID {0} not found.",

  ANNOTATION_NOT_FOUND: "Annotation not found.",
  QUEUE_TRACE_NOT_FOUND_IN_QUEUE:
    "Queue trace with ID {0} not found in queue {1}.",
  QUEUED_CONVERSATION_NOT_FOUND_IN_QUEUE:
    "Queued conversation with ID {0} not found in queue {1}.",

  ENTITY_NOT_FOUND: "Entity with ID {0} not found.",

  MODEL_CONFIGURATION_NOT_FOUND: "Model configuration with ID {0} not found.",

  EMAIL_REQUIRED: "Email is required.",
  YAML_FILE_REQUIRED: "YAML file is required.",
  FILE_MUST_BE_YAML: "File must be a YAML file (.yaml or .yml).",

  EVALUATION_NOT_FOUND: "Evaluation with ID {0} not found.",
  SCORE_NOT_FOUND: "Score with ID {0} not found.",
  EXPERIMENT_NOT_FOUND: "Experiment with ID {0} not found.",
  DATASET_NOT_FOUND: "Dataset with ID {0} not found.",

  ATTRIBUTE_VISIBILITY_RULE_NOT_FOUND:
    "Attribute visibility rule with ID {0} not found.",
  ATTRIBUTE_VISIBILITY_RULE_ALREADY_EXISTS:
    'Visibility rule for attribute "{0}" already exists for this project.',
  ATTRIBUTE_VISIBILITY_RULE_DOES_NOT_BELONG_TO_PROJECT:
    "Visibility rule does not belong to this project.",

  ROLE_NOT_FOUND: "Role with ID {0} not found.",
  DEFAULT_MEMBER_ROLE_NOT_FOUND:
    "Default Member role not found for project {0}.",
  DEFAULT_ORGANISATION_MEMBER_ROLE_NOT_FOUND:
    "Default Organisation Member role not found for organisation {0}.",
  CANNOT_UPDATE_SYSTEM_ROLES: "Cannot update system roles.",
  CANNOT_DELETE_SYSTEM_ROLES: "Cannot delete system roles.",
  CANNOT_DELETE_GLOBAL_ROLES: "Cannot delete global roles.",
  ROLE_DOES_NOT_BELONG_TO_PROJECT: "Role does not belong to this project.",
  ROLE_DOES_NOT_BELONG_TO_ORGANISATION:
    "Role does not belong to this organisation.",
  ONLY_OWNERS_CAN_ASSIGN_OWNER_ROLE:
    "Only instance Owners can assign Owner role.",
  ONLY_OWNERS_CAN_REMOVE_OWNER_ROLE:
    "Only instance Owners can remove Owner role.",
  OWNER_ROLE_NOT_FOUND: "Owner role not found.",
  CANNOT_REMOVE_OWNER_ROLE: "Cannot remove Owner role.",
  CANNOT_ASSIGN_OWNER_ROLE_TO_NON_OWNER:
    "Cannot assign Owner role to a user who is not an Owner.",

  DATASOURCE_NOT_FOUND: "Datasource with ID {0} not found.",
  DATASOURCE_DOES_NOT_BELONG_TO_ORGANISATION:
    "Datasource does not belong to this organisation.",

  CONVERSATION_NOT_FOUND: "Conversation with ID {0} not found in queue {1}.",
  CONVERSATION_CONFIG_NOT_FOUND:
    "Conversation configuration with ID {0} not found.",

  EXPERIMENT_NOT_FOUND_IN_PROJECT:
    "Experiment with ID {0} not found in this project.",
  PROMPT_VERSION_NOT_FOUND: "Prompt version {0} not found in this project.",

  EVALUATION_NOT_FOUND_IN_PROJECT: "Evaluation {0} not found in this project.",
  EVALUATION_NOT_FOUND_IN_ORGANISATION:
    "Evaluation {0} not found in this organisation.",
  EVALUATION_DOES_NOT_HAVE_DATASET: "Evaluation does not have a dataset.",
  EVALUATION_SCOPE_MISMATCH:
    "This endpoint is only available for {0}-scoped evaluations.",
  THIS_ENDPOINT_ONLY_FOR_DATASET_SCOPED_EVALUATIONS:
    "This endpoint is only available for dataset-scoped evaluations.",
  SCORES_NOT_FOUND: "One or more scores were not found.",
  SCORES_DOES_NOT_BELONG_TO_PROJECT:
    "One or more scores do not belong to this project.",
  EXPERIMENTS_NOT_FOUND:
    "One or more experiments were not found in this project.",
  DATASET_NOT_FOUND_IN_PROJECT: "Dataset {0} not found in this project.",
  DATASET_EVALUATION_REQUIRES_DATASET_ID:
    "Dataset evaluations require a datasetId.",
  EXPERIMENT_EVALUATION_REQUIRES_EXPERIMENT_IDS:
    "Experiment evaluations require experimentIds.",
  ALL_EXPERIMENTS_MUST_HAVE_SAME_DATASET:
    "All experiments in an evaluation must have the same datasetId.",
  DATASET_ROW_NOT_FOUND: "Dataset row not found for this evaluation.",
  EXPERIMENT_RESULT_NOT_FOUND:
    "Experiment result not found for this evaluation.",
  EXPERIMENT_MUST_BELONG_TO_EVALUATION:
    "Experiment must belong to the specified evaluation.",
  EXPERIMENT_ID_REQUIRED_FOR_EXPERIMENT_SCOPE:
    "experimentId is required for experiment-scoped evaluations.",
  SCORE_RESULTS_CONTAIN_INVALID_SCORES:
    "Score results contain scores that are not part of this evaluation.",
  DATASET_ROW_REQUIRED:
    "Dataset scoped evaluation results require datasetRowId.",
  EXPERIMENT_RESULT_REQUIRED:
    "Experiment scoped evaluation results require experimentResultId.",
  EVALUATION_RESULT_MUST_REFERENCE_DATASET_OR_EXPERIMENT:
    "Evaluation result must reference a dataset row or experiment result.",
  DATASET_ROW_RESULTS_ONLY_FOR_DATASET_SCOPE:
    "Dataset row results are only valid for dataset scoped evaluations.",
  EXPERIMENT_RESULTS_ONLY_FOR_EXPERIMENT_SCOPE:
    "Experiment results are only valid for experiment scoped evaluations.",
  SCORE_MUST_BE_OF_TYPE: "Score must be of type {0}.",
  SCORE_MUST_BELONG_TO_EVALUATION:
    "Score must belong to the specified evaluation.",
  SCORE_NOT_FOUND_IN_EVALUATION: "Score not found in evaluation.",
  IMPORT_ROW_MUST_HAVE_DATASET_ROW_OR_EXPERIMENT_RESULT:
    "Each import row must have datasetRowId (for dataset-scoped evaluations) or experimentResultId (for experiment-scoped evaluations).",
  IMPORT_SCORE_RESULT_DUPLICATE:
    "A score result already exists for this score and one or more of the given dataset rows or experiment results in this evaluation.",
  IMPORT_CONTAINS_DUPLICATE_ROW_REF:
    "Import contains duplicate datasetRowId or experimentResultId.",
  BOTH_EXPERIMENTS_MUST_BELONG_TO_EVALUATION:
    "Both experiments must belong to the specified evaluation.",
  RAGAS_MODEL_CONFIGURATION_REQUIRED:
    "ragasModelConfigurationId is required when using ragas scores.",

  CSV_FILE_REQUIRED: "CSV file is required.",
  FILE_MUST_BE_CSV: "File must be a CSV file.",
  CSV_HEADER_EMPTY: "CSV header is empty.",
  CSV_HEADER_CONTAINS_EMPTY_COLUMN_NAMES:
    "CSV header contains empty column names.",
  CSV_HEADER_CONTAINS_DUPLICATE_COLUMN_NAMES:
    "CSV header contains duplicate column names.",
  CSV_FILE_MUST_CONTAIN_HEADER_ROW: "CSV file must contain a header row.",
  FAILED_TO_PARSE_CSV: "Failed to parse CSV file: {0}.",
  CSV_ROW_COLUMN_MISMATCH:
    "Row {0} has {1} columns but header has {2} columns.",

  INVALID_REQUEST_BODY: "Invalid request body. Expected values array.",
  INVALID_DATASET_ROW_VALUES_COUNT:
    "Invalid dataset row values count. Expected {0} values, got {1}.",
  VALUES_ARRAY_LENGTH_MISMATCH:
    "Values array length ({0}) must match header length ({1}).",

  ENTERPRISE_LICENSE_REQUIRED: "This feature requires an enterprise license.",

  USER_NOT_AUTHENTICATED: "User not authenticated.",
  INVALID_PROJECT_API_KEY: "Invalid or expired project API key.",
  PROJECT_API_KEY_MISMATCH: "API key does not belong to this project.",
  ORGANISATION_CONTEXT_REQUIRED: "Organisation context is required.",
  ORGANISATION_AND_PROJECT_CONTEXT_REQUIRED:
    "Organisation and project context are required.",
  USER_DOES_NOT_BELONG_TO_PROJECT: "User does not belong to this project.",

  UNSUPPORTED_DATASOURCE_SOURCE: "Unsupported datasource source: {0}.",
  SEARCH_BY_ATTRIBUTES_NOT_SUPPORTED:
    "Search by attributes is not supported for {0} datasource.",
  SEARCH_BY_QUERY_NOT_SUPPORTED:
    "Search by query is not supported for {0} datasource.",
  FILTER_BY_ATTRIBUTE_EXISTS_NOT_SUPPORTED:
    "Filter by attribute existence is not supported for {0} datasource.",
  GET_ATTRIBUTE_NAMES_NOT_SUPPORTED:
    "Getting attribute names is not supported for {0} datasource.",
  GET_ATTRIBUTE_VALUES_NOT_SUPPORTED:
    "Getting attribute values is not supported for {0} datasource.",

  TRACE_NOT_FOUND: "Trace with ID {0} not found in datasource.",
  TRACE_SEARCH_FAILED:
    "Failed to search traces in datasource. Please check datasource configuration and connectivity.",
  TRACE_QUERY_FAILED:
    "Failed to query trace from datasource. Please check datasource configuration and connectivity.",
  TEMPO_CONNECTION_ERROR:
    "Unable to connect to Tempo at {0}. Please verify the datasource URL and ensure Tempo is running.",
  TEMPO_SERVICE_ERROR:
    "Tempo service returned an error (status {0}). Please check Tempo logs for details.",
  TEMPO_TIMEOUT_ERROR:
    "Request to Tempo timed out. The service may be overloaded or unreachable.",
  TEMPO_AUTHENTICATION_ERROR:
    "Authentication failed when connecting to Tempo. Please check datasource credentials.",
  JAEGER_CONNECTION_ERROR:
    "Unable to connect to Jaeger at {0}. Please verify the datasource URL and ensure Jaeger is running. Error: {1}",
  JAEGER_TIMEOUT_ERROR:
    "Request to Jaeger timed out at {0}. The service may be overloaded or unreachable.",
  JAEGER_AUTHENTICATION_ERROR:
    "Authentication failed when connecting to Jaeger at {0}. Please check datasource credentials. Status: {1}",
  JAEGER_SERVICE_ERROR:
    "Jaeger service returned an error (status {0}). Please check Jaeger logs for details.",
  JAEGER_API_ERROR: "Jaeger API error (status {0}): {1}",
  CLICKHOUSE_CONNECTION_ERROR:
    "Unable to connect to ClickHouse at {0}. Please verify the datasource configuration and ensure ClickHouse is running. Error: {1}",
  CLICKHOUSE_TIMEOUT_ERROR:
    "Request to ClickHouse timed out. The service may be overloaded or unreachable.",
  CLICKHOUSE_AUTHENTICATION_ERROR:
    "Authentication failed when connecting to ClickHouse. Please check datasource credentials.",
  CLICKHOUSE_AUTHORIZATION_ERROR:
    "Authorization failed when querying ClickHouse. The user does not have permission to access the requested resource.",
  CLICKHOUSE_QUERY_ERROR: "ClickHouse query error: {0}",
  CLICKHOUSE_TABLE_NOT_FOUND:
    "Table {0} not found in ClickHouse database. Please verify the table name in datasource configuration.",
  CLICKHOUSE_DATABASE_ERROR: "ClickHouse database error: {0}",

  SCORE_REQUIRES_EVALUATOR_PROMPT:
    "Score {0} ({1}) requires an evaluatorPrompt with a prompt version for evaluation. Please ensure the score has an evaluatorPrompt configured.",
  ROLE_NAME_ALREADY_EXISTS:
    'Role with name "{0}" already exists in this scope.',
  INVALID_PERMISSION: "Invalid permission: {0}. Allowed permissions: {1}.",
  PROJECT_SPECIFIC_ROLES_REQUIRE_ORGANISATION_ID:
    "Project-specific roles require an organisationId.",
  CANNOT_REMOVE_LAST_OWNER: "Cannot remove the last Owner from the system.",
  CANNOT_REMOVE_YOURSELF_IF_LAST_OWNER:
    "Cannot remove yourself if you are the last Owner.",
  CANNOT_REMOVE_INSTANCE_ADMIN:
    "Cannot remove instance admin. Remove instance admin role first.",
  CANNOT_REMOVE_YOURSELF: "Cannot remove yourself.",
  USER_DOES_NOT_HAVE_PERMISSION: "User does not have permission: {0}.",
  PROMPT_VERSION_NOT_FOUND_BY_ID: "Prompt version {0} not found.",
  MODEL_CONFIGURATION_NOT_FOUND_FOR_PROMPT_VERSION:
    "Model configuration not found for prompt version {0}.",
  PROMPT_DOES_NOT_BELONG_TO_PROJECT: "Prompt does not belong to this project.",
  PROMPT_VERSION_REQUIRED: "Prompt version is required.",
  PROMPT_VERSION_DOES_NOT_BELONG_TO_PROJECT:
    "Prompt version does not belong to this project.",
} as const;

export function formatError(
  template: string,
  ...args: (string | number)[]
): string {
  return template.replaceAll(/{(\d+)}/g, (match, index) => {
    const argIndex = Number.parseInt(index, 10);
    return args[argIndex] === undefined ? match : String(args[argIndex]);
  });
}
