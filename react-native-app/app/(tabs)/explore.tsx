import { Button, View } from "react-native";
import { dummyMessages } from "@/samples/dummyMessages";
import { useAudioBufferQueue } from "@/hooks/audio/useAudioBufferQueue";
import { AudioContext } from "react-native-audio-api";
import { dummyAudioChunks } from "@/samples/dummyAudioChuncks";
import { useBase64PcmAudioPlayer } from "@/hooks/audio/useBase64PcmAudioPlayer";
import { combineBase64ArrayList } from ".";

export default function TabTwoScreen() {
  const {
    enqueueAudioBufferQueue,
    isAudioPlaying,
    playAudio,
    stopPlayingAudio,
  } = useAudioBufferQueue({ sampleRate: 24000 });

  const { playPcmBase64Audio } = useBase64PcmAudioPlayer({
    sampleRate: 24000,
    coolingDuration: 0,
  });

  return (
    <View className=" self-stretch flex-1 justify-center items-stretch">
      <Button
        title="Test"
        onPress={async () => {
          for (const message of dummyMessages) {
            const audioContext = new AudioContext({ sampleRate: 24000 });
            if (message.type === "response.audio.delta") {
              const pcmText = message.delta!;
              const audioBuffer =
                await audioContext.decodePCMInBase64Data(pcmText);
              enqueueAudioBufferQueue(audioBuffer);
            }
          }

          playAudio();
        }}
      />

      <Button
        title="Play Combined"
        onPress={async () => {
          const combined = combineBase64ArrayList(dummyAudioChunks);
          playPcmBase64Audio({ base64String: combined });
        }}
      />

      <Button
        title="Play dummy Chuncks"
        onPress={async () => {
          const audioContext = new AudioContext({ sampleRate: 24000 });

          for (const chunck of dummyAudioChunks) {
            const audioBuffer =
              await audioContext.decodePCMInBase64Data(chunck);
            const bufferId = enqueueAudioBufferQueue(audioBuffer);
            console.log("enqueued buffer: ", bufferId);
          }

          playAudio();
        }}
      />

      <Button
        title="Play single Chunck"
        onPress={async () => {
          const audioContext = new AudioContext({ sampleRate: 24000 });

          const audioBuffer = await audioContext.decodePCMInBase64Data(
            dummyAudioChunks[7]
          );
          enqueueAudioBufferQueue(audioBuffer);

          playAudio();
        }}
      />
    </View>
  );
}
