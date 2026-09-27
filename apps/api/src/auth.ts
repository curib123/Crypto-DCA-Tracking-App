import {
  Body,
  CanActivate,
  ConflictException,
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from "class-validator";
import bcrypt from "bcryptjs";
import { PrismaService } from "./prisma.service";

const SESSION_COOKIE = "crypto_dca_session";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  @IsIn(["USD", "PHP", "EUR", "GBP", "AUD", "CAD", "SGD", "JPY", "KRW", "MYR", "IDR", "THB", "USDT", "USDC"])
  baseCurrency?: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

type AuthResult = {
  token: string;
  user: { id: string; email: string; baseCurrency: string };
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });

    if (existing) {
      throw new ConflictException("An account with this email already exists.");
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(dto.password, 12),
        baseCurrency: dto.baseCurrency || "USD",
      },
      select: { id: true, email: true, baseCurrency: true },
    });

    return this.issueToken(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    return this.issueToken({
      id: user.id,
      email: user.email,
      baseCurrency: user.baseCurrency,
    });
  }

  async me(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, baseCurrency: true },
    });
  }

  private issueToken(user: { id: string; email: string; baseCurrency: string }): AuthResult {
    return {
      token: this.jwt.sign({ sub: user.id, email: user.email }),
      user,
    };
  }
}

function readCookie(cookieHeader: string, name: string) {
  const prefix = `${name}=`;
  const part = cookieHeader
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));
  return part ? part.slice(prefix.length) : "";
}

function setSessionCookie(response: any, token: string) {
  response.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_MS,
    path: "/",
  });
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const header = String(request.headers.authorization || "");
    const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
    const cookie = readCookie(String(request.headers.cookie || ""), SESSION_COOKIE);
    const token = bearer || cookie;

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

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) response: any) {
    const result = await this.auth.register(dto);
    setSessionCookie(response, result.token);
    return { user: result.user };
  }

  @Post("login")
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: any) {
    const result = await this.auth.login(dto);
    setSessionCookie(response, result.token);
    return { user: result.user };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@Req() request: any) {
    return this.auth.me(request.user.id);
  }

  @Post("logout")
  logout(@Res({ passthrough: true }) response: any) {
    response.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    return { signedOut: true };
  }
}
