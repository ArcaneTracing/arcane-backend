import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";
import * as cookieParser from "cookie-parser";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });
  const configService = app.get(ConfigService);
  const logger = new Logger("Bootstrap");

  app.useGlobalPipes();
  app.use(cookieParser());

  app.enableCors({
    origin:
      process.env.NODE_ENV === "development"
        ? true
        : process.env.FRONTEND_URL?.split(",") || [],
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
    allowedHeaders: ["Content-Type", "Accept", "Authorization", "Origin"],
    exposedHeaders: ["Set-Cookie"],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  const port = Number.parseInt(configService.get<string>("PORT") || "8085", 10);
  const host = configService.get<string>("HOST") || "0.0.0.0";

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Arcane API")
    .setDescription(
      "API documentation for Arcane backend services. This API provides endpoints for managing traces, conversations, evaluations, projects, and more.",
    )
    .setVersion("1.0")
    .addServer(`http://${host}:${port}`, "Development server")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Enter JWT token",
      },
      "bearer",
    )
    .addApiKey(
      {
        type: "apiKey",
        name: "Authorization",
        in: "header",
        description: 'Use "Bearer <token>" or "ApiKey <key>"',
      },
      "apiKey",
    )
    .addTag("health", "Health check endpoints")
    .addTag("organisations", "Organisation management")
    .addTag("projects", "Project management")
    .addTag("datasources", "Datasource management")
    .addTag("traces", "Trace management and search")
    .addTag("conversations", "Conversation management")
    .addTag("evaluations", "Evaluation management")
    .addTag("experiments", "Experiment management")
    .addTag("datasets", "Dataset management")
    .addTag("scores", "Score management")
    .addTag("prompts", "Prompt management")
    .addTag("entities", "Entity management")
    .addTag("annotation-queue", "Annotation queue management")
    .addTag(
      "conversation-configuration",
      "Conversation configuration management",
    )
    .addTag("model-configuration", "Model configuration management")
    .addTag("rbac", "Role-based access control")
    .addTag("instance-owners", "Instance owner management")
    .addTag("permissions", "Permission management")
    .addTag("roles", "Role management")
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig, {
    deepScanRoutes: true,
    operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
  });
  SwaggerModule.setup("api-docs", app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: "alpha",
      operationsSorter: "alpha",
    },
  });

  logger.log(
    `Swagger documentation available at: http://${host}:${port}/api-docs`,
  );

  await app.listen(port, host);
  logger.log(`Application is running on: http://${host}:${port}`);
}
bootstrap();
