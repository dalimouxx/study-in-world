import { Global, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AlertsService } from './alerts.service';
import { ServerErrorAlertFilter } from './server-error.filter';

/** Alertes Telegram, disponibles partout ; signale aussi les erreurs serveur (500) par un filtre global. */
@Global()
@Module({
  providers: [AlertsService, { provide: APP_FILTER, useClass: ServerErrorAlertFilter }],
  exports: [AlertsService],
})
export class AlertsModule {}
