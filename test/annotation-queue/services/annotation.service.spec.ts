import { Test, TestingModule } from "@nestjs/testing";
import { AnnotationService } from "../../../src/annotation-queue/services/annotation.service";
import { AnnotationCreationService } from "../../../src/annotation-queue/services/annotation-creation.service";
import { AnnotationUpdateService } from "../../../src/annotation-queue/services/annotation-update.service";
import { AnnotationManagementService } from "../../../src/annotation-queue/services/annotation-management.service";
import { CreateAnnotationRequestDto } from "../../../src/annotation-queue/dto/request/create-annotation-request.dto";
import { UpdateAnnotationRequestDto } from "../../../src/annotation-queue/dto/request/update-annotation-request.dto";
import { AnnotationResponseDto } from "../../../src/annotation-queue/dto/response/annotation-response.dto";
import { MessageResponseDto } from "../../../src/annotation-queue/dto/response/message-response.dto";

describe("AnnotationService", () => {
  let service: AnnotationService;
  let annotationCreationService: AnnotationCreationService;
  let annotationUpdateService: AnnotationUpdateService;
  let annotationManagementService: AnnotationManagementService;

  const mockAnnotationCreationService = {
    createAnnotation: jest.fn(),
  };

  const mockAnnotationUpdateService = {
    updateAnnotationAnswer: jest.fn(),
  };

  const mockAnnotationManagementService = {
    removeAnnotation: jest.fn(),
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
      providers: [
        AnnotationService,
        {
          provide: AnnotationCreationService,
          useValue: mockAnnotationCreationService,
        },
        {
          provide: AnnotationUpdateService,
          useValue: mockAnnotationUpdateService,
        },
        {
          provide: AnnotationManagementService,
          useValue: mockAnnotationManagementService,
        },
      ],
    }).compile();

    service = module.get<AnnotationService>(AnnotationService);
    annotationCreationService = module.get<AnnotationCreationService>(
      AnnotationCreationService,
    );
    annotationUpdateService = module.get<AnnotationUpdateService>(
      AnnotationUpdateService,
    );
    annotationManagementService = module.get<AnnotationManagementService>(
      AnnotationManagementService,
    );
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createAnnotation", () => {
    it("should delegate to annotationCreationService", async () => {
      const createDto: CreateAnnotationRequestDto = {
        traceId: "trace-1",
        answers: [],
      };
      mockAnnotationCreationService.createAnnotation.mockResolvedValue(
        mockAnnotationResponseDto,
      );

      const result = await service.createAnnotation(
        "project-1",
        "queue-1",
        "user-1",
        createDto,
      );

      expect(annotationCreationService.createAnnotation).toHaveBeenCalledWith(
        "project-1",
        "queue-1",
        "user-1",
        createDto,
      );
      expect(result).toEqual(mockAnnotationResponseDto);
    });
  });

  describe("updateAnnotationAnswer", () => {
    it("should delegate to annotationUpdateService", async () => {
      const updateDto: UpdateAnnotationRequestDto = {
        answers: [],
      };
      mockAnnotationUpdateService.updateAnnotationAnswer.mockResolvedValue(
        mockAnnotationResponseDto,
      );

      const result = await service.updateAnnotationAnswer(
        "annotation-1",
        updateDto,
      );

      expect(
        annotationUpdateService.updateAnnotationAnswer,
      ).toHaveBeenCalledWith("annotation-1", updateDto);
      expect(result).toEqual(mockAnnotationResponseDto);
    });
  });

  describe("removeAnnotation", () => {
    it("should delegate to annotationManagementService", async () => {
      const messageResponse: MessageResponseDto = {
        message: "Annotation deleted successfully",
      };
      mockAnnotationManagementService.removeAnnotation.mockResolvedValue(
        messageResponse,
      );

      const result = await service.removeAnnotation("annotation-1");

      expect(annotationManagementService.removeAnnotation).toHaveBeenCalledWith(
        "annotation-1",
      );
      expect(result).toEqual(messageResponse);
    });
  });
});
