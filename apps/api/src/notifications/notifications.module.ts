import { Global, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

/** @Global() : déclenché depuis des modules indépendants (messages, tâches) sans lien entre eux. */
@Global()
@Module({ controllers: [NotificationsController], providers: [NotificationsService], exports: [NotificationsService] })
export class NotificationsModule {}
