import {
  AudioQuality,
  IOSOutputFormat,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type RecordingOptions,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Microphone capture for spoken input.
 *
 * Wraps the recorder's lifecycle — permission, audio session, prepare, record,
 * stop — behind two calls, because every one of those steps has to happen in
 * order and any of them can fail in a way the user needs told about. The screen
 * gets `start()`, `stop()` and a state to render; it never sees a recorder.
 *
 * The recording itself is not played back or stored: it is uploaded, turned into
 * text, and dropped.
 */

/**
 * Recording settings tuned for speech rather than music.
 *
 * Mono at 16 kHz is what speech recognition actually consumes — a stereo 44.1
 * kHz recording is resampled down to roughly this before anything listens to it,
 * so the extra bytes buy nothing and cost upload time on a phone connection.
 * At 32 kbit/s a spoken question is tens of kilobytes.
 */
const VOICE_RECORDING: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 16_000,
  numberOfChannels: 1,
  bitRate: 32_000,
  android: {
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
  },
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.MEDIUM,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 32_000,
  },
};

/**
 * Content type of what the recorder produces on this platform.
 *
 * Native records AAC in an MP4 container whatever the file is named; the web's
 * MediaRecorder produces WebM. The server accepts both, but it has to be told
 * which one is arriving — a mislabelled container is rejected before the model
 * ever hears it.
 */
const MIME_TYPE = Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4';

/**
 * Longest recording captured, milliseconds.
 *
 * A question is seconds long. The cap is here for the microphone left running
 * in a pocket: it stops the recording rather than letting it grow past what the
 * server will accept, which would otherwise fail only after a long upload.
 */
const MAX_DURATION_MS = 120_000;

export interface VoiceRecording {
  uri: string;
  mimeType: string;
}

export interface VoiceRecorder {
  /** True from the moment capture starts until `stop` resolves. */
  isRecording: boolean;
  /**
   * Why the last attempt failed, ready to show. Cleared when a new one starts.
   */
  error: string | null;
  /** Begins capture. Resolves false when permission was refused or setup failed. */
  start: () => Promise<boolean>;
  /** Ends capture and returns the recording, or null if there is nothing usable. */
  stop: () => Promise<VoiceRecording | null>;
  /** Ends capture and throws the recording away. */
  cancel: () => Promise<void>;
}

export function useVoiceRecorder(): VoiceRecorder {
  const recorder = useAudioRecorder(VOICE_RECORDING);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Held in a ref as well as state: `stop` has to know whether it is stopping
  // anything without being re-created every time the flag flips, which would
  // re-run every effect and callback that depends on it.
  const active = useRef(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLimit = useCallback(() => {
    if (timeout.current) {
      clearTimeout(timeout.current);
      timeout.current = null;
    }
  }, []);

  /** Stops the hardware, whatever state it is in, and settles the flags. */
  const halt = useCallback(async (): Promise<void> => {
    clearLimit();
    active.current = false;
    setIsRecording(false);

    try {
      await recorder.stop();
    } catch {
      // Already stopped, or stopped by the system. Either way there is nothing
      // left to stop, and reporting it would only interrupt the user.
    }
  }, [clearLimit, recorder]);

  // A screen left mid-recording must not leave the microphone open.
  useEffect(() => {
    return () => {
      clearLimit();
      if (active.current) {
        active.current = false;
        void recorder.stop().catch(() => undefined);
      }
    };
  }, [clearLimit, recorder]);

  const start = useCallback(async (): Promise<boolean> => {
    if (active.current) return true;
    setError(null);

    try {
      const existing = await getRecordingPermissionsAsync();
      const permission = existing.granted ? existing : await requestRecordingPermissionsAsync();

      if (!permission.granted) {
        setError(
          permission.canAskAgain
            ? 'Microphone access is needed to ask a question out loud.'
            : 'Microphone access is off. Turn it on for Vital AI in your device settings.',
        );
        return false;
      }

      // iOS routes recording through the audio session, which has to be told
      // that recording is what is about to happen — and that it should work with
      // the ringer switch off, since a user on mute still expects to be heard.
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });

      await recorder.prepareToRecordAsync();
      recorder.record();

      active.current = true;
      setIsRecording(true);
      timeout.current = setTimeout(() => {
        void halt();
      }, MAX_DURATION_MS);

      return true;
    } catch (cause) {
      await halt();
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : 'The microphone could not be started. Please try again.',
      );
      return false;
    }
  }, [halt, recorder]);

  const stop = useCallback(async (): Promise<VoiceRecording | null> => {
    if (!active.current) return null;

    await halt();

    // Reading the uri after `stop` resolves is what guarantees the file is
    // closed and complete — read any earlier and the upload can carry a
    // truncated recording.
    const uri = recorder.uri;
    if (!uri) {
      setError('That recording was empty. Please try again.');
      return null;
    }

    return { uri, mimeType: MIME_TYPE };
  }, [halt, recorder]);

  const cancel = useCallback(async (): Promise<void> => {
    if (!active.current) return;
    await halt();
    setError(null);
  }, [halt]);

  return { isRecording, error, start, stop, cancel };
}
