import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAuth } from 'google-auth-library';
import { readFileSync } from 'fs';

export interface PushMessage {
  title: string;
  body: string;
  /** Plain strings the app reads to open the right screen, for example { route: '/more/offers/12' }. */
  data?: Record<string, string>;
}

/** What happened to one token. `gone` means the phone no longer has the app: delete the token. */
export type SendResult = 'sent' | 'gone' | 'failed';

/**
 * Sends one push through Firebase Cloud Messaging (HTTP v1).
 * Switched on by FIREBASE_SERVICE_ACCOUNT, the path to the service account JSON file (or the JSON itself).
 * Without it nothing is sent and the message is only logged, so a dev machine needs no Firebase project.
 */
@Injectable()
export class FcmSenderService {
  private readonly log = new Logger('Push');
  private auth?: GoogleAuth;
  private projectId?: string;

  constructor(config: ConfigService) {
    const raw = config.get<string>('FIREBASE_SERVICE_ACCOUNT');
    if (!raw) return;
    try {
      const json = raw.trim().startsWith('{') ? raw : readFileSync(raw, 'utf8');
      const credentials = JSON.parse(json) as { project_id: string };
      this.projectId = credentials.project_id;
      this.auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/firebase.messaging'] });
    } catch (e) {
      this.log.error(`FIREBASE_SERVICE_ACCOUNT could not be read: ${(e as Error).message}`);
    }
  }

  get enabled(): boolean {
    return Boolean(this.auth && this.projectId);
  }

  async send(token: string, message: PushMessage): Promise<SendResult> {
    if (!this.auth || !this.projectId) {
      this.log.log(`(not sent, Firebase is not set up) ${message.title}: ${message.body}`);
      return 'sent';
    }
    try {
      const access = await this.auth.getAccessToken();
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${access}`, 'content-type': 'application/json' },
        body: JSON.stringify({ message: { token, notification: { title: message.title, body: message.body }, data: message.data ?? {} } }),
      });
      if (res.ok) return 'sent';
      // 404 UNREGISTERED and 400 INVALID_ARGUMENT mean the token is dead.
      if (res.status === 404 || res.status === 400) return 'gone';
      this.log.warn(`FCM answered ${res.status}`);
      return 'failed';
    } catch (e) {
      this.log.warn(`FCM call failed: ${(e as Error).message}`);
      return 'failed';
    }
  }
}
