import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../common/constants/error-messages.constants";
import { ProjectApiKeyService } from "../services/project-api-key.service";

const BASIC_AUTH_USERNAME = "api-key";

@Injectable()
export class ProjectApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ProjectApiKeyGuard.name);

  constructor(private readonly projectApiKeyService: ProjectApiKeyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization;

    if (!authHeader?.startsWith("Basic ")) {
      this.logger.warn(
        `Missing or invalid Basic Auth for ${request.method} ${request.url}`,
      );
      throw new UnauthorizedException("Basic authentication required");
    }

    const base64Credentials = authHeader.slice(6);
    let credentials: string;
    try {
      credentials = Buffer.from(base64Credentials, "base64").toString("utf-8");
    } catch {
      this.logger.warn(`Invalid Base64 in Basic Auth`);
      throw new UnauthorizedException("Invalid authorization header");
    }

    const colonIndex = credentials.indexOf(":");
    if (colonIndex === -1) {
      this.logger.warn(`Invalid Basic Auth format`);
      throw new UnauthorizedException("Invalid authorization header");
    }

    const username = credentials.slice(0, colonIndex);
    const apiKeyFromRequest = credentials.slice(colonIndex + 1);

    if (username !== BASIC_AUTH_USERNAME || !apiKeyFromRequest) {
      this.logger.warn(
        `Basic Auth must use username "${BASIC_AUTH_USERNAME}" and API key as password`,
      );
      throw new UnauthorizedException(
        formatError(ERROR_MESSAGES.INVALID_PROJECT_API_KEY),
      );
    }

    const projectApiKey =
      await this.projectApiKeyService.findByApiKey(apiKeyFromRequest);
    if (!projectApiKey) {
      this.logger.warn(`Invalid API key for ${request.method} ${request.url}`);
      throw new UnauthorizedException(
        formatError(ERROR_MESSAGES.INVALID_PROJECT_API_KEY),
      );
    }

    this.projectApiKeyService
      .updateLastUsedAt(projectApiKey.id)
      .catch((err) => {
        this.logger.warn(`Failed to update lastUsedAt: ${err.message}`);
      });

    request.projectApiKeyContext = {
      projectId: projectApiKey.projectId,
      organisationId: projectApiKey.project.organisationId,
      apiKeyId: projectApiKey.id,
    };

    return true;
  }
}
