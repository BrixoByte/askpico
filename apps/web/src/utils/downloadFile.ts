const downloadFile = (data: object, filename: string) => {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const picoDownload = (window as unknown as {
    PicoDownload?: { saveBlobUrl?: (o: string, u: string, n: string, m: string) => boolean };
  }).PicoDownload;
  if (picoDownload?.saveBlobUrl?.(location.origin, url, filename, blob.type)) {
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return;
  }
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

export default downloadFile;
