import { HttpStatus } from "@nestjs/common";
import { BusinessException } from "../../../common/exceptions/business.exception.js";

/** Same 403 + code the leave, expense and attendance approvals use. */
export class WorkPermissionSelfDecisionException extends BusinessException {
  constructor() {
    super(
      "You cannot approve or reject your own permission request",
      HttpStatus.FORBIDDEN,
      "SELF_APPROVAL_FORBIDDEN",
    );
  }
}
