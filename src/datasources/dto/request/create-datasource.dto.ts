import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsUrl,
  ValidateIf,
  IsObject,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { PartialType } from "@nestjs/mapped-types";
import {
  DatasourceType,
  DatasourceSource,
} from "../../entities/datasource.entity";

export class CreateDatasourceDto {
  @ApiProperty({
    type: "string",
    description: "Datasource name",
    example: "My Tempo Instance",
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    type: "string",
    required: false,
    description: "Datasource description",
    example: "Production Tempo instance",
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    type: "string",
    required: false,
    description:
      "Datasource URL (required for tempo, jaeger, custom_api unless configured in config)",
    example: "https://tempo.example.com",
  })
  @IsString()
  @ValidateIf(
    (o) =>
      (o.source !== "clickhouse" || !o.config?.clickhouse) &&
      (o.source !== "custom_api" || !o.config?.customApi?.baseUrl),
  )
  @IsNotEmpty()
  @IsUrl({
    protocols: ["http", "https"],
    require_protocol: true,
    require_valid_protocol: true,
    require_tld: false,
  })
  url?: string;

  @ApiProperty({
    enum: DatasourceType,
    description: "Type of datasource",
    example: DatasourceType.TRACES,
  })
  @IsEnum(DatasourceType)
  @IsNotEmpty()
  type: DatasourceType;

  @ApiProperty({
    enum: DatasourceSource,
    description: "Source/provider of the datasource",
    example: DatasourceSource.TEMPO,
    enumName: "DatasourceSource",
  })
  @IsEnum(DatasourceSource)
  @IsNotEmpty()
  source: DatasourceSource;

  @ApiProperty({
    type: Object,
    required: false,
    description:
      "Additional configuration (e.g., ClickHouse connection details, custom API config)",
    example: { clickhouse: { host: "localhost", port: 8123 } },
  })
  @IsObject()
  @IsOptional()
  config?: Record<string, any>;
}

export class UpdateDatasourceDto extends PartialType(CreateDatasourceDto) {
  @ValidateIf((o) => {
    if (o.url === undefined || o.url === "") {
      return false;
    }
    if (o.config?.clickhouse) {
      return false;
    }
    if (o.config?.customApi?.baseUrl) {
      return false;
    }
    return true;
  })
  @IsString()
  @IsUrl({
    protocols: ["http", "https"],
    require_protocol: true,
    require_valid_protocol: true,
    require_tld: false,
  })
  url?: string;
}
