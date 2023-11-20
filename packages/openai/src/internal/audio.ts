import { toFile } from "openai";
import { TranscriptionCreateParams } from "openai/resources/audio/transcriptions";

import { SpeechData } from "@bubby/core/interfaces/ai";
import { openai } from "./openai";

export async function audioCreateTranscription(
  speechData: SpeechData
): Promise<string> {
  const body: TranscriptionCreateParams = {
    file: await toFile(speechData),
    model: "whisper-1",
  };
  const transcription = await openai.audio.transcriptions.create(body);
  console.log(JSON.stringify(transcription, null, 2));
  return transcription.text;
}
