import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { ApiKeyGuard } from "../../../src/auth/guards/api-key.guard";
import { ConfigService } from "@nestjs/config";

describe("ApiKeyGuard", () => {
  let guard: ApiKeyGuard;
  let configService: ConfigService;

  const createContext = (authorization?: string): ExecutionContext => {
    const request = {
      headers: authorization ? { authorization } : {},
      method: "GET",
      url: "/test",
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;
  };

  beforeEach(() => {
    configService = {
      get: jest.fn(),
    } as any;
    guard = new ApiKeyGuard(configService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should throw when authorization header is missing", () => {
    const context = createContext();

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("should throw when header format is invalid", () => {
    const context = createContext("invalidformat");

    expect(() => guard.canActivate(context)).toThrow(
      "Invalid authorization header format",
    );
  });

  it("should throw when scheme is invalid", () => {
    const context = createContext("Basic token");

    expect(() => guard.canActivate(context)).toThrow(
      "Invalid authorization scheme",
    );
  });

  it("should throw when api key is missing", () => {
    const context = createContext("Bearer ");

    expect(() => guard.canActivate(context)).toThrow("Missing API key");
  });

  it("should throw when API_KEY is not configured", () => {
    const context = createContext("Bearer token");
    (configService.get as jest.Mock).mockReturnValue(undefined);

    expect(() => guard.canActivate(context)).toThrow(
      "API key authentication not configured",
    );
  });

  it("should throw when api key is invalid", () => {
    const context = createContext("Bearer token");
    (configService.get as jest.Mock).mockReturnValue("valid");

    expect(() => guard.canActivate(context)).toThrow("Invalid API key");
  });

  it("should allow when api key is valid", () => {
    const context = createContext("ApiKey valid");
    (configService.get as jest.Mock).mockReturnValue("valid");

    expect(guard.canActivate(context)).toBe(true);
  });
});
