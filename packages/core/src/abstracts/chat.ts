export type Chat = {
  getChannelId: () => string;
  getUserId: () => string;
};

export type ChatText = Chat & {
  getTextMessage: () => string;
};

export type Reply = {
  markdown: string;
};
