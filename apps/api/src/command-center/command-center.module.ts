import { Module } from '@nestjs/common';
import { ReportsModule } from '../reports/reports.module';
import { CommandCenterController } from './command-center.controller';
import { CommandCenterService } from './command-center.service';

@Module({ imports: [ReportsModule], controllers: [CommandCenterController], providers: [CommandCenterService] })
export class CommandCenterModule {}
