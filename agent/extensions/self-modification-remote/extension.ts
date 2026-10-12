import { getToken } from "@vercel/connect";
import selfModification from "eve/self-modification/remote";
import { authorizeSelfModification } from "../../../lib/self-modification-access.ts";

export default selfModification({
  source: {
    git: {
      repository: "github.com/daohoangson/bubby",
      directory: ".",
    },
  },
  target: { branch: "main" },
  credentials: {
    async resolve({ capability, repository }) {
      try {
        return await getToken("github/selfmod-daohoangson-bubby", {
          authorizationDetails: [
            {
              type: "github_app_installation",
              repositories: [repository.owner + "/" + repository.repo],
            },
          ],
          scopes:
            capability === "checkout"
              ? ["contents:read", "metadata:read"]
              : ["contents:write", "pull_requests:write", "metadata:read"],
          subject: { type: "app" },
        });
      } catch (error) {
        throw new Error("Self-modification could not obtain a GitHub credential from Vercel Connect for github/selfmod-daohoangson-bubby. Install and attach the configured GitHub connector to this Vercel project, install the managed GitHub App for the configured repository, then retry.", { cause: error });
      }
    },
  },
  authorize: authorizeSelfModification,
});
