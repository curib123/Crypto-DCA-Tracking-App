import { Body, Controller, Get, Injectable, Patch, Req, UseGuards } from "@nestjs/common";
import { ThemePreference } from "@prisma/client";
import { IsEnum, IsIn, IsOptional, IsString } from "class-validator";
import { SUPPORTED_CURRENCIES } from "../../common/currency.constants";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  @IsIn(SUPPORTED_CURRENCIES)
  baseCurrency?: string;

  @IsOptional()
  @IsEnum(ThemePreference)
  themePreference?: ThemePreference;
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  get(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        baseCurrency: true,
        themePreference: true,
      },
    });
  }

  update(userId: string, dto: UpdateSettingsDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.baseCurrency ? { baseCurrency: dto.baseCurrency.toUpperCase() } : {}),
        ...(dto.themePreference ? { themePreference: dto.themePreference } : {}),
      },
      select: {
        id: true,
        email: true,
        baseCurrency: true,
        themePreference: true,
      },
    });
  }
}

@Controller("settings")
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get(@Req() req: any) {
    return this.settings.get(req.user.id);
  }

  @Patch()
  update(@Req() req: any, @Body() dto: UpdateSettingsDto) {
    return this.settings.update(req.user.id, dto);
  }
}
