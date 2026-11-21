import { describe, expect, it } from 'vitest';
import { isSupportedAttachment } from './attachmentTypes';

describe('isSupportedAttachment', () => {
  it('accepts images, text-like files, PDF and Word documents', () => {
    expect(isSupportedAttachment('photo.png', 'image/png')).toBe(true);
    expect(isSupportedAttachment('notes.txt', 'text/plain')).toBe(true);
    expect(isSupportedAttachment('data.json', '')).toBe(true);
    expect(isSupportedAttachment('report.PDF', 'application/pdf')).toBe(true);
    expect(isSupportedAttachment('letter.docx', '')).toBe(true);
  });

  it('rejects binary and executable types the app cannot read', () => {
    expect(isSupportedAttachment('r70_unsupported.bin', 'application/octet-stream')).toBe(false);
    expect(isSupportedAttachment('setup.exe', 'application/x-msdownload')).toBe(false);
    expect(isSupportedAttachment('archive.zip', 'application/zip')).toBe(false);
  });

  it('rejects an unknown file with no extension and a binary type', () => {
    expect(isSupportedAttachment('noext', 'application/octet-stream')).toBe(false);
  });
});
