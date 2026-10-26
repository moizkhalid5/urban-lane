import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { saveFile, ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, UploadFolderError } from "@/lib/storage";
import { optimizeImageUpload } from "@/lib/storage/optimize-image";
import { prepareRailImage } from "@/lib/storage/rail-image";

/**
 * Staff-only image upload. Compresses the photo, saves it, and returns { url } for the product editor.
 * With ?purpose=rail (Admin → Homepage rail) the photo's plain background is also made transparent.
 */
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
  const rail = new URL(req.url).searchParams.get("purpose") === "rail";
  let image: { buffer: Buffer; name: string; removed?: boolean };
  try {
    image = rail ? await prepareRailImage(original, file.name) : await optimizeImageUpload(original, file.name);
  } catch (err) {
    console.error("[upload] Preparing the rail photo failed.", err);
    return NextResponse.json({ error: "Couldn't read this photo. Please try a PNG, JPG or WebP file." }, { status: 400 });
  }
  try {
    const saved = await saveFile(image.buffer, image.name);
    return NextResponse.json({ ...saved, originalBytes: original.length, savedBytes: image.buffer.length, backgroundRemoved: image.removed });
  } catch (err) {
    console.error("[upload] Saving the image failed.", err);
    const message = err instanceof UploadFolderError ? err.message : "Couldn't save the image. Please try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
