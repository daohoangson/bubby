import {
  ManagedPolicy,
  OpenIdConnectPrincipal,
  OpenIdConnectProvider,
  Role,
} from "aws-cdk-lib/aws-iam";
import { StackContext } from "sst/constructs";

export function GitHub({ app, stack }: StackContext) {
  if (app.stage !== "prod") {
    return;
  }

  // https://docs.sst.dev/going-to-production#stacks-setup
  const provider = new OpenIdConnectProvider(stack, "GitHub", {
    url: "https://token.actions.githubusercontent.com",
    clientIds: ["sts.amazonaws.com"],
  });

  new Role(stack, "GitHubActionsRole", {
    assumedBy: new OpenIdConnectPrincipal(provider).withConditions({
      StringLike: {
        "token.actions.githubusercontent.com:sub":
          // https://github.com/daohoangson/bubby
          `repo:daohoangson/bubby:*`,
      },
    }),
    description: "Role assumed for deploying from GitHub CI using AWS CDK",
    managedPolicies: [
      ManagedPolicy.fromAwsManagedPolicyName("AdministratorAccess"),
    ],
    roleName: "GitHub",
  });
}
