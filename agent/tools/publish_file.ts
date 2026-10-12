import { defineTool } from "eve/tools";
import { z } from "zod";
import { readOutputFile } from "../../lib/output-files.ts";

export default defineTool({
  description: "Send a finished sandbox file to the user as a Telegram document in the current chat/topic. Create and verify the file first. Supports CSV, TXT, JSON, PDF, DOCX, XLSX and common images up to 20 MB. Files are delivered only on Telegram; other channels return file metadata.",
  inputSchema: z.object({ path: z.string().min(1).describe("Path to the completed file inside /workspace") }),
  async execute({ path }, ctx) {
    const { file } = await readOutputFile(await ctx.getSandbox(), path);
    return file;
  },
});
