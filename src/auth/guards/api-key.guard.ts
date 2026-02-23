import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization;

    if (!authHeader) {
      this.logger.warn(
        `No authorization header found for ${request.method} ${request.url}`,
      );
      throw new UnauthorizedException("Missing authorization header");
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2) {
      this.logger.warn(
        `Invalid authorization header format for ${request.method} ${request.url}`,
      );
      throw new UnauthorizedException("Invalid authorization header format");
    }

    const [scheme, apiKey] = parts;
    const validSchemes = ["Bearer", "ApiKey", "apikey"];

    if (!validSchemes.includes(scheme)) {
      this.logger.warn(`Invalid authorization scheme: ${scheme}`);
      throw new UnauthorizedException("Invalid authorization scheme");
    }

    if (!apiKey) {
      this.logger.warn(`API key missing in authorization header`);
      throw new UnauthorizedException("Missing API key");
    }

    const validApiKey = this.configService.get<string>("INTERNAL_API_KEY");

    if (!validApiKey) {
      this.logger.error("INTERNAL_API_KEY environment variable not configured");
      throw new UnauthorizedException("API key authentication not configured");
    }

    if (apiKey !== validApiKey) {
      this.logger.warn(
        `Invalid API key provided for ${request.method} ${request.url}`,
      );
      throw new UnauthorizedException("Invalid API key");
    }

    return true;
  }
}
