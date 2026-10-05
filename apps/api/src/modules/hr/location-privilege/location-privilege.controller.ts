import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import {
  CreateOfficeNetworkDto,
  SetLocationPrivilegeDto,
  UpdateOfficeNetworkDto,
} from "./dto/location-privilege.dto.js";
import { LocationPrivilegeService } from "./location-privilege.service.js";

/** Per-employee location privilege. Organization-wide. */
@ApiTags("hr-location-privilege")
@Controller("hr/location-privileges")
export class LocationPrivilegeController {
  constructor(private readonly service: LocationPrivilegeService) {}

  @Get("employees/:employeeId")
  @RequirePermission("hr.location_privilege.read")
  @ApiOperation({
    summary: "An employee's location privilege (mode null when never set)",
  })
  getEmployee(@Param("employeeId", ParseIntPipe) employeeId: number) {
    return this.service.getEmployeePrivilege(employeeId);
  }

  @Put("employees/:employeeId")
  @RequirePermission("hr.location_privilege.write")
  @ApiOperation({ summary: "Set an employee's location privilege (audited)" })
  setEmployee(
    @Param("employeeId", ParseIntPipe) employeeId: number,
    @Body() dto: SetLocationPrivilegeDto,
  ) {
    return this.service.setEmployeePrivilege(employeeId, dto);
  }
}

/** The organization's office network list. Not employee data, so no scope. */
@ApiTags("hr-location-privilege")
@Controller("hr/office-networks")
export class OfficeNetworkController {
  constructor(private readonly service: LocationPrivilegeService) {}

  @Get()
  @RequirePermission("hr.office_network.read")
  @ApiOperation({ summary: "Office network addresses for this organization" })
  list() {
    return this.service.listOfficeNetworks();
  }

  @Post()
  @RequirePermission("hr.office_network.write")
  @ApiOperation({ summary: "Register an office network address (audited)" })
  create(@Body() dto: CreateOfficeNetworkDto) {
    return this.service.addOfficeNetwork(dto);
  }

  @Patch(":id")
  @RequirePermission("hr.office_network.write")
  @ApiOperation({ summary: "Activate or deactivate an address (audited)" })
  setActive(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateOfficeNetworkDto,
  ) {
    return this.service.setOfficeNetworkActive(id, dto.isActive);
  }
}
