import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  OnModuleInit,
  Post,
  Get,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Throttle } from "@nestjs/throttler";
import { IsString, Length } from "class-validator";
import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { PrismaService } from "../../infrastructure/database/prisma.service";

export const CONTROL_PANEL_COOKIE = "nextfi_control_session";
const CONTROL_PANEL_SESSION_MS = 30 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

function readCookie(cookieHeader: string, name: string) {
  const prefix = `${name}=`;
  const part = cookieHeader
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));
  return part ? decodeURIComponent(part.slice(prefix.length)) : "";
}

function hashPassword(password: string) {
  const salt = randomBytes(16);
  const digest = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${digest.toString("hex")}`;
}

function verifyPassword(password: string, stored: string) {
  const [algorithm, saltHex, digestHex] = stored.split("$");
  if (algorithm !== "scrypt" || !saltHex || !digestHex) return false;

  try {
    const expected = Buffer.from(digestHex, "hex");
    const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function strongPassword(password: string) {
  return (
    password.length >= 12 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

export class ControlPanelLoginDto {
  @IsString()
  @Length(1, 80)
  username!: string;

  @IsString()
  @Length(1, 256)
  password!: string;
}

export class ChangeControlPanelPasswordDto {
  @IsString()
  @Length(1, 256)
  currentPassword!: string;

  @IsString()
  @Length(12, 256)
  newPassword!: string;
}

@Injectable()
export class ControlPanelAuthService implements OnModuleInit {
  private readonly production: boolean;
  private readonly bootstrapUsername: string;
  private readonly bootstrapPassword: string;
  private readonly jwtSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.production = config.get("NODE_ENV") === "production";
    this.bootstrapUsername = String(
      config.get("CONTROL_PANEL_USERNAME") || "admin",
    ).trim();
    this.bootstrapPassword = String(
      config.get("CONTROL_PANEL_PASSWORD") || "pass",
    );
    this.jwtSecret = String(
      config.get("CONTROL_PANEL_JWT_SECRET") ||
        config.get("JWT_SECRET") ||
        "dev-only-control-panel-secret",
    );

    if (this.production) {
      if (
        !this.bootstrapUsername ||
        this.bootstrapPassword === "pass" ||
        this.bootstrapPassword.length < 12
      ) {
        throw new Error(
          "Production requires a non-default CONTROL_PANEL_USERNAME and a CONTROL_PANEL_PASSWORD of at least 12 characters.",
        );
      }

      if (this.jwtSecret.length < 32) {
        throw new Error(
          "CONTROL_PANEL_JWT_SECRET must be at least 32 characters in production.",
        );
      }
    }
  }

  async onModuleInit() {
    const existing = await this.prisma.controlPanelAdmin.findUnique({
      where: { username: this.bootstrapUsername },
    });

    if (!existing) {
      await this.prisma.controlPanelAdmin.create({
        data: {
          username: this.bootstrapUsername,
          passwordHash: hashPassword(this.bootstrapPassword),
          mustChangePassword: true,
        },
      });
    }
  }

  private async audit(
    adminId: string,
    action: string,
    metadata?: Record<string, unknown>,
  ) {
    await this.prisma.controlPanelAuditLog.create({
      data: {
        actorAdminId: adminId,
        action,
        targetType: "ControlPanelAdmin",
        targetId: adminId,
        metadata: metadata as any,
      },
    });
  }

  async login(usernameRaw: string, password: string) {
    const username = usernameRaw.trim();
    const admin = await this.prisma.controlPanelAdmin.findUnique({
      where: { username },
    });

    if (!admin) {
      // Do one scrypt operation even when the username is unknown to reduce timing leaks.
      verifyPassword(password, hashPassword("invalid-placeholder-password"));
      throw new UnauthorizedException("Invalid control-panel credentials.");
    }

    if (admin.lockedUntil && admin.lockedUntil > new Date()) {
      throw new UnauthorizedException(
        "Control-panel login is temporarily locked. Try again later.",
      );
    }

    if (!verifyPassword(password, admin.passwordHash)) {
      const failedAttempts = admin.failedAttempts + 1;
      const lockedUntil =
        failedAttempts >= MAX_LOGIN_ATTEMPTS
          ? new Date(Date.now() + LOCK_MS)
          : null;

      await this.prisma.controlPanelAdmin.update({
        where: { id: admin.id },
        data: {
          failedAttempts: lockedUntil ? 0 : failedAttempts,
          lockedUntil,
        },
      });

      throw new UnauthorizedException("Invalid control-panel credentials.");
    }

    const updated = await this.prisma.controlPanelAdmin.update({
      where: { id: admin.id },
      data: {
        failedAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    await this.audit(updated.id, "control.login");

    return {
      token: this.jwt.sign(
        {
          sub: updated.id,
          username: updated.username,
          scope: "control-panel",
        },
        {
          secret: this.jwtSecret,
          expiresIn: "30m",
        },
      ),
      admin: {
        id: updated.id,
        username: updated.username,
        mustChangePassword: updated.mustChangePassword,
      },
    };
  }

  setCookie(response: any, token: string) {
    response.cookie(CONTROL_PANEL_COOKIE, token, {
      httpOnly: true,
      secure: this.production,
      sameSite: "strict",
      maxAge: CONTROL_PANEL_SESSION_MS,
      path: "/",
    });
  }

  clearCookie(response: any) {
    response.clearCookie(CONTROL_PANEL_COOKIE, {
      httpOnly: true,
      secure: this.production,
      sameSite: "strict",
      path: "/",
    });
  }

  async resolveSession(cookieHeader: string) {
    const token = readCookie(cookieHeader, CONTROL_PANEL_COOKIE);
    if (!token) throw new UnauthorizedException("Control-panel login required.");

    try {
      const payload = await this.jwt.verifyAsync(token, {
        secret: this.jwtSecret,
      });

      if (payload?.scope !== "control-panel" || !payload?.sub) {
        throw new UnauthorizedException("Invalid control-panel session.");
      }

      const admin = await this.prisma.controlPanelAdmin.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          username: true,
          mustChangePassword: true,
          lastLoginAt: true,
        },
      });

      if (!admin) {
        throw new UnauthorizedException("Invalid control-panel session.");
      }

      return admin;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException("Control-panel session expired.");
    }
  }

  async changePassword(
    adminId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const admin = await this.prisma.controlPanelAdmin.findUniqueOrThrow({
      where: { id: adminId },
    });

    if (!verifyPassword(currentPassword, admin.passwordHash)) {
      throw new UnauthorizedException("Current password is incorrect.");
    }

    if (!strongPassword(newPassword)) {
      throw new ForbiddenException(
        "New password must be at least 12 characters and include uppercase, lowercase, number, and symbol.",
      );
    }

    if (verifyPassword(newPassword, admin.passwordHash)) {
      throw new ForbiddenException(
        "New password must be different from the current password.",
      );
    }

    const updated = await this.prisma.controlPanelAdmin.update({
      where: { id: admin.id },
      data: {
        passwordHash: hashPassword(newPassword),
        mustChangePassword: false,
        failedAttempts: 0,
        lockedUntil: null,
      },
      select: {
        id: true,
        username: true,
        mustChangePassword: true,
      },
    });

    await this.audit(admin.id, "control.password.change");
    return updated;
  }
}

@Injectable()
export class ControlPanelSessionGuard implements CanActivate {
  constructor(private readonly auth: ControlPanelAuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    request.controlAdmin = await this.auth.resolveSession(
      String(request.headers.cookie || ""),
    );
    return true;
  }
}

@Injectable()
export class ControlPanelReadyGuard implements CanActivate {
  constructor(private readonly sessionGuard: ControlPanelSessionGuard) {}

  async canActivate(context: ExecutionContext) {
    await this.sessionGuard.canActivate(context);
    const request = context.switchToHttp().getRequest();

    if (request.controlAdmin?.mustChangePassword) {
      throw new ForbiddenException(
        "Change the default control-panel password before continuing.",
      );
    }

    return true;
  }
}

@Controller("admin-auth")
export class ControlPanelAuthController {
  constructor(private readonly auth: ControlPanelAuthService) {}

  @Post("login")
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  async login(
    @Body() dto: ControlPanelLoginDto,
    @Res({ passthrough: true }) response: any,
  ) {
    const result = await this.auth.login(dto.username, dto.password);
    this.auth.setCookie(response, result.token);
    return { admin: result.admin };
  }

  @Get("me")
  @UseGuards(ControlPanelSessionGuard)
  me(@Req() request: any) {
    return request.controlAdmin;
  }

  @Post("change-password")
  @UseGuards(ControlPanelSessionGuard)
  async changePassword(
    @Req() request: any,
    @Body() dto: ChangeControlPanelPasswordDto,
  ) {
    return this.auth.changePassword(
      request.controlAdmin.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  @Post("logout")
  @UseGuards(ControlPanelSessionGuard)
  logout(@Res({ passthrough: true }) response: any) {
    this.auth.clearCookie(response);
    return { signedOut: true };
  }
}
