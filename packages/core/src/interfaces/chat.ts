export type Chat = {
  getChannelId: () => string;
  reply(reply: Reply): Promise<void>;
  unmaskFileUrl: (url: string) => Promise<string | undefined>;
};

export type ChatPhoto = Chat & {
  getPhotoCaption: () => string | undefined;
  getPhotoUrl: () => string;
};

export type ChatText = Chat & {
  getTextMessage: () => Promise<string>;
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
