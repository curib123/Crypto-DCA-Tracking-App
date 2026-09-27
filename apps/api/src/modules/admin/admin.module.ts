import { Module } from "@nestjs/common";
import { AdsModule } from "../ads/ads.module";
import { ContentModule } from "../content/content.module";
import { AdminController, AdminService } from "./admin";
import {
  ControlPanelAuthController,
  ControlPanelAuthService,
  ControlPanelReadyGuard,
  ControlPanelSessionGuard,
} from "./control-panel-auth";

@Module({
  imports: [AdsModule, ContentModule],
  controllers: [AdminController, ControlPanelAuthController],
  providers: [
    AdminService,
    ControlPanelAuthService,
    ControlPanelSessionGuard,
    ControlPanelReadyGuard,
  ],
})
export class AdminModule {}
