export type SpeechData = {
  blob: () => Promise<Blob>;
  url: string;
};

export type Speech = {
  fromText(text: string): Promise<SpeechData>;
  toText(input: SpeechData): Promise<string>;
};
