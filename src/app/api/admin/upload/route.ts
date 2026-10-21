import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { saveFile, ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, UploadFolderError } from "@/lib/storage";
import { optimizeImageUpload } from "@/lib/storage/optimize-image";

/** Staff-only image upload. Compresses the photo, saves it, and returns { url } for the product editor. */
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
    return NextResponse.json({ error: `File too large (max ${MAX_IMAGE_BYTES / 1024 / 1024}MB)` }, { status: 413 });
  }

  const original = Buffer.from(await file.arrayBuffer());
  const image = await optimizeImageUpload(original, file.name);
  try {
    const saved = await saveFile(image.buffer, image.name);
    return NextResponse.json({ ...saved, originalBytes: original.length, savedBytes: image.buffer.length });
  } catch (err) {
    console.error("[upload] Saving the image failed.", err);
    const message = err instanceof UploadFolderError ? err.message : "Couldn't save the image. Please try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
