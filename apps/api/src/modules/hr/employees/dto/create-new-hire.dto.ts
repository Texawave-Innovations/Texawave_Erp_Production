import { ApiProperty, ApiPropertyOptional, OmitType } from "@nestjs/swagger";
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsStrongPassword,
  MaxLength,
} from "class-validator";
import { CreateEmployeeDto } from "./create-employee.dto.js";
import { LowerTrim } from "./employee-transforms.js";

/** The only role HR may add on top of Employee when creating a new hire. */
export const NEW_HIRE_EXTRA_ROLES = ["TEAM_LEAD"] as const;
export type NewHireExtraRole = (typeof NEW_HIRE_EXTRA_ROLES)[number];

/**
 * HR creates a new hire's employee record AND their login in one step
 * (`POST /hr/employees/new-hire`, Docs/HR_API.md). The login always gets the
 * Employee self-service role; `additionalRole` may add Team Lead, nothing
 * else — there is deliberately no `roleIds`, so HR cannot hand out arbitrary
 * roles (that stays with `users.user.write` in Settings → Users). The login
 * e-mail is also the employee's work e-mail, and `userId` is not accepted:
 * the login is created here.
 */
export class CreateNewHireDto extends OmitType(CreateEmployeeDto, [
  "workEmail",
  "userId",
] as const) {
  @ApiProperty({
    example: "asha.verma@texawave.com",
    description: "Login e-mail; also stored as the work e-mail",
  })
  @LowerTrim()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({
    example: "Welcome@2026",
    description:
      "Temporary password; the new hire must change it at first sign-in",
  })
  @IsStrongPassword()
  tempPassword!: string;

  @ApiPropertyOptional({ enum: NEW_HIRE_EXTRA_ROLES })
  @IsOptional()
  @IsIn(NEW_HIRE_EXTRA_ROLES)
  additionalRole?: NewHireExtraRole;
}
