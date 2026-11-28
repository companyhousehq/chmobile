import { Directory, File, Paths } from "expo-file-system";

/** Deletes a file if it is there; never throws (a missing file is already clean). */
export function deleteFileQuietly(uri: string | null | undefined): void {
  if (!uri) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // Already gone: nothing to clean up.
  }
}

/**
 * App-private folders removed by the sign-out wipe (design 9.3 step 3): the
 * whole cache (it holds the camera, library, manipulator and document picker
 * originals), plus document/drafts and document/uploads.
 */
export function deleteWipedDirectories(): void {
  const failures: unknown[] = [];
  const remove = (dir: Directory) => {
    try {
      if (dir.exists) dir.delete();
    } catch (e) {
      failures.push(e);
    }
  };
  const cache = new Directory(Paths.cache);
  try {
    if (cache.exists) for (const entry of cache.list()) entry.delete();
  } catch (e) {
    failures.push(e);
  }
  for (const name of ["ImagePicker", "ImageManipulator", "DocumentPicker", "docs"]) {
    remove(new Directory(Paths.cache, name));
  }
  remove(new Directory(Paths.document, "drafts"));
  remove(new Directory(Paths.document, "uploads"));
  if (failures.length > 0) throw failures[0];
}
