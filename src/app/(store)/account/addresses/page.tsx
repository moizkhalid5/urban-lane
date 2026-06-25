import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { AddressBook } from "@/components/account/AddressBook";

export default async function AddressesPage() {
  const user = await requireUser("/account/addresses");
  const addresses = await prisma.address.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return (
    <AddressBook
      addresses={addresses.map((a) => ({
        id: a.id,
        firstName: a.firstName,
        lastName: a.lastName,
        phone: a.phone,
        line1: a.line1,
        line2: a.line2,
        city: a.city,
        state: a.state,
        postalCode: a.postalCode,
        country: a.country,
        isDefault: a.isDefault,
      }))}
    />
  );
}
