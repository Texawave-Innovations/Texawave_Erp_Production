import { Injectable } from "@nestjs/common";
import { EmployeeQueryService } from "../../hr/employees/employee-query.service.js";

/** Employee self-service reads. Every method resolves "who am I" from the
 * authenticated user via the employee↔user mapping — there is no employee id
 * anywhere in the request, so nobody can ask for someone else's record. */
@Injectable()
export class ProfileService {
  constructor(private readonly employees: EmployeeQueryService) {}

  getMyProfile() {
    return this.employees.getCurrentEmployee();
  }
}
