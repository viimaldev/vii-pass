/**
 * Thin helpers over the Cloudflare R2 bucket binding (`env.BUCKET`).
 *
 * R2 offers strong read-after-write consistency, so an object is immediately
 * retrievable once `put` resolves (research.md Decision 4).
 */

/** Store an object, optionally recording its content type. */
export async function putObject(
  bucket: R2Bucket,
  key: string,
  value: ArrayBuffer | ReadableStream | string,
  contentType?: string,
): Promise<void> {
  await bucket.put(key, value, contentType ? { httpMetadata: { contentType } } : undefined);
}

/** Retrieve an object body, or `null` when the key does not exist. */
export async function getObject(bucket: R2Bucket, key: string): Promise<R2ObjectBody | null> {
  return bucket.get(key);
}

/**
 * Cheap reachability probe for the health endpoint (FR-011). Lists at most one
 * object to confirm the bucket is reachable. Returns `false` instead of throwing.
 */
export async function storageReachable(bucket: R2Bucket): Promise<boolean> {
  try {
    await bucket.list({ limit: 1 });
    return true;
  } catch {
    return false;
  }
}
