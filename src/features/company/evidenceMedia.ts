import * as Crypto from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import {
  MAX_UPLOAD_BYTES,
  checkUpload,
  compressionQuality,
  resizeWidth,
  type EvidencePage,
} from "@/lib/company";
import { keepPageFile } from "@/lib/companyDrafts";
import { deleteFileQuietly } from "@/lib/files";

/**
 * Evidence capture on the phone (spec 0012 M17, 0011 R15): camera pages and
 * library photos are resized and recompressed on the device to fit the API
 * limit; PDFs are picked from files. Files are moved into the app's wiped
 * drafts folder straight away.
 */

export type MediaFailure = "cancelled" | "camera-denied" | "empty" | "large" | "type" | "prepare";

export type MediaResult = { ok: true; pages: EvidencePage[] } | { ok: false; reason: MediaFailure };

async function compress(
  uri: string,
  width: number,
  height: number,
): Promise<{ uri: string; size: number } | null> {
  const target = resizeWidth(width, height);
  for (let attempt = 0; ; attempt++) {
    const quality = compressionQuality(attempt);
    if (quality === null) return null;
    const ctx = ImageManipulator.ImageManipulator.manipulate(uri);
    if (target) ctx.resize({ width: target });
    const ref = await ctx.renderAsync();
    const out = await ref.saveAsync({
      compress: quality,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    const size = new File(out.uri).size;
    if (size > 0 && size <= MAX_UPLOAD_BYTES) return { uri: out.uri, size };
    deleteFileQuietly(out.uri);
  }
}

async function jpegPage(uri: string, width: number, height: number): Promise<EvidencePage | null> {
  let small: { uri: string; size: number } | null = null;
  try {
    small = await compress(uri, width, height);
    if (!small) return null;
    const kept = keepPageFile(small.uri, "jpg");
    return {
      id: Crypto.randomUUID(),
      uri: kept.uri,
      name: "page.jpg",
      mime: "image/jpeg",
      size: kept.size,
    };
  } finally {
    // The picker original and the manipulator output never outlive the capture.
    deleteFileQuietly(small?.uri);
    deleteFileQuietly(uri);
  }
}

async function pagesFromAssets(assets: ImagePicker.ImagePickerAsset[]): Promise<MediaResult> {
  const pages: EvidencePage[] = [];
  try {
    for (const a of assets) {
      const page = await jpegPage(a.uri, a.width, a.height);
      if (!page) return { ok: false, reason: "prepare" };
      pages.push(page);
    }
  } catch {
    return { ok: false, reason: "prepare" };
  } finally {
    for (const a of assets) deleteFileQuietly(a.uri);
  }
  return pages.length > 0 ? { ok: true, pages } : { ok: false, reason: "cancelled" };
}

/** Opens the camera for one page. Call again for the next page. */
export async function captureCameraPage(): Promise<MediaResult> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return { ok: false, reason: "camera-denied" };
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 });
  if (res.canceled) return { ok: false, reason: "cancelled" };
  return pagesFromAssets(res.assets);
}

export async function pickPhotoPages(): Promise<MediaResult> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    quality: 1,
  });
  if (res.canceled) return { ok: false, reason: "cancelled" };
  return pagesFromAssets(res.assets);
}

/** A PDF or image file from the Files app. Images are compressed, PDFs are checked against the limit. */
export async function pickFilePage(): Promise<MediaResult> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ["application/pdf", "image/png", "image/jpeg"],
    copyToCacheDirectory: true,
  });
  const a = res.canceled ? null : res.assets[0];
  if (!a) return { ok: false, reason: "cancelled" };
  const mime = a.mimeType ?? "application/pdf";
  try {
    if (mime.startsWith("image/")) {
      const page = await jpegPage(a.uri, 0, 0);
      return page ? { ok: true, pages: [page] } : { ok: false, reason: "prepare" };
    }
    const size = a.size ?? new File(a.uri).size;
    const problem = checkUpload({ name: a.name, size, type: mime });
    if (problem) return { ok: false, reason: problem as MediaFailure };
    const kept = keepPageFile(a.uri, "pdf");
    return {
      ok: true,
      pages: [
        {
          id: Crypto.randomUUID(),
          uri: kept.uri,
          name: "evidence.pdf",
          mime: "application/pdf",
          size: kept.size,
        },
      ],
    };
  } catch {
    return { ok: false, reason: "prepare" };
  } finally {
    deleteFileQuietly(a.uri);
  }
}
