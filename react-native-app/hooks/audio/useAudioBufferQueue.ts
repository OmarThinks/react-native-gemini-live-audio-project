import { useCallback, useEffect, useRef, useState } from "react";
import {
  AudioBuffer,
  AudioBufferQueueSourceNode,
  AudioContext,
} from "react-native-audio-api";

const useAudioBufferQueue = ({ sampleRate }: { sampleRate: number }) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferQueueRef = useRef<AudioBufferQueueSourceNode | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const isAudioPlayingRef = useRef(false);

  const updateIsAudioPlaying = useCallback((newIsAudioPlaying: boolean) => {
    setIsAudioPlaying(newIsAudioPlaying);
    isAudioPlayingRef.current = newIsAudioPlaying;
  }, []);

  const lastBufferIdRef = useRef("");

  const resetState = useCallback(() => {
    console.log("reset is triggered");
    updateIsAudioPlaying(false);
    lastBufferIdRef.current = "";
    try {
      //audioBufferQueueRef.current?.stop?.();
      //audioBufferQueueRef.current?.clearBuffers?.();
    } catch {}
  }, [updateIsAudioPlaying]);

  useEffect(() => {
    resetState();
    const audioContext = new AudioContext({ sampleRate });
    const audioBufferQueue = audioContext.createBufferQueueSource();
    audioBufferQueue.connect(audioContext.destination);

    audioContextRef.current = audioContext;
    audioBufferQueueRef.current = audioBufferQueue;

    return resetState;
  }, [resetState, sampleRate]);

  const playAudio = useCallback(() => {
    if (audioBufferQueueRef.current && lastBufferIdRef.current) {
      audioBufferQueueRef.current.start();
      updateIsAudioPlaying(true);
      console.log("I should start palying audio now");
      audioBufferQueueRef.current.onEnded = (event) => {
        console.log("onEnded", event);
        const { bufferId } = event;
        if (bufferId === lastBufferIdRef.current) {
          resetState();
        }
      };
    }
  }, [resetState, updateIsAudioPlaying]);

  const enqueueAudioBufferQueue = useCallback((audioBuffer: AudioBuffer) => {
    const bufferId = audioBufferQueueRef.current?.enqueueBuffer(audioBuffer);
    console.log("enqueuedBufferId", bufferId);
    if (bufferId) {
      lastBufferIdRef.current = bufferId;
    }
    if (!isAudioPlayingRef.current) {
      //playAudio();
    }
    return bufferId;
  }, []);

  return {
    isAudioPlaying,
    enqueueAudioBufferQueue,
    stopPlayingAudio: resetState,
    playAudio,
  };
};

export { useAudioBufferQueue };
