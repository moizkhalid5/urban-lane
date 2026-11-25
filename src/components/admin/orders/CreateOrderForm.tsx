"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createManualOrder,
  findCustomers,
  findProductsForOrder,
  type CustomerOption,
  type ProductOption,
} from "@/app/actions/admin-manual-orders";
import { shownEmail } from "@/lib/orders/placeholders";

const CHANNELS = ["WhatsApp", "Instagram", "Facebook", "In the shop", "Phone call", "Website", "Wholesale", "Other"];
const METHODS = [
  ["COD", "Cash / Cash on Delivery"],
  ["EASYPAISA", "Easypaisa"],
  ["JAZZCASH", "JazzCash"],
  ["BANK_TRANSFER", "Bank Transfer"],
  ["CARD", "Card"],
] as const;
const FULFILMENT = [
  ["DELIVERED", "Delivered / handed over"],
  ["SHIPPED", "Shipped"],
  ["PROCESSING", "Processing"],
  ["UNFULFILLED", "Not sent yet"],
] as const;

type Line = { key: string; variantId: string; title: string; size: string; stock: number; quantity: number; unitPrice: number };

const rupees = (cents: number) => Math.round(cents / 100);
const fmt = (n: number) => `Rs ${Math.round(n).toLocaleString("en-US")}`;

/** "YYYY-MM-DDTHH:MM" for now in Pakistan time (UTC+5), for the date picker. */
function nowInPakistan() {
  return new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 16);
}

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Admin → Orders → Create order. */
export function CreateOrderForm({
  shippingRule,
  initialCustomer,
}: {
  /** the shop's delivery charge and free-delivery threshold, in rupees */
  shippingRule: { flat: number; freeFrom: number | null };
  initialCustomer: CustomerOption | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState(nowInPakistan);
  const [channel, setChannel] = useState("WhatsApp");

  // customer
  const [mode, setMode] = useState<"existing" | "new">(initialCustomer ? "existing" : "new");
  const [customer, setCustomer] = useState<CustomerOption | null>(initialCustomer);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerOption[]>([]);
  const [newCustomer, setNewCustomer] = useState({ firstName: "", lastName: "", phone: "", email: "" });
  const [saveCustomer, setSaveCustomer] = useState(true);
  const [address, setAddress] = useState({
    line1: initialCustomer?.address?.line1 ?? "",
    line2: initialCustomer?.address?.line2 ?? "",
    city: initialCustomer?.address?.city ?? "",
    postalCode: initialCustomer?.address?.postalCode ?? "",
  });

  // products
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState<ProductOption[]>([]);
  const [lines, setLines] = useState<Line[]>([]);

  // money and status
  const [shipping, setShipping] = useState<number | null>(null); // null = the shop's rule
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<(typeof METHODS)[number][0]>("COD");
  const [paymentStatus, setPaymentStatus] = useState<"PAID" | "PENDING">("PAID");
  const [fulfillmentStatus, setFulfillmentStatus] = useState<(typeof FULFILMENT)[number][0]>("DELIVERED");
  const [takeStock, setTakeStock] = useState(true);
  const [note, setNote] = useState("");

  const cq = useDebounced(customerQuery);
  useEffect(() => {
    let live = true;
    if (cq.trim().length < 2) setCustomerResults([]);
    else findCustomers(cq).then((r) => live && setCustomerResults(r));
    return () => {
      live = false;
    };
  }, [cq]);

  const pq = useDebounced(productQuery);
  useEffect(() => {
    let live = true;
    if (pq.trim().length < 2) setProductResults([]);
    else findProductsForOrder(pq).then((r) => live && setProductResults(r));
    return () => {
      live = false;
    };
  }, [pq]);

  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0), [lines]);
  const ruleShipping = subtotal === 0 || (shippingRule.freeFrom != null && subtotal >= shippingRule.freeFrom) ? 0 : shippingRule.flat;
  const shippingShown = shipping ?? ruleShipping;
  const total = Math.max(0, subtotal - discount) + shippingShown;
  const pieces = lines.reduce((s, l) => s + l.quantity, 0);

  function chooseCustomer(c: CustomerOption) {
    setCustomer(c);
    setCustomerQuery("");
    setCustomerResults([]);
    if (c.address) setAddress({ line1: c.address.line1, line2: c.address.line2 ?? "", city: c.address.city, postalCode: c.address.postalCode });
  }

  function addLine(p: ProductOption, v: ProductOption["variants"][number]) {
    setLines((ls) => {
      const same = ls.find((l) => l.variantId === v.id);
      if (same) return ls.map((l) => (l === same ? { ...l, quantity: l.quantity + 1 } : l));
      return [...ls, { key: `${v.id}-${Date.now()}`, variantId: v.id, title: p.title, size: v.label, stock: v.stock, quantity: 1, unitPrice: rupees(v.priceCents) }];
    });
  }
  const setLine = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  function submit() {
    setError(null);
    start(async () => {
      const res = await createManualOrder({
        date,
        channel,
        customerId: mode === "existing" ? customer?.id ?? "" : "",
        newCustomer: mode === "new" ? newCustomer : undefined,
        saveCustomer: mode === "new" ? saveCustomer : false,
        address,
        lines: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, unitPrice: l.unitPrice })),
        shipping: shippingShown,
        discount,
        paymentMethod,
        paymentStatus,
        fulfillmentStatus,
        takeStock,
        note,
      });
      if (res.ok && res.orderNumber) router.push(`/admin/orders/${res.orderNumber}`);
      else setError(res.message ?? "Couldn't create the order.");
    });
  }

  const overStock = takeStock ? lines.filter((l) => l.quantity > l.stock) : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        {/* when */}
        <section className="card space-y-4 p-5">
          <h2 className="font-medium">When and where it was sold</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="order-date">Order date and time (Pakistan time)</label>
              <input id="order-date" type="datetime-local" value={date} max={nowInPakistan()} onChange={(e) => setDate(e.target.value)} className="input" />
              <p className="mt-1 text-xs text-ink-muted">Pick any past date. The order is filed on that day in Orders, the Dashboard and Analytics.</p>
            </div>
            <div>
              <label className="label" htmlFor="order-channel">Sold via</label>
              <select id="order-channel" value={channel} onChange={(e) => setChannel(e.target.value)} className="input">
                {CHANNELS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </section>

        {/* who */}
        <section className="card space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-medium">Customer</h2>
            <div className="flex rounded-full border border-line p-0.5 text-sm" role="tablist">
              {(["existing", "new"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => setMode(m)}
                  className={`rounded-full px-4 py-1.5 ${mode === m ? "bg-ink text-white" : "text-ink-soft"}`}
                >
                  {m === "existing" ? "Existing customer" : "New customer"}
                </button>
              ))}
            </div>
          </div>

          {mode === "existing" ? (
            customer ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-line p-3 text-sm">
                <div>
                  <p className="font-medium">{customer.name || "No name"}</p>
                  <p className="text-ink-muted">{shownEmail(customer.email)}{customer.phone ? ` · ${customer.phone}` : ""}</p>
                </div>
                <button type="button" onClick={() => setCustomer(null)} className="btn-ghost">Change</button>
              </div>
            ) : (
              <div>
                <label className="label" htmlFor="customer-search">Search by name, email or phone</label>
                <input id="customer-search" value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)} className="input" placeholder="e.g. Ayesha or 0300…" autoComplete="off" />
                {customerResults.length > 0 && (
                  <ul className="mt-2 divide-y divide-line-soft rounded-lg border border-line text-sm">
                    {customerResults.map((c) => (
                      <li key={c.id}>
                        <button type="button" onClick={() => chooseCustomer(c)} className="block w-full p-3 text-left hover:bg-line-soft">
                          <span className="font-medium">{c.name || "No name"}</span>
                          <span className="ml-2 text-ink-muted">{shownEmail(c.email)}{c.phone ? ` · ${c.phone}` : ""}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {cq.trim().length >= 2 && customerResults.length === 0 && (
                  <p className="mt-2 text-sm text-ink-muted">
                    No customer found.{" "}
                    <button type="button" className="underline" onClick={() => setMode("new")}>Type in a new customer</button>
                  </p>
                )}
              </div>
            )
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" value={newCustomer.firstName} onChange={(v) => setNewCustomer((c) => ({ ...c, firstName: v }))} />
              <Field label="Last name" value={newCustomer.lastName} onChange={(v) => setNewCustomer((c) => ({ ...c, lastName: v }))} />
              <Field label="Phone / WhatsApp" value={newCustomer.phone} onChange={(v) => setNewCustomer((c) => ({ ...c, phone: v }))} type="tel" />
              <Field label="Email (optional)" value={newCustomer.email} onChange={(v) => setNewCustomer((c) => ({ ...c, email: v }))} type="email" />
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" checked={saveCustomer} onChange={(e) => setSaveCustomer(e.target.checked)} />
                Save to Customers (so their orders are kept together)
              </label>
            </div>
          )}

          <div className="grid gap-4 border-t border-line-soft pt-4 sm:grid-cols-2">
            <Field label="Address (optional)" value={address.line1} onChange={(v) => setAddress((a) => ({ ...a, line1: v }))} />
            <Field label="Area / apartment (optional)" value={address.line2} onChange={(v) => setAddress((a) => ({ ...a, line2: v }))} />
            <Field label="City" value={address.city} onChange={(v) => setAddress((a) => ({ ...a, city: v }))} />
            <Field label="Postcode (optional)" value={address.postalCode} onChange={(v) => setAddress((a) => ({ ...a, postalCode: v }))} />
          </div>
        </section>

        {/* what */}
        <section className="card space-y-4 p-5">
          <h2 className="font-medium">Products</h2>
          <div>
            <label className="label" htmlFor="product-search">Search by name, brand or SKU</label>
            <input id="product-search" value={productQuery} onChange={(e) => setProductQuery(e.target.value)} className="input" placeholder="e.g. Next jacket or 182-804" autoComplete="off" />
          </div>
          {productResults.length > 0 && (
            <ul className="max-h-96 divide-y divide-line-soft overflow-y-auto rounded-lg border border-line text-sm">
              {productResults.map((p) => (
                <li key={p.productId} className="flex gap-3 p-3">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- small admin thumbnail
                    <img src={p.image} alt="" className="h-14 w-14 shrink-0 rounded object-cover" />
                  ) : (
                    <span className="h-14 w-14 shrink-0 rounded bg-line-soft" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {p.title}
                      {p.status !== "ACTIVE" && <span className="ml-2 text-xs text-ink-muted">({p.status.toLowerCase()})</span>}
                    </p>
                    <p className="text-xs text-ink-muted">{p.brand ?? ""}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {p.variants.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => addLine(p, v)}
                          className="rounded-full border border-line px-3 py-1 text-xs hover:border-ink"
                          title={`Add ${v.label}`}
                        >
                          + {v.label} · {fmt(rupees(v.priceCents))} · {v.stock} in stock
                        </button>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {pq.trim().length >= 2 && productResults.length === 0 && <p className="text-sm text-ink-muted">No products found.</p>}

          {lines.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th className="py-2 pr-3">Product</th>
                    <th className="py-2 pr-3">Qty</th>
                    <th className="py-2 pr-3">Price each (Rs)</th>
                    <th className="py-2 text-right">Total</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.key} className="border-b border-line-soft last:border-0">
                      <td className="py-2 pr-3">
                        {l.title}
                        <span className="block text-xs text-ink-muted">{l.size} · {l.stock} in stock</span>
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="number"
                          min={1}
                          value={l.quantity}
                          onChange={(e) => setLine(l.key, { quantity: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
                          className="input w-20"
                          aria-label={`Quantity of ${l.title}`}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="number"
                          min={0}
                          value={l.unitPrice}
                          onChange={(e) => setLine(l.key, { unitPrice: Math.max(0, Number(e.target.value) || 0) })}
                          className="input w-28"
                          aria-label={`Price of ${l.title}`}
                        />
                      </td>
                      <td className="py-2 text-right tabular-nums">{fmt(l.unitPrice * l.quantity)}</td>
                      <td className="py-2 pl-2 text-right">
                        <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="text-ink-muted hover:text-sale" aria-label={`Remove ${l.title}`}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card space-y-2 p-5">
          <label className="label" htmlFor="order-note">Notes (only the team sees these)</label>
          <textarea id="order-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="input" />
        </section>
      </div>

      {/* summary */}
      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <section className="card space-y-4 p-5">
          <h2 className="font-medium">Payment and status</h2>
          <div>
            <label className="label" htmlFor="pay-method">Paid by</label>
            <select id="pay-method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)} className="input">
              {METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="pay-status">Payment</label>
            <select id="pay-status" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as typeof paymentStatus)} className="input">
              <option value="PAID">Paid</option>
              <option value="PENDING">Not paid yet</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="fulfil">Delivery</label>
            <select id="fulfil" value={fulfillmentStatus} onChange={(e) => setFulfillmentStatus(e.target.value as typeof fulfillmentStatus)} className="input">
              {FULFILMENT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={takeStock} onChange={(e) => setTakeStock(e.target.checked)} />
            <span>
              Take these pieces off the stock
              <span className="block text-xs text-ink-muted">Untick if the stock was already lowered when it sold.</span>
            </span>
          </label>
        </section>

        <section className="card space-y-3 p-5 text-sm">
          <div className="flex justify-between"><span>{pieces} {pieces === 1 ? "piece" : "pieces"}</span><span className="tabular-nums">{fmt(subtotal)}</span></div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="ship">Delivery charge (Rs)</label>
            <input id="ship" type="number" min={0} value={shippingShown} onChange={(e) => setShipping(Math.max(0, Number(e.target.value) || 0))} className="input w-28 text-right" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="disc">Discount (Rs)</label>
            <input id="disc" type="number" min={0} value={discount} onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))} className="input w-28 text-right" />
          </div>
          <div className="flex justify-between border-t border-line pt-3 text-base font-medium"><span>Total</span><span className="tabular-nums">{fmt(total)}</span></div>

          {overStock.length > 0 && (
            <p className="text-xs text-sale">
              More than in stock: {overStock.map((l) => `${l.title} (${l.size})`).join(", ")}. Lower the quantity or untick “Take these pieces off the stock”.
            </p>
          )}
          {error && <p className="text-sm text-sale" role="alert">{error}</p>}
          <button type="button" onClick={submit} disabled={pending || lines.length === 0} className="btn-primary w-full">
            {pending ? "Creating…" : "Create order"}
          </button>
          <p className="text-xs text-ink-muted">Nobody is emailed. The order appears in Orders, the Dashboard and Analytics on the date you picked.</p>
        </section>
      </aside>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  const id = `f-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} className="input" />
    </div>
  );
}
