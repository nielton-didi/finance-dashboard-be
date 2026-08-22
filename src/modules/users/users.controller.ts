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
