import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { saveFile, ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/storage";

/** Staff-only image upload. Returns { url } for use in the product editor. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "STAFF")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 415 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const saved = await saveFile(buffer, file.name);
  return NextResponse.json(saved);
}
