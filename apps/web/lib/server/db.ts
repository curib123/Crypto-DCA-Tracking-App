import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  nextfiPrisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.nextfiPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.nextfiPrisma = prisma;
}
