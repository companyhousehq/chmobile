// Compares the app's copy of the backend questionnaire fixtures with the
// backend checkout, when it exists (design 2). The backend is the authority.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const copy = join(root, "src/lib/questionnaire.fixtures.json");
const source = join(root, "../companyhousebe/db/content/business_activity/fixtures.json");

if (!existsSync(source)) {
  process.stdout.write("check:fixtures skipped: ../companyhousebe is not checked out.\n");
  process.exit(0);
}
if (readFileSync(copy, "utf8") !== readFileSync(source, "utf8")) {
  process.stderr.write(
    "src/lib/questionnaire.fixtures.json differs from the backend's fixtures.json.\n" +
      "Copy it again from companyhousebe/db/content/business_activity/fixtures.json, then rerun the tests.\n",
  );
  process.exit(1);
}
process.stdout.write("check:fixtures ok: the app's copy matches the backend.\n");
