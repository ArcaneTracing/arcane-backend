import { DatasourceType } from "../entities/datasource.entity";
import { DatasourceSource } from "../entities/datasource.entity";

export class DatasourceDto {
  id: string;
  name: string;
  description: string;
  url: string;
  type: DatasourceType;
  source: DatasourceSource;
  config?: Record<string, any>;
  azureConfig?: {
    tenant_id: string;
    client_id: string;
    client_secret: string;
    subscription_id: string;
    resource_group: string;
    app_insights_name: string;
  };
}
