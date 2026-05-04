import { audioPlayer } from "../audio/AudioPlayer";

let speaking = false;

export function speak(text: string): void {
  const synth = window.speechSynthesis;
  if (!synth || speaking) return;
  speaking = true;

  // Duck music volume
  audioPlayer.duck(0.2, 300);

  // Dispatch event with text for overlay
  window.dispatchEvent(new CustomEvent("voiceStart", { detail: { text } }));

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.onend = () => {
    speaking = false;
    audioPlayer.unduck(600);
    window.dispatchEvent(new CustomEvent("voiceEnd"));
  };
  utterance.onerror = () => {
    speaking = false;
    audioPlayer.unduck(600);
    window.dispatchEvent(new CustomEvent("voiceEnd"));
  };
  synth.speak(utterance);
}

export function stop(): void {
  window.speechSynthesis?.cancel();
  speaking = false;
  audioPlayer.unduck(600);
  window.dispatchEvent(new CustomEvent("voiceEnd"));
}

export function isSpeaking(): boolean {
  return speaking;
}
