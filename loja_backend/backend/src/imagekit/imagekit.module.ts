import { Module } from '@nestjs/common';
import { ImagekitController } from './imagekit.controller';
import { ImagekitService } from './imagekit.service';

@Module({
  controllers: [ImagekitController],
  providers: [ImagekitService],
})
export class ImagekitModule {}
