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
          const text = await event.data.text();
          const message: LiveServerMessage = JSON.parse(text);
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

          if (message?.serverContent) {
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
