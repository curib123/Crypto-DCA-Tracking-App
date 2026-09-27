import { cache } from "react";
import { unstable_noStore as noStore } from "next/cache";
import {
  DEFAULT_LANDING_CONTENT,
  getLandingContent as getLandingFromDatabase,
  type LandingContent,
} from "@/lib/server/services";

export type { LandingContent };

export const getLandingContent = cache(async (): Promise<LandingContent> => {
  noStore();

  try {
    return await getLandingFromDatabase();
  } catch {
    return DEFAULT_LANDING_CONTENT;
  }
});
