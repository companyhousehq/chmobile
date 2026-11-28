import { keepPageFile } from "./companyDrafts";
import { deleteWipedDirectories } from "./files";

const mockFiles = new Set<string>();
const mockDirs = new Set<string>();

jest.mock("expo-file-system", () => {
  class File {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = parts
        .map((p) => (typeof p === "string" ? p : (p as { uri: string }).uri))
        .join("/");
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    get size() {
      return 10;
    }
    delete() {
      mockFiles.delete(this.uri);
    }
    copy(dest: { uri: string }) {
      mockFiles.add(dest.uri);
    }
  }
  class Directory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = parts
        .map((p) => (typeof p === "string" ? p : (p as { uri: string }).uri))
        .join("/");
    }
    get exists() {
      return mockDirs.has(this.uri);
    }
    create() {
      mockDirs.add(this.uri);
    }
    delete() {
      mockDirs.delete(this.uri);
      for (const f of [...mockFiles]) if (f.startsWith(`${this.uri}/`)) mockFiles.delete(f);
    }
    list() {
      return [...mockDirs]
        .filter((d) => d.startsWith(`${this.uri}/`) && !d.slice(this.uri.length + 1).includes("/"))
        .map((d) => new Directory(d));
    }
  }
  return { File, Directory, Paths: { cache: { uri: "cache" }, document: { uri: "doc" } } };
});
jest.mock("expo-crypto", () => ({ randomUUID: () => "uuid" }));

beforeEach(() => {
  mockFiles.clear();
  mockDirs.clear();
});

describe("evidence file hygiene", () => {
  it("keepPageFile deletes the cache original once the page is kept", () => {
    mockFiles.add("cache/ImagePicker/orig.jpg");
    const kept = keepPageFile("cache/ImagePicker/orig.jpg", "jpg");
    expect(mockFiles.has("cache/ImagePicker/orig.jpg")).toBe(false);
    expect(mockFiles.has(kept.uri)).toBe(true);
  });

  it("the sign-out wipe clears the picker, manipulator and document picker caches", () => {
    for (const d of ["ImagePicker", "ImageManipulator", "DocumentPicker"]) {
      mockDirs.add(`cache/${d}`);
      mockFiles.add(`cache/${d}/a.jpg`);
    }
    mockDirs.add("doc/drafts");
    mockFiles.add("doc/drafts/p.jpg");
    deleteWipedDirectories();
    expect([...mockFiles]).toEqual([]);
    expect(mockDirs.has("cache/ImagePicker")).toBe(false);
    expect(mockDirs.has("doc/drafts")).toBe(false);
  });
});
