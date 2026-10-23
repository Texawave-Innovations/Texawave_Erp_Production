import { Module } from "@nestjs/common";
import { CrmNotificationsController } from "./crm-notifications.controller.js";
import { CrmNotificationsRepository } from "./crm-notifications.repository.js";
import { CrmNotificationsService } from "./crm-notifications.service.js";

@Module({
  controllers: [CrmNotificationsController],
  providers: [CrmNotificationsRepository, CrmNotificationsService],
})
export class CrmNotificationsModule {}
