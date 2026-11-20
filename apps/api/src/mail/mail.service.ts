import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import type { Env } from '../config/env';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(config: ConfigService<Env, true>) {
    const host = config.get('SMTP_HOST', { infer: true });
    this.from = config.get('MAIL_FROM', { infer: true });
    this.transporter = host
      ? createTransport({
          host,
          port: config.get('SMTP_PORT', { infer: true }),
          secure: config.get('SMTP_PORT', { infer: true }) === 465,
          auth: config.get('SMTP_USER', { infer: true })
            ? { user: config.get('SMTP_USER', { infer: true }), pass: config.get('SMTP_PASSWORD', { infer: true }) }
            : undefined,
        })
      : null;
  }

  async send(to: string, subject: string, text: string, html?: string): Promise<void> {
    if (!this.transporter) {
      // Pas de SMTP configuré : on n'échoue pas (dev). Le contenu est loggé pour test local uniquement.
      this.logger.warn(`SMTP non configuré — e-mail non envoyé à ${to} : ${subject}\n${text}`);
      return;
    }
    await this.transporter.sendMail({ from: this.from, to, subject, text, html });
  }
}
