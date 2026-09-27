import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { SESSION_COOKIE, SESSION_MAX_AGE_MS } from "../../common/security/session.constants";

@Injectable()
export class SessionService {
  constructor(private readonly jwt: JwtService) {}

  issue(user: { id: string; email: string }) {
    return this.jwt.sign({ sub: user.id, email: user.email });
  }

  setCookie(response: any, token: string) {
    response.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE_MS,
      path: "/",
    });
  }

  clearCookie(response: any) {
    response.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
  }
}
