import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  Param,
  Patch,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  AdOverride,
  UserRole,
  UserStatus,
} from "@prisma/client";
import { IsEnum, IsOptional } from "class-validator";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import {
  AdSenseService,
  UpdateAdSenseSettingsDto,
} from "../ads/ads";
import { ContentService } from "../content/content";
import { ControlPanelReadyGuard } from "./control-panel-auth";

export class UpdateAdminUserDto {
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsEnum(AdOverride)
  adsOverride?: AdOverride;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly content: ContentService,
    private readonly ads: AdSenseService,
  ) {}

  private async audit(
    actorAdminId: string,
    action: string,
    targetType: string,
    targetId?: string,
    metadata?: Record<string, unknown>,
  ) {
    await this.prisma.controlPanelAuditLog.create({
      data: {
        actorAdminId,
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
        activeUsers7d: users.filter(
          (user) => user.lastLoginAt && user.lastLoginAt >= since7,
        ).length,
        appAdmins: users.filter((user) => user.role === UserRole.ADMIN).length,
        suspendedUsers: users.filter(
          (user) => user.status === UserStatus.SUSPENDED,
        ).length,
        transactions30d: transactions.length,
      },
      userGrowth: dayKeys.map((date) => ({ date, value: signups[date] })),
      transactionActivity: dayKeys.map((date) => ({
        date,
        value: txByDay[date],
      })),
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
          adsOverride: true,
          lastLoginAt: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async updateUser(
    actorAdminId: string,
    userId: string,
    dto: UpdateAdminUserDto,
  ) {
    if (!dto.role && !dto.status && !dto.adsOverride) {
      throw new BadRequestException("No user changes were provided.");
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.role ? { role: dto.role } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.adsOverride ? { adsOverride: dto.adsOverride } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        adsOverride: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    await this.audit(actorAdminId, "user.update", "User", userId, {
      role: dto.role,
      status: dto.status,
      adsOverride: dto.adsOverride,
    });

    return updated;
  }

  async auditLog() {
    return this.prisma.controlPanelAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        actor: {
          select: {
            username: true,
          },
        },
      },
    });
  }

  getLanding() {
    return this.content.getLanding();
  }

  async saveLanding(
    actorAdminId: string,
    value: unknown,
  ) {
    const saved = await this.content.saveLanding(value);
    await this.audit(
      actorAdminId,
      "landing.update",
      "SiteSetting",
      "landing",
    );
    return saved;
  }

  getAds() {
    return this.ads.adminView();
  }

  async saveAds(
    actorAdminId: string,
    dto: UpdateAdSenseSettingsDto,
  ) {
    const saved = await this.ads.updateSettings(dto);
    await this.audit(
      actorAdminId,
      "adsense.settings.update",
      "SiteSetting",
      "adsense",
      saved,
    );
    return this.ads.adminView();
  }
}

@Controller("admin")
@UseGuards(ControlPanelReadyGuard)
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
    return this.admin.updateUser(
      req.controlAdmin.id,
      id,
      dto,
    );
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
  saveLanding(
    @Req() req: any,
    @Body() body: unknown,
  ) {
    return this.admin.saveLanding(
      req.controlAdmin.id,
      body,
    );
  }

  @Get("ads")
  ads() {
    return this.admin.getAds();
  }

  @Put("ads")
  saveAds(
    @Req() req: any,
    @Body() dto: UpdateAdSenseSettingsDto,
  ) {
    return this.admin.saveAds(
      req.controlAdmin.id,
      dto,
    );
  }
}
