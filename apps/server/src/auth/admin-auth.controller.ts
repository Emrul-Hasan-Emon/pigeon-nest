import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { AdminUser } from '../database/entities/person/admin-user.entity';
import { CurrentAdmin } from './decorators/current-admin.decorator';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto } from './dtos/admin-login.dto';

@Controller({ path: 'api/admin/auth', version: '1' })
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: AdminLoginDto) {
    return this.adminAuthService.login(dto);
  }

  // Who is signed in. Used by the admin console to show the name and role.
  @Get('me')
  @UseGuards(AdminAuthGuard)
  me(@CurrentAdmin() admin: AdminUser) {
    return { id: admin.id, name: admin.name, email: admin.email, role: admin.role, imageUrl: admin.imageUrl ?? null };
  }
}
