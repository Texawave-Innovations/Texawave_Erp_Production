import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional } from "class-validator";
import {
  DOCUMENT_TYPES,
  RequiredText,
} from "../../../employee-self-service/profile/dto/onboarding-rules.js";

/** Multipart form fields alongside the uploaded file. `label` is the
 * free-text name HR gives an ad-hoc document (e.g. "Offer Letter").
 * `documentType`, if supplied, tags it against the same fixed set onboarding
 * uses (e.g. to let HR add a replacement AADHAAR) — purely informational
 * here, never enforced to be unique (see schema.prisma's EmployeeDocument
 * comment). It must be one of that fixed set: a free string would be stored
 * as-is, and `PROFILE_PHOTO` is what the avatar lookup keys on. */
export class UploadEmployeeDocumentDto {
  @RequiredText(100)
  label!: string;

  @ApiPropertyOptional({ example: "AADHAAR", enum: DOCUMENT_TYPES })
  @IsOptional()
  @IsIn(DOCUMENT_TYPES)
  documentType?: string;
}
