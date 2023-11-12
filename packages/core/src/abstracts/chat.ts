export type Chat = {
  getChatId: () => string;
  getUserId: () => string;
};

export type ChatText = Chat & {
  getTextMessage: () => string;
};

export type Reply = {
  markdown: string;
};
