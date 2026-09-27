import { Module } from "@nestjs/common";
import { ContentController, ContentService } from "./content";

@Module({
  controllers: [ContentController],
  providers: [ContentService],
  exports: [ContentService],
})
export class ContentModule {}
