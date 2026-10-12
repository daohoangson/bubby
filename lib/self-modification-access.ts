type AuthorizationContext = {
  channel: { kind?: string };
  principal: {
    authenticator: string;
    principalId: string;
    attributes: { readonly chat_type?: string | readonly string[] };
  } | null;
};

/** Only the owner's authenticated private Telegram conversations may edit source. */
export function authorizeSelfModification({ channel, principal }: AuthorizationContext): boolean {
  return channel.kind === "channel:telegram"
    && principal?.authenticator === "telegram-webhook"
    && principal.principalId === "telegram:552046506"
    && principal.attributes.chat_type === "private";
}
