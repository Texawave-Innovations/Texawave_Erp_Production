import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import {
  QueryOverallDataDto,
  QueryOverallDataRecordsDto,
} from "./dto/overall-data.dto.js";
import { CrmOverallDataService } from "./overall-data.service.js";

/** Read-only. Deleting a drill-down record goes through the owning entity's
 * own DELETE endpoint (`crm.meeting.delete`, `crm.activity.delete`,
 * `crm.miningrow.delete`, `crm.coldcalling.delete`) — there is deliberately
 * no delete here. */
@ApiTags("crm-overall-data")
@Controller("crm/overall-data")
export class CrmOverallDataController {
  constructor(private readonly overallData: CrmOverallDataService) {}

  @Get()
  @RequirePermission("crm.overalldata.read")
  getMonth(@Query() query: QueryOverallDataDto) {
    return this.overallData.getMonth(query);
  }

  @Get("records")
  @RequirePermission("crm.overalldata.read")
  getRecords(@Query() query: QueryOverallDataRecordsDto) {
    return this.overallData.getRecords(query);
  }
}
