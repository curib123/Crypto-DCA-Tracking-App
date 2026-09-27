import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { SESSION_COOKIE } from "../../common/security/session.constants";

function readCookie(cookieHeader: string, name: string) {
  const prefix = `${name}=`;
  const part = cookieHeader
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));
  return part ? part.slice(prefix.length) : "";
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const token = readCookie(String(request.headers.cookie || ""), SESSION_COOKIE);

    if (!token) throw new UnauthorizedException("Sign in required.");

    try {
      const payload = await this.jwt.verifyAsync(token);
      request.user = { id: payload.sub, email: payload.email };
      return true;
    } catch {
      throw new UnauthorizedException("Your session is invalid or expired.");
    }
  }
}
