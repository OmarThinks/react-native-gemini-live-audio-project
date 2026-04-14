import { useCallback, useEffect, useRef, useState } from "react";
import { AudioBufferSourceNode, AudioContext } from "react-native-audio-api";

const useBase64PcmAudioPlayer = ({
  sampleRate,
  coolingDuration,
}: {
  sampleRate: number;
  coolingDuration: number;
}) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isAudioPlayingSafe, setIsAudioPlayingSafe] = useState(false);

  const cleanUp = useCallback(() => {
    setIsAudioPlaying(false);
    setTimeout(() => {
      setIsAudioPlayingSafe(false);
    }, coolingDuration);

    try {
      audioBufferSourceNodeRef.current?.stop?.();
    } catch {}
    audioBufferSourceNodeRef.current = null;
  }, [coolingDuration]);

  useEffect(() => {
    cleanUp();

    const audioContext = new AudioContext({ sampleRate });
    audioContextRef.current = audioContext;

    return () => {
      cleanUp();
    };
  }, [cleanUp, sampleRate]);

  const playPcmBase64Audio = useCallback(
    async ({ base64String }: { base64String: string }) => {
      if (audioContextRef.current) {
        const audioBuffer =
          await audioContextRef.current?.decodePCMInBase64Data(base64String);

        const audioBufferSourceNode =
          audioContextRef.current.createBufferSource();
        audioBufferSourceNode.connect(audioContextRef.current.destination);

        audioBufferSourceNode.buffer = audioBuffer;
        setIsAudioPlaying(true);
        setIsAudioPlayingSafe(true);
        audioBufferSourceNode.onEnded = () => {
          cleanUp();
        };
        audioBufferSourceNode.start();
        audioBufferSourceNodeRef.current = audioBufferSourceNode;
      }
    },
    [cleanUp]
  );

  return {
    isAudioPlaying,
    playPcmBase64Audio,
    stopPlayingAudio: cleanUp,
    isAudioPlayingSafe,
  };
};

export { useBase64PcmAudioPlayer };
