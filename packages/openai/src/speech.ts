import { Speech } from "@bubby/core/interfaces/ai";
import { audioCreateTranscription } from "./internal/audio";

export const speech: Speech = {
  fromText: async (input) => {
    throw new Error(input);
  },
  toText: (speechData) => audioCreateTranscription(speechData),
};
