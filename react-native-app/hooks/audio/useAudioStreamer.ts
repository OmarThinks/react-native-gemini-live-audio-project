import { requestRecordingPermissionsAsync } from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import {
  AudioBuffer,
  AudioContext,
  AudioRecorder,
} from "react-native-audio-api";

const useAudioStreamer = ({
  sampleRate,
  interval,
  onAudioReady,
}: {
  sampleRate: number;
  interval: number;
  onAudioReady: (audioBuffer: AudioBuffer) => void;
}) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const resetState = useCallback(() => {
    setIsStreaming(false);
    try {
      audioRecorderRef.current?.stop?.();
    } catch {}
  }, []);

  useEffect(() => {
    return resetState;
  }, [resetState]);

  const startStreaming = useCallback(async () => {
    const permissionResult = await requestRecordingPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permission Error", "Audio recording permission is required");
      return;
    }

    const audioContext = new AudioContext({ sampleRate });
    const audioRecorder = new AudioRecorder({
      sampleRate: sampleRate,
      bufferLengthInSamples: (sampleRate * interval) / 1000,
    });

    const recorderAdapterNode = audioContext.createRecorderAdapter();

    audioRecorder.connect(recorderAdapterNode);

    audioRecorder.onAudioReady((event) => {
      const { buffer } = event;

      onAudioReady(buffer);
    });
    audioRecorder.start();
    setIsStreaming(true);

    audioContextRef.current = audioContext;
    audioRecorderRef.current = audioRecorder;
  }, [interval, onAudioReady, sampleRate]);

  return {
    isStreaming,
    startStreaming,
    stopStreaming: resetState,
  };
};

export { useAudioStreamer };
