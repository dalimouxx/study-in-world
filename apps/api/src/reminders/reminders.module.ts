import { Module } from '@nestjs/common';
import { MessageTemplatesModule } from '../message-templates/message-templates.module';
import { JobsController } from './jobs.controller';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';

@Module({
  imports: [MessageTemplatesModule],
  controllers: [JobsController, RemindersController],
  providers: [RemindersService],
  exports: [RemindersService],
})
export class RemindersModule {}
