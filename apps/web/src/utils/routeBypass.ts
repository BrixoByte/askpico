// One-shot flag: the next submit skips /api/agent/route and goes straight to
// core chat ("Answer with core chat instead" on a routed reply).
let bypass = false;

export const setRouteBypass = (value: boolean) => {
  bypass = value;
};

export const consumeRouteBypass = () => {
  const value = bypass;
  bypass = false;
  return value;
};
