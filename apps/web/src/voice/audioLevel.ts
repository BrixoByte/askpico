import type { VoicePhase } from '@store/voice-store';
import { getOutputAnalyser } from './tts';
import { sharedAudioContext } from './sharedAudio';
import { PicoLogger } from '@utils/logger';

let micStream: MediaStream | null = null;
let micSource: MediaStreamAudioSourceNode | null = null;
let micAnalyser: AnalyserNode | null = null;
let wanted = false;
let starting = false;

export const startMicLevel = async (): Promise<void> => {
  wanted = true;
  if (micAnalyser || starting || !navigator.mediaDevices?.getUserMedia) return;
  starting = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const ctx = sharedAudioContext();
    if (!wanted || !ctx) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    micSource = ctx.createMediaStreamSource(stream);
    micSource.connect(analyser);
    micStream = stream;
    micAnalyser = analyser;
  } catch (error) {
    PicoLogger.error('MicLevel', 'Mic level monitor failed to start (getUserMedia)', error);
    micAnalyser = null;
  } finally {
    starting = false;
  }
};

export const stopMicLevel = (): void => {
  wanted = false;
  micStream?.getTracks().forEach((track) => track.stop());
  micSource?.disconnect();
  micSource = null;
  micStream = null;
  micAnalyser = null;
};

export const currentMicStream = (): MediaStream | null => micStream;

export const currentLevel = (phase: VoicePhase): number => {
  const analyser =
    phase === 'speaking' ? getOutputAnalyser() : phase === 'listening' ? micAnalyser : null;
  if (!analyser) return -1;
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  return sum / data.length / 255;
};
