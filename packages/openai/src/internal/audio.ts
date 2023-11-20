import { TranscriptionCreateParams } from "openai/resources/audio/transcriptions";
import { openai } from "./openai";
import { toFile } from "openai";

export async function audioCreateTranscription(
  file: Response
): Promise<string> {
  const body: TranscriptionCreateParams = {
    file: await toFile(file),
    model: "whisper-1",
  };
  const transcription = await openai.audio.transcriptions.create(body);
  console.log(JSON.stringify(transcription, null, 2));
  return transcription.text;
}
