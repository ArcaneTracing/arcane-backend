export const EVALUATION_JOBS_TOPIC = "evaluation-jobs";
export const EVALUATION_RESULTS_TOPIC = "evaluation-results";
export const EXPERIMENT_JOBS_TOPIC = "experiment-jobs";
export const EXPERIMENT_RESULTS_TOPIC = "experiment-results";

export interface RabbitTopicConfig {
  exchange: string;
  routingKey: string;
  queue?: string;
}
