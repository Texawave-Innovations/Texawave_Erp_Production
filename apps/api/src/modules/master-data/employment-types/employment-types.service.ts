import { Injectable } from "@nestjs/common";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { MasterDataService } from "../shared/master-data.service.js";
import type { CreateEmploymentTypeDto } from "./dto/create-employment-type.dto.js";
import type { QueryEmploymentTypeDto } from "./dto/query-employment-type.dto.js";
import type { UpdateEmploymentTypeDto } from "./dto/update-employment-type.dto.js";
import {
  EmploymentTypesRepository,
  type EmploymentTypeRow,
} from "./employment-types.repository.js";

@Injectable()
export class EmploymentTypesService extends MasterDataService<
  EmploymentTypeRow,
  CreateEmploymentTypeDto,
  UpdateEmploymentTypeDto,
  QueryEmploymentTypeDto
> {
  constructor(
    repository: EmploymentTypesRepository,
    tenantContext: TenantContextService,
  ) {
    super(repository, tenantContext, "employment type");
  }
}
