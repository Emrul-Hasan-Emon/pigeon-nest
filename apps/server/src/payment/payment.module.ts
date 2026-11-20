import { Module } from '@nestjs/common';
import { AdminPaymentGatewayController } from './controllers/admin-payment-gateway.controller';
import { AdminPaymentGatewayService } from './services/admin-payment-gateway.service';

@Module({
  controllers: [AdminPaymentGatewayController],
  providers: [AdminPaymentGatewayService],
  exports: [AdminPaymentGatewayService],
})
export class PaymentModule {}
