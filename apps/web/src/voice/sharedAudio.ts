// One AudioContext for the whole voice call, so the mic level, AI speech, and
// the call recorder can be mixed in a single graph.
let ctx: AudioContext | null = null;

export const sharedAudioContext = (): AudioContext | null => {
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  return ctx;
};
