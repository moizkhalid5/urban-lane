import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/** Record an admin/staff action for the audit trail. Best-effort (never throws). */
export async function logAudit(
  userId: string | undefined,
  action: string,
  entity?: string,
  entityId?: string,
  meta?: Prisma.InputJsonValue,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: { userId: userId ?? null, action, entity, entityId, meta },
    });
  } catch {
    // swallow — auditing must never break the underlying action
  }
}
