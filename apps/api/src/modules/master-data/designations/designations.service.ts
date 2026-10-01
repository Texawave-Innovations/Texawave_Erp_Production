import { Injectable } from "@nestjs/common";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { MasterDataService } from "../shared/master-data.service.js";
import type { CreateDesignationDto } from "./dto/create-designation.dto.js";
import type { QueryDesignationDto } from "./dto/query-designation.dto.js";
import type { UpdateDesignationDto } from "./dto/update-designation.dto.js";
import {
  DesignationsRepository,
  type DesignationRow,
} from "./designations.repository.js";

@Injectable()
export class DesignationsService extends MasterDataService<
  DesignationRow,
  CreateDesignationDto,
  UpdateDesignationDto,
  QueryDesignationDto
> {
  constructor(
    repository: DesignationsRepository,
    tenantContext: TenantContextService,
  ) {
    super(repository, tenantContext, "designation");
  }
}
