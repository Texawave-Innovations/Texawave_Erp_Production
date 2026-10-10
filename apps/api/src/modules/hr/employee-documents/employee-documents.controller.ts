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
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RawResponse } from "../../../common/decorators/raw-response.decorator.js";
import { RequireScopedPermission } from "../../../common/decorators/require-permission.decorator.js";
import { MAX_UPLOAD_BYTES } from "../../../shared/file-storage/file-storage.service.js";
import { UploadEmployeeDocumentDto } from "./dto/upload-employee-document.dto.js";
import {
  EmployeeDocumentsService,
  type UploadedDocument,
} from "./employee-documents.service.js";

/** HR's document center for a single employee: everything the employee
 * uploaded during onboarding (read-only here) plus HR's own ad-hoc uploads.
 * Team-scoped like every other HR-data endpoint (Docs/CODING_STANDARDS.md §10a). */
@ApiTags("hr-employee-documents")
@Controller("hr/employees/:employeeId/documents")
export class EmployeeDocumentsController {
  constructor(private readonly documents: EmployeeDocumentsService) {}

  @Get()
  @RequireScopedPermission("hr.employee_document.read")
  @ApiOperation({
    summary: "List an employee's documents (onboarding + HR-uploaded)",
  })
  list(@Param("employeeId", ParseIntPipe) employeeId: number) {
    return this.documents.listDocuments(employeeId);
  }

  @Post()
  @RequireScopedPermission("hr.employee_document.write")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES } }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiOperation({
    summary:
      "Upload a new ad-hoc document for this employee. PDF, JPG or PNG, 5 MB or smaller. Field name: file.",
  })
  upload(
    @Param("employeeId", ParseIntPipe) employeeId: number,
    @Body() dto: UploadEmployeeDocumentDto,
    @UploadedFile() file: UploadedDocument | undefined,
  ) {
    return this.documents.uploadDocument(employeeId, dto, file);
  }

  @Get(":id/file")
  @RequireScopedPermission("hr.employee_document.read")
  @RawResponse()
  @ApiOperation({ summary: "Download one document" })
  async download(
    @Param("employeeId", ParseIntPipe) employeeId: number,
    @Param("id", ParseIntPipe) id: number,
  ) {
    const file = await this.documents.downloadDocument(employeeId, id);
    return new StreamableFile(file.buffer, {
      type: file.mimeType,
      disposition: `attachment; filename="${encodeURIComponent(file.fileName)}"`,
    });
  }

  @Delete(":id")
  @RequireScopedPermission("hr.employee_document.write")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param("employeeId", ParseIntPipe) employeeId: number,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.documents.removeDocument(employeeId, id);
  }
}
