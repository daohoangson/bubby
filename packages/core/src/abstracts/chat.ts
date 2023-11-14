export type Chat = {
  getChannelId: () => string;
  getUserId: () => string;
  getUserName: () => string;
  reply(reply: Reply): Promise<EditableReply | undefined>;
  unmaskFileUrl: (url: string) => Promise<string | undefined>;
};

export type ChatPhoto = Chat & {
  getPhotoCaption: () => string | undefined;
  getPhotoUrl: () => string;
};

export type ChatText = Chat & {
  getTextMessage: () => string;
};

export type EditableReply = {
  edit(plainText: string): Promise<void>;
};

export type Reply =
  | {
      markdown: string;
      type: "markdown";
    }
  | {
      caption?: string;
      url: string;
      type: "photo";
    }
  | {
      system: string;
      type: "system";
    };
