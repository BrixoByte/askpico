// Splits streamed LLM text into speakable sentences so TTS can start on the
// first completed sentence instead of waiting for the whole reply (Step 6).

const SENTENCE_END = /[.!?।…]+["'”)\]]*\s|\n+/;
// Clause breaks (comma, Urdu comma, semicolon, colon) followed by whitespace.
const CLAUSE_BREAK = /[,،;:]\s/;
const CLAUSE_MIN_CHARS = 60;
// The first clause of a reply may be short, so audio starts after a few words.
const FIRST_CLAUSE_MIN_CHARS = 15;

// Markdown/formatting that sounds wrong when spoken.
const MD_LINK = /\[([^\]]+)\]\((?:[^)]+)\)/g;
const MD_BOLD_ITALIC = /[*_`~#>]/g;
const MOOD_TAG = /\[mood:[^\]]*\]/gi;
// Internal fact-check marker — must never be spoken or shown.
const VERIFY_TAG = /\[Verify Local Data[^\]]*\]/gi;

export const toSpeakableText = (text: string): string =>
  text
    .replace(MD_LINK, '$1')
    .replace(MOOD_TAG, '')
    .replace(VERIFY_TAG, '')
    .replace(MD_BOLD_ITALIC, '')
    .replace(/[ \t]+/g, ' ')
    .trim();

// Urdu is the default speech language. The server falls back to Hindi,
// then English, if the Urdu voice fails.
export const detectSpeechLang = (_text: string): string => 'ur-PK';

export class SentenceChunker {
  private buffer = '';
  private spokenLength = 0;
  private spoken = false;

  // Feed newly arrived text; returns sentences that are complete enough to
  // speak now. The remainder stays buffered.
  feed(text: string): string[] {
    this.buffer += text;
    const sentences: string[] = [];
    let match: RegExpExecArray | null;
    const re = new RegExp(SENTENCE_END.source, 'g');
    let lastEnd = 0;
    while ((match = re.exec(this.buffer)) !== null) {
      const candidate = this.buffer.slice(lastEnd, match.index + match[0].length);
      const cleaned = toSpeakableText(candidate);
      // Require some substance so "..." or a lone bullet doesn't trigger TTS.
      if (/[\p{L}\p{N}]/u.test(cleaned) && cleaned.length >= 2) {
        sentences.push(cleaned);
        lastEnd = match.index + match[0].length;
      }
    }
    this.buffer = this.buffer.slice(lastEnd);
    // Run-on text with no sentence end yet: speak up to the last clause break
    // so the first audio starts sooner.
    const minChars = this.spoken ? CLAUSE_MIN_CHARS : FIRST_CLAUSE_MIN_CHARS;
    if (sentences.length === 0 && this.buffer.length >= minChars) {
      const clauseBreaks = new RegExp(CLAUSE_BREAK.source, 'g');
      let cut = -1;
      let breakMatch: RegExpExecArray | null;
      while ((breakMatch = clauseBreaks.exec(this.buffer)) !== null) cut = breakMatch.index + 1;
      const clause = cut > 0 ? toSpeakableText(this.buffer.slice(0, cut)) : '';
      if (/[\p{L}\p{N}]/u.test(clause) && clause.length >= 2) {
        sentences.push(clause);
        this.buffer = this.buffer.slice(cut);
      }
    }
    // Opening words of a reply: speak the first complete words once enough have arrived,
    // without waiting for punctuation.
    if (sentences.length === 0 && !this.spoken && this.buffer.length >= FIRST_CLAUSE_MIN_CHARS) {
      const space = this.buffer.lastIndexOf(' ');
      const words = space > 0 ? toSpeakableText(this.buffer.slice(0, space)) : '';
      if (/[\p{L}\p{N}]/u.test(words) && words.length >= 2) {
        sentences.push(words);
        this.buffer = this.buffer.slice(space);
      }
    }
    if (sentences.length > 0) this.spoken = true;
    return sentences;
  }

  // Called when the stream finishes — returns whatever is left.
  flush(): string[] {
    const rest = toSpeakableText(this.buffer);
    this.buffer = '';
    return /[\p{L}\p{N}]/u.test(rest) && rest.length >= 2 ? [rest] : [];
  }

  reset() {
    this.buffer = '';
    this.spokenLength = 0;
    this.spoken = false;
  }
}
