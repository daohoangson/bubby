import { defineAgent, defineDynamic } from "eve";
import { createModel } from "../../../../../lib/model.ts";

// The bundled dynamic agent selects a Gateway model ID. Use our custom provider
// directly during development; sandbox.ts restores its native source workspace.
export default process.env.EVE_DEV === "1"
  ? defineAgent({
    description: "Update this agent's authored source when the user asks to create or update reusable skills, instructions, tools, or other capabilities. Make persistent changes under /source. Source changes become available on the next user turn; do not verify edited capabilities in the current turn.",
    model: createModel(process.env),
    modelOptions: { providerOptions: { openai: { store: false } } },
  })
  : defineDynamic({ events: { "session.started": () => null } });
