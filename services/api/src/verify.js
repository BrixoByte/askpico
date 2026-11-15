const VERIFY_TRIGGER =
  /\d|PKR|Rs\b|USD|\$|€|£|%|price|cost|budget|authorit|regulat|supplier|agenc|ministr|law|certific|market|percent|statistic|trade|import|export|tax/i;

export const REPLY_VERIFY_MAX_LENGTH = 24000;

// A reply is only sent to the checker when it could contain a verifiable
// claim. Fenced code or documents are skipped: their numbers (pixels,
// ports, syntax) are not facts, and rewriting them would corrupt code.
export const shouldVerifyReply = (reply) =>
  typeof reply === 'string' &&
  reply.trim() !== '' &&
  reply.length <= REPLY_VERIFY_MAX_LENGTH &&
  !reply.includes('```') &&
  VERIFY_TRIGGER.test(reply);

export const parseVerificationSpans = (text) => {
  const json = typeof text === 'string' ? text.match(/\{[\s\S]*\}/)?.[0] : null;
  if (!json) return [];
  try {
    const data = JSON.parse(json);
    if (!Array.isArray(data?.ungrounded)) return [];
    return [...new Set(data.ungrounded)]
      .filter((s) => typeof s === 'string' && s.trim().length >= 3 && s.length <= 500)
      .slice(0, 20);
  } catch {
    return [];
  }
};

// Replaces checker-flagged spans with [Verify Local Data]. A span is only
// applied when it appears verbatim in the reply, so hallucinated spans
// from the checker can never corrupt the text.
export const applyVerificationSpans = (reply, spans) => {
  if (typeof reply !== 'string' || !Array.isArray(spans)) {
    return { corrected: typeof reply === 'string' ? reply : '', flagged: 0 };
  }
  let corrected = reply;
  let flagged = 0;
  for (const span of spans) {
    if (corrected.includes(span)) {
      corrected = corrected.split(span).join('[Verify Local Data]');
      flagged += 1;
    }
  }
  if (flagged > 0) {
    corrected = corrected.replace(/(\[Verify Local Data\][,\s]*){2,}/g, '[Verify Local Data] ');
  }
  return { corrected, flagged };
};
