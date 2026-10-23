import { Global, Module } from "@nestjs/common";
import { ScmActivityService } from "./scm-activity.service.js";
import { ScmNumberingService } from "./scm-numbering.service.js";

/** Cross-cutting SCM providers (document numbering). Global so every SCM
 * module can inject them without re-importing. */
@Global()
@Module({
  providers: [ScmNumberingService, ScmActivityService],
  exports: [ScmNumberingService, ScmActivityService],
})
export class ScmCommonModule {}
