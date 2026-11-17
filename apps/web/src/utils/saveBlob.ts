// Saves a Blob as a user download. In the Android WebView the anchor-download
// path is unreliable (the native bridge must fetch the blob URL before it is
// revoked), so prefer the PicoDownload bridge and delay revocation there.

export const saveBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const picoDownload = (window as unknown as {
    PicoDownload?: { saveBlobUrl?: (o: string, u: string, n: string, m: string) => boolean };
  }).PicoDownload;
  if (picoDownload?.saveBlobUrl?.(location.origin, url, fileName, blob.type)) {
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return;
  }
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};
