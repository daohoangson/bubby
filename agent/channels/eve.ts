import { eveChannel } from "eve/channels/eve";
import { localDev, vercelOidc } from "eve/channels/auth";

// Terminal access locally and authenticated Vercel clients in production.
export default eveChannel({ auth: [vercelOidc(), localDev()] });
