import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TransactionsController, TransactionsService } from "./transactions";

@Module({
  imports: [AuthModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
})
export class TransactionsModule {}
