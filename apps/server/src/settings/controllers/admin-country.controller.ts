import { Controller, Get, UseGuards } from '@nestjs/common';
import { listCountries } from '../utils/countries';
import { AdminAuthGuard } from '../../auth/guards/admin-auth.guard';

@UseGuards(AdminAuthGuard)
@Controller({ path: 'api/admin/countries', version: '1' })
export class AdminCountryController {
  @Get()
  list() {
    return listCountries();
  }
}
