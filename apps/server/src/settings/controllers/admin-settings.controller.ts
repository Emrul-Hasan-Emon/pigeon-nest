import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { ActorResolverService } from '../../shared/services/actor-resolver.service';
import { UpdateSettingsDto } from '../dtos/settings.dtos';
import { SystemSettingsService } from '../services/system-settings.service';
import { AdminAuthGuard } from '../../auth/guards/admin-auth.guard';

@UseGuards(AdminAuthGuard)
@Controller({ path: 'api/admin/settings', version: '1' })
export class AdminSettingsController {
  constructor(
    private readonly settings: SystemSettingsService,
    private readonly actors: ActorResolverService,
  ) {}

  @Get()
  list() {
    return this.settings.list();
  }

  @Patch()
  async update(@Body() dto: UpdateSettingsDto, @CurrentUser() user: JwtPayload) {
    return this.settings.update(dto.settings, await this.actors.resolve(user));
  }
}
