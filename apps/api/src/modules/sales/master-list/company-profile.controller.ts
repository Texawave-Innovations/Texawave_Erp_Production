import {
  Body,
  Controller,
  Delete,
  Get,
  Put,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RawResponse } from "../../../common/decorators/raw-response.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import { CompanyProfileService } from "./company-profile.service.js";
import { UpsertCompanyProfileDto } from "./dto/company-profile.dto.js";
import { MAX_IMAGE_BYTES, type UploadedImage } from "./image-upload.js";

/** Sales master list → company details (logo, name, address, GSTIN) — the
 * seller block printed on every document. */
@ApiTags("sales-master-list")
@Controller("sales/master/company-profile")
export class CompanyProfileController {
  constructor(private readonly profile: CompanyProfileService) {}

  @Get()
  @RequirePermission("sales.master.read")
  @ApiOperation({ summary: "The company profile, or null if not set up" })
  find() {
    return this.profile.find();
  }

  @Put()
  @RequirePermission("sales.master.write")
  @ApiOperation({
    summary: "Create or replace the company profile",
  })
  upsert(@Body() dto: UpsertCompanyProfileDto) {
    return this.profile.upsert(dto);
  }

  @Get("logo")
  @RequirePermission("sales.master.read")
  @RawResponse()
  @ApiOperation({ summary: "The company logo (for document previews)" })
  async logo() {
    const file = await this.profile.readLogo();
    return new StreamableFile(file.buffer, {
      type: file.mimeType,
      disposition: "inline",
    });
  }

  @Put("logo")
  @RequirePermission("sales.master.write")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: MAX_IMAGE_BYTES } }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiOperation({
    summary: "Upload or replace the logo (PNG or JPG, ≤ 2 MB, field: file)",
  })
  uploadLogo(@UploadedFile() file: UploadedImage | undefined) {
    return this.profile.uploadLogo(file);
  }

  @Delete("logo")
  @RequirePermission("sales.master.write")
  @ApiOperation({ summary: "Remove the logo" })
  removeLogo() {
    return this.profile.removeLogo();
  }
}
