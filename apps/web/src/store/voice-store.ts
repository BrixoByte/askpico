import { create } from 'zustand';

export type VoicePhase = 'idle' | 'listening' | 'thinking' | 'speaking';

export type SttLang = 'auto' | 'en-US' | 'ur-PK' | 'hi-IN';

interface VoiceState {
  // Voice mode (Step 6 loop) on/off — toggled from the composer.
  voiceMode: boolean;
  phase: VoicePhase;
  // Live interim transcript while listening (for the UI indicator).
  interim: string;
  // Last user-facing voice error, cleared on next successful start.
  error: string | null;
  // True when the platform has no speech recognition at all — UI shows the
  // typed fallback note instead of the mic button.
  sttSupported: boolean;
  // Set by the voice session right before submitting a spoken turn so
  // useSubmit tags the request as 'voice' for backend routing.
  pendingVoiceTurn: boolean;
  // Speech-recognition language. 'auto' follows the browser locale; an
  // explicit value fixes transcripts when the user speaks another language
  // (e.g. Urdu speech into an en-US recognizer comes out garbled).
  sttLang: SttLang;
  voiceHome: boolean;
  voiceThreadId: string | null;
  // Call controls: held = mic keeps listening but speech is ignored; aiMuted =
  // AI replies stay as text but are not spoken; recording = call is being saved.
  held: boolean;
  aiMuted: boolean;
  recording: boolean;
  callStartedAt: number | null;
  // Bumped when the chat reply stream ends, so the session can speak the final sentence at once.
  replyStreamDone: number;
  markReplyStreamDone: () => void;
  setHeld: (held: boolean) => void;
  setAiMuted: (aiMuted: boolean) => void;
  setRecording: (recording: boolean) => void;
  setVoiceMode: (on: boolean) => void;
  setPhase: (phase: VoicePhase) => void;
  setInterim: (text: string) => void;
  setError: (message: string | null) => void;
  setSttSupported: (supported: boolean) => void;
  setPendingVoiceTurn: (pending: boolean) => void;
  setSttLang: (lang: SttLang) => void;
  setVoiceThreadId: (id: string | null) => void;
  exitVoiceHome: () => void;
  enterVoiceHome: (threadId: string | null) => void;
}

const storedSttLang = (): SttLang => {
  const value = localStorage.getItem('pico-stt-lang');
  return value === 'en-US' || value === 'ur-PK' || value === 'hi-IN' ? value : 'auto';
};

const storedUserMode = (): 'voice' | 'chat' =>
  localStorage.getItem('pico_user_mode') === 'chat' ? 'chat' : 'voice';

const persistUserMode = (mode: 'voice' | 'chat') => localStorage.setItem('pico_user_mode', mode);

const useVoiceStore = create<VoiceState>((set) => ({
  voiceMode: false,
  sttLang: storedSttLang(),
  voiceHome: storedUserMode() === 'voice',
  voiceThreadId: null,
  held: false,
  aiMuted: false,
  recording: false,
  callStartedAt: null,
  replyStreamDone: 0,
  markReplyStreamDone: () => set((state) => ({ replyStreamDone: state.replyStreamDone + 1 })),
  phase: 'idle',
  interim: '',
  error: null,
  sttSupported: false,
  pendingVoiceTurn: false,
  setVoiceMode: (voiceMode) => set({ voiceMode, phase: voiceMode ? 'listening' : 'idle', interim: '', error: null, pendingVoiceTurn: false, held: false, aiMuted: false, callStartedAt: voiceMode ? Date.now() : null }),
  setPhase: (phase) => set({ phase }),
  setInterim: (interim) => set({ interim }),
  setError: (error) => set({ error }),
  setSttSupported: (sttSupported) => set({ sttSupported }),
  setPendingVoiceTurn: (pendingVoiceTurn) => set({ pendingVoiceTurn }),
  setSttLang: (sttLang) => {
    localStorage.setItem('pico-stt-lang', sttLang);
    set({ sttLang });
  },
  setVoiceThreadId: (voiceThreadId) => set({ voiceThreadId }),
  setHeld: (held) => set({ held }),
  setAiMuted: (aiMuted) => set({ aiMuted }),
  setRecording: (recording) => set({ recording }),
  exitVoiceHome: () => {
    persistUserMode('chat');
    set({ voiceHome: false, voiceMode: false, phase: 'idle', interim: '', error: null, pendingVoiceTurn: false, held: false, aiMuted: false, callStartedAt: null });
  },
  enterVoiceHome: (threadId) => {
    persistUserMode('voice');
    set({ voiceHome: true, voiceThreadId: threadId, voiceMode: true, phase: 'listening', interim: '', error: null, pendingVoiceTurn: false, held: false, aiMuted: false, callStartedAt: Date.now() });
  },
}));

export default useVoiceStore;
