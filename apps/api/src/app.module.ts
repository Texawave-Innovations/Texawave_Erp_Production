import { Module, ValidationPipe } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter.js";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor.js";
import { LoggerModule } from "./common/logger/logger.module.js";
import { ConfigModule } from "./config/config.module.js";
import { DepartmentsModule } from "./modules/departments/departments.module.js";
import { MenuModule } from "./modules/menu/menu.module.js";
import { TagsModule } from "./modules/_reference/tags/tags.module.js";
import { ProfileModule } from "./modules/employee-self-service/profile/profile.module.js";
import { TeamsModule } from "./modules/hr/teams/teams.module.js";
import { EmployeesModule } from "./modules/hr/employees/employees.module.js";
import { OrgChartModule } from "./modules/hr/org-chart/org-chart.module.js";
import { MyLeaveRequestsModule } from "./modules/employee-self-service/leave-requests/my-leave-requests.module.js";
import { LeaveRequestsModule } from "./modules/hr/leave-requests/leave-requests.module.js";
import { WorkLogsModule } from "./modules/hr/work-logs/work-logs.module.js";
import { MyWorkLogsModule } from "./modules/employee-self-service/work-logs/my-work-logs.module.js";
import { TasksModule } from "./modules/hr/tasks/tasks.module.js";
import { MyTasksModule } from "./modules/employee-self-service/tasks/my-tasks.module.js";
import { TicketsModule } from "./modules/hr/tickets/tickets.module.js";
import { MyTicketsModule } from "./modules/employee-self-service/tickets/my-tickets.module.js";
import { ExpenseClaimsModule } from "./modules/hr/expense-claims/expense-claims.module.js";
import { MyExpenseClaimsModule } from "./modules/employee-self-service/expense-claims/my-expense-claims.module.js";
import { ExitRequestsModule } from "./modules/hr/exit-requests/exit-requests.module.js";
import { MyExitRequestsModule } from "./modules/employee-self-service/exit-requests/my-exit-requests.module.js";
import { AttendanceModule } from "./modules/hr/attendance/attendance.module.js";
import { RevisionLettersModule } from "./modules/hr/revision-letters/revision-letters.module.js";
import { InterviewsModule } from "./modules/hr/interviews/interviews.module.js";
import { OfferLettersModule } from "./modules/hr/offer-letters/offer-letters.module.js";
import { ProfilesModule } from "./modules/hr/profiles/profiles.module.js";
import { LeaveTypesModule } from "./modules/hr/leave-types/leave-types.module.js";
import { CalendarModule } from "./modules/hr/calendar/calendar.module.js";
import { HolidaysModule } from "./modules/hr/holidays/holidays.module.js";
import { WeeklyOffRulesModule } from "./modules/hr/weekly-off-rules/weekly-off-rules.module.js";
import { ShiftAssignmentsModule } from "./modules/hr/shift-assignments/shift-assignments.module.js";
import { ShiftsModule } from "./modules/master-data/shifts/shifts.module.js";
import { DesignationsModule } from "./modules/master-data/designations/designations.module.js";
import { EmploymentTypesModule } from "./modules/master-data/employment-types/employment-types.module.js";
import { WorkLocationsModule } from "./modules/master-data/work-locations/work-locations.module.js";
import { RolesModule } from "./modules/settings/roles/roles.module.js";
import { AuditModule } from "./platform/audit/audit.module.js";
import { AuthModule } from "./platform/auth/auth.module.js";
import { HealthModule } from "./platform/health/health.module.js";
import { RolesPermissionsModule } from "./platform/roles-permissions/roles-permissions.module.js";
import { TenancyModule } from "./platform/tenancy/tenancy.module.js";
import { UsersModule } from "./platform/users/users.module.js";
import { FieldEncryptionModule } from "./shared/crypto/field-encryption.module.js";
import { FileStorageModule } from "./shared/file-storage/file-storage.module.js";
import { PrismaModule } from "./shared/prisma/prisma.module.js";
import { RedisModule } from "./shared/redis/redis.module.js";

@Module({
  imports: [
    // Order matters for a few of these: ConfigModule first (everything else
    // reads env), LoggerModule early (its pino-http middleware needs to be
    // in place before requests are handled), then infra (Prisma/Redis),
    // then platform (auth/permissions/tenancy — auth depends on
    // Prisma/Redis), then business modules last.
    //
    // AuthModule (and RolesPermissionsModule, which it already imports)
    // must be listed before TenancyModule: Nest collects global APP_GUARD
    // providers in module-discovery order, and TenancyModule now also
    // imports RolesPermissionsModule (for TeamContextService,
    // Docs/CODING_STANDARDS.md §10a). If TenancyModule were discovered
    // first, PermissionsGuard would be registered before JwtAuthGuard,
    // running permission checks before authentication has even run.
    ConfigModule,
    LoggerModule,
    PrismaModule,
    RedisModule,
    FieldEncryptionModule,
    FileStorageModule,
    AuthModule,
    RolesPermissionsModule,
    TenancyModule,
    AuditModule,
    HealthModule,
    TagsModule,
    RolesModule,
    DesignationsModule,
    EmploymentTypesModule,
    WorkLocationsModule,
    ShiftsModule,
    EmployeesModule,
    OrgChartModule,
    ShiftAssignmentsModule,
    HolidaysModule,
    WeeklyOffRulesModule,
    CalendarModule,
    LeaveTypesModule,
    LeaveRequestsModule,
    WorkLogsModule,
    TasksModule,
    TicketsModule,
    ExpenseClaimsModule,
    ExitRequestsModule,
    AttendanceModule,
    RevisionLettersModule,
    InterviewsModule,
    OfferLettersModule,
    ProfilesModule,
    ProfileModule,
    TeamsModule,
    MyLeaveRequestsModule,
    MyWorkLogsModule,
    MyTasksModule,
    MyTicketsModule,
    MyExpenseClaimsModule,
    MyExitRequestsModule,
    DepartmentsModule,
    UsersModule,
    MenuModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    // Registered here (not only via app.useGlobalPipes() in main.ts) so
    // Test.createTestingModule({ imports: [AppModule] }) gets the same
    // validation behavior main.ts's bootstrap() gets — no drift between
    // what runs in tests and what runs for real.
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    },
  ],
})
export class AppModule {}
