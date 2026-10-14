import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RawResponse } from "../../../common/decorators/raw-response.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import { MAX_UPLOAD_BYTES } from "../../../shared/file-storage/file-storage.service.js";
import { AddressDto } from "./dto/address.dto.js";
import { BankDetailsDto } from "./dto/bank-details.dto.js";
import { ExperienceDto } from "./dto/experience.dto.js";
import { FamilyMemberDto } from "./dto/family-member.dto.js";
import { GovernmentIdsDto } from "./dto/government-ids.dto.js";
import { PersonalDetailsDto } from "./dto/personal-details.dto.js";
import { ProfileService, type UploadedDocument } from "./profile.service.js";

/**
 * Its own permission namespace, so an employee's role never needs `hr.*`.
 * The URL is `employee/profile` (user-facing, short) while the module and
 * its permission codes stay `employee-self-service` / `employee_self_service.*`
 * (Docs/ARCHITECTURE.md §7) — kept distinct from `hr.employee.*` so the two
 * never look alike in a permission list or an audit log. The two names are
 * independent; only the string in @Controller() decides the route.
 */
@ApiTags("employee-self-service")
@Controller("employee/profile")
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  @RequirePermission("employee_self_service.profile.read")
  @ApiOperation({ summary: "The authenticated user's own employee record" })
  getMine() {
    return this.profile.getMyProfile();
  }

  @Get("personal-details")
  @RequirePermission("employee_self_service.profile.read")
  getPersonal() {
    return this.profile.getPersonal();
  }

  @Put("personal-details")
  @RequirePermission("employee_self_service.profile.write")
  putPersonal(@Body() dto: PersonalDetailsDto) {
    return this.profile.putPersonal(dto);
  }

  @Get("address/:type")
  @RequirePermission("employee_self_service.profile.read")
  @ApiOperation({ summary: "type is PERMANENT or PRESENT" })
  getAddress(@Param("type") type: string) {
    return this.profile.getAddress(type);
  }

  @Put("address/:type")
  @RequirePermission("employee_self_service.profile.write")
  putAddress(@Param("type") type: string, @Body() dto: AddressDto) {
    return this.profile.putAddress(type, dto);
  }

  @Delete("address/present")
  @RequirePermission("employee_self_service.profile.write")
  @ApiOperation({
    summary: "Clear the present address (tick 'same as permanent')",
  })
  clearPresentAddress() {
    return this.profile.clearPresentAddress();
  }

  @Get("bank-details")
  @RequirePermission("employee_self_service.profile.read")
  @ApiOperation({ summary: "Masked account number only" })
  getBank() {
    return this.profile.getBank();
  }

  @Put("bank-details")
  @RequirePermission("employee_self_service.profile.write")
  putBank(@Body() dto: BankDetailsDto) {
    return this.profile.putBank(dto);
  }

  @Get("government-ids")
  @RequirePermission("employee_self_service.profile.read")
  getGovernmentIds() {
    return this.profile.getGovernmentIds();
  }

  @Put("government-ids")
  @RequirePermission("employee_self_service.profile.write")
  putGovernmentIds(@Body() dto: GovernmentIdsDto) {
    return this.profile.putGovernmentIds(dto);
  }

  @Get("family")
  @RequirePermission("employee_self_service.profile.read")
  listFamilyMembers() {
    return this.profile.listFamilyMembers();
  }

  @Post("family")
  @RequirePermission("employee_self_service.profile.write")
  addFamilyMember(@Body() dto: FamilyMemberDto) {
    return this.profile.addFamilyMember(dto);
  }

  @Put("family/:id")
  @RequirePermission("employee_self_service.profile.write")
  @HttpCode(HttpStatus.NO_CONTENT)
  updateFamilyMember(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: FamilyMemberDto,
  ) {
    return this.profile.updateFamilyMember(id, dto);
  }

  @Delete("family/:id")
  @RequirePermission("employee_self_service.profile.write")
  @HttpCode(HttpStatus.NO_CONTENT)
  removeFamilyMember(@Param("id", ParseIntPipe) id: number) {
    return this.profile.removeFamilyMember(id);
  }

  @Get("experience")
  @RequirePermission("employee_self_service.profile.read")
  listExperience() {
    return this.profile.listExperience();
  }

  @Post("experience")
  @RequirePermission("employee_self_service.profile.write")
  addExperience(@Body() dto: ExperienceDto) {
    return this.profile.addExperience(dto);
  }

  @Put("experience/:id")
  @RequirePermission("employee_self_service.profile.write")
  @HttpCode(HttpStatus.NO_CONTENT)
  updateExperience(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ExperienceDto,
  ) {
    return this.profile.updateExperience(id, dto);
  }

  @Delete("experience/:id")
  @RequirePermission("employee_self_service.profile.write")
  @HttpCode(HttpStatus.NO_CONTENT)
  removeExperience(@Param("id", ParseIntPipe) id: number) {
    return this.profile.removeExperience(id);
  }

  @Get("documents")
  @RequirePermission("employee_self_service.profile.read")
  listDocuments() {
    return this.profile.listDocuments();
  }

  @Put("documents/:documentType/file")
  @RequirePermission("employee_self_service.profile.write")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES } }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiOperation({
    summary:
      "Upload (or replace) one document. PDF, JPG or PNG, 5 MB or smaller. Field name: file.",
  })
  uploadDocument(
    @Param("documentType") documentType: string,
    @UploadedFile() file: UploadedDocument | undefined,
  ) {
    return this.profile.uploadDocument(documentType, file);
  }

  @Get("documents/:documentType/file")
  @RequirePermission("employee_self_service.profile.read")
  @RawResponse()
  @ApiOperation({ summary: "Download your own document" })
  async downloadDocument(@Param("documentType") documentType: string) {
    const file = await this.profile.downloadDocument(documentType);
    return new StreamableFile(file.buffer, {
      type: file.mimeType,
      disposition: `attachment; filename="${encodeURIComponent(file.fileName)}"`,
    });
  }

  @Delete("documents/:documentType")
  @RequirePermission("employee_self_service.profile.write")
  @HttpCode(HttpStatus.NO_CONTENT)
  removeDocument(@Param("documentType") documentType: string) {
    return this.profile.removeDocument(documentType);
  }

  @Post("submit")
  @RequirePermission("employee_self_service.profile.write")
  @ApiOperation({
    summary:
      "Completes onboarding if every required item is present; otherwise returns what is missing",
  })
  submit() {
    return this.profile.submit();
  }
}
