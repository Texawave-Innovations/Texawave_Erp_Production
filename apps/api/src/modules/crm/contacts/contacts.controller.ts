import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequireScopedPermission } from "../../../common/decorators/require-permission.decorator.js";
import { ContactsService } from "./contacts.service.js";
import {
  CreateContactDto,
  QueryContactDto,
  UpdateContactDto,
} from "./dto/contact.dto.js";

/** Migrated from the LIVE legacy TexaWave_ERP/src/modules/crm/domain/
 * contactsService.ts + Contacts.tsx (RTDB `crm/contacts`) — NOT the dead
 * apps/.../modules/contacts/ClientsLayout.tsx. Delete is soft-delete,
 * gated behind the write permission (legacy gates it behind "admin"; this
 * app has no separate "CRM admin" role concept yet, so write is the
 * documented stand-in — see Docs/HR_LEGACY_PARITY-style note in
 * packages/database/prisma/permissions/catalog.ts). `.team` is seeded but
 * granted to no default role in this phase (open production decision). */
@ApiTags("crm-contacts")
@Controller("crm/contacts")
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  @RequireScopedPermission("crm.contact.read")
  @ApiOperation({
    summary:
      "List contacts in the caller's scope (search across name/designation/email/phone/account name, filter by accountId)",
  })
  findAll(@Paginate(QueryContactDto) query: QueryContactDto) {
    return this.contacts.findAll(query);
  }

  @Get(":id")
  @RequireScopedPermission("crm.contact.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.contacts.findOne(id);
  }

  @Post()
  @RequireScopedPermission("crm.contact.write")
  @ApiOperation({
    summary: "Create a contact (accountId must exist in this organization)",
  })
  create(@Body() dto: CreateContactDto) {
    return this.contacts.create(dto);
  }

  @Patch(":id")
  @RequireScopedPermission("crm.contact.write")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateContactDto) {
    return this.contacts.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireScopedPermission("crm.contact.write")
  @ApiOperation({ summary: "Soft-delete a contact" })
  async remove(@Param("id", ParseIntPipe) id: number) {
    await this.contacts.remove(id);
  }
}
