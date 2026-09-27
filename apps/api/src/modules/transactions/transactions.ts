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
import { validateAssetLedger } from "@crypto-dca/core";
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PrismaService } from "../../infrastructure/database/prisma.service";

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
  @IsIn(["USD", "PHP", "EUR", "GBP", "AUD", "CAD", "SGD", "JPY", "KRW", "MYR", "IDR", "THB", "USDT", "USDC"])
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

  @IsOptional()
  @IsUUID()
  clientReference?: string;

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
    const occurredAt = new Date(dto.occurredAt);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { baseCurrency: true },
    });
    const quoteCurrency = dto.quoteCurrency.trim().toUpperCase();
    const sameCurrency = quoteCurrency === user.baseCurrency.toUpperCase();

    if (!sameCurrency && dto.fxRateToBase === undefined) {
      throw new BadRequestException(
        `FX rate is required when ${quoteCurrency} differs from base currency ${user.baseCurrency}.`,
      );
    }

    const fxRateToBase = sameCurrency ? 1 : dto.fxRateToBase!;

    if (dto.clientReference) {
      const existingReference = await this.prisma.transaction.findFirst({
        where: { userId, clientReference: dto.clientReference },
      });
      if (existingReference) return existingReference;
    }

    if (occurredAt.getTime() > Date.now() + 5 * 60 * 1000) {
      throw new BadRequestException(
        "Ledger transactions cannot be future-dated. Use a DCA plan/reminder for future purchases.",
      );
    }

    const quantityRequiredTypes: TransactionType[] = [
      TransactionType.BUY,
      TransactionType.SELL,
      TransactionType.TRANSFER_IN,
      TransactionType.TRANSFER_OUT,
      TransactionType.AIRDROP,
      TransactionType.REWARD,
      TransactionType.STAKING_REWARD,
      TransactionType.ADJUSTMENT,
    ];

    const quantityRequired = quantityRequiredTypes.includes(dto.type);

    if (quantityRequired && dto.quantity <= 0) {
      throw new BadRequestException("Quantity must be greater than zero for this transaction type.");
    }

    if (
      (dto.type === TransactionType.BUY || dto.type === TransactionType.SELL) &&
      dto.amountSpent <= 0
    ) {
      throw new BadRequestException("Buy and sell transactions require an amount greater than zero.");
    }

    if (dto.type === TransactionType.FEE && dto.quantity <= 0 && (dto.feeBase || 0) <= 0) {
      throw new BadRequestException("A fee transaction requires either asset quantity or a base-currency fee.");
    }

    const existingAssetLedger = await this.prisma.transaction.findMany({
      where: { userId, assetSymbol },
      orderBy: { occurredAt: "asc" },
    });

    const ledgerValidation = validateAssetLedger([
      ...existingAssetLedger.map((row) => ({
        id: row.id,
        type: row.type,
        quantity: Number(row.quantity),
        amountBase: Number(row.amountSpent) * Number(row.fxRateToBase),
        feeBase: Number(row.feeBase),
        occurredAt: row.occurredAt,
      })),
      {
        type: dto.type,
        quantity: dto.quantity,
        amountBase: dto.amountSpent * fxRateToBase,
        feeBase: dto.feeBase || 0,
        occurredAt,
      },
    ]);

    if (!ledgerValidation.valid) {
      throw new BadRequestException(ledgerValidation.reason || "This transaction would make the asset ledger invalid.");
    }

    return this.prisma.transaction.create({
      data: {
        userId,
        assetSymbol,
        type: dto.type,
        quantity: String(dto.quantity),
        unitPrice: String(
          dto.unitPrice > 0
            ? dto.unitPrice
            : dto.quantity > 0
              ? dto.amountSpent / dto.quantity
              : 0,
        ),
        amountSpent: String(dto.amountSpent),
        quoteCurrency,
        fxRateToBase: String(fxRateToBase),
        feeBase: String(dto.feeBase || 0),
        exchange: dto.exchange?.trim() || null,
        wallet: dto.wallet?.trim() || null,
        notes: dto.notes?.trim() || null,
        clientReference: dto.clientReference || null,
        occurredAt,
      },
    });
  }

  async remove(userId: string, id: string) {
    const row = await this.prisma.transaction.findFirst({ where: { id, userId } });
    if (!row) return { deleted: false };

    const remaining = await this.prisma.transaction.findMany({
      where: {
        userId,
        assetSymbol: row.assetSymbol,
        id: { not: id },
      },
      orderBy: { occurredAt: "asc" },
    });

    const ledgerValidation = validateAssetLedger(
      remaining.map((item) => ({
        id: item.id,
        type: item.type,
        quantity: Number(item.quantity),
        amountBase: Number(item.amountSpent) * Number(item.fxRateToBase),
        feeBase: Number(item.feeBase),
        occurredAt: item.occurredAt,
      })),
    );

    if (!ledgerValidation.valid) {
      throw new BadRequestException(
        `Cannot delete this transaction because a later ledger entry depends on it. ${ledgerValidation.reason || ""}`.trim(),
      );
    }

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
