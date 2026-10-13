import { Global, Module } from '@nestjs/common';
import { AutomationController } from './automation.controller';
import { AutomationEngineService } from './automation-engine.service';
import { AutomationRulesService } from './automation-rules.service';

/**
 * Global : AutomationEngineService doit être injectable depuis Applications/Visa/Documents
 * sans que ces modules aient besoin d'importer explicitement AutomationModule.
 */
@Global()
@Module({
  controllers: [AutomationController],
  providers: [AutomationRulesService, AutomationEngineService],
  exports: [AutomationRulesService, AutomationEngineService],
})
export class AutomationModule {}
