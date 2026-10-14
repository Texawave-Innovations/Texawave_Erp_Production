import { HttpStatus } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { BusinessException } from "../../../common/exceptions/business.exception.js";
import { NotAnEmployeeException } from "./employee.exceptions.js";

describe("NotAnEmployeeException", () => {
  it("is a 403 business exception with the NOT_AN_EMPLOYEE code", () => {
    const err = new NotAnEmployeeException();
    expect(err).toBeInstanceOf(BusinessException);
    expect(err.getStatus()).toBe(HttpStatus.FORBIDDEN);
    expect(err.message).toBe(
      "Your account is not linked to an employee record",
    );
    expect(err.errorCode).toBe("NOT_AN_EMPLOYEE");
  });
});
