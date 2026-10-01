import { Injectable } from "@nestjs/common";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { MasterDataService } from "../shared/master-data.service.js";
import type { CreateShiftDto } from "./dto/create-shift.dto.js";
import type { QueryShiftDto } from "./dto/query-shift.dto.js";
import type { UpdateShiftDto } from "./dto/update-shift.dto.js";
import { ShiftsRepository, type ShiftRow } from "./shifts.repository.js";

@Injectable()
export class ShiftsService extends MasterDataService<
  ShiftRow,
  CreateShiftDto,
  UpdateShiftDto,
  QueryShiftDto
> {
  constructor(
    repository: ShiftsRepository,
    tenantContext: TenantContextService,
  ) {
    super(repository, tenantContext, "shift");
  }
}
