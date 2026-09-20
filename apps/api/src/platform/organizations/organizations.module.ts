import { Module } from "@nestjs/common";
import { OrganizationsRepository } from "./organizations.repository.js";

@Module({
  providers: [OrganizationsRepository],
  exports: [OrganizationsRepository],
})
export class OrganizationsModule {}
