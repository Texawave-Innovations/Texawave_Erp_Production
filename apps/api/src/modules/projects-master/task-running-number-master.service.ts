import { Injectable } from "@nestjs/common";
import { TenantContextService } from "../../platform/tenancy/tenant-context.service.js";
import type { UpdateTaskRunningNumberMasterDto } from "./dto/update-task-running-number-master.dto.js";
import { TaskRunningNumberMasterRepository } from "./task-running-number-master.repository.js";

const DEFAULTS = {
  taskPrefix: "T",
  separator: "-",
  sequenceDigits: 2,
};

@Injectable()
export class TaskRunningNumberMasterService {
  constructor(
    private readonly repository: TaskRunningNumberMasterRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  /** Synthesizes an unsaved default row — the tab always shows all fields,
   * even before the first save. */
  async findOne() {
    const scope = this.tenantContext.getOrgScope();
    const existing = await this.repository.findOne(scope);
    return existing ?? DEFAULTS;
  }

  upsert(dto: UpdateTaskRunningNumberMasterDto) {
    const scope = this.tenantContext.getOrgScope();
    return this.repository.upsert(scope, dto, this.tenantContext.getUserId());
  }
}
