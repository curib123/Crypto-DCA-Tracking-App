import { IsString, MinLength } from "class-validator";

export class GoogleSignInDto {
  @IsString()
  @MinLength(20)
  credential!: string;
}
