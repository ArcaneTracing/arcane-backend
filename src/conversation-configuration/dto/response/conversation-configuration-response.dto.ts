export class ConversationConfigurationResponseDto {
  id: string;
  name: string;
  description?: string;
  stitchingAttributesName: string[];
  createdAt: Date;
  updatedAt: Date;
}
