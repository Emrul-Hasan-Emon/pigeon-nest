import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { UserAuthService } from './user-auth.service';
import { UserLoginDto } from './dtos/user-login.dto';
import { UserRegisterDto } from './dtos/user-register.dto';

// Public endpoints — no token needed.
@Controller({ path: 'api/user/auth', version: '1' })
export class UserAuthController {
  constructor(private readonly userAuthService: UserAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: UserLoginDto) {
    return this.userAuthService.login(dto);
  }

  // JSON: name, phone (+countrycode), password, optional email.
  @Post('register')
  register(@Body() dto: UserRegisterDto) {
    return this.userAuthService.register(dto);
  }
}
