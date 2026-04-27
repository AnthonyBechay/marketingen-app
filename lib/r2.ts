import { S3Client, PutObjectCommand, DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

let _client: S3Client | null = null;

export function r2() {
  if (!_client) {
    const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      throw new Error("R2 credentials not set (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)");
    }
    _client = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return _client;
}

export function r2Bucket() {
  const b = process.env.R2_BUCKET;
  if (!b) throw new Error("R2_BUCKET not set");
  return b;
}

export function r2PublicBaseUrl() {
  const base = process.env.R2_PUBLIC_URL;
  if (!base) throw new Error("R2_PUBLIC_URL not set (e.g. https://pub-xxx.r2.dev or your custom domain)");
  return base.replace(/\/+$/, "");
}

// ─── Path scheme ──────────────────────────────────────────────
//
// Everything is namespaced under the user and project so the bucket
// stays organized when browsed in the Cloudflare dashboard.
//
//   users/{userId}/projects/{projectId}/posts/{postName}/{file}.png
//   users/{userId}/projects/{projectId}/brand/logo-{timestamp}.{ext}

export function projectPrefix(userId: string, projectId: string) {
  return `users/${userId}/projects/${projectId}`;
}

export function postPrefix(userId: string, projectId: string, postName: string) {
  return `${projectPrefix(userId, projectId)}/posts/${postName}`;
}

export function r2KeyForSlide(
  userId: string,
  projectId: string,
  postName: string,
  idx: number,
  total: number,
) {
  const fname =
    total === 1
      ? `${postName}.png`
      : `${postName}-slide-${String(idx + 1).padStart(2, "0")}.png`;
  return `${postPrefix(userId, projectId, postName)}/${fname}`;
}

export function r2KeyForLogo(userId: string, projectId: string, ext: string) {
  return `${projectPrefix(userId, projectId)}/brand/logo-${Date.now()}.${ext.replace(/^\./, "")}`;
}

// ─── Upload / delete helpers ──────────────────────────────────

export async function uploadObject(
  key: string,
  body: Buffer,
  contentType: string,
  cacheControl = "public, max-age=31536000, immutable",
): Promise<string> {
  await r2().send(
    new PutObjectCommand({
      Bucket: r2Bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl,
    }),
  );
  return `${r2PublicBaseUrl()}/${key}`;
}

export async function uploadPng(key: string, body: Buffer): Promise<string> {
  return uploadObject(key, body, "image/png");
}

export async function deleteKeys(keys: string[]) {
  if (!keys.length) return;
  await r2().send(
    new DeleteObjectsCommand({
      Bucket: r2Bucket(),
      Delete: { Objects: keys.map((Key) => ({ Key })) },
    }),
  );
}

export async function deletePrefix(prefix: string) {
  const list = await r2().send(
    new ListObjectsV2Command({ Bucket: r2Bucket(), Prefix: prefix }),
  );
  const keys = (list.Contents ?? []).map((o) => o.Key).filter((k): k is string => Boolean(k));
  if (keys.length) await deleteKeys(keys);
}
