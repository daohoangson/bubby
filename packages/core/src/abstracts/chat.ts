export type Chat = {
  getChannelId: () => string;
  getUserId: () => string;
  unmaskFileUrl: (url: string) => Promise<string | undefined>;
};

export type ChatPhoto = Chat & {
  getPhotoCaption: () => string | undefined;
  getPhotoUrl: () => string;
};

export type ChatText = Chat & {
  getTextMessage: () => string;
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
      plaintext: string;
      type: "plaintext";
    };
