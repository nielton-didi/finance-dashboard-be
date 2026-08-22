import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/auth/role';
import { OrgAccessGuard } from './guards/org-access.guard';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  findAllForUser(@CurrentUser() user: JwtPayload) {
    return this.organizationsService.findAllForUser(user);
  }

  @Post()
  @RequirePermissions(Permission.OrganizationManage)
  create(@Body() dto: CreateOrganizationDto) {
    return this.organizationsService.create(dto);
  }

  @Get(':orgId')
  @UseGuards(OrgAccessGuard)
  findOne(@Param('orgId', ParseIntPipe) orgId: number) {
    return this.organizationsService.findOne(orgId);
  }

  @Patch(':orgId')
  @RequirePermissions(Permission.OrganizationManage)
  update(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.update(orgId, dto);
  }
}
