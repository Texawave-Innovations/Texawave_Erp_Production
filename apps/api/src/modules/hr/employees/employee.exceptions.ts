import { HttpStatus } from "@nestjs/common";
import { BusinessException } from "../../../common/exceptions/business.exception.js";

/** The authenticated user has no employee record linked to their login (403). */
export class NotAnEmployeeException extends BusinessException {
  constructor() {
    super(
      "Your account is not linked to an employee record",
      HttpStatus.FORBIDDEN,
      "NOT_AN_EMPLOYEE",
    );
  }
}
