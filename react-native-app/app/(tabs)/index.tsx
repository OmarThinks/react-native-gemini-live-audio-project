import {
  combineBase64ArrayList,
  useOpenAiRealTime,
} from "@/hooks/ai/useOpenAiRealTimeHook";
import { dummyBase64Audio24K } from "@/samples/dummyBase64Audio";
import { requestRecordingPermissionsAsync } from "expo-audio";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Text, View } from "react-native";
import {
  AudioBuffer,
  AudioBufferSourceNode,
  AudioContext,
  AudioRecorder,
} from "react-native-audio-api";
import { SafeAreaView } from "react-native-safe-area-context";

// TODO: Replace with your internal ip address
const localIpAddress = "http://192.168.8.103";

const New = () => {
  const [messages, setMessages] = useState<object[]>([]);
  const isAudioPlayingRef = useRef(false);
  const isAiResponseInProgressRef = useRef(false);

  const onIsAudioPlayingUpdate = useCallback((playing: boolean) => {
    isAudioPlayingRef.current = playing;
  }, []);

  const { isAudioPlaying, playAudio, stopPlayingAudio } = useAudioPlayer({
    onIsAudioPlayingUpdate,
  });

  const enqueueMessage = useCallback((message: object) => {
    console.log("Got response chunk");
    setMessages((prevMessages) => [...prevMessages, message]);
  }, []);

  const onAudioResponseComplete = useCallback(
    (base64String: string) => {
      console.log("Playing full response");
      playAudio({
        sampleRate: 24000,
        base64Text: base64String,
      });
    },
    [playAudio]
  );

  const onUsageReport = useCallback((usage: object) => {
    console.log("Usage report:", usage);
  }, []);

  const onSocketClose = useCallback(
    (closeEvent: CloseEvent) => {
      console.log("onSocketClose", closeEvent);
      //stopStreaming();
      stopPlayingAudio();
    },
    [stopPlayingAudio]
  );

  const onReadyToReceiveAudio = useCallback(() => {
    //startStreaming();
  }, []);

  const {
    isWebSocketConnected,
    connectWebSocket,
    disconnectSocket,
    isWebSocketConnecting,
    sendBase64AudioStringChunk,
    isAiResponseInProgress,
    isInitialized,
    transcription,
  } = useOpenAiRealTime({
    instructions: "You are a helpful assistant.",
    onMessageReceived: enqueueMessage,
    onAudioResponseComplete,
    onUsageReport,
    onSocketClose,
    onReadyToReceiveAudio,
  });

  const ping = useCallback(() => {
    sendBase64AudioStringChunk(dummyBase64Audio24K);
  }, [sendBase64AudioStringChunk]);

  const [chunks, setChunks] = useState<string[]>([]);

  //console.log("before onAudioStreamerChunk: ", isAiResponseInProgress);

  const onAudioStreamerChunk = useCallback(
    (audioBuffer: AudioBuffer) => {
      const chunk = convertAudioBufferToBase64(audioBuffer);
      setChunks((prev) => [...prev, chunk]);

      if (
        isWebSocketConnected &&
        isInitialized &&
        !isAiResponseInProgressRef.current &&
        !isAudioPlayingRef.current
      ) {
        console.log(
          `Sending AUdio Chunk. isWebSocketConnected: ${isWebSocketConnected}, isInitialized: ${isInitialized}, isAiResponseInProgress: ${isAiResponseInProgressRef.current}, isAudioPlayingRef.current: ${isAudioPlayingRef.current}, ${chunk.slice(0, 50) + "..."}`
        );
        sendBase64AudioStringChunk(chunk);
      }
    },
    [isInitialized, isWebSocketConnected, sendBase64AudioStringChunk]
  );

  const { isStreaming, startStreaming, stopStreaming } = useAudioStreamer({
    sampleRate: 24000, // e.g., 16kHz - // TODO : The documentation doesn't specify the exact requirements for this. It tried 16K and 24K. I think 16k is better.
    interval: 250, // emit every 250 milliseconds
    onAudioReady: onAudioStreamerChunk,
  });

  const playAudioRecorderChunks = useCallback(() => {
    const combined = combineBase64ArrayList(chunks);
    playAudio({ base64Text: combined, sampleRate: 16000 });
  }, [chunks, playAudio]);

  const _connectWebSocket = useCallback(async () => {
    const tokenResponse = await fetch(`${localIpAddress}:3000/session`);
    const data = await tokenResponse.json();
    const EPHEMERAL_KEY = data.client_secret.value;
    connectWebSocket({ ephemeralKey: EPHEMERAL_KEY });
  }, [connectWebSocket]);

  useEffect(() => {
    if (isWebSocketConnected) {
      if (isInitialized) {
        console.log("Starting audio streaming");
        startStreaming();
      }
    } else {
      console.log("Stopping audio streaming");
      stopStreaming();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWebSocketConnected, isInitialized]);

  useEffect(() => {
    isAiResponseInProgressRef.current = isAiResponseInProgress;
  }, [isAiResponseInProgress]);

  return (
    <SafeAreaView
      className=" self-stretch flex-1"
      edges={["top", "left", "right"]}
    >
      <View className=" self-stretch flex-1">
        <View
          className=" self-stretch flex-1"
          style={{
            backgroundColor: "black",
            gap: 16,
            display: "flex",
            flexDirection: "column",
            padding: 16,
          }}
        >
          <View>
            <Button
              onPress={() => {
                playAudio({
                  base64Text: dummyBase64Audio24K,
                  sampleRate: 24000,
                });
              }}
              title="Play 24K string"
            />
          </View>
          <View>
            {isWebSocketConnected && <Button onPress={ping} title="Ping" />}
            {isWebSocketConnecting ? (
              <Text style={{ color: "white", fontSize: 32 }}>
                Connecting...
              </Text>
            ) : isWebSocketConnected ? (
              <Button onPress={disconnectSocket} title="disconnectSocket" />
            ) : (
              <Button onPress={_connectWebSocket} title="connectWebSocket" />
            )}

            <Button
              onPress={() => {
                console.log("Log Messages:", messages);
              }}
              title="Log Messages"
            />
          </View>
          <HR />

          <View>
            <Text
              style={{ color: "white", fontSize: 32 }}
              className=" text-[30px] font-bold"
            >
              Transcription:
            </Text>
            <Text style={{ color: "white", fontSize: 32 }}>
              {transcription}
            </Text>
          </View>

          <HR />

          <View className=" flex-row flex items-center">
            <Text style={{ color: "white", fontSize: 32 }}>
              Is audio Playing: {isAudioPlaying ? "Yes" : "No"}
            </Text>

            {isAudioPlaying && (
              <Button onPress={stopPlayingAudio} title="Stop Playing" />
            )}
          </View>

          <HR />

          <View className=" flex flex-row items-center gap-2">
            {!isStreaming && (
              <Button
                onPress={() => {
                  setChunks([]);
                  startStreaming();
                }}
                title="Start Streaming"
              />
            )}
            {isStreaming && (
              <Button onPress={stopStreaming} title="Stop Streaming" />
            )}
            {!isStreaming && chunks.length > 0 && (
              <Button onPress={playAudioRecorderChunks} title="Play Stream" />
            )}
          </View>
          <Text style={{ color: "white", fontSize: 32 }}>
            Is Streaming: {isStreaming ? "Yes" : "No"}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const HR = memo(function HR_() {
  return <View className=" self-stretch bg-white h-[2px] " />;
});

const useAudioPlayer = ({
  onIsAudioPlayingUpdate,
}: {
  onIsAudioPlayingUpdate: (playing: boolean) => void;
}) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  const updateIsAudioPlaying = useCallback(
    (newValue: boolean) => {
      setIsAudioPlaying(newValue);
      onIsAudioPlayingUpdate(newValue);
    },
    [onIsAudioPlayingUpdate]
  );

  const cleanUp = useCallback(() => {
    updateIsAudioPlaying(false);
    try {
      audioBufferSourceNodeRef.current?.stop?.();
    } catch {}
    audioBufferSourceNodeRef.current = null;
  }, [updateIsAudioPlaying]);

  const playAudio = useCallback(
    async ({
      base64Text,
      sampleRate,
    }: {
      sampleRate: number;
      base64Text: string;
    }) => {
      const audioContext = new AudioContext({ sampleRate });
      const audioBuffer = await audioContext.decodePCMInBase64Data(base64Text);

      const audioBufferSourceNode = audioContext.createBufferSource();
      audioBufferSourceNode.connect(audioContext.destination);

      audioBufferSourceNode.buffer = audioBuffer;
      updateIsAudioPlaying(true);
      audioBufferSourceNode.onEnded = () => {
        cleanUp();
      };
      audioBufferSourceNode.start();

      audioBufferSourceNodeRef.current = audioBufferSourceNode;
      audioContextRef.current = audioContext;
    },
    [cleanUp, updateIsAudioPlaying]
  );
  const stopPlayingAudio = useCallback(() => {
    audioBufferSourceNodeRef.current?.stop?.();
  }, []);

  return {
    isAudioPlaying,
    playAudio,
    stopPlayingAudio,
  };
};

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

const convertAudioBufferToBase64 = (audioBuffer: AudioBuffer) => {
  const float32Array = audioBuffer.getChannelData(0);

  // Convert Float32Array to 16-bit PCM
  const pcmData = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    // Convert float32 (-1 to 1) to int16 (-32768 to 32767)
    const sample = Math.max(-1, Math.min(1, float32Array[i]));
    pcmData[i] = Math.round(sample * 32767);
  }

  // Convert to bytes
  const bytes = new Uint8Array(pcmData.buffer);

  // Convert to base64
  let binary = "";
  const chunkSize = 0x8000; // 32KB chunks to avoid call stack limits
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }

  const base64String = btoa(binary);

  return base64String;
};

export default New;
export {
  convertAudioBufferToBase64,
  combineBase64ArrayList,
  useAudioPlayer,
  useAudioStreamer,
};
