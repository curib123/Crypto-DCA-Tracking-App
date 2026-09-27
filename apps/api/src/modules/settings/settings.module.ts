import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SettingsController, SettingsService } from "./settings";

@Module({
  imports: [AuthModule],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
