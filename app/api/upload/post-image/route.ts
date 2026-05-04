// Multipart upload endpoint for custom user-supplied post images.
//
// POST /api/upload/post-image?slug=...&postId=...
//   form-data: file=<image>
// Returns: { url: string }
//
// The image is stored under the same R2 prefix as generated slides so
// the post-cleanup logic still wipes everything when a post is deleted.
// We accept anything the browser would let through as <input type="file"
// accept="image/*">; resizing/optimization is out of scope.

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { uploadObject, postPrefix } from "@/lib/r2";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    const slug = req.nextUrl.searchParams.get("slug");
    const postId = req.nextUrl.searchParams.get("postId");
    if (!slug || !postId) {
      return NextResponse.json({ error: "Missing slug or postId" }, { status: 400 });
    }

    const project = await db.project.findUnique({
      where: { userId_slug: { userId: user.id, slug } },
      select: { id: true },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const post = await db.post.findFirst({
      where: { id: postId, projectId: project.id },
      select: { id: true, name: true },
    });
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported type: ${file.type}. Use PNG, JPEG, WebP, or GIF.` },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `File too large (max ${MAX_BYTES / 1024 / 1024} MB)` }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const ext =
      file.type === "image/png"
        ? "png"
        : file.type === "image/jpeg"
          ? "jpg"
          : file.type === "image/webp"
            ? "webp"
            : "gif";
    const id = randomBytes(6).toString("hex");
    const key = `${postPrefix(user.id, project.id, post.name)}/upload-${id}.${ext}`;
    const url = await uploadObject(key, buf, file.type);

    return NextResponse.json({ url });
  } catch (e) {
    const msg = (e as Error).message ?? "Upload failed";
    console.error("upload/post-image failed:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
