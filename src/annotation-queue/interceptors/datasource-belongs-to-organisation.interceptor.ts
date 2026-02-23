import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Datasource } from "../../datasources/entities/datasource.entity";

@Injectable()
export class DatasourceBelongsToOrganisationInterceptor implements NestInterceptor {
  private readonly logger = new Logger(
    DatasourceBelongsToOrganisationInterceptor.name,
  );

  constructor(
    @InjectRepository(Datasource)
    private readonly datasourceRepository: Repository<Datasource>,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const { organisationId } = request.params;
    const datasourceId = request.body?.datasourceId;

    if (!organisationId) {
      throw new ForbiddenException("Organisation ID is required");
    }

    if (!datasourceId) {
      return next.handle();
    }

    const exists = await this.datasourceRepository
      .createQueryBuilder("d")
      .where("d.id = :datasourceId", { datasourceId })
      .andWhere("d.organisationId = :organisationId", { organisationId })
      .getExists();

    if (!exists) {
      throw new ForbiddenException(
        `Datasource does not belong to this organisation`,
      );
    }

    return next.handle();
  }
}
