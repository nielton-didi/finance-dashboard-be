import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { AutocountConnectionsModule } from '../autocount-connections/autocount-connections.module';

@Module({
  imports: [AutocountConnectionsModule],
  controllers: [HealthController],
})
export class HealthModule {}
