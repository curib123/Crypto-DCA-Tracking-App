import { Controller, Get, Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/database/prisma.service";

export type LandingFeature = { title: string; description: string };
export type LandingFaq = { question: string; answer: string };
export type LandingContent = {
  brandName: string;
  announcement: string;
  heroEyebrow: string;
  heroTitle: string;
  heroDescription: string;
  primaryCtaLabel: string;
  secondaryCtaLabel: string;
  features: LandingFeature[];
  faq: LandingFaq[];
  footerText: string;
  seoTitle: string;
  seoDescription: string;
};

export const DEFAULT_LANDING_CONTENT: LandingContent = {
  brandName: "NextFi",
  announcement: "Installable PWA · DCA-first portfolio analytics",
  heroEyebrow: "Crypto DCA, made measurable",
  heroTitle: "Know exactly what your DCA is doing.",
  heroDescription:
    "Track real contributions, weighted average cost, break-even, fees and portfolio performance in one clean workspace.",
  primaryCtaLabel: "Continue with Google",
  secondaryCtaLabel: "Install NextFi",
  features: [
    {
      title: "Real cost basis",
      description: "Weighted calculations are rebuilt from your transaction ledger instead of editable totals.",
    },
    {
      title: "Clear performance",
      description: "Keep invested capital, current value, realized P/L and unrealized P/L separate.",
    },
    {
      title: "Multi-currency",
      description: "Preserve the original quote currency while reporting consistently in your chosen base currency.",
    },
    {
      title: "Offline-ready",
      description: "Read synchronized portfolio data and queue transactions when your connection drops.",
    },
    {
      title: "Visual analytics",
      description: "Use focused charts for allocation and performance where a visual actually adds information.",
    },
    {
      title: "AI insights",
      description: "Turn your own portfolio data into explainable observations without giving the model custody or trading access.",
    },
  ],
  faq: [
    {
      question: "Does NextFi hold or trade my cryptocurrency?",
      answer: "No. NextFi is a tracking and analytics application. It does not custody funds or execute trades.",
    },
    {
      question: "How is average cost calculated?",
      answer: "NextFi recalculates weighted cost basis from your transaction ledger so corrected transactions flow through the portfolio automatically.",
    },
    {
      question: "Does NextFi work offline?",
      answer: "Previously synchronized portfolio data can be read offline, and supported transaction entries can be queued for later synchronization.",
    },
  ],
  footerText: "Portfolio tracking and analytics only. Not financial advice.",
  seoTitle: "NextFi — Crypto DCA Tracking & Portfolio Analytics",
  seoDescription:
    "Track crypto DCA contributions, weighted average cost, break-even, portfolio value and profit/loss in an installable PWA.",
};

function text(value: unknown, fallback: string, max = 240) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, max)
    : fallback;
}

function normalizeFeatures(value: unknown) {
  if (!Array.isArray(value)) return DEFAULT_LANDING_CONTENT.features;
  const rows = value
    .slice(0, 12)
    .map((item: any) => ({
      title: text(item?.title, "", 80),
      description: text(item?.description, "", 280),
    }))
    .filter((item) => item.title && item.description);
  return rows.length ? rows : DEFAULT_LANDING_CONTENT.features;
}

function normalizeFaq(value: unknown) {
  if (!Array.isArray(value)) return DEFAULT_LANDING_CONTENT.faq;
  const rows = value
    .slice(0, 12)
    .map((item: any) => ({
      question: text(item?.question, "", 120),
      answer: text(item?.answer, "", 500),
    }))
    .filter((item) => item.question && item.answer);
  return rows.length ? rows : DEFAULT_LANDING_CONTENT.faq;
}

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  normalize(value: unknown): LandingContent {
    const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
    return {
      brandName: text(input.brandName, DEFAULT_LANDING_CONTENT.brandName, 40),
      announcement: text(input.announcement, DEFAULT_LANDING_CONTENT.announcement, 140),
      heroEyebrow: text(input.heroEyebrow, DEFAULT_LANDING_CONTENT.heroEyebrow, 100),
      heroTitle: text(input.heroTitle, DEFAULT_LANDING_CONTENT.heroTitle, 140),
      heroDescription: text(input.heroDescription, DEFAULT_LANDING_CONTENT.heroDescription, 360),
      primaryCtaLabel: text(input.primaryCtaLabel, DEFAULT_LANDING_CONTENT.primaryCtaLabel, 60),
      secondaryCtaLabel: text(input.secondaryCtaLabel, DEFAULT_LANDING_CONTENT.secondaryCtaLabel, 60),
      features: normalizeFeatures(input.features),
      faq: normalizeFaq(input.faq),
      footerText: text(input.footerText, DEFAULT_LANDING_CONTENT.footerText, 220),
      seoTitle: text(input.seoTitle, DEFAULT_LANDING_CONTENT.seoTitle, 120),
      seoDescription: text(input.seoDescription, DEFAULT_LANDING_CONTENT.seoDescription, 260),
    };
  }

  async getLanding() {
    const row = await this.prisma.siteSetting.findUnique({ where: { key: "landing" } });
    return this.normalize(row?.value);
  }

  async saveLanding(value: unknown) {
    const normalized = this.normalize(value);
    await this.prisma.siteSetting.upsert({
      where: { key: "landing" },
      update: { value: normalized as any },
      create: { key: "landing", value: normalized as any },
    });
    return normalized;
  }
}

@Controller("content")
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get("landing")
  landing() {
    return this.content.getLanding();
  }
}
