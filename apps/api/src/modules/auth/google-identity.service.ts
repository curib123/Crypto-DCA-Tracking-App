import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OAuth2Client, TokenPayload } from "google-auth-library";

export type VerifiedGoogleIdentity = {
  subject: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  pictureUrl?: string;
  hostedDomain?: string;
};

@Injectable()
export class GoogleIdentityService {
  private readonly client = new OAuth2Client();
  private readonly clientId: string;

  constructor(config: ConfigService) {
    this.clientId = String(config.get("GOOGLE_CLIENT_ID") || "").trim();

    if (!this.clientId) {
      throw new Error("GOOGLE_CLIENT_ID is required.");
    }
  }

  async verifyCredential(credential: string): Promise<VerifiedGoogleIdentity> {
    try {
      const ticket = await this.client.verifyIdToken({
        idToken: credential,
        audience: this.clientId,
      });

      const payload = ticket.getPayload();
      return this.normalizePayload(payload);
    } catch {
      throw new UnauthorizedException("Google sign-in could not be verified.");
    }
  }

  private normalizePayload(payload?: TokenPayload): VerifiedGoogleIdentity {
    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedException("Google account identity is incomplete.");
    }

    return {
      subject: payload.sub,
      email: payload.email.toLowerCase(),
      emailVerified: Boolean(payload.email_verified),
      name: payload.name || undefined,
      pictureUrl: payload.picture || undefined,
      hostedDomain: payload.hd || undefined,
    };
  }
}
