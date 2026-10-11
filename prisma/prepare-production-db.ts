/**
 * Cleans a COPY of the database before it goes live (never run it against your working DB):
 *   - removes the demo customer (customer@example.com, password published in the README)
 *     with its orders, addresses, profile, cart, wishlist and tokens
 *   - sets a new admin password (the seed default "ChangeMe123!" is public)
 *   - clears carts, login/verification tokens and audit entries left over from testing
 * Catalogue, categories, brands, banners and settings are kept.
 *
 *   DATABASE_URL=mysql://…/copy_db  NEW_ADMIN_PASSWORD='…'  npx tsx prisma/prepare-production-db.ts
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const DEMO_EMAILS = ["customer@example.com"];

async function main() {
  const password = process.env.NEW_ADMIN_PASSWORD ?? "";
  if (password.length < 12) throw new Error("Set NEW_ADMIN_PASSWORD (12+ characters).");
  const url = process.env.DATABASE_URL ?? "";
  if (!/_export|_prod|copy/i.test(url)) {
    throw new Error(`Refusing to run: DATABASE_URL must point at a copy (name containing _export/_prod/copy). Got ${url.replace(/:[^:@]*@/, ":***@")}`);
  }

  const prisma = new PrismaClient();
  try {
    const demo = await prisma.user.findMany({ where: { email: { in: DEMO_EMAILS } }, select: { id: true, email: true } });
    const demoIds = demo.map((u) => u.id);

    await prisma.$transaction(async (tx) => {
      const orders = await tx.order.findMany({ where: { OR: [{ userId: { in: demoIds } }, { email: { in: DEMO_EMAILS } }] }, select: { id: true } });
      const orderIds = orders.map((o) => o.id);
      await tx.refundRequest.deleteMany({ where: { OR: [{ orderId: { in: orderIds } }, { email: { in: DEMO_EMAILS } }] } });
      await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await tx.order.deleteMany({ where: { id: { in: orderIds } } });
      await tx.cartItem.deleteMany({});
      await tx.cart.deleteMany({});
      await tx.wishlistItem.deleteMany({ where: { userId: { in: demoIds } } });
      await tx.address.deleteMany({ where: { userId: { in: demoIds } } });
      await tx.customerProfile.deleteMany({ where: { userId: { in: demoIds } } });
      await tx.token.deleteMany({});
      await tx.auditLog.deleteMany({});
      await tx.user.deleteMany({ where: { id: { in: demoIds } } });
      console.log(`Removed demo users: ${demo.map((u) => u.email).join(", ") || "none"}; orders: ${orderIds.length}.`);
    });

    const admins = await prisma.user.updateMany({ where: { role: "ADMIN" }, data: { passwordHash: await hashPassword(password) } });
    console.log(`Admin password updated for ${admins.count} admin account(s).`);
    console.log(`Now: ${await prisma.product.count()} products, ${await prisma.user.count()} users, ${await prisma.order.count()} orders.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
