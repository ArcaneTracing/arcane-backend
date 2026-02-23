import { validate, ValidationError } from "class-validator";
import { IsNonEmptyArray } from "../../../src/annotation-queue/validators/is-non-empty-array.validator";

class TestClass {
  @IsNonEmptyArray()
  items: any[];
}

describe("IsNonEmptyArray", () => {
  describe("validation", () => {
    it("should pass validation for non-empty array", async () => {
      const obj = new TestClass();
      obj.items = [1, 2, 3];

      const errors = await validate(obj);

      expect(errors).toHaveLength(0);
    });

    it("should fail validation for empty array", async () => {
      const obj = new TestClass();
      obj.items = [];

      const errors = await validate(obj);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe("items");
      expect(errors[0].constraints).toHaveProperty("isNonEmptyArray");
      expect(errors[0].constraints.isNonEmptyArray).toBe(
        "items must be a non-empty array",
      );
    });

    it("should fail validation for null", async () => {
      const obj = new TestClass();
      obj.items = null as any;

      const errors = await validate(obj);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe("items");
    });

    it("should fail validation for undefined", async () => {
      const obj = new TestClass();
      obj.items = undefined as any;

      const errors = await validate(obj);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe("items");
    });

    it("should fail validation for non-array value", async () => {
      const obj = new TestClass();
      obj.items = "not an array" as any;

      const errors = await validate(obj);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe("items");
    });

    it("should pass validation for array with objects", async () => {
      const obj = new TestClass();
      obj.items = [{ id: 1 }, { id: 2 }];

      const errors = await validate(obj);

      expect(errors).toHaveLength(0);
    });

    it("should pass validation for array with strings", async () => {
      const obj = new TestClass();
      obj.items = ["item1", "item2", "item3"];

      const errors = await validate(obj);

      expect(errors).toHaveLength(0);
    });
  });
});
