// Fast rule layer for agent routing. Runs before the LLM classifier (~0 ms).
// Covers English, Urdu script, and Roman Urdu. Doctor and Studio are "Planned"
// and intentionally have NO rules — health/planned requests stay in core chat.
//
// Tiers:
//  - strong: multi-word task phrases, proximity patterns (request verb within
//    ~30-50 chars of a domain keyword), plus ALL Urdu-script patterns
//    (desi messages are almost always requests). Routes immediately.
//  - weak:   bare English keywords — routed ONLY when the message also carries
//    an action/request marker (imperative verb or desi request word).
//    Statements and opinions ("physics is hard", "bitcoin is volatile")
//    stay in core chat.

const REQUEST_RE =
  /\b(make|create|generate|write|draft|build|prepare|compose|produce|give|tell|show|find|search|get|fetch|lookup|need|want|chahiye|banao|bnao|bana do|likho|likh do|batao|batana|samjhao|samjha do|dikhao|nikalo|milo|karo|kar do|karna|please|can you|could you|plz|kindly|mujhe|mera|meri|mere|help)\b/i;

const AGENTS = [
  {
    agentId: 'study',
    strong: [
      /\b(multiple choice|lesson plan|lecture notes|homework (help|assignment)|assignment (help|on)|study (plan|tips|schedule|for)|notes? (on|for|about)|summari[sz]e (this )?(chapter|topic|lesson|notes)|physics (problem|question|sawal|topics?|numerical|doubt)|chemistry (problem|question|sawal|topics?|numerical|doubt)|biology (question|topics?|doubt)|math (problem|question|sawal|doubt)|periodic table|formula (sheet|for)|equation (solver|for)|science (question|topic|fair)|exam (prep|tips|schedule)|quiz (me|on|about|for)|mcqs? on|calculus|photosynthesis)\b/i,
      /(کوئز|سبق|لیسن|ہوم ورک|اسائنمنٹ|پھزکس|کیمسٹری|بیالوجی|ریاضی|الجبرا|جیومیٹری|سائنس|نوٹس|خلاصہ|امتحان|ٹاپک|سوال|مشق)/,
      /\b(quiz|mcq|lesson|homework|assignment|physics|chemistry|biology|math|algebra|geometry|calculus|photosynthesis|theorem|formula|equation|science|chapter|exam|topic|padhai|parho|seekhna|samjhao|samjha do|padhana|doubt|notes?)\b.{0,30}\b(sawal|question|problem|doubt|help|samjhao|batao|banao|karo|chahiye|parho|seekhna|quiz|test|batao)\b|\b(sawal|question|problem|doubt|help|samjhao|batao|banao|karo|chahiye|samjha do)\b.{0,30}\b(quiz|mcq|lesson|homework|assignment|physics|chemistry|biology|math|algebra|geometry|calculus|photosynthesis|theorem|formula|equation|science|chapter|exam|topic|padhai|parho|seekhna|notes?)\b/i,
    ],
    weak: [/\b(notes?|exam|topic|formula|equation|science|math|physics|chemistry|biology|homework|assignment|lesson|chapter|quiz|calculus|photosynthesis|theorem)\b/i],
  },
  {
    agentId: 'career',
    strong: [
      /\b(cover letter|job application|interview (prep|questions?|answers?)|salary negotiation|linkedin (profile|post|summary)|portfolio (website|review)|reference letter|resignation letter|offer letter|appointment letter|formal (email|letter) (for|to)|email (for|to) (a |an |the )?(job|interview|office|boss|manager|hr)|job (application|interview|offer|letter)|naukri|cv (format|template|banao|likho|banaye|banado)|resume (format|template|banao|likho|banaye|banado))\b/i,
      /(سی وی|ریزومے|کوریئر لیٹر|نوکری|انٹرویو|آفر لیٹر|رزگٹ|حوالہ|پورٹ فولیو|فارمل لیٹر|فارمل ای میل)/,
      /\b(cv|resume|cover letter|interview prep|linkedin|portfolio|resignation|offer letter|naukri|job lagao|job ke liye|letter likho|formal email|email likho)\b.{0,30}\b(banao|bnao|likho|likh do|batao|banaye|banado|format|template|help|chahiye|karo|kar|update|improve|review|suggest|write|create|make)\b|\b(banao|bnao|likho|likh do|batao|banaye|banado|format|template|help|chahiye|karo|kar|update|improve|review|suggest|write|create|make)\b.{0,30}\b(cv|resume|cover letter|interview prep|linkedin|portfolio|resignation|offer letter|naukri|job lagao|job ke liye|letter likho|formal email|email likho)\b/i,
    ],
    weak: [/\b(interview|linkedin|portfolio|resume|cv)\b/i],
  },
  {
    agentId: 'business',
    strong: [
      /\b(freelance (rate|price|charge|work)|freelancing (rate|price|charge)|invoice (template|format|generator|banao|bnao|likho)|tax (slab|return|calculator|filing|kaise)|pricing (strategy|table|for|kaise)|barcode (generator|generate|banao|kaise)|qr code (generator|generate|banao|for|kaise)|shop (account|khata|ka hisaab)|rate card|charges? for (my|the|a) (service|work|project)|how much (should|to) charge|business (plan|idea|loan)|paisa (kamai|manage|save)|kamai kaise|small business (ideas?|plan|tips|account|khata|paisa))\b/i,
      /(انوائس|بل|ٹیکس|فری لانس|قیمت|بار کوڈ|کیو آر کوڈ|دکان کا حساب|کمائی|mahanga|mahngi)/,
      /\b(freelance|invoice|tax return|pricing|barcode|qr code|qr generate|business plan|shop khata|rate card|charges|paisa|kamai|likhna invoice|bill banao|mahanga|mahngi)\b.{0,30}\b(banao|bnao|likho|format|template|help|chahiye|karo|kar|rate|price|charge|calculate|kitna|kitni|batao|generate|create|make|write)\b|\b(banao|bnao|likho|format|template|help|chahiye|karo|kar|rate|price|charge|calculate|kitna|kitni|batao|generate|create|make|write)\b.{0,30}\b(freelance|invoice|tax return|pricing|barcode|qr code|qr generate|business plan|shop khata|rate card|charges|paisa|kamai|likhna invoice|bill banao|mahanga|mahngi)\b/i,
    ],
    weak: [/\b(invoice|barcode|freelance|pricing)\b/i],
  },
  {
    agentId: 'hacker',
    strong: [
      /\b(format|validate|minify|generate|parse|lint|debug|fix|refactor|explain|convert|write|create|make|build|check|test|solve|run|install|deploy|compile|execute)\b.{0,50}\b(json|regex|regular expression|sql|xml|yaml|diff|patch|code|script|query|api|css|html|url|hash|token|jwt|cron|graphql|rest|command|terminal|server|database|bug|error|issue|crash|exception|problem)\b/i,
      /\b(regular expression|stack trace|error code|api endpoint|http status|unit conversion|merge conflict|sql query|database query|rest api|graphql|webhook|jwt|oauth|cors|css bug|html bug|responsive|breakpoint|regex pattern)\b/i,
      /\b(validate|verify|test|write|create|make|generate|build|check|find|match)\b.{0,40}\b(regex|regular expression|json schema|sql query|xml|yaml|cron expression|glob pattern|url pattern)\b/i,
      /\b(regex|regular expression|json schema|sql query|xml|yaml|cron expression|glob pattern|url pattern)\b.{0,40}\b(validate|verify|test|write|create|make|generate|build|check|find|match|for|to)\b/i,
      /(ڈی بگ|اسٹیک ٹریس|ایرر کوڈ|ریجیکس|منیفائر|فارمیٹر|کوئری|ڈیٹا بیس|بگ فکس|کوڈ کی خرابی)/,
      /\b(bug|error|issue|crash|exception|problem|fix|debug|resolve|solve|nahi chal raha|error aa raha|fail ho raha)\b.{0,40}\b(code|script|app|program|function|api|server|build|file|module|command|install|run|start|open)\b/i,
      /\b(code|script|app|program|function|api|server|build|file|module|command|install|run|start|open)\b.{0,40}\b(bug|error|issue|crash|exception|problem|fix|debug|resolve|solve|nahi chal raha|error aa raha|fail ho raha)\b/i,
    ],
    weak: [/\b(json|regex|sql|xml|yaml|diff|patch|stack trace|error code|api endpoint|http status|unit conversion|merge conflict|sql query|database query|rest api|graphql|webhook|jwt|oauth|cors|github|docker|git|npm|css|html|kubernetes|linux)\b/i],
  },
  {
    agentId: 'creative',
    strong: [
      /\b(color palette|colour palette|logo (banao|banaye|design karo|design chahiye|ideas?|concept)|resize (this |the |my |an )?image|image (converter|compression|resizer)|compress (this |the |my )?image|photo edit|photoshop|illustration|font pairing|gradient (generator|maker)|wallpaper (design|maker|banao)|phone wallpaper|desktop wallpaper|avatar (design|maker|banao)|banner (design|maker|banao)|thumbnail (design|maker|banao)|mockup|ui design|ux design|wireframe|figma|canva|creative writing (help|prompt|ideas?)|story (idea|prompt|likho|banao)s?|poem (about|on|for|likho)|shayari|likho (ek |a )?(kahani|story|shayari|poem))\b/i,
      /(رنگ|پینٹ|تصویر|ڈیزائن|لوگو|فوٹو|تصویریں|وال پیپر|شاعری|کہانی)/,
      /\b(stock photos?|stock images?|color palette|logo|design|image|photo|picture|wallpaper|avatar|banner|thumbnail|illustration|gradient|story|poem|shayari)\b.{0,30}\b(design|banao|bnao|likho|create|make|generate|idea|prompt|help|chahiye|do|suggest|find|search|get|show|download)\b|\b(design|banao|bnao|likho|create|make|generate|idea|prompt|help|chahiye|do|suggest|find|search|get|show|download)\b.{0,30}\b(stock photos?|stock images?|color palette|logo|design|image|photo|picture|wallpaper|avatar|banner|thumbnail|illustration|gradient|story|poem|shayari)\b/i,
    ],
    weak: [/\b(design|image|photo|picture|story|gradient|wallpaper|logo|illustration|avatar|banner|thumbnail)\b/i],
  },
  {
    agentId: 'office',
    strong: [
      /\b(merge (these |the |my |all |multiple )?(two )?pdfs?|split (this|the|my|a) pdfs?pdf to (jpg|image|word|png)|images? to pdf|scan to pdf|pdf compress|pdf rotate|pdf watermark|combine pdf|document maker|formal letter|application letter|leave application|resignation letter|report (format|template|likho|banao)|meeting minutes|certificate (format|template|banao|likho)|id card|brochure|flyer|poster (design|format|banao)|invoice template|letterhead|docx|word document|excel (file|sheet|formula)|csv (convert|to)|markdown to pdf|pdf (file|document) (merge|split|compress|convert))\b/i,
      /(پی ڈی ایف|دستاویز|خط|درخواست|رپورٹ|سرٹیفکیٹ|پمفلٹ|پوسٹر)/,
      /\b(pdf|document|letter|application|report|certificate|brochure|flyer|poster|invoice|docx|word document|powerpoint|ppt|spreadsheet|agenda|minutes|merge pdf|split pdf|compress pdf|rotate pdf|watermark)\b.{0,30}\b(merge|split|compress|rotate|watermark|convert|format|template|banao|bnao|likho|create|make|generate|help|chahiye|do)\b|\b(merge|split|compress|rotate|watermark|convert|format|template|banao|bnao|likho|create|make|generate|help|chahiye|do)\b.{0,30}\b(pdf|document|letter|application|report|certificate|brochure|flyer|poster|invoice|docx|word document|powerpoint|ppt|spreadsheet|agenda|minutes)\b/i,
    ],
    weak: [/\b(letter|application|report|certificate|agenda|minutes|poster|flyer|invoice|document|pdf)\b/i],
  },
  {
    agentId: 'lock_in',
    strong: [
      /\b(remind me|reminder|to-?do list|procrastinat|study routine|habit tracker|kaam nahi ho raha|time waste|distraction|mann lag raha|adhura kaam|der ho rahi|time nahi mil raha|focus (mode|timer|session|kar|karo)|pomodoro (timer|session|start|karo|kar|chahiye|banao)|deep work (mode|session|timer|karo))\b/i,
      /(پوموڈورو|فوکس|یاد دلا|یاد دہانی|مصروفیت|ترغیب|وقت|توجہ|کام|منصوبہ)/,
      /\b(pomodoro|focus|remind|reminder|scratchpad|todo|to-do|productivity|motivation|routine|habit|discipline|deep work|study schedule|time management)\b.{0,30}\b(mode|timer|session|me|list|tracker|karo|kar|chahiye|help|start|set|banao)\b|\b(mode|timer|session|list|tracker|karo|kar|chahiye|help|start|set|banao)\b.{0,30}\b(pomodoro|focus|remind|reminder|scratchpad|todo|to-do|productivity|motivation|routine|habit|discipline|deep work|study schedule|time management)\b/i,
    ],
    weak: [/\b(remind|focus|routine|habit|motivation|discipline|schedule|pomodoro|scratchpad|todo|productivity|deep work|time management)\b/i],
  },
  {
    agentId: 'live',
    strong: [
      /\b(weather (in|at|for|today|now|kaisa|kya)|mausam|temperature (in|at|today|now)|forecast (for|today|tomorrow|this week)|rain (in|today|expected)|humid|wind speed|uv index|air quality|aqi|time (in|at|zone)|current time|what time is it|kitne baje|baje kya|currency|exchange rate|usd to|to (usd|pkr|inr|eur|gbp|sar|aed)|[a-z]{3} to [a-z]{3}|stock price|share price|gold rate|silver rate|oil price|live score|news today|latest news|traffic (in|today)|flight status|pollution|sunrise|sunset|gold price|silver price|news (today|aaj|abhi)|live score|match score|score (today|aaj|abhi)|flight (status|today|aaj)|rate (today|abhi|aaj))\b/i,
      /(موسم|بارش|درجہ حرارت|کرنسی|شرح|سونا|چاندی|تیل|خبر|اسکور|فلائٹ|آج کا|ابھی کا|کتنے بجے)/,
      /\b(weather|mausam|barish|temperature|kitne baje|baje|currency|dollar|rupee|bitcoin|crypto|gold|silver|oil)\b.{0,30}\b(today|now|current|latest|rate|price|kya|hai|batao|kitna|kitni|kya hai|btao|btana)\b|\b(today|now|current|latest|rate|price|kya|hai|batao|kitna|kitni|kya hai|btao|btana)\b.{0,30}\b(weather|mausam|barish|temperature|kitne baje|baje|currency|dollar|rupee|bitcoin|crypto|gold|silver|oil)\b/i,
    ],
    weak: [],
  },
];

const STOP = /^(hi+|hello+|salam|assalam|hey+|yo|ok+|okay|thanks?|thank you|shukriya|theek|acha|haan|nahi|ji|yes|no|kya|kia|kaisa|kaisi|theek hai|bye|good ?(morning|night|evening)|kia hal|kya haal|kaise ho|how are you|gm|gn)\b[!.?]*$/i;

const normalize = (text) =>
  text
    .toLowerCase()
    .replace(/[؟?!.,;:!"'`~()\[\]{}<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Returns { agentId, confidence, stage } or null.
 * confidence is 1.0 for strong hits, 0.85 for weak+request hits.
 */
export const matchAgentRules = (message) => {
  if (typeof message !== 'string') return null;
  const text = normalize(message);
  if (text.length < 3) return null;
  if (STOP.test(text)) return null;
  const wantsAction = REQUEST_RE.test(text);
  let weakHit = null;
  for (const agent of AGENTS) {
    for (const re of agent.strong) {
      if (re.test(text)) return { agentId: agent.agentId, confidence: 1, stage: 'rule' };
    }
    if (!weakHit) {
      for (const re of agent.weak) {
        if (re.test(text)) {
          weakHit = agent.agentId;
          break;
        }
      }
    }
  }
  if (weakHit && wantsAction) {
    return { agentId: weakHit, confidence: 0.85, stage: 'rule-weak' };
  }
  return null;
};

export const ROUTER_AGENT_IDS = AGENTS.map((r) => r.agentId);
export const ROUTER_CONFIDENCE_THRESHOLD = 0.7;
