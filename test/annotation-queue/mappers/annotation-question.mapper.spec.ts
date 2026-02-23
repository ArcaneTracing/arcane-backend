import { AnnotationQuestionMapper } from "../../../src/annotation-queue/mappers/annotation-question.mapper";
import { AnnotationQuestion } from "../../../src/annotation-queue/entities/annotation-question.entity";
import { AnnotationQuestionType } from "../../../src/annotation-queue/entities/annotation-question-type.enum";

describe("AnnotationQuestionMapper", () => {
  describe("toResponseDto", () => {
    it("should map entity to response dto", () => {
      const question = new AnnotationQuestion();
      question.id = "question-1";
      question.question = "How was it?";
      question.helperText = "Be honest";
      question.placeholder = "Type here";
      question.type = AnnotationQuestionType.TEXT;
      question.options = ["a", "b"];
      question.min = 1;
      question.max = 5;
      question.required = true;
      question.default = "a";

      const result = AnnotationQuestionMapper.toResponseDto(question);

      expect(result).toEqual({
        id: "question-1",
        question: "How was it?",
        helperText: "Be honest",
        placeholder: "Type here",
        type: AnnotationQuestionType.TEXT,
        options: ["a", "b"],
        min: 1,
        max: 5,
        required: true,
        default: "a",
      });
    });
  });

  describe("toEntity", () => {
    it("should map dto to entity and default required to false", () => {
      const dto = {
        question: "Rate",
        helperText: "1-5",
        placeholder: "Pick",
        type: AnnotationQuestionType.NUMBER,
        options: ["1", "2"],
        min: 1,
        max: 5,
        default: "1",
      };

      const result = AnnotationQuestionMapper.toEntity(dto);

      expect(result).toBeInstanceOf(AnnotationQuestion);
      expect(result.question).toBe("Rate");
      expect(result.helperText).toBe("1-5");
      expect(result.placeholder).toBe("Pick");
      expect(result.type).toBe(AnnotationQuestionType.NUMBER);
      expect(result.options).toEqual(["1", "2"]);
      expect(result.min).toBe(1);
      expect(result.max).toBe(5);
      expect(result.required).toBe(false);
      expect(result.default).toBe("1");
    });

    it("should keep required when provided", () => {
      const dto = {
        question: "Agree?",
        type: AnnotationQuestionType.BOOLEAN,
        required: true,
      };

      const result = AnnotationQuestionMapper.toEntity(dto);

      expect(result.required).toBe(true);
    });
  });
});
