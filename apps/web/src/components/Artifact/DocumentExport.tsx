import React from 'react';

import { markdownToDocxBlob } from '@utils/docx';
import { markdownToHtml, printHtmlAsPdf } from '@utils/printDocument';

const buttonClass =
  'relative flex items-center gap-1 rounded-lg border border-surface-line bg-surface px-2 py-1 text-xs text-ink-soft hover:bg-surface-muted after:absolute after:-inset-y-2 after:inset-x-0';

const DocumentExport = ({ title, content }: { title: string; content: string }) => {
  const baseName = title.replace(/\.[^.]+$/, '') || 'document';

  const downloadDocx = async () => {
    const blob = await markdownToDocxBlob(content);
    const url = URL.createObjectURL(blob);
    const filename = `${baseName}.docx`;
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
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  return (
    <div className='flex w-full items-center justify-end gap-2'>
      <button type='button' className={buttonClass} onClick={() => printHtmlAsPdf(baseName, markdownToHtml(content))}>
        Download PDF
      </button>
      <button type='button' className={buttonClass} onClick={() => void downloadDocx()}>
        Download DOCX
      </button>
    </div>
  );
};

export default DocumentExport;
