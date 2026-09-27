import {
  BadRequestException,
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  ForbiddenException,
  Get,
  Injectable,
  Param,
  Patch,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { UserRole, UserStatus } from "@prisma/client";
import { IsEnum, IsOptional } from "class-validator";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ContentService } from "../content/content";

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    if (!request.user?.id) throw new ForbiddenException("Administrator access required.");

    const user = await this.prisma.user.findUnique({
      where: { id: request.user.id },
      select: { role: true, status: true },
    });

    if (!user || user.status !== UserStatus.ACTIVE || user.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Administrator access required.");
    }
    return true;
  }
}

export class UpdateAdminUserDto {
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly content: ContentService,
  ) {}

  private async audit(
    actorUserId: string,
    action: string,
    targetType: string,
    targetId?: string,
    metadata?: Record<string, unknown>,
  ) {
    await this.prisma.adminAuditLog.create({
      data: {
        actorUserId,
        action,
        targetType,
        targetId,
        metadata: metadata as any,
      },
    });
  }

  async overview() {
    const now = new Date();
    const since30 = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
    const since7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [users, transactions] = await Promise.all([
      this.prisma.user.findMany({
        select: {
          createdAt: true,
          lastLoginAt: true,
          status: true,
          role: true,
        },
      }),
      this.prisma.transaction.findMany({
        where: { createdAt: { gte: since30 } },
        select: { createdAt: true, assetSymbol: true },
      }),
    ]);

    const dayKeys = Array.from({ length: 30 }, (_, index) => {
      const day = new Date(since30.getTime() + index * 24 * 60 * 60 * 1000);
      return day.toISOString().slice(0, 10);
    });
    const signups = Object.fromEntries(dayKeys.map((key) => [key, 0]));
    const txByDay = Object.fromEntries(dayKeys.map((key) => [key, 0]));
    const assetCounts: Record<string, number> = {};

    for (const user of users) {
      const key = user.createdAt.toISOString().slice(0, 10);
      if (key in signups) signups[key] += 1;
    }
    for (const tx of transactions) {
      const key = tx.createdAt.toISOString().slice(0, 10);
      if (key in txByDay) txByDay[key] += 1;
      assetCounts[tx.assetSymbol] = (assetCounts[tx.assetSymbol] || 0) + 1;
    }

    return {
      totals: {
        users: users.length,
        activeUsers7d: users.filter((user) => user.lastLoginAt && user.lastLoginAt >= since7).length,
        admins: users.filter((user) => user.role === UserRole.ADMIN).length,
        suspendedUsers: users.filter((user) => user.status === UserStatus.SUSPENDED).length,
        transactions30d: transactions.length,
      },
      userGrowth: dayKeys.map((date) => ({ date, value: signups[date] })),
      transactionActivity: dayKeys.map((date) => ({ date, value: txByDay[date] })),
      topAssets: Object.entries(assetCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([asset, value]) => ({ asset, value })),
    };
  }

  async listUsers(searchRaw?: string, pageRaw?: string, limitRaw?: string) {
    const search = String(searchRaw || "").trim();
    const page = Math.max(1, Number(pageRaw) || 1);
    const limit = Math.min(100, Math.max(10, Number(limitRaw) || 25));
    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: "insensitive" as const } },
            { name: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          pictureUrl: true,
          baseCurrency: true,
          role: true,
          status: true,
          themePreference: true,
          lastLoginAt: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
  }

  async updateUser(actorUserId: string, userId: string, dto: UpdateAdminUserDto) {
    if (!dto.role && !dto.status) {
      throw new BadRequestException("No user changes were provided.");
    }
    if (actorUserId === userId && dto.status === UserStatus.SUSPENDED) {
      throw new BadRequestException("You cannot suspend your own administrator account.");
    }
    if (actorUserId === userId && dto.role === UserRole.USER) {
      throw new BadRequestException("You cannot remove your own administrator role.");
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.role ? { role: dto.role } : {}),
        ...(dto.status ? { status: dto.status } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    await this.audit(actorUserId, "user.update", "User", userId, {
      role: dto.role,
      status: dto.status,
    });
    return updated;
  }

  async auditLog() {
    return this.prisma.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        actor: { select: { email: true, name: true } },
      },
    });
  }

  getLanding() {
    return this.content.getLanding();
  }

  async saveLanding(actorUserId: string, value: unknown) {
    const saved = await this.content.saveLanding(value);
    await this.audit(actorUserId, "landing.update", "SiteSetting", "landing");
    return saved;
  }
}

@Controller("admin")
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("overview")
  overview() {
    return this.admin.overview();
  }

  @Get("users")
  users(
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.admin.listUsers(search, page, limit);
  }

  @Patch("users/:id")
  updateUser(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdateAdminUserDto,
  ) {
    return this.admin.updateUser(req.user.id, id, dto);
  }

  @Get("audit")
  audit() {
    return this.admin.auditLog();
  }

  @Get("content/landing")
  landing() {
    return this.admin.getLanding();
  }

  @Put("content/landing")
  saveLanding(@Req() req: any, @Body() body: unknown) {
    return this.admin.saveLanding(req.user.id, body);
  }
}
