import { Body, Controller, Get, Post, Req, Res, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { GoogleSignInDto } from "./auth.dto";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { SessionService } from "./session.service";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly session: SessionService,
  ) {}

  @Post("google")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async google(@Body() dto: GoogleSignInDto, @Res({ passthrough: true }) response: any) {
    const result = await this.auth.signInWithGoogle(dto.credential);
    this.session.setCookie(response, result.token);
    return { user: result.user };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@Req() request: any) {
    return this.auth.me(request.user.id);
  }

  @Post("logout")
  logout(@Res({ passthrough: true }) response: any) {
    this.session.clearCookie(response);
    return { signedOut: true };
  }
}
