import { Module } from '@nestjs/common';
import { CheckoutModule } from '../checkout/checkout.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [CheckoutModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
