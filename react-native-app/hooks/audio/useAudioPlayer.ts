import { useCallback, useRef, useState } from "react";
import { AudioContext, AudioBufferSourceNode } from "react-native-audio-api";

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

export { useAudioPlayer };
