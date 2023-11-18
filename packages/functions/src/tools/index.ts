import { Tool } from "@bubby/core/interfaces/ai";

import * as image from "./image";
import * as memory from "./memory";
import * as ops from "./ops";

export const tools: Tool<any>[] = [
  image.analyzeImage,
  image.generateImage,
  memory.overwriteMemory,
  ops.newThread,
];
