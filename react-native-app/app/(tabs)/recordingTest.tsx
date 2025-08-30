import { combineBase64ArrayList } from "@/hooks/ai/useOpenAiRealTimeHook";
import { useBase64PcmAudioPlayer } from "@/hooks/audio/useBase64PcmAudioPlayer";
import React, { useCallback, useState } from "react";
import { Button, View } from "react-native";
import { AudioBuffer } from "react-native-audio-api";
import { convertAudioBufferToBase64 } from ".";
import { useAudioStreamer } from "@/hooks/audio/useAudioStreamer";

const RecordingTest = () => {
  const [base64Strings, setBase64Strings] = useState<string[]>([]);

  const onAudioReady = useCallback((audioBuffer: AudioBuffer) => {
    setBase64Strings((prev) => [
      ...prev,
      convertAudioBufferToBase64(audioBuffer),
    ]);
  }, []);

  const {
    isStreaming: isRecording,
    startStreaming: startRecording,
    stopStreaming: stopRecording,
  } = useAudioStreamer({
    sampleRate: 24000,
    onAudioReady,
    interval: 250,
  });

  const _startRecording = () => {
    setBase64Strings([]);
    startRecording();
  };

  const { playPcmBase64Audio } = useBase64PcmAudioPlayer({
    coolingDuration: 0,
    sampleRate: 24000,
  });

  return (
    <View className=" self-stretch flex-1 justify-center">
      <Button
        title={isRecording ? "Stop Recording" : "Start Recording"}
        onPress={isRecording ? stopRecording : _startRecording}
      />

      <Button
        title="Play array"
        onPress={() => {
          const combined = combineBase64ArrayList(base64Strings);
          playPcmBase64Audio({ base64String: combined });
        }}
      />
    </View>
  );
};

export default RecordingTest;
