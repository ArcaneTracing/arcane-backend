import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddForeignKeyIndexes1737129700000 implements MigrationInterface {
  name = 'AddForeignKeyIndexes1737129700000';

  public async up(queryRunner: QueryRunner): Promise<void> {

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_dataset_rows_dataset_id" ON "dataset_rows" ("dataset_id");`);


    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_experiment_results_experiment_id" ON "experiment_results" ("experiment_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_experiment_results_dataset_row_id" ON "experiment_results" ("dataset_row_id");`);


    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_score_results_evaluation_id" ON "score_results" ("evaluation_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_score_results_score_id" ON "score_results" ("score_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_score_results_dataset_row_id" ON "score_results" ("dataset_row_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_score_results_experiment_result_id" ON "score_results" ("experiment_result_id");`);


    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_prompt_versions_prompt_id" ON "prompt_versions" ("prompt_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_prompt_versions_model_configuration_id" ON "prompt_versions" ("model_configuration_id");`);


    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_experiments_project_id" ON "experiments" ("project_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_experiments_prompt_version_id" ON "experiments" ("prompt_version_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_experiments_dataset_id" ON "experiments" ("dataset_id");`);


    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_evaluations_project_id" ON "evaluations" ("project_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_evaluations_dataset_id" ON "evaluations" ("dataset_id");`);


    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_annotations_trace_id" ON "annotations" ("trace_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_annotations_conversation_id" ON "annotations" ("conversation_id");`);


    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_queued_traces_queue_id" ON "queued_traces" ("queue_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_queued_traces_datasource_id" ON "queued_traces" ("datasource_id");`);


    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_queued_conversations_queue_id" ON "queued_conversations" ("queue_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_queued_conversations_conversation_config_id" ON "queued_conversations" ("conversation_config_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_queued_conversations_datasource_id" ON "queued_conversations" ("datasource_id");`);


    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_projects_organisation_id" ON "projects" ("organisation_id");`);


    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_datasets_project_id" ON "datasets" ("project_id");`);


    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_annotation_answers_question_id" ON "annotation_answers" ("question_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_annotation_answers_annotation_id" ON "annotation_answers" ("annotation_id");`);


    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_annotation_queues_project_id" ON "annotation_queues" ("project_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_annotation_queues_template_id" ON "annotation_queues" ("template_id");`);


    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_roles_organisation_id" ON "roles" ("organisation_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_roles_project_id" ON "roles" ("project_id");`);


    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_user_roles_user_id" ON "user_roles" ("user_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_user_roles_role_id" ON "user_roles" ("role_id");`);


    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_entities_organisation_id" ON "entities" ("organisation_id");`);


    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_datasources_organisation_id" ON "datasources" ("organisation_id");`);


    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_model_configurations_organisation_id" ON "model_configurations" ("organisation_id");`);


    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_prompts_project_id" ON "prompts" ("project_id");`);


    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_scores_project_id" ON "scores" ("project_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_scores_evaluator_prompt_id" ON "scores" ("evaluator_prompt_id");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_scores_evaluator_prompt_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_scores_project_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_prompts_project_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_model_configurations_organisation_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_datasources_organisation_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_entities_organisation_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_roles_role_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_roles_user_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_roles_project_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_roles_organisation_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_annotation_queues_template_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_annotation_queues_project_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_annotation_answers_annotation_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_annotation_answers_question_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_datasets_project_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_projects_organisation_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_queued_conversations_datasource_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_queued_conversations_conversation_config_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_queued_conversations_queue_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_queued_traces_datasource_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_queued_traces_queue_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_annotations_conversation_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_annotations_trace_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_evaluations_dataset_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_evaluations_project_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_experiments_dataset_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_experiments_prompt_version_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_experiments_project_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_prompt_versions_model_configuration_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_prompt_versions_prompt_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_score_results_experiment_result_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_score_results_dataset_row_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_score_results_score_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_score_results_evaluation_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_experiment_results_dataset_row_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_experiment_results_experiment_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dataset_rows_dataset_id";`);
  }
}