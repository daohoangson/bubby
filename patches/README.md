# Eve 0.77.0 model inheritance

`pnpm install --frozen-lockfile` applies `eve@0.77.0.patch`. The built-in remote
self-modification agent defaults to the internal `eve:inherit-parent` selection
when its mount has no explicit model override.

The patch copies the parent's durable model reference, including provider
options and the compiled node that owns its source. Eve reconstructs the SDK
provider from that authored module in the child session. API keys and SDK objects
are never copied into workflow state. Ephemeral model objects fail closed.
Explicit model overrides retain Eve's existing behavior.

The four patched files cover remote model selection, durable normalization,
source resolution across compiled nodes, and the reference type declaration.
Authorization, GitHub credentials, sandbox setup, and publish tools use Eve's
original implementation. The local editor keeps its existing model configuration.

When upgrading Eve, rebase or remove this patch and run `pnpm test`,
`pnpm typecheck`, and `EVE_DEV=1 pnpm build`. Verify an owner-only production
editor request across multiple turns and confirm HTTP clients remain denied.
The colocated test exercises JSON checkpoint restoration, provider identity,
nested inheritance, explicit overrides, and rejection of ephemeral models.
