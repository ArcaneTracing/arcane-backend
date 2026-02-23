import { Organisation } from "../entities/organisation.entity";
import { OrganisationResponseDto } from "../dto/response/organisation.dto";

export class OrganisationMapper {
  static toDto(organisation: Organisation): OrganisationResponseDto {
    return {
      id: organisation.id,
      name: organisation.name,
      createdAt: organisation.createdAt,
      updatedAt: organisation.updatedAt,
    };
  }
}
