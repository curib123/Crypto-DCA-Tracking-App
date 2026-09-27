import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { TransactionType } from "@prisma/client";
import { calculateAssetPosition } from "@crypto-dca/core";
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from "class-validator";
import { JwtAuthGuard } from "./auth";
import { PrismaService } from "./prisma.service";

export class CreateTransactionDto {
  @IsString()
  @MaxLength(12)
  assetSymbol!: string;

  @IsEnum(TransactionType)
  type!: TransactionType;

  @IsNumber()
  @Min(0)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsNumber()
  @Min(0)
  amountSpent!: number;

  @IsString()
  @MaxLength(12)
  quoteCurrency!: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  fxRateToBase?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  feeBase?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  exchange?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  wallet?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsDateString()
  occurredAt!: string;
}

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { occurredAt: "desc" },
    });
  }

  async create(userId: string, dto: CreateTransactionDto) {
    const assetSymbol = dto.assetSymbol.trim().toUpperCase();

    if (dto.type === TransactionType.SELL) {
      const existing = await this.prisma.transaction.findMany({
        where: { userId, assetSymbol },
        orderBy: { occurredAt: "asc" },
      });

      const position = calculateAssetPosition(
        existing.map((row) => ({
          id: row.id,
          type: row.type,
          quantity: Number(row.quantity),
          amountBase: Number(row.amountSpent) * Number(row.fxRateToBase),
          feeBase: Number(row.feeBase),
          occurredAt: row.occurredAt,
        })),
      );

      if (dto.quantity > position.quantity + 1e-12) {
        throw new BadRequestException(
          `Cannot sell ${dto.quantity} ${assetSymbol}; tracked holding is ${position.quantity}.`,
        );
      }
    }

    return this.prisma.transaction.create({
      data: {
        userId,
        assetSymbol,
        type: dto.type,
        quantity: String(dto.quantity),
        unitPrice: String(dto.unitPrice),
        amountSpent: String(dto.amountSpent),
        quoteCurrency: dto.quoteCurrency.trim().toUpperCase(),
        fxRateToBase: String(dto.fxRateToBase || 1),
        feeBase: String(dto.feeBase || 0),
        exchange: dto.exchange?.trim() || null,
        wallet: dto.wallet?.trim() || null,
        notes: dto.notes?.trim() || null,
        occurredAt: new Date(dto.occurredAt),
      },
    });
  }

  async remove(userId: string, id: string) {
    const row = await this.prisma.transaction.findFirst({ where: { id, userId } });
    if (!row) return { deleted: false };

    await this.prisma.transaction.delete({ where: { id } });
    return { deleted: true };
  }
}

@Controller("transactions")
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get()
  list(@Req() req: any) {
    return this.transactions.list(req.user.id);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateTransactionDto) {
    return this.transactions.create(req.user.id, dto);
  }

  @Delete(":id")
  remove(@Req() req: any, @Param("id") id: string) {
    return this.transactions.remove(req.user.id, id);
  }
}
