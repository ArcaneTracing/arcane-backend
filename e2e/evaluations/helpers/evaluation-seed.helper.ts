import { DataSource } from "typeorm";
import { Organisation } from "../../../src/organisations/entities/organisation.entity";
import { Project } from "../../../src/projects/entities/project.entity";
import { Dataset } from "../../../src/datasets/entities/dataset.entity";
import {
  Score,
  ScoringType,
  ScaleOption,
  OrdinalConfig,
} from "../../../src/scores/entities/score.entity";
import {
  Evaluation,
  EvaluationScope,
  EvaluationType,
} from "../../../src/evaluations/entities/evaluation.entity";
import {
  ScoreResult,
  ScoreResultStatus,
} from "../../../src/evaluations/entities/score-result.entity";
import { Experiment } from "../../../src/experiments/entities/experiment.entity";
import { ExperimentResult } from "../../../src/experiments/entities/experiment-result.entity";
import { DatasetRow } from "../../../src/datasets/entities/dataset-row.entity";
import { ModelConfiguration } from "../../../src/model-configuration/entities/model-configuration.entity";
import { Prompt } from "../../../src/prompts/entities/prompt.entity";
import {
  PromptVersion,
  TemplateType,
  TemplateFormat,
} from "../../../src/prompts/entities/prompt-version.entity";
import {
  generateNominalValues,
  generateNumericValues,
  generateOrdinalValues,
  nominalCodesToNumbers,
  ordinalLabelsToScaleValues,
  distributionHelpers,
} from "./data-generators.helper";
import {
  batchInsertDatasetRows,
  batchInsertScoreResults,
  batchInsertExperimentResults,
  batchInsertScoreResultsForExperiment,
} from "./batch-insertion.helper";

const log = (msg: string) => console.log(`[E2E] ${msg}`);

function valuesToNumbers(
  values: (string | number)[],
  scoringType: "NOMINAL" | "ORDINAL" | "NUMERIC",
  options: { distribution?: Record<string, number>; scale?: ScaleOption[] },
): number[] {
  if (scoringType === "NUMERIC") {
    return values as number[];
  }
  if (scoringType === "NOMINAL") {
    const distribution =
      options.distribution ??
      distributionHelpers.calculateDistribution(values as string[]);
    return nominalCodesToNumbers(values as string[], distribution);
  }
  if (scoringType === "ORDINAL" && options.scale) {
    return ordinalLabelsToScaleValues(values as string[], options.scale);
  }
  throw new Error("ORDINAL requires scale");
}

export interface SeedDatasetEvaluationOptions {
  organisationId?: string;
  projectId?: string;
  datasetId?: string;
  evaluationId?: string;
  scoreId?: string;
  scoringType: "NOMINAL" | "ORDINAL" | "NUMERIC";
  nominalValues?: string[];
  numericValues?: number[];
  ordinalValues?: string[];
  scale?: ScaleOption[];
  ordinalConfig?: OrdinalConfig;
  createdById?: string;
  numRows?: number;
}

export interface SeedDatasetEvaluationResult {
  organisationId: string;
  projectId: string;
  evaluationId: string;
  scoreId: string;
  datasetId: string;
}

const TEST_USER_ID = "test-user-id";

async function ensureTestUserMembership(
  dataSource: DataSource,
  organisationId: string,
  projectId: string,
): Promise<void> {
  await dataSource.query(
    `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
     VALUES ($1, 'Test User', 'test@test.com', true, NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
    [TEST_USER_ID],
  );
  await dataSource.query(
    `INSERT INTO organisation_users (organisation_id, user_id) VALUES ($1, $2) ON CONFLICT (organisation_id, user_id) DO NOTHING`,
    [organisationId, TEST_USER_ID],
  );
  await dataSource.query(
    `INSERT INTO project_users (project_id, user_id) VALUES ($1, $2) ON CONFLICT (project_id, user_id) DO NOTHING`,
    [projectId, TEST_USER_ID],
  );
  const [ownerRole] = await dataSource.query(
    `SELECT id FROM roles WHERE is_instance_level = true AND organisation_id IS NULL AND project_id IS NULL LIMIT 1`,
  );
  if (ownerRole) {
    await dataSource.query(
      `INSERT INTO user_roles (id, user_id, role_id, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())
       ON CONFLICT (user_id, role_id) DO NOTHING`,
      [TEST_USER_ID, ownerRole.id],
    );
  }
}
export async function seedDatasetEvaluationWithScoreResults(
  dataSource: DataSource,
  options: SeedDatasetEvaluationOptions,
): Promise<SeedDatasetEvaluationResult> {
  const orgRepo = dataSource.getRepository(Organisation);
  const projectRepo = dataSource.getRepository(Project);
  const datasetRepo = dataSource.getRepository(Dataset);
  const scoreRepo = dataSource.getRepository(Score);
  const evaluationRepo = dataSource.getRepository(Evaluation);
  const scoreResultRepo = dataSource.getRepository(ScoreResult);
  const datasetRowRepo = dataSource.getRepository(DatasetRow);

  let organisation: Organisation;
  if (options.organisationId) {
    organisation = await orgRepo.findOneOrFail({
      where: { id: options.organisationId },
    });
  } else {
    organisation = orgRepo.create({
      name: `Test Organisation ${Date.now()}`,
    });
    organisation = await orgRepo.save(organisation);
  }

  let project: Project;
  if (options.projectId) {
    project = await projectRepo.findOneOrFail({
      where: { id: options.projectId },
      relations: ["organisation"],
    });
  } else {
    project = projectRepo.create({
      name: `Test Project ${Date.now()}`,
      organisationId: organisation.id,
      createdById: options.createdById || "test-user-id",
    });
    project = await projectRepo.save(project);
  }
  await ensureTestUserMembership(dataSource, organisation.id, project.id);

  const providedValuesLength =
    options.nominalValues?.length ||
    options.numericValues?.length ||
    options.ordinalValues?.length ||
    0;
  const numRows =
    options.numRows ?? (providedValuesLength > 0 ? providedValuesLength : 5);
  log(`seedDatasetEvaluation: ${numRows} rows, ${options.scoringType}`);

  let dataset: Dataset;
  let datasetRows: DatasetRow[];
  if (options.datasetId) {
    dataset = await datasetRepo.findOneOrFail({
      where: { id: options.datasetId },
    });
    datasetRows = await datasetRowRepo.find({
      where: { datasetId: dataset.id },
      take: numRows,
    });
  } else {
    dataset = datasetRepo.create({
      name: `Test Dataset ${Date.now()}`,
      projectId: project.id,
      header: ["input", "output"],
      createdById: options.createdById || "test-user-id",
    });
    dataset = await datasetRepo.save(dataset);

    if (numRows > 100) {
      log(`  Inserting ${numRows} dataset rows (batch)...`);
      datasetRows = await batchInsertDatasetRows(
        dataSource,
        dataset.id,
        numRows,
      );
      log(`  Dataset rows done.`);
    } else {
      datasetRows = [];
      for (let i = 0; i < numRows; i++) {
        const row = datasetRowRepo.create({
          datasetId: dataset.id,
          values: [`test input ${i}`, `test output ${i}`],
        });
        await datasetRowRepo.save(row);
        datasetRows.push(row);
      }
    }
  }

  let score: Score;
  if (options.scoreId) {
    score = await scoreRepo.findOneOrFail({ where: { id: options.scoreId } });
  } else {
    const scoreData: Partial<Score> = {
      name: `Test Score ${Date.now()}`,
      projectId: project.id,
      scoringType:
        options.scoringType === "NOMINAL"
          ? ScoringType.NOMINAL
          : options.scoringType === "ORDINAL"
            ? ScoringType.ORDINAL
            : ScoringType.NUMERIC,
      scale: options.scale || null,
      ordinalConfig: options.ordinalConfig || null,
      createdById: options.createdById || "test-user-id",
    };
    score = scoreRepo.create(scoreData);
    score = await scoreRepo.save(score);
  }

  let evaluation: Evaluation;
  if (options.evaluationId) {
    evaluation = await evaluationRepo.findOneOrFail({
      where: { id: options.evaluationId },
      relations: ["scores"],
    });
  } else {
    evaluation = evaluationRepo.create({
      name: `Test Evaluation ${Date.now()}`,
      projectId: project.id,
      evaluationType: EvaluationType.AUTOMATIC,
      evaluationScope: EvaluationScope.DATASET,
      datasetId: dataset.id,
      createdById: options.createdById || "test-user-id",
    });
    evaluation = await evaluationRepo.save(evaluation);

    await dataSource
      .createQueryBuilder()
      .relation(Evaluation, "scores")
      .of(evaluation.id)
      .add(score.id);
  }

  let values: (string | number)[];
  if (options.nominalValues && options.nominalValues.length > 0) {
    values = [...options.nominalValues];

    if (numRows > values.length) {
      const distribution = distributionHelpers.calculateDistribution(
        values as string[],
      );
      const additional = generateNominalValues(
        numRows - values.length,
        distribution,
      );
      values = [...values, ...additional];
    }
  } else if (options.numericValues && options.numericValues.length > 0) {
    values = [...options.numericValues];
    if (numRows > values.length) {
      const mean = distributionHelpers.calculateMean(values as number[]);
      const stdDev = distributionHelpers.calculateStdDev(values as number[]);
      const additional = generateNumericValues(
        numRows - values.length,
        mean,
        stdDev,
      );
      values = [...values, ...additional];
    }
  } else if (
    options.ordinalValues &&
    options.ordinalValues.length > 0 &&
    options.scale
  ) {
    values = [...options.ordinalValues];
    if (numRows > values.length) {
      const distribution = distributionHelpers.calculateDistribution(
        values as string[],
      );
      const distributionArray = options.scale.map(
        (opt) => distribution[opt.label] || 0,
      );
      const additional = generateOrdinalValues(
        numRows - values.length,
        options.scale,
        distributionArray,
      );
      values = [...values, ...additional];
    }
  } else {
    values = generateNominalValues(numRows, { A: 0.5, B: 0.5 });
  }

  values = values.slice(0, numRows);

  const rowsToUse = datasetRows.slice(0, numRows);

  const distribution =
    options.scoringType === "NOMINAL"
      ? distributionHelpers.calculateDistribution(values as string[])
      : undefined;
  const numericValues = valuesToNumbers(values, options.scoringType, {
    distribution,
    scale: options.scale,
  });

  if (numRows > 100) {
    log(`  Inserting ${numRows} score results (batch)...`);
    await batchInsertScoreResults(
      dataSource,
      evaluation.id,
      score.id,
      rowsToUse,
      numericValues,
    );
    log(`  Score results done.`);
  } else {
    for (let i = 0; i < rowsToUse.length; i++) {
      const result = scoreResultRepo.create({
        evaluationId: evaluation.id,
        scoreId: score.id,
        datasetRowId: rowsToUse[i]?.id || null,
        value: numericValues[i],
        status: ScoreResultStatus.DONE,
      });
      await scoreResultRepo.save(result);
    }
  }

  log(`seedDatasetEvaluation: done.`);
  return {
    organisationId: organisation.id,
    projectId: project.id,
    evaluationId: evaluation.id,
    scoreId: score.id,
    datasetId: dataset.id,
  };
}

export interface SeedExperimentEvaluationOptions {
  organisationId?: string;
  projectId?: string;
  datasetId?: string;
  evaluationId?: string;
  experimentId?: string;
  scoreId?: string;
  scoringType: "NOMINAL" | "ORDINAL" | "NUMERIC";
  nominalValues?: string[];
  numericValues?: number[];
  ordinalValues?: string[];
  scale?: ScaleOption[];
  ordinalConfig?: OrdinalConfig;
  createdById?: string;
  numRows?: number;
}

export interface SeedExperimentEvaluationResult {
  organisationId: string;
  projectId: string;
  evaluationId: string;
  experimentId: string;
  scoreId: string;
  datasetId: string;
}
export async function seedExperimentEvaluationWithScoreResults(
  dataSource: DataSource,
  options: SeedExperimentEvaluationOptions,
): Promise<SeedExperimentEvaluationResult> {
  const orgRepo = dataSource.getRepository(Organisation);
  const providedValuesLength =
    options.nominalValues?.length ||
    options.numericValues?.length ||
    options.ordinalValues?.length ||
    0;
  const numRows = options.numRows ?? Math.max(5, providedValuesLength);
  log(`seedExperimentEvaluation: ${numRows} rows, ${options.scoringType}`);
  const projectRepo = dataSource.getRepository(Project);
  const datasetRepo = dataSource.getRepository(Dataset);
  const experimentRepo = dataSource.getRepository(Experiment);
  const experimentResultRepo = dataSource.getRepository(ExperimentResult);
  const scoreRepo = dataSource.getRepository(Score);
  const evaluationRepo = dataSource.getRepository(Evaluation);
  const scoreResultRepo = dataSource.getRepository(ScoreResult);
  const datasetRowRepo = dataSource.getRepository(DatasetRow);
  const modelConfigRepo = dataSource.getRepository(ModelConfiguration);
  const promptRepo = dataSource.getRepository(Prompt);
  const promptVersionRepo = dataSource.getRepository(PromptVersion);

  let organisation: Organisation;
  if (options.organisationId) {
    organisation = await orgRepo.findOneOrFail({
      where: { id: options.organisationId },
    });
  } else {
    organisation = orgRepo.create({
      name: `Test Organisation ${Date.now()}`,
    });
    organisation = await orgRepo.save(organisation);
  }

  let project: Project;
  if (options.projectId) {
    project = await projectRepo.findOneOrFail({
      where: { id: options.projectId },
      relations: ["organisation"],
    });
  } else {
    project = projectRepo.create({
      name: `Test Project ${Date.now()}`,
      organisationId: organisation.id,
      createdById: options.createdById || "test-user-id",
    });
    project = await projectRepo.save(project);
  }
  await ensureTestUserMembership(dataSource, organisation.id, project.id);

  let dataset: Dataset;
  let datasetRows: DatasetRow[];
  if (options.datasetId) {
    dataset = await datasetRepo.findOneOrFail({
      where: { id: options.datasetId },
    });
    datasetRows = await datasetRowRepo.find({
      where: { datasetId: dataset.id },
      take: numRows,
    });
  } else {
    dataset = datasetRepo.create({
      name: `Test Dataset ${Date.now()}`,
      projectId: project.id,
      header: ["input", "output"],
      createdById: options.createdById || "test-user-id",
    });
    dataset = await datasetRepo.save(dataset);

    if (numRows > 100) {
      log(`  Inserting ${numRows} dataset rows (batch)...`);
      datasetRows = await batchInsertDatasetRows(
        dataSource,
        dataset.id,
        numRows,
      );
      log(`  Dataset rows done.`);
    } else {
      datasetRows = [];
      for (let i = 0; i < numRows; i++) {
        const row = datasetRowRepo.create({
          datasetId: dataset.id,
          values: [`test input ${i}`, `test output ${i}`],
        });
        await datasetRowRepo.save(row);
        datasetRows.push(row);
      }
    }
  }

  let experiment: Experiment;
  if (options.experimentId) {
    experiment = await experimentRepo.findOneOrFail({
      where: { id: options.experimentId },
    });
  } else {
    const modelConfig = modelConfigRepo.create({
      name: `Test Model Config ${Date.now()}`,
      configuration: { adapter: "openai", model: "gpt-4" },
      organisationId: organisation.id,
      createdById: options.createdById || "test-user-id",
    });
    await modelConfigRepo.save(modelConfig);

    const prompt = promptRepo.create({
      name: `Test Prompt ${Date.now()}`,
      projectId: project.id,
    });
    await promptRepo.save(prompt);

    const promptVersion = promptVersionRepo.create({
      promptId: prompt.id,
      modelConfigurationId: modelConfig.id,
      templateType: TemplateType.STR,
      templateFormat: TemplateFormat.NONE,
      template: "Hello {{input}}",
      invocationParameters: {},
    });
    await promptVersionRepo.save(promptVersion);

    experiment = experimentRepo.create({
      name: `Test Experiment ${Date.now()}`,
      projectId: project.id,
      datasetId: dataset.id,
      promptVersionId: promptVersion.id,
      createdById: options.createdById || "test-user-id",
    });
    experiment = await experimentRepo.save(experiment);
  }

  let score: Score;
  if (options.scoreId) {
    score = await scoreRepo.findOneOrFail({ where: { id: options.scoreId } });
  } else {
    const scoreData: Partial<Score> = {
      name: `Test Score ${Date.now()}`,
      projectId: project.id,
      scoringType:
        options.scoringType === "NOMINAL"
          ? ScoringType.NOMINAL
          : options.scoringType === "ORDINAL"
            ? ScoringType.ORDINAL
            : ScoringType.NUMERIC,
      scale: options.scale || null,
      ordinalConfig: options.ordinalConfig || null,
      createdById: options.createdById || "test-user-id",
    };
    score = scoreRepo.create(scoreData);
    score = await scoreRepo.save(score);
  }

  let evaluation: Evaluation;
  if (options.evaluationId) {
    evaluation = await evaluationRepo.findOneOrFail({
      where: { id: options.evaluationId },
      relations: ["scores", "experiments"],
    });
  } else {
    evaluation = evaluationRepo.create({
      name: `Test Evaluation ${Date.now()}`,
      projectId: project.id,
      evaluationType: EvaluationType.AUTOMATIC,
      evaluationScope: EvaluationScope.EXPERIMENT,
      createdById: options.createdById || "test-user-id",
    });
    evaluation = await evaluationRepo.save(evaluation);

    await dataSource
      .createQueryBuilder()
      .relation(Evaluation, "scores")
      .of(evaluation.id)
      .add(score.id);

    await dataSource
      .createQueryBuilder()
      .relation(Evaluation, "experiments")
      .of(evaluation.id)
      .add(experiment.id);
  }

  let values: (string | number)[];
  if (options.nominalValues && options.nominalValues.length > 0) {
    values = [...options.nominalValues];
    if (numRows > values.length) {
      const distribution = distributionHelpers.calculateDistribution(
        values as string[],
      );
      const additional = generateNominalValues(
        numRows - values.length,
        distribution,
      );
      values = [...values, ...additional];
    }
  } else if (options.numericValues && options.numericValues.length > 0) {
    values = [...options.numericValues];
    if (numRows > values.length) {
      const mean = distributionHelpers.calculateMean(values as number[]);
      const stdDev = distributionHelpers.calculateStdDev(values as number[]);
      const additional = generateNumericValues(
        numRows - values.length,
        mean,
        stdDev,
      );
      values = [...values, ...additional];
    }
  } else if (
    options.ordinalValues &&
    options.ordinalValues.length > 0 &&
    options.scale
  ) {
    values = [...options.ordinalValues];
    if (numRows > values.length) {
      const distribution = distributionHelpers.calculateDistribution(
        values as string[],
      );
      const distributionArray = options.scale.map(
        (opt) => distribution[opt.label] || 0,
      );
      const additional = generateOrdinalValues(
        numRows - values.length,
        options.scale,
        distributionArray,
      );
      values = [...values, ...additional];
    }
  } else {
    values = generateNominalValues(numRows, { A: 0.5, B: 0.5 });
  }

  values = values.slice(0, numRows);

  const rowsToUse = datasetRows.slice(0, numRows);

  const distribution =
    options.scoringType === "NOMINAL"
      ? distributionHelpers.calculateDistribution(values as string[])
      : undefined;
  const numericValues = valuesToNumbers(values, options.scoringType, {
    distribution,
    scale: options.scale,
  });

  let experimentResults: ExperimentResult[];
  if (numRows > 100) {
    log(`  Inserting ${numRows} experiment results (batch)...`);
    experimentResults = await batchInsertExperimentResults(
      dataSource,
      experiment.id,
      rowsToUse,
    );
    log(`  Experiment results done.`);
  } else {
    experimentResults = [];
    for (let i = 0; i < rowsToUse.length; i++) {
      const experimentResult = experimentResultRepo.create({
        experimentId: experiment.id,
        datasetRowId: rowsToUse[i].id,
        status: "DONE" as any,
      });
      const savedExperimentResult =
        await experimentResultRepo.save(experimentResult);
      experimentResults.push(savedExperimentResult);
    }
  }

  if (numRows > 100) {
    log(`  Inserting ${numRows} score results (batch)...`);
    await batchInsertScoreResultsForExperiment(
      dataSource,
      evaluation.id,
      score.id,
      experimentResults,
      numericValues,
    );
    log(`  Score results done.`);
  } else {
    for (let i = 0; i < experimentResults.length; i++) {
      const result = scoreResultRepo.create({
        evaluationId: evaluation.id,
        scoreId: score.id,
        experimentResultId: experimentResults[i].id,
        value: numericValues[i],
        status: ScoreResultStatus.DONE,
      });
      await scoreResultRepo.save(result);
    }
  }

  log(`seedExperimentEvaluation: done.`);
  return {
    organisationId: organisation.id,
    projectId: project.id,
    evaluationId: evaluation.id,
    experimentId: experiment.id,
    scoreId: score.id,
    datasetId: dataset.id,
  };
}

export interface SeedComparisonEvaluationOptions {
  organisationId?: string;
  projectId?: string;
  datasetId?: string;
  evaluationId?: string;
  scoreId?: string;
  scoringType: "NOMINAL" | "ORDINAL" | "NUMERIC";
  valuesA?: (string | number)[];
  valuesB?: (string | number)[];
  scale?: ScaleOption[];
  ordinalConfig?: OrdinalConfig;
  createdById?: string;
  numRows?: number;
}

export interface SeedComparisonEvaluationResult {
  organisationId: string;
  projectId: string;
  evaluationId: string;
  experimentIdA: string;
  experimentIdB: string;
  scoreId: string;
  datasetId: string;
}

export async function seedComparisonEvaluationWithTwoExperiments(
  dataSource: DataSource,
  options: SeedComparisonEvaluationOptions,
): Promise<SeedComparisonEvaluationResult> {
  const orgRepo = dataSource.getRepository(Organisation);
  const projectRepo = dataSource.getRepository(Project);
  const datasetRepo = dataSource.getRepository(Dataset);
  const datasetRowRepo = dataSource.getRepository(DatasetRow);
  const experimentRepo = dataSource.getRepository(Experiment);
  const experimentResultRepo = dataSource.getRepository(ExperimentResult);
  const scoreRepo = dataSource.getRepository(Score);
  const evaluationRepo = dataSource.getRepository(Evaluation);
  const scoreResultRepo = dataSource.getRepository(ScoreResult);
  const modelConfigRepo = dataSource.getRepository(ModelConfiguration);
  const promptRepo = dataSource.getRepository(Prompt);
  const promptVersionRepo = dataSource.getRepository(PromptVersion);

  const providedLength = Math.min(
    options.valuesA?.length ?? 0,
    options.valuesB?.length ?? Infinity,
  );
  const numRows = options.numRows ?? Math.max(5, providedLength);
  log(`seedComparisonEvaluation: ${numRows} rows, ${options.scoringType}`);

  let organisation: Organisation;
  if (options.organisationId) {
    organisation = await orgRepo.findOneOrFail({
      where: { id: options.organisationId },
    });
  } else {
    organisation = orgRepo.create({ name: `Test Organisation ${Date.now()}` });
    organisation = await orgRepo.save(organisation);
  }

  let project: Project;
  if (options.projectId) {
    project = await projectRepo.findOneOrFail({
      where: { id: options.projectId },
      relations: ["organisation"],
    });
  } else {
    project = projectRepo.create({
      name: `Test Project ${Date.now()}`,
      organisationId: organisation.id,
      createdById: options.createdById || "test-user-id",
    });
    project = await projectRepo.save(project);
  }
  await ensureTestUserMembership(dataSource, organisation.id, project.id);

  let dataset: Dataset;
  let datasetRows: DatasetRow[];
  if (options.datasetId) {
    dataset = await datasetRepo.findOneOrFail({
      where: { id: options.datasetId },
    });
    datasetRows = await datasetRowRepo.find({
      where: { datasetId: dataset.id },
      take: numRows,
    });
  } else {
    dataset = datasetRepo.create({
      name: `Test Dataset ${Date.now()}`,
      projectId: project.id,
      header: ["input", "output"],
      createdById: options.createdById || "test-user-id",
    });
    dataset = await datasetRepo.save(dataset);
    if (numRows > 100) {
      log(`  Inserting ${numRows} dataset rows (batch)...`);
      datasetRows = await batchInsertDatasetRows(
        dataSource,
        dataset.id,
        numRows,
      );
    } else {
      datasetRows = [];
      for (let i = 0; i < numRows; i++) {
        const row = datasetRowRepo.create({
          datasetId: dataset.id,
          values: [`test input ${i}`, `test output ${i}`],
        });
        await datasetRowRepo.save(row);
        datasetRows.push(row);
      }
    }
  }
  const rowsToUse = datasetRows.slice(0, numRows);

  let valuesA: (string | number)[];
  let valuesB: (string | number)[];
  if (
    options.valuesA &&
    options.valuesB &&
    options.valuesA.length >= numRows &&
    options.valuesB.length >= numRows
  ) {
    valuesA = options.valuesA.slice(0, numRows);
    valuesB = options.valuesB.slice(0, numRows);
  } else {
    if (options.scoringType === "NOMINAL") {
      valuesA = generateNominalValues(numRows, { A: 0.5, B: 0.5 }, 42);
      valuesB = generateNominalValues(numRows, { A: 0.5, B: 0.5 }, 43);
    } else if (options.scoringType === "NUMERIC") {
      const numA = generateNumericValues(numRows, 0.5, 0.1, 42);
      valuesA = numA;
      valuesB = numA.map(
        (v, i) => v + (i % 3 === 0 ? 0.1 : i % 3 === 1 ? -0.05 : 0),
      );
    } else if (options.scoringType === "ORDINAL" && options.scale) {
      valuesA = generateOrdinalValues(
        numRows,
        options.scale,
        [0.2, 0.2, 0.2, 0.2, 0.2],
        42,
      );
      valuesB = generateOrdinalValues(
        numRows,
        options.scale,
        [0.2, 0.2, 0.2, 0.2, 0.2],
        43,
      );
    } else {
      valuesA = generateNominalValues(numRows, { A: 0.5, B: 0.5 }, 42);
      valuesB = generateNominalValues(numRows, { A: 0.5, B: 0.5 }, 43);
    }
  }

  const distribution =
    options.scoringType === "NOMINAL"
      ? distributionHelpers.calculateDistribution([
          ...(valuesA as string[]),
          ...(valuesB as string[]),
        ])
      : undefined;
  const numericValuesA = valuesToNumbers(valuesA, options.scoringType, {
    distribution,
    scale: options.scale,
  });
  const numericValuesB = valuesToNumbers(valuesB, options.scoringType, {
    distribution,
    scale: options.scale,
  });

  const modelConfig = modelConfigRepo.create({
    name: `Test Model Config ${Date.now()}`,
    configuration: { adapter: "openai", model: "gpt-4" },
    organisationId: organisation.id,
    createdById: options.createdById || "test-user-id",
  });
  await modelConfigRepo.save(modelConfig);

  const prompt = promptRepo.create({
    name: `Test Prompt ${Date.now()}`,
    projectId: project.id,
  });
  await promptRepo.save(prompt);

  const promptVersion = promptVersionRepo.create({
    promptId: prompt.id,
    modelConfigurationId: modelConfig.id,
    templateType: TemplateType.STR,
    templateFormat: TemplateFormat.NONE,
    template: "Hello {{input}}",
    invocationParameters: {},
  });
  await promptVersionRepo.save(promptVersion);

  const experimentA = experimentRepo.create({
    name: `Test Experiment A ${Date.now()}`,
    projectId: project.id,
    datasetId: dataset.id,
    promptVersionId: promptVersion.id,
    createdById: options.createdById || "test-user-id",
  });
  await experimentRepo.save(experimentA);

  const experimentB = experimentRepo.create({
    name: `Test Experiment B ${Date.now()}`,
    projectId: project.id,
    datasetId: dataset.id,
    promptVersionId: promptVersion.id,
    createdById: options.createdById || "test-user-id",
  });
  await experimentRepo.save(experimentB);

  let score: Score;
  if (options.scoreId) {
    score = await scoreRepo.findOneOrFail({ where: { id: options.scoreId } });
  } else {
    const scoreData: Partial<Score> = {
      name: `Test Score ${Date.now()}`,
      projectId: project.id,
      scoringType:
        options.scoringType === "NOMINAL"
          ? ScoringType.NOMINAL
          : options.scoringType === "ORDINAL"
            ? ScoringType.ORDINAL
            : ScoringType.NUMERIC,
      scale: options.scale || null,
      ordinalConfig: options.ordinalConfig || null,
      createdById: options.createdById || "test-user-id",
    };
    score = scoreRepo.create(scoreData);
    score = await scoreRepo.save(score);
  }

  const evaluation = evaluationRepo.create({
    name: `Test Evaluation ${Date.now()}`,
    projectId: project.id,
    evaluationType: EvaluationType.AUTOMATIC,
    evaluationScope: EvaluationScope.EXPERIMENT,
    createdById: options.createdById || "test-user-id",
  });
  await evaluationRepo.save(evaluation);

  await dataSource
    .createQueryBuilder()
    .relation(Evaluation, "scores")
    .of(evaluation.id)
    .add(score.id);
  await dataSource
    .createQueryBuilder()
    .relation(Evaluation, "experiments")
    .of(evaluation.id)
    .add(experimentA.id);
  await dataSource
    .createQueryBuilder()
    .relation(Evaluation, "experiments")
    .of(evaluation.id)
    .add(experimentB.id);

  let experimentResultsA: ExperimentResult[];
  let experimentResultsB: ExperimentResult[];
  if (numRows > 100) {
    log(`  Inserting ${numRows} experiment results for A (batch)...`);
    experimentResultsA = await batchInsertExperimentResults(
      dataSource,
      experimentA.id,
      rowsToUse,
    );
    log(`  Inserting ${numRows} experiment results for B (batch)...`);
    experimentResultsB = await batchInsertExperimentResults(
      dataSource,
      experimentB.id,
      rowsToUse,
    );
  } else {
    experimentResultsA = [];
    experimentResultsB = [];
    for (let i = 0; i < rowsToUse.length; i++) {
      const erA = experimentResultRepo.create({
        experimentId: experimentA.id,
        datasetRowId: rowsToUse[i].id,
        status: "DONE" as any,
      });
      const erB = experimentResultRepo.create({
        experimentId: experimentB.id,
        datasetRowId: rowsToUse[i].id,
        status: "DONE" as any,
      });
      experimentResultsA.push(await experimentResultRepo.save(erA));
      experimentResultsB.push(await experimentResultRepo.save(erB));
    }
  }

  if (numRows > 100) {
    log(`  Inserting ${numRows} score results for experiment A (batch)...`);
    await batchInsertScoreResultsForExperiment(
      dataSource,
      evaluation.id,
      score.id,
      experimentResultsA,
      numericValuesA,
    );
    log(`  Inserting ${numRows} score results for experiment B (batch)...`);
    await batchInsertScoreResultsForExperiment(
      dataSource,
      evaluation.id,
      score.id,
      experimentResultsB,
      numericValuesB,
    );
  } else {
    for (let i = 0; i < rowsToUse.length; i++) {
      const srA = scoreResultRepo.create({
        evaluationId: evaluation.id,
        scoreId: score.id,
        experimentResultId: experimentResultsA[i].id,
        value: numericValuesA[i],
        status: ScoreResultStatus.DONE,
      });
      const srB = scoreResultRepo.create({
        evaluationId: evaluation.id,
        scoreId: score.id,
        experimentResultId: experimentResultsB[i].id,
        value: numericValuesB[i],
        status: ScoreResultStatus.DONE,
      });
      await scoreResultRepo.save(srA);
      await scoreResultRepo.save(srB);
    }
  }

  log(`Running ANALYZE on experiment_results, score_results...`);
  await dataSource.query("ANALYZE experiment_results");
  await dataSource.query("ANALYZE score_results");
  console.log("[E2E] ANALYZE experiment_results, score_results complete");

  log(`seedComparisonEvaluation: done.`);
  return {
    organisationId: organisation.id,
    projectId: project.id,
    evaluationId: evaluation.id,
    experimentIdA: experimentA.id,
    experimentIdB: experimentB.id,
    scoreId: score.id,
    datasetId: dataset.id,
  };
}
export async function truncateEvaluationTables(
  dataSource: DataSource,
): Promise<void> {
  log("Truncating evaluation tables...");

  await dataSource.query("TRUNCATE TABLE score_results CASCADE");
  await dataSource.query("TRUNCATE TABLE evaluation_scores CASCADE");
  await dataSource.query("TRUNCATE TABLE evaluation_experiments CASCADE");
  await dataSource.query("TRUNCATE TABLE evaluations CASCADE");
  await dataSource.query("TRUNCATE TABLE experiment_results CASCADE");
  await dataSource.query("TRUNCATE TABLE experiments CASCADE");
  await dataSource.query("TRUNCATE TABLE scores CASCADE");
  await dataSource.query("TRUNCATE TABLE dataset_rows CASCADE");
  await dataSource.query("TRUNCATE TABLE datasets CASCADE");
  await dataSource.query("TRUNCATE TABLE projects CASCADE");
  await dataSource.query("TRUNCATE TABLE organisations CASCADE");
  log("Truncate complete.");
}
