import { createHash } from "node:crypto";
import { posix } from "node:path";
import type { SandboxSession } from "eve/sandbox";

export const MAX_OUTPUT_BYTES = 20_000_000;
const mediaTypes: Record<string, string> = {
  ".csv": "text/csv", ".txt": "text/plain", ".json": "application/json",
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp",
};

export type OutputFile = {
  path: string;
  filename: string;
  mediaType: string;
  size: number;
  sha256: string;
};

export async function readOutputFile(sandbox: Pick<SandboxSession, "readFile">, filePath: string) {
  const path = posix.resolve("/workspace", filePath);
  if (!path.startsWith("/workspace/") || filePath.includes("\0")) {
    throw new Error("Choose a file inside /workspace.");
  }
  const filename = posix.basename(path);
  if (/[\r\n]/.test(filename)) throw new Error("File names cannot contain line breaks.");
  const mediaType = mediaTypes[posix.extname(filename).toLowerCase()];
  if (!mediaType) throw new Error("Supported output formats: CSV, TXT, JSON, PDF, DOCX, XLSX, PNG, JPEG, GIF, WebP.");
  const stream = await sandbox.readFile({ path });
  if (!stream) throw new Error("The output file does not exist. Create it first.");
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_OUTPUT_BYTES) throw new Error("The output file exceeds the 20 MB limit.");
      chunks.push(chunk.value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  if (!size) throw new Error("The output file is empty.");
  const bytes = Buffer.concat(chunks);
  const file: OutputFile = { path, filename, mediaType, size,
    sha256: createHash("sha256").update(bytes).digest("hex") };
  return { file, bytes };
}
