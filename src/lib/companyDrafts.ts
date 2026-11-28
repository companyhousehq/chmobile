import { Directory, File, Paths } from "expo-file-system";
import { deleteFileQuietly } from "./files";
import * as Crypto from "expo-crypto";
import type { Answers } from "./questionnaire";
import { parseClaimDraft, type ClaimDraft, type EvidencePage } from "./company";
import { store } from "./storage/mmkv";

/**
 * Device drafts (spec 0011 R16, 0012 OQ-6): per user and company, in the
 * encrypted `drafts` store; captured pages in document/drafts, which the
 * sign-out wipe removes. A device draft is never shown as saved.
 */

const claimKey = (userId: string, companyId: string) => `claim:${userId}:${companyId}`;
const activityKey = (userId: string, companyId: string) => `activity:${userId}:${companyId}`;

export function loadClaimDraft(userId: string, companyId: string): ClaimDraft {
  return parseClaimDraft(store("drafts").getString(claimKey(userId, companyId)));
}

export function saveClaimDraft(userId: string, companyId: string, d: ClaimDraft): void {
  store("drafts").set(claimKey(userId, companyId), JSON.stringify(d));
}

/** Removes the draft text and its page files (after submit, or when the user discards). */
export function clearClaimDraft(userId: string, companyId: string): void {
  const d = loadClaimDraft(userId, companyId);
  d.pages.forEach(deletePageFile);
  store("drafts").remove(claimKey(userId, companyId));
}

export function deletePageFile(p: EvidencePage): void {
  try {
    const f = new File(p.uri);
    if (f.exists) f.delete();
  } catch {
    // Already gone: nothing to clean up.
  }
}

/**
 * Moves a freshly captured or picked file into the app's wiped drafts folder.
 * The source (a picker or manipulator file in the cache) is deleted at once.
 */
export function keepPageFile(srcUri: string, ext: string): { uri: string; size: number } {
  const dir = new Directory(Paths.document, "drafts");
  dir.create({ intermediates: true, idempotent: true });
  const dest = new File(dir, `${Crypto.randomUUID()}.${ext}`);
  new File(srcUri).copy(dest);
  const kept = { uri: dest.uri, size: dest.size };
  deleteFileQuietly(srcUri);
  return kept;
}

export interface ActivityDeviceDraft {
  answers: Answers;
  questionnaireVersionId: string;
  stepKey: string | null;
}

export function loadActivityDraft(userId: string, companyId: string): ActivityDeviceDraft | null {
  const raw = store("drafts").getString(activityKey(userId, companyId));
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<ActivityDeviceDraft>;
    if (
      v.answers &&
      typeof v.answers === "object" &&
      typeof v.questionnaireVersionId === "string"
    ) {
      return {
        answers: v.answers,
        questionnaireVersionId: v.questionnaireVersionId,
        stepKey: v.stepKey ?? null,
      };
    }
  } catch {
    // Unreadable: treated as no draft.
  }
  return null;
}

export function saveActivityDraft(userId: string, companyId: string, d: ActivityDeviceDraft): void {
  store("drafts").set(activityKey(userId, companyId), JSON.stringify(d));
}

export function clearActivityDraft(userId: string, companyId: string): void {
  store("drafts").remove(activityKey(userId, companyId));
}
