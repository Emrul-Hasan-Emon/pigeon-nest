import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { FcmSenderService, PushMessage } from './fcm-sender.service';

/** Tells a seller's phones that something needs them. A failure here never stops the action that caused it. */
@Injectable()
export class PushService {
  private readonly log = new Logger('Push');

  constructor(
    private readonly db: DatabaseService,
    private readonly fcm: FcmSenderService,
  ) {}

  /** Fire and forget: call it without await. */
  notifySeller(sellerId: number, message: PushMessage): void {
    void this.deliver(sellerId, message).catch((e: Error) => this.log.warn(`Push to seller ${sellerId} failed: ${e.message}`));
  }

  private async deliver(sellerId: number, message: PushMessage) {
    const devices = await this.db.sellerDevice.find({ where: { sellerId } });
    for (const d of devices) {
      if ((await this.fcm.send(d.token, message)) === 'gone') await this.db.sellerDevice.delete({ id: d.id });
    }
  }

  /** Saves the phone for this seller. A phone that was another seller's moves to this one. */
  async register(sellerId: number, token: string, platform: 'android' | 'ios') {
    await this.db.sellerDevice.query(
      `INSERT INTO seller_device ("sellerId", token, platform, "lastSeenAt")
       VALUES ($1, $2, $3, now())
       ON CONFLICT (token) DO UPDATE SET "sellerId" = $1, platform = $3, "lastSeenAt" = now(), "deletedAt" = NULL`,
      [sellerId, token, platform],
    );
    return { registered: true };
  }

  async unregister(sellerId: number, token: string) {
    await this.db.sellerDevice.delete({ sellerId, token });
    return { unregistered: true };
  }

  /** Fire and forget: call it without await. */
  notifyUser(userId: number, message: PushMessage): void {
    void this.deliverToUser(userId, message).catch((e: Error) => this.log.warn(`Push to user ${userId} failed: ${e.message}`));
  }

  private async deliverToUser(userId: number, message: PushMessage) {
    const devices = await this.db.userDevice.find({ where: { userId } });
    for (const d of devices) {
      if ((await this.fcm.send(d.token, message)) === 'gone') await this.db.userDevice.delete({ id: d.id });
    }
  }

  /** Saves the phone for this buyer. A phone that was another buyer's moves to this one. */
  async registerUser(userId: number, token: string, platform: 'android' | 'ios') {
    await this.db.userDevice.query(
      `INSERT INTO user_device ("userId", token, platform, "lastSeenAt")
       VALUES ($1, $2, $3, now())
       ON CONFLICT (token) DO UPDATE SET "userId" = $1, platform = $3, "lastSeenAt" = now(), "deletedAt" = NULL`,
      [userId, token, platform],
    );
    return { registered: true };
  }

  async unregisterUser(userId: number, token: string) {
    await this.db.userDevice.delete({ userId, token });
    return { unregistered: true };
  }
}
