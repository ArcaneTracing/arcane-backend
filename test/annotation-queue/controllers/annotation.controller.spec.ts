jest.mock("@thallesp/nestjs-better-auth", () => ({
  Session:
    () => (target: any, propertyKey: string, parameterIndex: number) => {},
  UserSession: class UserSession {},
}));

jest.mock("../../../src/rbac/guards/org-project-permission.guard", () => ({
  OrgProjectPermissionGuard: jest.fn(() => ({
    canActivate: jest.fn(() => true),
  })),
}));

jest.mock(
  "../../../src/annotation-queue/guards/queue-belongs-to-project.guard",
  () => ({
    QueueBelongsToProjectGuard: jest.fn(() => ({
      canActivate: jest.fn(() => true),
    })),
  }),
);

jest.mock(
  "../../../src/annotation-queue/guards/annotation-belongs-to-queue.guard",
  () => ({
    AnnotationBelongsToQueueGuard: jest.fn(() => ({
      canActivate: jest.fn(() => true),
    })),
  }),
);

import { Test, TestingModule } from "@nestjs/testing";
import { AnnotationController } from "../../../src/annotation-queue/controllers/annotation.controller";
import { AnnotationService } from "../../../src/annotation-queue/services/annotation.service";
import { CreateAnnotationRequestDto } from "../../../src/annotation-queue/dto/request/create-annotation-request.dto";
import { UpdateAnnotationRequestDto } from "../../../src/annotation-queue/dto/request/update-annotation-request.dto";
import { AnnotationResponseDto } from "../../../src/annotation-queue/dto/response/annotation-response.dto";
import { MessageResponseDto } from "../../../src/annotation-queue/dto/response/message-response.dto";

type UserSession = {
  session: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    expiresAt: Date;
    token: string;
  };
  user: {
    id: string;
    email?: string;
    name: string;
    emailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
};

describe("AnnotationController", () => {
  let controller: AnnotationController;
  let annotationService: AnnotationService;

  const mockAnnotationService = {
    createAnnotation: jest.fn(),
    updateAnnotationAnswer: jest.fn(),
    removeAnnotation: jest.fn(),
  };

  const mockUserSession: UserSession = {
    session: {
      id: "session-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: "user-1",
      expiresAt: new Date(),
      token: "token-1",
    },
    user: {
      id: "user-1",
      email: "test@example.com",
      name: "Test User",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const mockAnnotationResponseDto: AnnotationResponseDto = {
    id: "annotation-1",
    queueId: "queue-1",
    answers: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as AnnotationResponseDto;

  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      controllers: [AnnotationController],
      providers: [
        {
          provide: AnnotationService,
          useValue: mockAnnotationService,
        },
      ],
    }).compile();

    controller = module.get<AnnotationController>(AnnotationController);
    annotationService = module.get<AnnotationService>(AnnotationService);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createAnnotation", () => {
    it("should create a new annotation", async () => {
      const createDto: CreateAnnotationRequestDto = {
        traceId: "trace-1",
        answers: [],
      };
      mockAnnotationService.createAnnotation.mockResolvedValue(
        mockAnnotationResponseDto,
      );

      const result = await controller.createAnnotation(
        "project-1",
        "queue-1",
        createDto,
        mockUserSession,
      );

      expect(result).toEqual(mockAnnotationResponseDto);
      expect(annotationService.createAnnotation).toHaveBeenCalledWith(
        "project-1",
        "queue-1",
        mockUserSession.user.id,
        createDto,
      );
    });
  });

  describe("updateAnnotation", () => {
    it("should update an annotation", async () => {
      const updateDto: UpdateAnnotationRequestDto = {
        answers: [],
      };
      mockAnnotationService.updateAnnotationAnswer.mockResolvedValue(
        mockAnnotationResponseDto,
      );

      const result = await controller.updateAnnotation(
        "annotation-1",
        updateDto,
      );

      expect(result).toEqual(mockAnnotationResponseDto);
      expect(annotationService.updateAnnotationAnswer).toHaveBeenCalledWith(
        "annotation-1",
        updateDto,
      );
    });
  });

  describe("removeAnnotation", () => {
    it("should remove an annotation", async () => {
      const messageResponse: MessageResponseDto = {
        message: "Annotation deleted successfully",
      };
      mockAnnotationService.removeAnnotation.mockResolvedValue(messageResponse);

      const result = await controller.removeAnnotation("annotation-1");

      expect(result).toEqual(messageResponse);
      expect(annotationService.removeAnnotation).toHaveBeenCalledWith(
        "annotation-1",
      );
    });
  });
});
