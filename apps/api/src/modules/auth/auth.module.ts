import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { GoogleIdentityService } from "./google-identity.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { SessionService } from "./session.service";

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    GoogleIdentityService,
    JwtAuthGuard,
    SessionService,
  ],
  exports: [JwtAuthGuard],
})
export class AuthModule {}
