import { Config } from "sst/node/config";
import { Context } from "telegraf";
import { Update } from "telegraf/typings/core/types/typegram";

import * as core from "@bubby/core/interfaces/user";

export class User implements core.User {
  constructor(protected ctx: Context<Update.MessageUpdate>) {}

  getUserId() {
    return `${this.ctx.from.id}`;
  }

  getUserName() {
    const { ctx } = this;
    return `${ctx.from.first_name} ${ctx.from.last_name}`;
  }

  isAdmin() {
    return Config.TELEGRAM_ADMIN_IDS.split(",")
      .map((v) => parseInt(v.trim()))
      .includes(this.ctx.from.id);
  }
}
