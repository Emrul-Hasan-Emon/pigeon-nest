import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { CurrentUserAccount } from '../../auth/decorators/current-user-account.decorator';
import { RequireUserAccess } from '../../auth/decorators/require-user-access.decorator';
import { UserAccessGuard } from '../../auth/guards/user-access.guard';
import { UserAuthGuard } from '../../auth/guards/user-auth.guard';
import { User } from '../../database/entities/person/user.entity';
import { RegisterDeviceDto, UnregisterDeviceDto } from '../dtos/device.dtos';
import { PushService } from '../services/push.service';

// The buyer app tells the server which phone to notify. Any signed-in buyer may, whatever the account state.
@UseGuards(UserAuthGuard, UserAccessGuard)
@RequireUserAccess('any')
@Controller({ path: 'api/user/devices', version: '1' })
export class UserDeviceController {
  constructor(private readonly push: PushService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  register(@CurrentUserAccount() user: User, @Body() dto: RegisterDeviceDto) {
    return this.push.registerUser(user.id, dto.token, dto.platform);
  }

  // A POST, not a DELETE: this only stops notifications, and the app sends it right before signing out.
  @Post('unregister')
  @HttpCode(HttpStatus.OK)
  unregister(@CurrentUserAccount() user: User, @Body() dto: UnregisterDeviceDto) {
    return this.push.unregisterUser(user.id, dto.token);
  }
}
