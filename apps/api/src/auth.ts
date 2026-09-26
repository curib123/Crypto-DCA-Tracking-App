import {
  Body,
  CanActivate,
  ConflictException,
  Controller,
  ExecutionContext,
  Injectable,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from "class-validator";
import bcrypt from "bcryptjs";
import { PrismaService } from "./prisma.service";

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

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
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

  async login(dto: LoginDto) {
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

  private issueToken(user: { id: string; email: string; baseCurrency: string }) {
    return {
      accessToken: this.jwt.sign({ sub: user.id, email: user.email }),
      user,
    };
  }
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const header = String(request.headers.authorization || "");
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";

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
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }
}
