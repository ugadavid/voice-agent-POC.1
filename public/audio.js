export function base64ToBlob(base64, mimeType) {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
}

export function setPlayerFromMp3Base64(player, b64) {
  const audioBlob = base64ToBlob(b64, "audio/mpeg");
  player.src = URL.createObjectURL(audioBlob);
  return player.src;
}
