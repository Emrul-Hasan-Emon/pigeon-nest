import { Module } from '@nestjs/common';
import { AdminAttributeController } from './controllers/admin-attribute.controller';
import { AdminAttributeValueController } from './controllers/admin-attribute-value.controller';
import { AdminAttributeService } from './services/admin-attribute.service';

@Module({
  controllers: [AdminAttributeController, AdminAttributeValueController],
  providers: [AdminAttributeService],
  exports: [AdminAttributeService],
})
export class AttributeModule {}
