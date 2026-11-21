// File types the composer accepts. Text-like files are read in the browser; PDF and Word
// documents are sent to /api/attachments/extract; images are attached as images.
export const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.json', '.csv', '.log', '.py', '.js', '.jsx', '.ts', '.tsx', '.html', '.css',
  '.xml', '.yaml', '.yml', '.sql', '.sh', '.java', '.c', '.cpp', '.h', '.go', '.rs', '.rb',
  '.php', '.swift', '.kt',
]);

const DOCUMENT_EXTENSIONS = new Set(['.pdf', '.docx']);

const extensionOf = (name: string) => {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot).toLowerCase();
};

export const isSupportedAttachment = (name: string, type: string): boolean => {
  const ext = extensionOf(name);
  return type.startsWith('image/') || type.startsWith('text/') || TEXT_EXTENSIONS.has(ext) || DOCUMENT_EXTENSIONS.has(ext);
};
