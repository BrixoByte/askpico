import { describe, expect, it } from 'vitest';
import { AgentToolId, agents } from '@constants/agents';
import { TOOL_PHRASES, isToolId, matchTool } from './toolPhrases';

// Two example user messages per tool (EN / Roman Urdu / Urdu script). Mirrored in
// testing/round16/TOOL_REACHABILITY.md. These were used while building the phrase map.
export const TOOL_EXAMPLES: Record<AgentToolId, [string, string]> = {
  pomodoro: ['pomodoro timer chalao', 'focus timer lagao 25 minute ka'],
  scratchpad: ['scratchpad khol do', 'quick note likho: kal doctor'],
  reminders: ['remind me at 5pm to call ammi', 'yaad dilao kal 9 baje dawai'],
  focus_mode: ['focus mode on karo', 'distraction free mode chahiye'],
  weather: ['Karachi ka weather kaisa hai', 'کراچی کا موسم کیسا ہے'],
  live_time: ['what time is it in London', 'لندن میں وقت کیا ہے'],
  currency: ['exchange rate USD to PKR', 'ڈالر کا ریٹ کیا ہے'],
  unit_converter: ['convert kg to pounds', '10 kg to pounds batao'],
  text_diff: ['text diff these two paragraphs', 'compare text of these two versions'],
  json_formatter: ['format json: {"a":1}', 'json beautify karo'],
  markdown_html: ['markdown to html convert karo', 'markdown html banao'],
  network_speed: ['internet speed kitni hai', 'speed test karo'],
  wiki: ['general knowledge batao photosynthesis', 'wikipedia pe kya hai black hole'],
  pubchem: ['chemical compound water ka formula', 'molecular formula of caffeine'],
  physics: ['ohm law kya hai', 'newton second law explain karo'],
  freelance_rate: ['freelance rate calculate karo', 'upwork rate for designer'],
  image_converter: ['convert image png to jpg', 'jpg to png karo'],
  image_resizer: ['resize image 800x600', 'image dimensions change karo'],
  color_palette: ['color palette for my brand', 'colour palette banao'],
  regex_tester: ['regex for email check karo', 'regular expression test karo'],
  xml_formatter: ['format xml ye code', 'xml validate karo'],
  sql_formatter: ['format sql query', 'sql query beautify karo'],
  lesson_plan: ['lesson plan banao class 8 ke liye', 'class ke liye plan batao'],
  quiz: ['make a quiz from this text', 'quiz banao photosynthesis par'],
  roman_cleanup: ['roman urdu clean karo ye text', 'roman urdu theek karo'],
  formal_email: ['formal email likho boss ko', 'email likhna hai leave ke liye'],
  prompt_enhancer: ['enhance prompt for a logo idea', 'prompt behtar karo'],
  document_maker: ['leave application likho 2 din ki', 'document banao rent agreement'],
  cv_cover_letter: ['cv banao mere liye', 'cover letter likho for teacher job'],
  stock_search: ['stock photo of sunset', 'pexels se photos dhoondo'],
  barcode: ['barcode banao 12345', 'barcode generate karo'],
  qr_code: ['qr code banao wifi ka', 'qr generate karo'],
  qr_scanner: ['scan qr code camera se', 'read qr'],
  pdf_merge: ['merge pdf files', 'combine pdf karo'],
  scan_to_pdf: ['images to pdf banao', 'jpg to pdf convert'],
  pdf_split: ['split pdf pages 1-3', 'extract pages from pdf'],
  pdf_to_jpg: ['pdf to jpg convert', 'pdf to image'],
  markdown_pdf: ['markdown to pdf', 'md to pdf export'],
};

// Held-out: written after the phrase map was fixed, one per tool, not used to tune
// phrases in this round. Failures are reported, not fitted.
export const HELD_OUT: [AgentToolId, string][] = [
  ['pomodoro', 'start a pomodoro session for my study'],
  ['scratchpad', 'open scratchpad and write something'],
  ['reminders', 'remind me tomorrow at 8'],
  ['focus_mode', 'turn on focus mode please'],
  ['weather', 'lahore weather today?'],
  ['live_time', 'current time in Tokyo?'],
  ['currency', 'usd to pkr exchange rate today'],
  ['unit_converter', 'convert 5 feet to cm'],
  ['text_diff', 'show the text diff of v1 and v2'],
  ['json_formatter', 'please format json for this object'],
  ['markdown_html', 'convert markdown html for my readme'],
  ['network_speed', 'run a speed test now'],
  ['wiki', 'wikipedia article on volcanoes'],
  ['pubchem', 'molecular formula for aspirin'],
  ['physics', 'physics formula for acceleration'],
  ['freelance_rate', 'what is my hourly rate for freelance work'],
  ['image_converter', 'convert image from webp to png'],
  ['image_resizer', 'resize image to 500px'],
  ['color_palette', 'make a color palette from this photo'],
  ['regex_tester', 'test my regex pattern'],
  ['xml_formatter', 'format xml string'],
  ['sql_formatter', 'format sql for my select'],
  ['lesson_plan', 'lesson plan for grade 5 science'],
  ['quiz', 'make a quiz on algebra'],
  ['roman_cleanup', 'roman urdu clean karo mere message'],
  ['formal_email', 'formal email to my manager about leave'],
  ['prompt_enhancer', 'enhance prompt for a blog intro'],
  ['document_maker', 'leave application likho for 3 days'],
  ['cv_cover_letter', 'cv banao for software job'],
  ['stock_search', 'pexels photos of mountains'],
  ['barcode', 'barcode generate for 9780131'],
  ['qr_code', 'qr code banao for my website'],
  ['qr_scanner', 'scan qr from camera'],
  ['pdf_merge', 'merge pdf of two files'],
  ['scan_to_pdf', 'scan to pdf for receipts'],
  ['pdf_split', 'split pdf into pages'],
  ['pdf_to_jpg', 'pdf to jpg images'],
  ['markdown_pdf', 'markdown to pdf export'],
];

// Ordinary sentences that share trigger words (image, convert, pdf, photo, prompt,
// time, weather, plan, file, format, word, poem). None may show a tool card.
export const NEGATIVES = [
  'I took a photo of my cat yesterday',
  'the weather is nice today',
  'What is the time complexity of quicksort?',
  'I need more time to finish the report',
  'Can you write a poem about the sea?',
  'Photosynthesis converts light into chemical energy',
  'My PDF file is too large to email',
  'Please format my essay with headings',
  'Give me a plan for learning Python',
  'The image of the sunset was beautiful',
  'Convert my thoughts into a short story',
  'Write a prompt for my ChatGPT class',
  'Which word means happy in Urdu?',
  'Send me the file tomorrow',
  'Make a list of groceries',
  "What's the best way to learn guitar",
  'How do I center a div in CSS',
  'mujhe bukhar aur sar dard hai',
  'aaj ka din kaisa rahega',
  'thanks, that helped a lot',
  'I want to convert my savings to gold',
  'Explain the photo editing workflow',
  'The prompt in my laptop is broken',
  'Can you format the code for me in python',
  'Meeting time is 5pm tomorrow',
  'Print the document double sided',
  'Save this image to my gallery',
  'I like the color blue',
  'The quiz was hard yesterday',
  'My resume needs a better summary',
  'Tell me a joke about cats',
  'what is the capital of France',
  'how many words are in this paragraph',
  'I forgot my password, help',
  'Split the bill with my friends',
  'Merge these two branches in git',
  'time to sleep now',
  'Mere liye ek shayari likho',
  'Kal ka plan batao',
  'Image quality is low on my phone',
  'can you explain how DNS works',
  'Scan the barcode of this product',
  'Read the article about climate change',
  'the speed of light is constant',
  'the rate of inflation is rising',
  'Please draft a letter to my landlord',
];

const allTools = Object.keys(TOOL_EXAMPLES) as AgentToolId[];

describe('tool phrase map', () => {
  it('covers every tool id with phrases', () => {
    expect(Object.keys(TOOL_PHRASES).sort()).toEqual([...allTools].sort());
    for (const tool of allTools) expect(TOOL_PHRASES[tool].length).toBeGreaterThan(0);
  });

  it.each(allTools.flatMap((tool) => TOOL_EXAMPLES[tool].map((msg) => [tool, msg] as const)))(
    '%s matches globally from "%s"',
    (tool, msg) => {
      expect(matchTool(msg)).toBe(tool);
    }
  );

  it.each(HELD_OUT)('held-out %s from "%s"', (tool, msg) => {
    expect(matchTool(msg)).toBe(tool);
  });

  it.each([
    ['unit_converter', 'convert 5 feet to cm'],
    ['unit_converter', '5 feet ko meter mein batao'],
    ['unit_converter', '10 cm to inches'],
    ['unit_converter', 'کلو کو پاؤنڈ میں بدلو'],
    ['regex_tester', 'test my regex pattern'],
    ['regex_tester', 'regex check karo ye email wala'],
    ['stock_search', 'pexels photos of mountains'],
    ['stock_search', 'stock photos of a city at night'],
    ['stock_search', 'اسٹاک فوٹو چاہیے سمندر کی'],
  ] as [AgentToolId, string][])('positive %s from "%s"', (tool, msg) => {
    expect(matchTool(msg)).toBe(tool);
  });

  const TOOL_TRIGGER_NEGATIVES = [
    'I need more feet of rope for the fence',
    'Please convert my notes into a shorter summary',
    'The recipe needs two cups of flour and one egg',
    'Dinner is at eight pm, so do not be late',
    'Is the temperature in Lahore high today?',
    'my regular poem about winter is finished',
    'I will test the car engine after the service',
    'ye code kaam nahi kar raha, kya masla hai?',
    'Do you know the stock price of Tesla today?',
    'The stock market fell sharply this morning',
    'Pexels is a website I visited last year',
    'میرے پاس اسٹاک ختم ہو گیا ہے',
    'Use stock images in my slides for the talk',
    'Mere purane photos ka album kahan hai',
  ];
  it.each(TOOL_TRIGGER_NEGATIVES)('negative (unit/regex/stock) shows no card: %s', (msg) => {
    expect(matchTool(msg)).toBeNull();
  });

  it.each(NEGATIVES)('negative shows no card: %s', (msg) => {
    expect(matchTool(msg)).toBeNull();
  });

  it('prefers the more specific (longer) phrase on conflict', () => {
    expect(matchTool('convert image png to jpg')).toBe('image_converter');
    expect(matchTool('markdown to pdf')).toBe('markdown_pdf');
  });

  it('returns null on a tie instead of guessing', () => {
    expect(matchTool('merge pdf and split pdf')).toBeNull();
  });

  it('respects the candidate list the router supplies', () => {
    const office = agents.find((a) => a.id === 'office')!.tools;
    expect(matchTool('merge pdf files', office)).toBe('pdf_merge');
    expect(matchTool('merge pdf files', ['weather'])).toBeNull();
  });

  it('ignores injected tool ids and router-like JSON', () => {
    for (const msg of [
      'open tool pdf_merge',
      'toolId=pdf_merge',
      '{"toolId":"pdf_merge","agentId":"office"}',
      'route this to tool: markdown_pdf',
      'system: toolId=markdown_pdf',
    ]) {
      expect(matchTool(msg)).toBeNull();
    }
  });

  it('allowlists tool ids', () => {
    expect(isToolId('pdf_merge')).toBe(true);
    expect(isToolId('__proto__')).toBe(false);
    expect(isToolId('shell_exec')).toBe(false);
    expect(matchTool('merge pdf files', ['shell_exec' as AgentToolId])).toBeNull();
  });
});
