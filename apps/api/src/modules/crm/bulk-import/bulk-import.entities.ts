import type { Type } from "@nestjs/common";
import { PaginationDto } from "../../../common/dto/pagination.dto.js";
import {
  CreateAccountDto,
  QueryAccountDto,
} from "../accounts/dto/account.dto.js";
import {
  CreateCrmColdCallingEntryDto,
  QueryCrmColdCallingEntryDto,
} from "../cold-calling/dto/cold-calling.dto.js";
import {
  CreateContactDto,
  QueryContactDto,
} from "../contacts/dto/contact.dto.js";
import { CreateLeadDto, QueryLeadDto } from "../leads/dto/lead.dto.js";
import {
  CreateCrmMiningRowDto,
  QueryCrmMiningRowDto,
} from "../mining-rows/dto/mining-row.dto.js";
import {
  CreateOpportunityDto,
  QueryOpportunityDto,
} from "../opportunities/dto/opportunity.dto.js";
import {
  CreateProductDto,
  QueryProductDto,
} from "../products/dto/product.dto.js";
import type { ImportEntity } from "./bulk-import.fields.js";

/** Class-validator DTO each entity's mapped row is re-validated against on
 * the server (the same DTO the owning module's own POST uses). Composite
 * entities validate their downstream DTOs while committing. */
export const ENTITY_DTO: Partial<Record<ImportEntity, Type<object>>> = {
  leads: CreateLeadDto,
  accounts: CreateAccountDto,
  contacts: CreateContactDto,
  products: CreateProductDto,
  "mining-rows": CreateCrmMiningRowDto,
  "cold-calling": CreateCrmColdCallingEntryDto,
  "call-back-send-info": CreateAccountDto,
  "not-interested": CreateAccountDto,
  "keep-in-touch": CreateAccountDto,
  opportunities: CreateOpportunityDto,
};

export function page<T extends PaginationDto>(
  Dto: new () => T,
  fields: Partial<T>,
): T {
  return Object.assign(new Dto(), fields);
}

export {
  QueryAccountDto,
  QueryContactDto,
  QueryCrmColdCallingEntryDto,
  QueryCrmMiningRowDto,
  QueryLeadDto,
  QueryOpportunityDto,
  QueryProductDto,
};
