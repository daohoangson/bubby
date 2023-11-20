import { TranscriptionCreateParams } from "openai/resources/audio/transcriptions";
import { openai } from "./openai";
import { toFile } from "openai";

export async function audioCreateTranscription(blob: Blob): Promise<string> {
  const file = await toFile(blob);
  const body: TranscriptionCreateParams = {
    file,
    model: "whisper-1",
  };
  const transcription = await openai.audio.transcriptions.create(body);
  console.log(JSON.stringify(transcription, null, 2));
  return transcription.text;
}
