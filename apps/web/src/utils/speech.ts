// Web Speech API is not available on Firefox and some webviews —
// hide voice controls there until a supported fallback exists.
// (The Android PicoBridge path is checked separately in voice/stt.ts.)
export const speechRecognitionSupported = (): boolean =>
  typeof window !== 'undefined' &&
  ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
