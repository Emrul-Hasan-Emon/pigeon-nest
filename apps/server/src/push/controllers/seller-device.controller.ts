import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { CurrentSeller } from '../../auth/decorators/current-seller.decorator';
import { RequireSellerAccess } from '../../auth/decorators/require-seller-access.decorator';
import { SellerAccessGuard } from '../../auth/guards/seller-access.guard';
import { SellerAuthGuard } from '../../auth/guards/seller-auth.guard';
import { Seller } from '../../database/entities/seller/seller.entity';
import { RegisterDeviceDto, UnregisterDeviceDto } from '../dtos/device.dtos';
import { PushService } from '../services/push.service';

// The seller app tells the server which phone to notify. Any signed-in seller may, whatever the account state.
@UseGuards(SellerAuthGuard, SellerAccessGuard)
@RequireSellerAccess('any')
@Controller({ path: 'api/seller/devices', version: '1' })
export class SellerDeviceController {
  constructor(private readonly push: PushService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  register(@CurrentSeller() seller: Seller, @Body() dto: RegisterDeviceDto) {
    return this.push.register(seller.id, dto.token, dto.platform);
  }

  // A POST, not a DELETE: this only stops notifications, and the app sends it right before signing out.
  @Post('unregister')
  @HttpCode(HttpStatus.OK)
  unregister(@CurrentSeller() seller: Seller, @Body() dto: UnregisterDeviceDto) {
    return this.push.unregister(seller.id, dto.token);
  }
}
