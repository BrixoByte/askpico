import { useCallback, useEffect, useRef, useState } from 'react';
import { speechRecognitionSupported } from '@utils/speech';

type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionResultEvent = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string };
    };
  };
};

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Microphone access denied. Allow mic permission in your browser settings.',
  'service-not-allowed': 'Microphone access denied. Allow mic permission in your browser settings.',
  'audio-capture': 'No microphone found. Connect a mic and try again.',
  network: 'Speech recognition needs a connection. Check your network.',
  'no-speech': 'No speech detected. Try again.',
};

interface UseSpeechRecognitionOptions {
  onFinal: (text: string) => void;
  onError?: (message: string) => void;
  onEnd?: () => void;
}

// Voice Step 1: mic → text into the composer. Callers decide via onEnd
// whether the transcript is inserted only or auto-sent.
const useSpeechRecognition = ({ onFinal, onError, onEnd }: UseSpeechRecognitionOptions) => {
  const supported = speechRecognitionSupported();
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const callbacksRef = useRef({ onFinal, onError, onEnd });
  callbacksRef.current = { onFinal, onError, onEnd };

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    if (!supported || recognitionRef.current) return;
    const Ctor =
      (window as { SpeechRecognition?: new () => SpeechRecognitionInstance }).SpeechRecognition ??
      (window as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance })
        .webkitSpeechRecognition;
    if (!Ctor) return;

    const rec = new Ctor();
    rec.interimResults = true;
    rec.continuous = false;

    rec.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) finalText += transcript;
        else interimText += transcript;
      }
      setInterim(interimText);
      if (finalText.trim() !== '') callbacksRef.current.onFinal(finalText.trim());
    };

    rec.onerror = (event) => {
      const key = event.error ?? '';
      const message = ERROR_MESSAGES[key];
      if (message) callbacksRef.current.onError?.(message);
    };

    rec.onend = () => {
      recognitionRef.current = null;
      setListening(false);
      setInterim('');
      callbacksRef.current.onEnd?.();
    };

    recognitionRef.current = rec;
    setListening(true);
    setInterim('');
    try {
      rec.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
    }
  }, [supported]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  useEffect(
    () => () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    },
    []
  );

  return { supported, listening, interim, start, stop, toggle };
};

export default useSpeechRecognition;
