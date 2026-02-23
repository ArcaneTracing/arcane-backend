export class PermissionsResponseDto {
  instance: string[];
  organisation: string[];
  project: string[];
  all: string[];
  features?: {
    enterprise: boolean;
  };
}
