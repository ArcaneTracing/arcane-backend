import {
  ExecutionContext,
  ForbiddenException,
  CallHandler,
} from "@nestjs/common";
import { of, lastValueFrom } from "rxjs";
import { DatasourceBelongsToOrganisationInterceptor } from "../../../src/annotation-queue/interceptors/datasource-belongs-to-organisation.interceptor";
import { Datasource } from "../../../src/datasources/entities/datasource.entity";
import { Repository } from "typeorm";

describe("DatasourceBelongsToOrganisationInterceptor", () => {
  let interceptor: DatasourceBelongsToOrganisationInterceptor;
  let repository: Repository<Datasource>;
  let mockQueryBuilder: {
    where: jest.Mock;
    andWhere: jest.Mock;
    getExists: jest.Mock;
  };

  const createContext = (
    params: Record<string, any>,
    body?: Record<string, any>,
  ): ExecutionContext => {
    const request = { params, body };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;
  };

  const createNext = (): CallHandler => ({
    handle: jest.fn(() => of("ok")),
  });

  beforeEach(() => {
    mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getExists: jest.fn(),
    };
    repository = {
      createQueryBuilder: jest.fn(() => mockQueryBuilder),
    } as unknown as Repository<Datasource>;

    interceptor = new DatasourceBelongsToOrganisationInterceptor(repository);
  });

  it("should throw when organisationId is missing", async () => {
    const context = createContext({});
    const next = createNext();

    await expect(interceptor.intercept(context, next)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(interceptor.intercept(context, next)).rejects.toThrow(
      "Organisation ID is required",
    );
    expect(next.handle).not.toHaveBeenCalled();
  });

  it("should skip validation when datasourceId is missing", async () => {
    const context = createContext({ organisationId: "org-1" }, {});
    const next = createNext();

    const stream = await interceptor.intercept(context, next);
    const result = await lastValueFrom(stream);

    expect(result).toBe("ok");
    expect(repository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it("should throw when datasource does not belong to organisation", async () => {
    mockQueryBuilder.getExists.mockResolvedValue(false);
    const context = createContext(
      { organisationId: "org-1" },
      { datasourceId: "datasource-1" },
    );
    const next = createNext();

    await expect(interceptor.intercept(context, next)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(interceptor.intercept(context, next)).rejects.toThrow(
      "Datasource does not belong to this organisation",
    );
    expect(repository.createQueryBuilder).toHaveBeenCalledWith("d");
  });

  it("should allow request when datasource belongs to organisation", async () => {
    mockQueryBuilder.getExists.mockResolvedValue(true);
    const context = createContext(
      { organisationId: "org-1" },
      { datasourceId: "datasource-1" },
    );
    const next = createNext();

    const stream = await interceptor.intercept(context, next);
    const result = await lastValueFrom(stream);

    expect(result).toBe("ok");
    expect(repository.createQueryBuilder).toHaveBeenCalledWith("d");
    expect(mockQueryBuilder.where).toHaveBeenCalledWith(
      "d.id = :datasourceId",
      { datasourceId: "datasource-1" },
    );
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      "d.organisationId = :organisationId",
      { organisationId: "org-1" },
    );
  });
});
