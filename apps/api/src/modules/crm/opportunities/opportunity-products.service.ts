import { Injectable } from "@nestjs/common";
import { ResourceNotFoundException } from "../../../common/exceptions/business.exception.js";
import { TeamContextService } from "../../../platform/tenancy/team-context.service.js";
import { TenantContextService } from "../../../platform/tenancy/tenant-context.service.js";
import { OpportunityProductsRepository } from "./opportunity-products.repository.js";
import type {
  AddOpportunityProductsDto,
  UpdateOpportunityProductDto,
} from "./dto/opportunity-product.dto.js";

const READ = "crm.opportunity.read";
const WRITE = "crm.opportunity.write";

@Injectable()
export class OpportunityProductsService {
  constructor(
    private readonly repository: OpportunityProductsRepository,
    private readonly tenantContext: TenantContextService,
    private readonly teamContext: TeamContextService,
  ) {}

  async findAll(opportunityId: number) {
    const scope = await this.teamContext.resolveScope(READ);
    const rows = await this.repository.findMany(scope, opportunityId);
    if (rows === null)
      throw new ResourceNotFoundException("Opportunity", opportunityId);
    return rows;
  }

  async addItems(opportunityId: number, dto: AddOpportunityProductsDto) {
    const scope = await this.teamContext.resolveScope(WRITE);
    const rows = await this.repository.addItems(
      scope,
      opportunityId,
      dto,
      this.tenantContext.getUserId(),
    );
    if (rows === null)
      throw new ResourceNotFoundException("Opportunity", opportunityId);
    return rows;
  }

  async updateItem(
    opportunityId: number,
    itemId: number,
    dto: UpdateOpportunityProductDto,
  ) {
    const scope = await this.teamContext.resolveScope(WRITE);
    const row = await this.repository.updateItem(
      scope,
      opportunityId,
      itemId,
      dto,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("OpportunityProduct", itemId);
    return row;
  }

  async removeItem(opportunityId: number, itemId: number) {
    const scope = await this.teamContext.resolveScope(WRITE);
    const row = await this.repository.removeItem(
      scope,
      opportunityId,
      itemId,
      this.tenantContext.getUserId(),
    );
    if (!row) throw new ResourceNotFoundException("OpportunityProduct", itemId);
    return row;
  }
}
