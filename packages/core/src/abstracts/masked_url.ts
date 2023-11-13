const rootUrl = "https://bubby.app";

export function buildMaskedUrlForFile(channelId: string, fileId: string) {
  const encodedChannelId = encodeURIComponent(channelId);
  const encodedFileId = encodeURIComponent(fileId);
  return `${rootUrl}/v1/c/${encodedChannelId}/f/${encodedFileId}/masked`;
}

export function extractFileIdFromMaskedUrl(
  channelId: string,
  url: string
): string | undefined {
  if (!url.startsWith(rootUrl)) {
    return;
  }

  const match = url.match(/\/v1\/c\/(.+)\/f\/(.+)\/masked$/);
  if (!match) {
    return;
  }

  const urlChannelId = decodeURIComponent(match[1]);
  if (urlChannelId !== channelId) {
    console.warn("urlChannelId !== channelId", { urlChannelId, channelId });
    return;
  }

  return decodeURIComponent(match[2]);
}
