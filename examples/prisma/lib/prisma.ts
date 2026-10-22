import { PrismaClient } from "@prisma/client";

// En desarrollo, Next recarga los módulos y crearía un cliente por recarga; el
// singleton vive en `globalThis` para no abrir conexiones de más.
const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalParaPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalParaPrisma.prisma = prisma;
