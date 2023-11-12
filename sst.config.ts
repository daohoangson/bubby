import { SSTConfig } from "sst";
import { API } from "./stacks/MyStack";
import { GitHub } from "./stacks/ProdStack";

export default {
  config(_input) {
    return {
      name: "bubby",
      region: "us-east-1",
    };
  },
  stacks(app) {
    app.stack(API).stack(GitHub);
  },
} satisfies SSTConfig;
