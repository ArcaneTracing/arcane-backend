import { Injectable } from "@nestjs/common";
import { Evaluation } from "../../entities/evaluation.entity";
import { Dataset } from "../../../datasets/entities/dataset.entity";
import { Experiment } from "../../../experiments/entities/experiment.entity";
import { EvaluationQueueOrchestrator } from "../queue-orchestration/evaluation-queue-orchestrator.service";

@Injectable()
export class EvaluationJobsService {
  constructor(
    private readonly evaluationQueueOrchestrator: EvaluationQueueOrchestrator,
  ) {}

  async postScoreMappingsToQueue(
    evaluation: Evaluation,
    dataset: Dataset | null,
    experiments: Experiment[],
  ): Promise<void> {
    return this.evaluationQueueOrchestrator.postEvaluationToQueue(
      evaluation,
      dataset,
      experiments,
    );
  }
}
