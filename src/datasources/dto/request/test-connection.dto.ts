import { IsString, IsOptional, IsObject, IsEnum } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { DatasourceSource } from "../../entities/datasource.entity";

export class TestConnectionDto {
  @ApiPropertyOptional({
    description: "URL to test (overrides datasource URL if provided)",
  })
  @IsString()
  @IsOptional()
  url?: string;

  @ApiProperty({
    enum: DatasourceSource,
    description: "Datasource source type",
  })
  @IsEnum(DatasourceSource)
  source: DatasourceSource;

  @ApiPropertyOptional({
    description: "Config to test (overrides datasource config if provided)",
  })
  @IsObject()
  @IsOptional()
  config?: Record<string, any>;
}
