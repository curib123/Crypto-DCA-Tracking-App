import {
  Body,
  Controller,
  Get,
  Injectable,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IsBoolean, IsOptional } from "class-validator";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

export type AdSenseSettings = {
  masterEnabled: boolean;
  landingEnabled: boolean;
  appEnabled: boolean;
  defaultForUsers: boolean;
};

const DEFAULT_SETTINGS: AdSenseSettings = {
  masterEnabled: false,
  landingEnabled: false,
  appEnabled: false,
  defaultForUsers: false,
};

export class UpdateAdSenseSettingsDto {
  @IsOptional()
  @IsBoolean()
  masterEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  landingEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  appEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  defaultForUsers?: boolean;
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function maskClientId(clientId: string) {
  if (!clientId) return null;
  if (clientId.length < 10) return "configured";
  return `${clientId.slice(0, 7)}••••••${clientId.slice(-4)}`;
}

@Injectable()
export class AdSenseService {
  private readonly clientId: string;
  private readonly appSlotId: string;
  private readonly landingSlotId: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.clientId = String(config.get("ADSENSE_CLIENT_ID") || "").trim();
    this.appSlotId = String(config.get("ADSENSE_APP_SLOT_ID") || "").trim();
    this.landingSlotId = String(
      config.get("ADSENSE_LANDING_SLOT_ID") || "",
    ).trim();
  }

  private normalize(value: unknown): AdSenseSettings {
    const input =
      value && typeof value === "object"
        ? (value as Record<string, unknown>)
        : {};

    return {
      masterEnabled: normalizeBoolean(
        input.masterEnabled,
        DEFAULT_SETTINGS.masterEnabled,
      ),
      landingEnabled: normalizeBoolean(
        input.landingEnabled,
        DEFAULT_SETTINGS.landingEnabled,
      ),
      appEnabled: normalizeBoolean(
        input.appEnabled,
        DEFAULT_SETTINGS.appEnabled,
      ),
      defaultForUsers: normalizeBoolean(
        input.defaultForUsers,
        DEFAULT_SETTINGS.defaultForUsers,
      ),
    };
  }

  private validClient() {
    return /^ca-pub-\d{16}$/.test(this.clientId);
  }

  private validSlot(slot: string) {
    return /^\d{6,20}$/.test(slot);
  }

  async settings() {
    const row = await this.prisma.siteSetting.findUnique({
      where: { key: "adsense" },
    });
    return this.normalize(row?.value);
  }

  async updateSettings(dto: UpdateAdSenseSettingsDto) {
    const current = await this.settings();
    const next = this.normalize({
      ...current,
      ...dto,
    });

    await this.prisma.siteSetting.upsert({
      where: { key: "adsense" },
      update: { value: next as any },
      create: { key: "adsense", value: next as any },
    });

    return next;
  }

  async adminView() {
    return {
      settings: await this.settings(),
      credentials: {
        clientConfigured: this.validClient(),
        appSlotConfigured: this.validSlot(this.appSlotId),
        landingSlotConfigured: this.validSlot(this.landingSlotId),
        clientIdMasked: maskClientId(this.clientId),
      },
      note:
        "AdSense identifiers come from server environment variables. They are not editable in the control panel.",
    };
  }

  async publicConfig() {
    const settings = await this.settings();
    const enabled =
      settings.masterEnabled &&
      settings.landingEnabled &&
      this.validClient() &&
      this.validSlot(this.landingSlotId);

    return enabled
      ? {
          enabled: true,
          clientId: this.clientId,
          slotId: this.landingSlotId,
          placement: "landing",
        }
      : {
          enabled: false,
          placement: "landing",
        };
  }

  async appConfig(userId: string) {
    const [settings, user] = await Promise.all([
      this.settings(),
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { adsOverride: true },
      }),
    ]);

    const userEnabled =
      user.adsOverride === "ENABLED" ||
      (user.adsOverride === "INHERIT" && settings.defaultForUsers);

    const enabled =
      settings.masterEnabled &&
      settings.appEnabled &&
      userEnabled &&
      this.validClient() &&
      this.validSlot(this.appSlotId);

    return enabled
      ? {
          enabled: true,
          clientId: this.clientId,
          slotId: this.appSlotId,
          placement: "app",
        }
      : {
          enabled: false,
          placement: "app",
        };
  }
}

@Controller("ads")
export class AdSenseController {
  constructor(private readonly ads: AdSenseService) {}

  @Get("public")
  publicConfig() {
    return this.ads.publicConfig();
  }

  @Get("app")
  @UseGuards(JwtAuthGuard)
  appConfig(@Req() request: any) {
    return this.ads.appConfig(request.user.id);
  }
}
