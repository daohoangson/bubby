const rootUrl = "https://bubby.app";

export function buildMaskedUrlForFile(channelId: string, fileId: string) {
  const json = JSON.stringify({ channelId, fileId });
  const base64 = Buffer.from(json).toString("base64");
  return `${rootUrl}/v1/files/${encodeURIComponent(base64)}`;
}

export function extractFileIdFromMaskedUrl(
  channelId: string,
  url: string
): string | undefined {
  if (!url.startsWith(rootUrl)) {
    return;
  }

  const match = url.match(/\/v1\/files\/(.+)$/);
  if (!match) {
    return;
  }

  const json = Buffer.from(decodeURIComponent(match[1]), "base64").toString();
  try {
    const { channelId: actualChannelId, fileId } = JSON.parse(json);
    if (actualChannelId !== channelId) {
      console.warn("actualChannelId !== channelId", {
        channelId,
        url,
        actualChannelId,
      });
      return;
    }

    return fileId;
  } catch (jsonError) {
    console.error({ url, json, jsonError });
    return;
  }
}
