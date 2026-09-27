import { Module } from "@nestjs/common";
import { TransactionsController, TransactionsService } from "./transactions";

@Module({
  controllers: [TransactionsController],
  providers: [TransactionsService],
})
export class TransactionsModule {}
