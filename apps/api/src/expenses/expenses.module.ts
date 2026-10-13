import { Module } from '@nestjs/common';
import { CashboxModule } from '../cashbox/cashbox.module';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';

@Module({ imports: [CashboxModule], controllers: [ExpensesController], providers: [ExpensesService] })
export class ExpensesModule {}
