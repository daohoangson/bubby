export type User = {
  getUserId: () => string;
  getUserName: () => string;
  isAdmin: () => boolean;
};
