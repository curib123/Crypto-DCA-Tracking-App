import { ConflictException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { GoogleIdentityService } from "./google-identity.service";
import { SessionService } from "./session.service";

@Injectable()
export class AuthService {
  private readonly defaultBaseCurrency: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleIdentity: GoogleIdentityService,
    private readonly session: SessionService,
    config: ConfigService,
  ) {
    this.defaultBaseCurrency = String(config.get("DEFAULT_BASE_CURRENCY") || "USD").toUpperCase();
  }

  async signInWithGoogle(credential: string) {
    const identity = await this.googleIdentity.verifyCredential(credential);

    let user = await this.prisma.user.findUnique({
      where: { googleSubject: identity.subject },
    });

    if (!user) {
      const existingByEmail = await this.prisma.user.findUnique({
        where: { email: identity.email },
      });

      if (existingByEmail) {
        const isLegacy = existingByEmail.googleSubject.startsWith("legacy:");
        const googleAuthoritative =
          identity.email.endsWith("@gmail.com") ||
          (identity.emailVerified && Boolean(identity.hostedDomain));

        if (!isLegacy || !googleAuthoritative) {
          throw new ConflictException(
            "An account already exists for this email and cannot be linked automatically.",
          );
        }

        user = await this.prisma.user.update({
          where: { id: existingByEmail.id },
          data: {
            googleSubject: identity.subject,
            name: identity.name,
            pictureUrl: identity.pictureUrl,
          },
        });
      } else {
        user = await this.prisma.user.create({
          data: {
            googleSubject: identity.subject,
            email: identity.email,
            name: identity.name,
            pictureUrl: identity.pictureUrl,
            baseCurrency: this.defaultBaseCurrency,
          },
        });
      }
    } else {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          email: identity.email,
          name: identity.name,
          pictureUrl: identity.pictureUrl,
        },
      });
    }

    return {
      token: this.session.issue(user),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        pictureUrl: user.pictureUrl,
        baseCurrency: user.baseCurrency,
      },
    };
  }

  async me(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        pictureUrl: true,
        baseCurrency: true,
      },
    });
  }
}
