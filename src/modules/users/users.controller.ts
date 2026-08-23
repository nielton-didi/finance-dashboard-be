import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { GrantOrganizationAccessDto } from './dto/grant-organization-access.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/auth/role';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@Controller('users')
@RequirePermissions(Permission.UserManage)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usersService.remove(id, user.sub);
  }

  @Get(':id/organizations')
  findOrganizations(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOrganizations(id);
  }

  @Post(':id/organizations')
  grantOrganizationAccess(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GrantOrganizationAccessDto,
  ) {
    return this.usersService.grantOrganizationAccess(id, dto.organizationId);
  }

  @Delete(':id/organizations/:orgId')
  revokeOrganizationAccess(
    @Param('id', ParseIntPipe) id: number,
    @Param('orgId', ParseIntPipe) orgId: number,
  ) {
    return this.usersService.revokeOrganizationAccess(id, orgId);
  }
}
