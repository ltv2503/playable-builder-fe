import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCliScript, writeFormFilesToDir } from "@/lib/serverBuild";

/**
 * Builds the preview HTML by shelling out to the sibling playable-builder
 * package's dist/cli-single-html.js (built from
 * playable-builder/src/pipeline/builder.ts's buildSingleHtml()) instead of
 * the client-side blob-URL packer in lib/buildPreviewBlob.ts. This makes the
 * preview an exact match of the real single-html output (same obfuscation,
 * cc.adapter.js injection, watermarking, ...) rather than a lighter
 * approximation — at the cost of a server round-trip on the *first* build.
 *
 * Every @playgroundField (string/number/boolean) property in the output is
 * already wrapped to read from window.__playgroundConfig, with the original
 * value as fallback (see playable-builder/src/pipeline/playgroundFields.ts).
 * Live-editing one of those fields therefore does NOT need another
 * round-trip through this route — see lib/playgroundConfig.ts, which just
 * re-injects a small `window.__playgroundConfig = {...}` script client-side
 * and reboots. This route only needs to run once per upload.
 */
const BUILD_SCRIPT = path.resolve(process.cwd(), "..", "playable-builder", "dist", "cli-single-html.js");

export async function POST(request: Request) {
  let inputDir: string | null = null;
  let outDir: string | null = null;
  try {
    const form = await request.formData();

    inputDir = await fs.mkdtemp(path.join(os.tmpdir(), "playable-preview-in-"));
    outDir = await fs.mkdtemp(path.join(os.tmpdir(), "playable-preview-out-"));
    const outputFile = path.join(outDir, "preview.html");

    await writeFormFilesToDir(form, inputDir);
    if (!(await fs.stat(path.join(inputDir, "index.html")).catch(() => null))) {
      return Response.json({ error: "Không thấy index.html trong dữ liệu upload." }, { status: 400 });
    }

    await runCliScript(BUILD_SCRIPT, [inputDir, outputFile]);

    const html = await fs.readFile(outputFile, "utf-8");
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  } finally {
    if (inputDir) await fs.rm(inputDir, { recursive: true, force: true }).catch(() => {});
    if (outDir) await fs.rm(outDir, { recursive: true, force: true }).catch(() => {});
  }
}
