import { Injectable } from "@nestjs/common";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { MasterDataService } from "../shared/master-data.service.js";
import type { CreateWorkLocationDto } from "./dto/create-work-location.dto.js";
import type { QueryWorkLocationDto } from "./dto/query-work-location.dto.js";
import type { UpdateWorkLocationDto } from "./dto/update-work-location.dto.js";
import {
  WorkLocationsRepository,
  type WorkLocationRow,
} from "./work-locations.repository.js";

@Injectable()
export class WorkLocationsService extends MasterDataService<
  WorkLocationRow,
  CreateWorkLocationDto,
  UpdateWorkLocationDto,
  QueryWorkLocationDto
> {
  constructor(
    repository: WorkLocationsRepository,
    tenantContext: TenantContextService,
  ) {
    super(repository, tenantContext, "work location");
  }
}
