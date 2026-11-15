import React, { useState } from 'react';

const friendlyMessage = (error: string) => {
  if (/incomplete|cut off|Unexpected end of file/i.test(error))
    return 'This preview was cut off while it was being generated.';
  if (/Cannot resolve|No exported React component/i.test(error))
    return 'A file in this preview is missing or not exported correctly.';
  if (/timed out/i.test(error)) return 'The preview took too long to load.';
  return 'This preview could not be loaded.';
};

const PreviewErrorCard = ({
  error,
  title,
  onRetry,
}: {
  error: string;
  title: string;
  onRetry: () => void;
}) => {
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);

  const copyReport = async () => {
    const report = [
      `Artifact: ${title}`,
      `Issue: ${friendlyMessage(error)}`,
      note.trim() ? `User note: ${note.trim()}` : null,
      '',
      'Technical details:',
      error,
    ]
      .filter((line) => line !== null)
      .join('\n');
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className='flex h-full flex-col items-center justify-center overflow-auto p-4'>
      <div className='w-full max-w-md rounded-xl border border-surface-line bg-surface p-5 shadow-card'>
        <p className='text-sm font-semibold text-ink'>{friendlyMessage(error)}</p>
        <p className='mt-1 text-xs text-ink-muted'>
          Try refreshing. If it keeps happening, describe what you saw and copy the report for the team.
        </p>

        <div className='mt-3 flex gap-2'>
          <button
            type='button'
            onClick={onRetry}
            className='rounded-lg border border-surface-line bg-surface px-3 py-1.5 text-xs text-ink-soft hover:bg-surface-muted'
          >
            Refresh preview
          </button>
        </div>

        <label className='mt-4 block text-xs font-medium text-ink-soft' htmlFor='preview-error-note'>
          What were you doing? (optional)
        </label>
        <textarea
          id='preview-error-note'
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder='Example: asked for a landing page with a footer'
          className='mt-1 w-full resize-none rounded-lg border border-surface-line bg-surface-muted px-3 py-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-emerald-400'
        />

        <div className='mt-3 flex items-center justify-between gap-2'>
          <button
            type='button'
            onClick={copyReport}
            className='rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-emerald-400'
          >
            {copied ? 'Report copied' : 'Copy error report'}
          </button>
          <details className='text-xs text-ink-muted'>
            <summary className='cursor-pointer select-none'>Technical details</summary>
            <pre className='mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-surface-muted p-2 font-mono text-[11px] text-ink-soft'>
              {error}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
};

export default PreviewErrorCard;
