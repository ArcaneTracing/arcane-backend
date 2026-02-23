import { ApiProperty } from "@nestjs/swagger";
import {
  DatasourceType,
  DatasourceSource,
} from "src/datasources/entities/datasource.entity";

export class DatasourceListItemResponseDto {
  @ApiProperty({ type: "string", format: "uuid", description: "Datasource ID" })
  id: string;

  @ApiProperty({ type: "string", description: "Datasource name" })
  name: string;

  @ApiProperty({
    type: "string",
    nullable: true,
    description: "Datasource description",
  })
  description: string;

  @ApiProperty({ enum: DatasourceType, description: "Type of datasource" })
  type: DatasourceType;

  @ApiProperty({
    enum: DatasourceSource,
    description: "Source/provider of the datasource",
  })
  source: DatasourceSource;

  @ApiProperty({
    type: "boolean",
    description: "Whether search by query is supported",
  })
  isSearchByQueryEnabled: boolean;

  @ApiProperty({
    type: "boolean",
    description: "Whether search by attributes is supported",
  })
  isSearchByAttributesEnabled: boolean;

  @ApiProperty({
    type: "boolean",
    description: "Whether getting attribute names is supported",
  })
  isGetAttributeNamesEnabled: boolean;

  @ApiProperty({
    type: "boolean",
    description: "Whether getting attribute values is supported",
  })
  isGetAttributeValuesEnabled: boolean;
}
