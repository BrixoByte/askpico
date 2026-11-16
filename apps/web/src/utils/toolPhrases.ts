import { AgentToolId } from '@constants/agents';

// Phrase-level routing for the inline "Open <tool>" card. Multi-word phrases (EN,
// Roman Urdu, Urdu script) on purpose: single substrings such as "rate" or "note"
// match ordinary sentences. The card appears only when exactly one of the routed
// agent's tools matches, so an ambiguous message never opens a tool.
export const TOOL_PHRASES: Record<AgentToolId, string[]> = {
  pomodoro: ['pomodoro timer', 'pomodoro session', 'pomodoro chalao', 'focus timer', 'timer lagao', 'timer set karo'],
  scratchpad: ['open scratchpad', 'scratchpad khol', 'scratchpad likho', 'quick note', 'note likho', 'notes likho'],
  reminders: ['remind me', 'reminder set', 'reminder lagao', 'yaad dilao'],
  focus_mode: ['focus mode', 'distraction free', 'fullscreen focus'],
  weather: ['weather kaisa', 'weather today', 'weather in', 'mausam kaisa', 'موسم کیسا'],
  live_time: ['current time', 'what time', 'time kya hai', 'وقت کیا'],
  currency: ['exchange rate', 'dollar rate', 'usd to', 'bitcoin price', 'ڈالر کا ریٹ'],
  unit_converter: ['convert kg', 'kg to', 'to celsius', 'to fahrenheit', 'meters to', 'feet to cm', 'cm to feet', 'inches to cm', 'cm to inches', 'feet ko meter', 'کلو کو پاؤنڈ', 'کلو سے پاؤنڈ'],
  text_diff: ['text diff', 'compare text', 'difference between'],
  json_formatter: ['format json', 'json format', 'json beautify'],
  markdown_html: ['markdown to html', 'markdown html'],
  network_speed: ['internet speed', 'wifi speed', 'speed test'],
  wiki: ['general knowledge', 'wikipedia pe', 'wikipedia par', 'wikipedia article', 'biology ke baare'],
  pubchem: ['chemical compound', 'molecular formula', 'compound ka'],
  physics: ['physics formula', 'ohm law', 'newton second law', 'velocity formula'],
  freelance_rate: ['freelance rate', 'hourly rate', 'upwork rate', 'fiverr rate'],
  image_converter: ['convert image', 'png to jpg', 'jpg to png', 'webp to'],
  image_resizer: ['resize image', 'image resize', 'image dimensions'],
  color_palette: ['color palette', 'colour palette', 'color scheme'],
  regex_tester: ['regex for', 'regex test', 'regex banao', 'test my regex', 'regex check karo', 'regular expression'],
  xml_formatter: ['format xml', 'xml format', 'xml validate'],
  sql_formatter: ['format sql', 'sql format', 'sql query'],
  lesson_plan: ['lesson plan', 'class ke liye plan'],
  quiz: ['make a quiz', 'quiz banao', 'mcq banao'],
  roman_cleanup: ['roman urdu clean', 'clean roman', 'roman urdu theek'],
  formal_email: ['formal email', 'email likho', 'email likhna'],
  prompt_enhancer: ['enhance prompt', 'improve prompt', 'prompt behtar'],
  document_maker: ['leave application', 'document banao', 'application likho'],
  cv_cover_letter: ['cv banao', 'cover letter', 'resume banao'],
  stock_search: ['stock photo', 'photos dhoondo', 'pexels se', 'pexels photos', 'pixabay se', 'اسٹاک فوٹو', 'stock photos of'],
  barcode: ['barcode banao', 'barcode generate', 'code128'],
  qr_code: ['qr code banao', 'qr generate', 'qr code bnao'],
  qr_scanner: ['scan qr', 'qr scan', 'read qr'],
  pdf_merge: ['merge pdf', 'pdf merge', 'combine pdf'],
  scan_to_pdf: ['images to pdf', 'jpg to pdf', 'png to pdf', 'scan to pdf'],
  pdf_split: ['split pdf', 'pdf split', 'extract pages'],
  pdf_to_jpg: ['pdf to jpg', 'pdf to image'],
  markdown_pdf: ['markdown to pdf', 'md to pdf'],
};

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const phraseRegex = (phrase: string) =>
  new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(phrase)}($|[^\\p{L}\\p{N}])`, 'iu');

export const TOOL_IDS = Object.keys(TOOL_PHRASES) as AgentToolId[];

export const isToolId = (value: unknown): value is AgentToolId =>
  typeof value === 'string' && Object.hasOwn(TOOL_PHRASES, value);

// Priority when several tools match one message:
// 1. The tool whose longest matched phrase is longest wins (a multi-word
//    verb+object phrase such as "markdown to pdf" beats a shorter one).
// 2. A tie on that length is ambiguous and yields no card; the user is answered
//    in core chat instead of guessing.
// The result is always an id from TOOL_PHRASES (allowlist); ids typed by the user
// ("toolId=pdf_merge") never match because only phrases are searched.
export const matchTool = (text: string, candidates: AgentToolId[] = TOOL_IDS): AgentToolId | null => {
  const scored = candidates
    .filter(isToolId)
    .map((tool) => {
      const lengths = (TOOL_PHRASES[tool] ?? [])
        .filter((phrase) => phraseRegex(phrase).test(text))
        .map((phrase) => phrase.length);
      return { tool, score: lengths.length ? Math.max(...lengths) : 0 };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return null;
  if (scored.length > 1 && scored[0].score === scored[1].score) return null;
  return scored[0].tool;
};
