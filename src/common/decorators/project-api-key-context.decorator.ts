import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface ProjectApiKeyContextData {
  projectId: string;
  organisationId: string;
  apiKeyId: string;
}

export const ProjectApiKeyContext = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): ProjectApiKeyContextData => {
    const request = ctx.switchToHttp().getRequest();
    return request.projectApiKeyContext;
  },
);
