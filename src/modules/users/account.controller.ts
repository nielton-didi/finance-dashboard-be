import { Body, Controller, Patch } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateAccountDto } from './dto/update-account.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@Controller('account')
export class AccountController {
  constructor(private readonly usersService: UsersService) {}

  @Patch()
  updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  @Patch('password')
  updatePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdatePasswordDto,
  ) {
    return this.usersService.updatePassword(user.sub, dto);
  }
}
