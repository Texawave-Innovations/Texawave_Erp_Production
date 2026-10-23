import { Injectable } from "@nestjs/common";
import { TenantContextService } from "../../platform/tenancy/tenant-context.service.js";
import { SealSignaturesRepository } from "./seal-signatures.repository.js";
import { SealSignaturesService } from "./seal-signatures.service.js";

@Injectable()
export class AuthorizedSignaturesService extends SealSignaturesService {
  constructor(
    repository: SealSignaturesRepository,
    tenantContext: TenantContextService,
  ) {
    super(repository, tenantContext, "signature", "Authorized signature");
  }
}
