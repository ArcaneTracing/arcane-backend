import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, IsNull } from "typeorm";
import { Score, ScoringType } from "../entities/score.entity";
import { Prompt } from "../../prompts/entities/prompt.entity";
import { CreateScoreRequestDto } from "../dto/request/create-score-request.dto";
import { UpdateScoreRequestDto } from "../dto/request/update-score-request.dto";
import { ScoreResponseDto } from "../dto/response/score-response.dto";
import { ScoreMapper } from "../mappers";
import { ScoreUpdater } from "../updaters/score-updater";
import { AuditService } from "../../audit/audit.service";

@Injectable()
export class ScoresService {
  private readonly logger = new Logger(ScoresService.name);

  constructor(
    @InjectRepository(Score)
    private readonly scoreRepository: Repository<Score>,
    @InjectRepository(Prompt)
    private readonly promptRepository: Repository<Prompt>,
    private readonly auditService: AuditService,
  ) {}

  private toAuditState(s: Score): Record<string, unknown> {
    return {
      id: s.id,
      name: s.name,
      description: s.description ?? null,
      scoringType: s.scoringType,
      projectId: s.projectId ?? null,
      evaluatorPromptId: s.evaluatorPromptId ?? null,
      ragasScoreKey: s.ragasScoreKey ?? null,
      scale: s.scale ?? null,
      ordinalConfig: s.ordinalConfig ?? null,
    };
  }

  private async resolveEvaluatorPrompt(
    projectId: string,
    evaluatorPromptId?: string,
  ): Promise<Prompt | null> {
    if (!evaluatorPromptId) {
      return null;
    }

    const prompt = await this.promptRepository.findOne({
      where: { id: evaluatorPromptId },
    });

    if (prompt?.projectId !== projectId) {
      throw new NotFoundException(
        `Prompt with ID ${evaluatorPromptId} not found in this project`,
      );
    }

    return prompt;
  }

  async create(
    projectId: string,
    dto: CreateScoreRequestDto,
    userId: string,
    organisationId: string,
  ): Promise<ScoreResponseDto> {
    const evaluatorPrompt = await this.resolveEvaluatorPrompt(
      projectId,
      dto.evaluatorPromptId,
    );

    const savedScore = await this.scoreRepository.save(
      ScoreMapper.toEntity(dto, projectId, userId, evaluatorPrompt),
    );

    await this.auditService.record({
      action: "score.created",
      actorId: userId,
      actorType: "user",
      resourceType: "score",
      resourceId: savedScore.id,
      organisationId,
      projectId,
      afterState: this.toAuditState(savedScore),
      metadata: { creatorId: userId, organisationId, projectId },
    });

    return ScoreMapper.toDto(savedScore);
  }

  async findAll(projectId: string): Promise<ScoreResponseDto[]> {
    const scores = await this.scoreRepository.find({
      where: [{ projectId }, { projectId: IsNull() }],
      relations: ["evaluatorPrompt"],
      order: { createdAt: "DESC" },
    });

    return scores.map((score) => ScoreMapper.toDto(score));
  }

  async findOne(projectId: string, scoreId: string): Promise<ScoreResponseDto> {
    const score = await this.scoreRepository.findOne({
      where: [
        { id: scoreId, projectId },
        { id: scoreId, projectId: IsNull() },
      ],
      relations: ["evaluatorPrompt"],
    });

    if (!score) {
      throw new NotFoundException(`Score with ID ${scoreId} not found`);
    }

    return ScoreMapper.toDto(score);
  }

  async update(
    projectId: string,
    scoreId: string,
    dto: UpdateScoreRequestDto,
    userId?: string,
    organisationId?: string,
  ): Promise<ScoreResponseDto> {
    const score = await this.scoreRepository.findOne({
      where: [
        { id: scoreId, projectId },
        { id: scoreId, projectId: IsNull() },
      ],
      relations: ["evaluatorPrompt"],
    });

    if (!score) {
      throw new NotFoundException(`Score with ID ${scoreId} not found`);
    }

    if (score.projectId === null) {
      throw new BadRequestException("Global scores cannot be updated");
    }

    const beforeState = this.toAuditState(score);

    ScoreUpdater.apply(score, dto);

    if (dto.evaluatorPromptId !== undefined) {
      if (dto.evaluatorPromptId === null) {
        score.evaluatorPromptId = null;
        score.evaluatorPrompt = null;
      } else {
        const evaluatorPrompt = await this.resolveEvaluatorPrompt(
          projectId,
          dto.evaluatorPromptId,
        );
        score.evaluatorPromptId = evaluatorPrompt?.id ?? null;
        score.evaluatorPrompt = evaluatorPrompt;
      }
    }

    await this.scoreRepository.save(score);

    const reloadedScore = await this.scoreRepository.findOne({
      where: { id: score.id },
      relations: ["evaluatorPrompt"],
    });

    if (!reloadedScore) {
      throw new NotFoundException("Score not found after update");
    }

    if (organisationId && score.projectId) {
      await this.auditService.record({
        action: "score.updated",
        actorId: userId,
        actorType: "user",
        resourceType: "score",
        resourceId: scoreId,
        organisationId,
        projectId: score.projectId,
        beforeState,
        afterState: this.toAuditState(reloadedScore),
        metadata: {
          changedFields: Object.keys(dto),
          organisationId,
          projectId: score.projectId,
        },
      });
    }

    return ScoreMapper.toDto(reloadedScore);
  }

  async remove(
    projectId: string,
    scoreId: string,
    userId?: string,
    organisationId?: string,
  ): Promise<void> {
    const score = await this.scoreRepository.findOne({
      where: [
        { id: scoreId, projectId },
        { id: scoreId, projectId: IsNull() },
      ],
    });

    if (!score) {
      throw new NotFoundException(`Score with ID ${scoreId} not found`);
    }

    if (score.scoringType === ScoringType.RAGAS) {
      throw new BadRequestException("Ragas scores cannot be deleted");
    }

    const beforeState = this.toAuditState(score);

    await this.scoreRepository.remove(score);

    if (organisationId) {
      await this.auditService.record({
        action: "score.deleted",
        actorId: userId,
        actorType: "user",
        resourceType: "score",
        resourceId: scoreId,
        organisationId,
        projectId: score.projectId ?? undefined,
        beforeState,
        afterState: null,
        metadata: { organisationId, projectId: score.projectId ?? null },
      });
    }
  }
}
