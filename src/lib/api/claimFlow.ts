import * as Crypto from "expo-crypto";
import type { ClaimDraft, EvidencePage } from "../company";
import { ApiError } from "./client";
import { companyApi } from "./companies";

/**
 * Uploads evidence pages one by one (spec 0011 R15). The page id is the
 * `Idempotency-Key` for its upload, so an interrupted run that is retried
 * never stores a page twice. Uploads already done are skipped, and each new
 * upload id is reported straight away so it can be kept for the next retry.
 */
export async function uploadPages(
  pages: readonly EvidencePage[],
  done: Readonly<Record<string, string>>,
  onProgress: (index: number, total: number) => void,
  onUploaded: (pageId: string, uploadId: string) => void,
  upload: typeof companyApi.upload = companyApi.upload,
): Promise<string[]> {
  const ids: string[] = [];
  for (const [i, p] of pages.entries()) {
    let uploadId = done[p.id];
    if (!uploadId) {
      onProgress(i + 1, pages.length);
      const res = await upload({ uri: p.uri, name: p.name, type: p.mime }, p.id);
      uploadId = res.id;
      onUploaded(p.id, uploadId);
    }
    ids.push(uploadId);
  }
  return ids;
}

/** A fresh Idempotency-Key for a submission. */
export const newKey = () => Crypto.randomUUID();

/**
 * True when the API no longer has an upload the draft points at: 422 with an
 * `unknown_upload` field error, or 409 `upload-expired` (uploads last 24 hours).
 */
export function isStaleUploadError(e: unknown): boolean {
  if (!(e instanceof ApiError)) return false;
  if (e.status === 409 && e.slug === "upload-expired") return true;
  return e.status === 422 && !!e.problem.errors?.some((f) => f.code === "unknown_upload");
}

/** Forgets every upload id and gives each page a new id (a new Idempotency-Key for its re-upload). */
export function renewUploads(d: ClaimDraft): ClaimDraft {
  return {
    ...d,
    uploads: {},
    submitKey: "",
    pages: d.pages.map((p) => ({ ...p, id: Crypto.randomUUID() })),
  };
}

/** Runs an upload-and-submit attempt; on a stale upload renews the pages and tries once more. */
export async function withUploadRenewal<T>(
  attempt: () => Promise<T>,
  renew: () => void,
): Promise<T> {
  try {
    return await attempt();
  } catch (e) {
    if (!isStaleUploadError(e)) throw e;
    renew();
    return attempt();
  }
}
