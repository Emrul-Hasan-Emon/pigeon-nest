import { Injectable } from '@nestjs/common';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { DatabaseService } from '../../database/database.service';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { Actor } from '../types/actor.type';

// Turns a token's identity into the name stamped on audit / tracker fields.
// The name is stored as it is now, so a log stays readable after a rename.
@Injectable()
export class ActorResolverService {
  constructor(private readonly db: DatabaseService) {}

  async resolve(user: JwtPayload): Promise<Actor> {
    const select = { id: true, name: true } as const;
    if (user.type === AuthUserType.ADMIN) {
      const row = await this.db.adminUser.findOne({ where: { id: user.sub }, select });
      return { id: user.sub, type: user.type, name: row?.name ?? 'Admin' };
    }
    if (user.type === AuthUserType.SELLER) {
      const row = await this.db.seller.findOne({ where: { id: user.sub }, select });
      return { id: user.sub, type: user.type, name: row?.name ?? 'Seller' };
    }
    const row = await this.db.user.findOne({ where: { id: user.sub }, select });
    return { id: user.sub, type: AuthUserType.USER, name: row?.name ?? 'Customer' };
  }
}
