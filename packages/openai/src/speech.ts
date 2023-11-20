import { Speech } from "@bubby/core/interfaces/ai";
import { audioCreateSpeech, audioCreateTranscription } from "./internal/audio";

export const speech: Speech = {
  fromText: async (text) => audioCreateSpeech(text),
  toText: (speechData) => audioCreateTranscription(speechData),
};
