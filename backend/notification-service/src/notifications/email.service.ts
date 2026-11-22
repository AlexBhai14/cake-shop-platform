import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

@Injectable()
export class EmailService {
  private readonly transport: nodemailer.Transporter;
  private readonly from: string;

  constructor(config: ConfigService) {
    this.transport = nodemailer.createTransport({
      host: config.get<string>('SMTP_HOST') ?? 'localhost',
      port: Number(config.get('SMTP_PORT') ?? 1025),
      secure: false,
      ignoreTLS: true, // Mailpit is a local test inbox without TLS
    });
    this.from = config.get<string>('MAIL_FROM') ?? 'Cake Shop <no-reply@cakeshop.local>';
  }

  async send(mail: Mail): Promise<void> {
    await this.transport.sendMail({ from: this.from, ...mail });
  }
}
