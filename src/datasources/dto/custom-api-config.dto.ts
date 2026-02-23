import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsObject,
  ValidateNested,
  IsNotEmpty,
} from "class-validator";
import { Type } from "class-transformer";

export enum CustomApiAuthenticationType {
  HEADER = "header",
  BEARER = "bearer",
  BASIC = "basic",
}

export class CustomApiEndpointConfigDto {
  @ApiProperty({
    type: "string",
    description: "Endpoint path",
    example: "/api/traces/search",
  })
  @IsString()
  @IsNotEmpty()
  path: string;
}

export class CustomApiEndpointsConfigDto {
  @ApiProperty({
    type: CustomApiEndpointConfigDto,
    description: "Search endpoint configuration",
  })
  @ValidateNested()
  @Type(() => CustomApiEndpointConfigDto)
  search: CustomApiEndpointConfigDto;

  @ApiProperty({
    type: CustomApiEndpointConfigDto,
    description: "Search by trace ID endpoint configuration",
  })
  @ValidateNested()
  @Type(() => CustomApiEndpointConfigDto)
  searchByTraceId: CustomApiEndpointConfigDto;

  @ApiProperty({
    type: CustomApiEndpointConfigDto,
    required: false,
    description: "Get attribute names endpoint configuration",
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CustomApiEndpointConfigDto)
  attributeNames?: CustomApiEndpointConfigDto;

  @ApiProperty({
    type: CustomApiEndpointConfigDto,
    required: false,
    description: "Get attribute values endpoint configuration",
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CustomApiEndpointConfigDto)
  attributeValues?: CustomApiEndpointConfigDto;
}

export class CustomApiCapabilitiesConfigDto {
  @ApiProperty({
    type: "boolean",
    required: false,
    default: true,
    description: "Enable search by query",
  })
  @IsOptional()
  @IsBoolean()
  searchByQuery?: boolean;

  @ApiProperty({
    type: "boolean",
    required: false,
    default: false,
    description: "Enable search by attributes",
  })
  @IsOptional()
  @IsBoolean()
  searchByAttributes?: boolean;

  @ApiProperty({
    type: "boolean",
    required: false,
    default: false,
    description:
      "Enable filter by attribute existence (optimizes conversations)",
  })
  @IsOptional()
  @IsBoolean()
  filterByAttributeExists?: boolean;

  @ApiProperty({
    type: "boolean",
    required: false,
    default: false,
    description: "Enable get attribute names",
  })
  @IsOptional()
  @IsBoolean()
  getAttributeNames?: boolean;

  @ApiProperty({
    type: "boolean",
    required: false,
    default: false,
    description: "Enable get attribute values",
  })
  @IsOptional()
  @IsBoolean()
  getAttributeValues?: boolean;
}

export class CustomApiAuthenticationConfigDto {
  @ApiProperty({
    enum: CustomApiAuthenticationType,
    description: "Authentication type",
  })
  @IsEnum(CustomApiAuthenticationType)
  type: CustomApiAuthenticationType;

  @ApiProperty({
    type: "string",
    required: false,
    description: "Header name (for header type)",
  })
  @IsOptional()
  @IsString()
  headerName?: string;

  @ApiProperty({
    type: "string",
    required: false,
    description: "Authentication value (for header or bearer type)",
  })
  @IsOptional()
  @IsString()
  value?: string;

  @ApiProperty({
    type: "string",
    required: false,
    description: "Username (for basic type)",
  })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({
    type: "string",
    required: false,
    description: "Password (for basic type)",
  })
  @IsOptional()
  @IsString()
  password?: string;
}

export class CustomApiConfigDto {
  @ApiProperty({
    type: "string",
    description: "Base URL for the Custom API",
    example: "https://api.example.com",
  })
  @IsString()
  @IsNotEmpty()
  baseUrl: string;

  @ApiProperty({
    type: CustomApiEndpointsConfigDto,
    description: "Endpoint configurations",
  })
  @ValidateNested()
  @Type(() => CustomApiEndpointsConfigDto)
  endpoints: CustomApiEndpointsConfigDto;

  @ApiProperty({
    type: CustomApiCapabilitiesConfigDto,
    required: false,
    description: "Capability flags",
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CustomApiCapabilitiesConfigDto)
  capabilities?: CustomApiCapabilitiesConfigDto;

  @ApiProperty({
    type: CustomApiAuthenticationConfigDto,
    required: false,
    description: "Authentication configuration",
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CustomApiAuthenticationConfigDto)
  authentication?: CustomApiAuthenticationConfigDto;

  @ApiProperty({
    type: "object",
    description: "Additional headers",
    example: { "X-Custom-Header": "value" },
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;
}
