export class IdentifierUtils {
  static validate(identifier: string): string {
    if (!identifier || identifier.trim().length === 0) {
      throw new Error("Identifier cannot be empty");
    }
    const trimmed = identifier.trim();

    if (trimmed.startsWith(".") || trimmed.endsWith(".")) {
      throw new Error("Identifier cannot start or end with a dot");
    }

    if (trimmed.includes("..")) {
      throw new Error("Identifier cannot contain consecutive dots");
    }

    const validPattern = /^[a-zA-Z0-9._\s-]+$/;
    if (!validPattern.test(trimmed)) {
      throw new Error(
        "Identifier contains invalid characters. Only alphanumeric, dots, hyphens, underscores, and spaces are allowed",
      );
    }

    return trimmed;
  }
}
