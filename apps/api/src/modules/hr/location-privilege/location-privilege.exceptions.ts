import { HttpStatus } from "@nestjs/common";
import { BusinessException } from "../../../common/exceptions/business.exception.js";

/** Check-in or check-out from outside the office network while the employee is
 * OFFICE-mode (403). Nothing is written. */
export class LocationNotAllowedException extends BusinessException {
  constructor() {
    super(
      "You must be connected to the office network to check in or out. Connect to the office network and try again.",
      HttpStatus.FORBIDDEN,
      "LOCATION_NOT_ALLOWED",
    );
  }
}
