import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import type { Request } from 'express';
import { AlertsService } from './alerts.service';

/**
 * Laisse Nest répondre comme d'habitude (même réponse qu'avant), et signale sur Telegram les erreurs serveur :
 * toute exception qui n'est pas une erreur HTTP prévue, ou une erreur HTTP 5xx.
 */
@Catch()
export class ServerErrorAlertFilter extends BaseExceptionFilter {
  constructor(
    adapterHost: HttpAdapterHost,
    private readonly alerts: AlertsService,
  ) {
    super(adapterHost.httpAdapter);
  }

  override catch(exception: unknown, host: ArgumentsHost) {
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    if (status >= 500 && host.getType() === 'http') {
      const req = host.switchToHttp().getRequest<Request>();
      // Chemin sans paramètres de requête (ils peuvent contenir des données personnelles).
      const path = (req.originalUrl ?? req.url ?? '').split('?')[0];
      this.alerts.emit({ kind: 'server_error', method: req.method, path, message: exception instanceof Error ? exception.message : String(exception) });
    }
    super.catch(exception, host);
  }
}
