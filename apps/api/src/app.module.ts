import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppointmentsModule } from './appointments/appointments.module';
import { AiAssistantModule } from './ai-assistant/ai-assistant.module';
import { ApplicationsModule } from './applications/applications.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BlogModule } from './blog/blog.module';
import { AutomationModule } from './automation/automation.module';
import { BranchesModule } from './branches/branches.module';
import { CandidatesModule } from './candidates/candidates.module';
import { CashboxModule } from './cashbox/cashbox.module';
import { CatalogModule } from './catalog/catalog.module';
import { ChecklistModule } from './checklist/checklist.module';
import { CommandCenterModule } from './command-center/command-center.module';
import { CommissionsModule } from './commissions/commissions.module';
import { CounterModule } from './common/services/counter.module';
import { ContractsModule } from './contracts/contracts.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { validateEnv } from './config/env';
import { DocumentsModule } from './documents/documents.module';
import { EmployeesModule } from './employees/employees.module';
import { ExportModule } from './export/export.module';
import { ExpensesModule } from './expenses/expenses.module';
import { FinanceModule } from './finance/finance.module';
import { HealthController } from './health/health.controller';
import { HealthScoreModule } from './health-score/health-score.module';
import { MailModule } from './mail/mail.module';
import { MessagesModule } from './messages/messages.module';
import { PortalModule } from './portal/portal.module';
import { PartnersModule } from './partners/partners.module';
import { PlatformAdminModule } from './platform-admin/platform-admin.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PartnerPortalModule } from './partner-portal/partner-portal.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProspectsModule } from './prospects/prospects.module';
import { PublicModule } from './public/public.module';
import { ReportsModule } from './reports/reports.module';
import { RolesModule } from './roles/roles.module';
import { SettingsModule } from './settings/settings.module';
import { StorageModule } from './storage/storage.module';
import { TasksModule } from './tasks/tasks.module';
import { TimelineModule } from './timeline/timeline.module';
import { VisaModule } from './visa/visa.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuditModule,
    AutomationModule,
    MailModule,
    StorageModule,
    CounterModule,
    DashboardModule,
    TimelineModule,
    AuthModule,
    BlogModule,
    EmployeesModule,
    ExportModule,
    RolesModule,
    BranchesModule,
    SettingsModule,
    ProspectsModule,
    CandidatesModule,
    PortalModule,
    MessagesModule,
    DocumentsModule,
    ChecklistModule,
    HealthScoreModule,
    AiAssistantModule,
    CatalogModule,
    ApplicationsModule,
    VisaModule,
    CashboxModule,
    ExpensesModule,
    FinanceModule,
    ContractsModule,
    TasksModule,
    AppointmentsModule,
    ReportsModule,
    CommandCenterModule,
    PartnersModule,
    PlatformAdminModule,
    NotificationsModule,
    CommissionsModule,
    PartnerPortalModule,
    PublicModule,
  ],
  controllers: [HealthController],
  providers: [
    // Ordre important : limitation de débit → authentification → permissions.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
