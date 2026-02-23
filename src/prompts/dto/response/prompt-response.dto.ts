import {
  TemplateType,
  TemplateFormat,
  PromptTemplate,
  InvocationParameters,
  Tools,
  ResponseFormat,
} from "../prompt-types";

export interface PromptResponseDto {
  id: string;
  name: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  promotedVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PromptVersionResponseDto {
  id: string;
  promptId: string;
  promptName: string;
  versionName: string | null;
  description: string | null;
  modelConfigurationId: string;
  template: PromptTemplate;
  templateType: TemplateType;
  templateFormat: TemplateFormat;
  invocationParameters: InvocationParameters;
  tools: Tools | null;
  responseFormat: ResponseFormat | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResponseDto<T> {
  data: T;
}

export interface ListResponseDto<T> {
  data: T[];
}
