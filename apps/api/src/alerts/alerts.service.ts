import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { alertText, type AlertEvent } from './alert-text';

export const ALERTS_FETCH = 'ALERTS_FETCH';
export const ALERTS_CLOCK = 'ALERTS_CLOCK';
const ERROR_COOLDOWN_MS = 10 * 60_000;

/**
 * Alertes vers le groupe Telegram de l'équipe. `emit` ne bloque jamais l'action en cours et ne lève jamais :
 * l'envoi part en arrière-plan, une panne de Telegram est seulement journalisée. Sans TELEGRAM_BOT_TOKEN ou
 * TELEGRAM_CHAT_ID, rien n'est envoyé. Une même erreur serveur n'est signalée qu'une fois toutes les 10 minutes.
 */
@Injectable()
export class AlertsService {
  private readonly logger = new Logger('Alertes');
  private readonly lastError = new Map<string, number>();

  constructor(
    private readonly config: ConfigService,
    @Optional() @Inject(ALERTS_FETCH) private readonly fetchImpl: typeof fetch = fetch,
    @Optional() @Inject(ALERTS_CLOCK) private readonly now: () => number = Date.now,
  ) {}

  emit(event: AlertEvent): void {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    const chatId = this.config.get<string>('TELEGRAM_CHAT_ID');
    if (!token || !chatId) return;
    if (event.kind === 'server_error' && !this.errorAllowed(`${event.method} ${event.path} ${event.message}`)) return;

    const text = alertText(event, this.config.get<string>('FRONTEND_URL') ?? 'https://studyinworld.net');
    void Promise.resolve()
      .then(() =>
        this.fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
          signal: AbortSignal.timeout(5000),
        }),
      )
      .then((res) => {
        if (res && !res.ok) this.logger.warn(`Telegram a refusé l'alerte « ${event.kind} » (HTTP ${res.status})`);
      })
      .catch((err: unknown) => this.logger.warn(`Alerte « ${event.kind} » non envoyée : ${(err as Error).message}`));
  }

  private errorAllowed(key: string): boolean {
    const t = this.now();
    const last = this.lastError.get(key);
    if (last !== undefined && t - last < ERROR_COOLDOWN_MS) return false;
    this.lastError.set(key, t);
    return true;
  }
}
