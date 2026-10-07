import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Paginate } from "../../../common/decorators/paginate.decorator.js";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator.js";
import {
  CreateOfferLetterDto,
  QueryOfferLetterDto,
  UpdateOfferLetterDto,
} from "./dto/offer-letter.dto.js";
import { OfferLettersService } from "./offer-letters.service.js";

/** Recruitment → Offer Letter. Organization-wide by explicit permission (no
 * own/team/all): legacy records have no owner to scope by. Status is not
 * settable: GENERATED is the only reachable status. No delete route. */
@ApiTags("hr-offer-letters")
@Controller("hr/offer-letters")
export class OfferLettersController {
  constructor(private readonly offers: OfferLettersService) {}

  @Get()
  @RequirePermission("hr.offer_letter.read")
  @ApiOperation({ summary: "Generated offer letters, newest first" })
  findAll(@Paginate(QueryOfferLetterDto) query: QueryOfferLetterDto) {
    return this.offers.findAll(query);
  }

  @Get(":id")
  @RequirePermission("hr.offer_letter.read")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.offers.findOne(id);
  }

  @Post()
  @RequirePermission("hr.offer_letter.write")
  @ApiOperation({ summary: "Generate an offer letter (status GENERATED)" })
  create(@Body() dto: CreateOfferLetterDto) {
    return this.offers.create(dto);
  }

  @Patch(":id")
  @RequirePermission("hr.offer_letter.write")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateOfferLetterDto,
  ) {
    return this.offers.update(id, dto);
  }
}
