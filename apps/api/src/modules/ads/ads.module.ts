import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AdSenseController, AdSenseService } from "./ads";

@Module({
  imports: [AuthModule],
  controllers: [AdSenseController],
  providers: [AdSenseService],
  exports: [AdSenseService],
})
export class AdsModule {}
