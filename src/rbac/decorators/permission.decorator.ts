import { applyDecorators, SetMetadata } from "@nestjs/common";

export const PERMISSION_KEY = "permission";
export const ALLOW_PROJECT_CREATOR_KEY = "allowProjectCreator";

export const Permission = (
  permission: string,
  options?: { allowProjectCreator?: boolean },
) => {
  const decorators = [SetMetadata(PERMISSION_KEY, permission)];

  if (options?.allowProjectCreator) {
    decorators.push(SetMetadata(ALLOW_PROJECT_CREATOR_KEY, true));
  }

  return applyDecorators(...decorators);
};
