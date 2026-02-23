import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { createHash, randomBytes } from "node:crypto";
import { ProjectApiKey } from "../entities/project-api-key.entity";

const API_KEY_PREFIX = "sk-arcane-";
const API_KEY_RANDOM_BYTES = 24;

export interface ApiKeyStatus {
  exists: boolean;
  createdAt?: Date;
}

export interface CreateApiKeyResult {
  apiKey: string;
}

@Injectable()
export class ProjectApiKeyService {
  private readonly logger = new Logger(ProjectApiKeyService.name);

  constructor(
    @InjectRepository(ProjectApiKey)
    private readonly projectApiKeyRepository: Repository<ProjectApiKey>,
    private readonly configService: ConfigService,
  ) {}

  private computeFastHash(apiKey: string): string {
    const salt = this.configService.get<string>("API_KEY_SALT");
    if (!salt) {
      throw new Error("API_KEY_SALT environment variable is required");
    }
    const saltHash = createHash("sha256").update(salt).digest("hex");
    return createHash("sha256")
      .update(apiKey + saltHash)
      .digest("hex");
  }

  private generateApiKey(): string {
    const random = randomBytes(API_KEY_RANDOM_BYTES).toString("hex");
    return `${API_KEY_PREFIX}${random}`;
  }

  async createOrRegenerate(
    projectId: string,
    createdById: string,
  ): Promise<CreateApiKeyResult> {
    await this.revoke(projectId);

    const apiKey = this.generateApiKey();
    const fastHashedSecretKey = this.computeFastHash(apiKey);

    await this.projectApiKeyRepository.save({
      projectId,
      fastHashedSecretKey,
      createdById,
    });

    this.logger.log(`API key created for project ${projectId}`);
    return { apiKey };
  }

  async findByProject(projectId: string): Promise<ApiKeyStatus> {
    const key = await this.projectApiKeyRepository.findOne({
      where: { projectId },
      select: ["id", "createdAt"],
    });
    return {
      exists: !!key,
      createdAt: key?.createdAt,
    };
  }

  async findByApiKey(apiKey: string): Promise<ProjectApiKey | null> {
    const candidateHash = this.computeFastHash(apiKey);
    return this.projectApiKeyRepository.findOne({
      where: { fastHashedSecretKey: candidateHash },
      relations: ["project"],
    });
  }

  async revoke(projectId: string): Promise<void> {
    const result = await this.projectApiKeyRepository.delete({ projectId });
    if (result.affected && result.affected > 0) {
      this.logger.log(`API key revoked for project ${projectId}`);
    }
  }

  async updateLastUsedAt(id: string): Promise<void> {
    await this.projectApiKeyRepository.update(id, {
      lastUsedAt: new Date(),
    });
  }
}
