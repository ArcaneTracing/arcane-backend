import { AnnotationAnswerMapper } from "../../../src/annotation-queue/mappers/annotation-answer.mapper";
import { AnnotationAnswer } from "../../../src/annotation-queue/entities/annotation-answer.entity";
import { Annotation } from "../../../src/annotation-queue/entities/annotation.entity";

describe("AnnotationAnswerMapper", () => {
  describe("toDto", () => {
    it("should map entity fields to response dto", () => {
      const answer = new AnnotationAnswer();
      answer.id = "answer-1";
      answer.questionId = "question-1";
      answer.value = "text";
      answer.numberValue = 42;
      answer.booleanValue = true;
      answer.stringArrayValue = ["a", "b"];

      const result = AnnotationAnswerMapper.toDto(answer);

      expect(result).toEqual({
        id: "answer-1",
        questionId: "question-1",
        value: "text",
        numberValue: 42,
        booleanValue: true,
        stringArrayValue: ["a", "b"],
      });
    });
  });

  describe("toEntity", () => {
    it("should map dto fields to entity", () => {
      const dto = {
        questionId: "question-1",
        value: "text",
        numberValue: 7,
        booleanValue: false,
        stringArrayValue: ["x"],
      };

      const result = AnnotationAnswerMapper.toEntity(dto);

      expect(result).toBeInstanceOf(AnnotationAnswer);
      expect(result.questionId).toBe("question-1");
      expect(result.value).toBe("text");
      expect(result.numberValue).toBe(7);
      expect(result.booleanValue).toBe(false);
      expect(result.stringArrayValue).toEqual(["x"]);
      expect(result.annotation).toBeUndefined();
      expect(result.annotationId).toBeUndefined();
    });

    it("should set annotation or annotationId when provided", () => {
      const dto = { questionId: "question-1" };
      const annotation = new Annotation();
      annotation.id = "annotation-1";

      const withAnnotation = AnnotationAnswerMapper.toEntity(dto, annotation);
      const withAnnotationId = AnnotationAnswerMapper.toEntity(
        dto,
        undefined,
        "annotation-2",
      );

      expect(withAnnotation.annotation).toBe(annotation);
      expect(withAnnotation.annotationId).toBeUndefined();
      expect(withAnnotationId.annotation).toBeUndefined();
      expect(withAnnotationId.annotationId).toBe("annotation-2");
    });
  });
});
