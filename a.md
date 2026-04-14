Gemini Audio API + React Native

- GitHub: https://github.com/OmarThinks/react-native-gemini-live-audio-project
- YouTube: https://www.youtube.com/watch?v=DT9LeR5wvhM

<details>

<summary>ExpressJS Endpoint:</summary>

```js
const { GoogleGenAI, Modality } = require("@google/genai/node");
require("dotenv").config();
const cors = require("cors");
const express = require("express");
const app = express();
const port = 3000; // You can choose any available port

app.use(cors());

// Define a basic route
app.get("/", (req, res) => {
  res.send("Hello, Express!");
});

const client = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY,
  httpOptions: { apiVersion: "v1alpha" },
});

// Models: https://ai.google.dev/gemini-api/docs/live#audio-generation
const models = [
  // Native Audio
  "gemini-2.5-flash-preview-native-audio-dialog",
  "gemini-2.5-flash-exp-native-audio-thinking-dialog",

  // Half cascade audio: (Text that is transcribed, is think)
  "gemini-live-2.5-flash-preview",
  "gemini-2.0-flash-live-001",
];

const model = models[3];

app.get("/session", async (req, res) => {
  const expireTime = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // one hour from now

  const token = await client.authTokens.create({
    config: {
      uses: 10,
      expireTime,
      newSessionExpireTime: expireTime,
      liveConnectConstraints: {
        model,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: "You are a helpful assistant.",
          contextWindowCompression: {
            slidingWindow: {
              targetTokens: "20000",
            },
          },
        },
      },
    },
  });

  // Send back the JSON we received from the OpenAI REST API
  res.send({ token });
});

// Start the server
app.listen(port, () => {
  console.log(`Express app listening at http://localhost:${port}`);
});

const AvailableVoices = [
  { voiceName: "Zephyr", description: "Bright" },
  { voiceName: "Puck", description: "Upbeat" },
  { voiceName: "Charon", description: "Informative" },
  { voiceName: "Kore", description: "Firm" },
  { voiceName: "Fenrir", description: "Excitable" },
  { voiceName: "Leda", description: "Youthful" },
  { voiceName: "Orus", description: "Firm" },
  { voiceName: "Aoede", description: "Breezy" },
  { voiceName: "Callirrhoe", description: "Easy-going" },
  { voiceName: "Autonoe", description: "Bright" },
  { voiceName: "Enceladus", description: "Breathy" },
  { voiceName: "Iapetus", description: "Clear" },
  { voiceName: "Umbriel", description: "Easy-going" },
  { voiceName: "Algieba", description: "Smooth" },
  { voiceName: "Despina", description: "Smooth" },
  { voiceName: "Erinome", description: "Clear" },
  { voiceName: "Algenib", description: "Gravelly" },
  { voiceName: "Rasalgethi", description: "Informative" },
  { voiceName: "Laomedeia", description: "Upbeat" },
  { voiceName: "Achernar", description: "Soft" },
  { voiceName: "Alnilam", description: "Firm" },
  { voiceName: "Schedar", description: "Even" },
  { voiceName: "Gacrux", description: "Mature" },
  { voiceName: "Pulcherrima", description: "Forward" },
  { voiceName: "Achird", description: "Friendly" },
  { voiceName: "Zubenelgenubi", description: "Casual" },
  { voiceName: "Vindemiatrix", description: "Gentle" },
  { voiceName: "Sadachbia", description: "Lively" },
  { voiceName: "Sadaltager", description: "Knowledgeable" },
  { voiceName: "Sulafat", description: "Warm" },
];
```

</details>

<details>

<summary>useGeminiLiveAudio</summary>

```tsx
import {
  type LiveServerMessage,
  type LiveClientMessage,
  type UsageMetadata,
} from "@google/genai";
import { Buffer } from "buffer";
import { useCallback, useEffect, useRef, useState } from "react";

const useGeminiLiveAudio = ({
  onMessageReceived,
  onAudioResponseComplete,
  onUsageReport,
  onReadyToReceiveAudio,
  onSocketClose,
  onSocketError,
}: {
  onMessageReceived: (message: LiveServerMessage) => void;
  onAudioResponseComplete: (base64Audio: string) => void;
  onUsageReport: (usage: UsageMetadata) => void;
  onReadyToReceiveAudio: () => void;
  onSocketClose: (closeEvent: CloseEvent) => void;
  onSocketError?: (error: Event) => void;
}) => {
  const webSocketRef = useRef<null | WebSocket>(null);
  const [isWebSocketConnecting, setIsWebSocketConnecting] = useState(false);
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAiResponseInProgress, setIsAiResponseInProgress] = useState(false);
  const responseQueueRef = useRef<string[]>([]);

  const resetHookState = useCallback(() => {
    webSocketRef.current = null;
    setIsWebSocketConnecting(false);
    setIsWebSocketConnected(false);
    setIsInitialized(false);
    responseQueueRef.current = [];
    setIsAiResponseInProgress(false);
  }, []);

  const connectWebSocket = useCallback(
    async ({ ephemeralKey }: { ephemeralKey: string }) => {
      setIsWebSocketConnecting(true);
      if (webSocketRef.current) {
        return;
      }

      try {
        const urlParams = new URLSearchParams();

        urlParams.append("access_token", ephemeralKey);

        const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?${urlParams.toString()}`;

        const ws = new WebSocket(url);

        ws.addEventListener("open", () => {
          console.log("Connected to server.");
          setIsWebSocketConnected(true);
        });

        ws.addEventListener("close", (closeEvent) => {
          setIsWebSocketConnected(false);
          resetHookState();
          onSocketClose(closeEvent);
        });

        ws.addEventListener("error", (error) => {
          console.error("WebSocket error:", error);
          onSocketError?.(error);
        });

        ws.addEventListener("message", async (event) => {
          //console.log("WebSocket message:", event.data);
          // convert message to an object

          try {
            let text = "";
            let message: LiveServerMessage;

            if (typeof event.data === "string") {
              text = event.data;
              // Text message (React Native default for text)
              // console.log("WebSocket message text:", event.data);
            } else if (event.data instanceof ArrayBuffer) {
              // Binary message
              text = new TextDecoder().decode(event.data);
              //console.log("WebSocket binary as text:", text);
            } else if (event.data instanceof Blob) {
              // Browser Blob case
              text = await event.data.text();
              //console.log("WebSocket blob text:", text);
            } else {
              console.warn(
                "Unknown WebSocket message type:",
                typeof event.data
              );
              return; // Early return for unknown types
            }

            if (!text.trim()) {
              console.warn("Received empty message");
              return;
            }

            message = JSON.parse(text);

            //const message: LiveServerMessage = JSON.parse(text);
            console.log("WebSocket message received:", message);

            onMessageReceived(message);

            if (message.setupComplete) {
              setIsInitialized(true);
              onReadyToReceiveAudio();
            }
            const parts = message?.serverContent?.modelTurn?.parts;

            if (parts) {
              for (const part of parts) {
                const audioChunk = part?.inlineData?.data;
                if (audioChunk) {
                  responseQueueRef.current.push(audioChunk);
                }
              }
            }

            if (message?.serverContent?.modelTurn) {
              setIsAiResponseInProgress(true);
            }

            if (message?.serverContent?.generationComplete) {
              setIsAiResponseInProgress(false);
              const combinedBase64 = combineBase64ArrayList(
                responseQueueRef.current
              );
              responseQueueRef.current = [];
              onAudioResponseComplete(combinedBase64);
            }

            if (message?.usageMetadata) {
              onUsageReport(message.usageMetadata);
            }
          } catch {}
        });

        webSocketRef.current = ws;
      } catch (error) {
        console.error("Error connecting to WebSocket:", error);
      } finally {
        setIsWebSocketConnecting(false);
      }
    },
    [
      onAudioResponseComplete,
      onMessageReceived,
      onReadyToReceiveAudio,
      onSocketClose,
      onSocketError,
      onUsageReport,
      resetHookState,
    ]
  );

  const disconnectSocket = useCallback(() => {
    if (webSocketRef.current) {
      webSocketRef.current.close();
    }
  }, []);

  useEffect(() => {
    return () => {
      console.log("-------------------- I'm disconnecting");
      disconnectSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isWebSocketConnected) {
      console.log("sending server config message", webSocketRef.current);
      const message: LiveClientMessage = {
        setup: {},
      };

      webSocketRef.current?.send(JSON.stringify(message));
    }
  }, [isWebSocketConnected]);

  const sendMessage = useCallback(
    (messageObject: LiveClientMessage) => {
      if (
        webSocketRef.current &&
        webSocketRef.current.readyState === WebSocket.OPEN &&
        isWebSocketConnected &&
        isInitialized
      ) {
        webSocketRef.current.send(JSON.stringify(messageObject));
      }
    },
    [isInitialized, isWebSocketConnected]
  );

  const sendBase64AudioStringChunk = useCallback(
    (base64String: string) => {
      //console.log("Should send message");
      if (webSocketRef.current) {
        //console.log("Should send message");

        const messageToSend: LiveClientMessage = {
          realtimeInput: {
            audio: {
              data: base64String,
              mimeType: "audio/pcm;rate=16000",
            },
          },
        };

        sendMessage(messageToSend);
      }
    },
    [sendMessage]
  );

  return {
    isWebSocketConnected,
    connectWebSocket,
    disconnectSocket,
    isWebSocketConnecting,
    sendBase64AudioStringChunk,
    isInitialized,
    isAiResponseInProgress,
  };
};

const combineBase64ArrayList = (base64Array: string[]): string => {
  const pcmChunks: Uint8Array[] = base64Array.map((base64Text) => {
    if (base64Text) {
      const buf = Buffer.from(base64Text, "base64"); // decode base64 to raw bytes
      const toReturn = new Uint8Array(
        buf.buffer,
        buf.byteOffset,
        buf.byteLength
      );
      return toReturn;
    } else {
      return new Uint8Array();
    }
  });

  // Calculate total length
  const totalLength = pcmChunks.reduce((acc, chunk) => acc + chunk.length, 0);

  // Create one big Uint8Array
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of pcmChunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  // Convert back to base64
  const combinedBase64 = Buffer.from(combined.buffer).toString("base64");

  return combinedBase64;
};

export { combineBase64ArrayList, useGeminiLiveAudio };
```

</details>

<details>

<summary>Example Screen:</summary>

```tsx
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
import {
  combineBase64ArrayList,
  useGeminiLiveAudio,
} from "@/hooks/useGeminiLiveAudio";

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
  } = useGeminiLiveAudio({
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
          `Sending AUdio Chunk. isWebSocketConnected: ${isWebSocketConnected}, isInitialized: ${isInitialized}, isAiResponseInProgress: ${
            isAiResponseInProgressRef.current
          }, isAudioPlayingRef.current: ${isAudioPlayingRef.current}, ${
            chunk.slice(0, 50) + "..."
          }`
        );
        sendBase64AudioStringChunk(chunk);
      }
    },
    [isInitialized, isWebSocketConnected, sendBase64AudioStringChunk]
  );

  const { isStreaming, startStreaming, stopStreaming } = useAudioStreamer({
    sampleRate: 16000, // e.g., 16kHz - // TODO : The documentation doesn't specify the exact requirements for this. It tried 16K and 24K. I think 16k is better.
    interval: 250, // emit every 250 milliseconds
    onAudioReady: onAudioStreamerChunk,
  });

  const playAudioRecorderChunks = useCallback(() => {
    const combined = combineBase64ArrayList(chunks);
    playAudio({ base64Text: combined, sampleRate: 16000 });
  }, [chunks, playAudio]);

  const _connectWebSocket = useCallback(async () => {
    const tokenResponse = await fetch(`${localIpAddress}:3000/session`);
    console.log(tokenResponse);
    const data = await tokenResponse.json();
    console.log(data);

    const EPHEMERAL_KEY = data.token.name;
    console.log(EPHEMERAL_KEY);
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
```

</details>

Thanks a lot! 🌹
