let speaking = false;

export function speak(text: string): void {
  const synth = window.speechSynthesis;
  if (!synth || speaking) return;
  speaking = true;
  window.dispatchEvent(new CustomEvent("voiceStart"));

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.onend = () => {
    speaking = false;
    window.dispatchEvent(new CustomEvent("voiceEnd"));
  };
  utterance.onerror = () => {
    speaking = false;
    window.dispatchEvent(new CustomEvent("voiceEnd"));
  };
  synth.speak(utterance);
}

export function stop(): void {
  window.speechSynthesis?.cancel();
  speaking = false;
  window.dispatchEvent(new CustomEvent("voiceEnd"));
}

export function isSpeaking(): boolean {
  return speaking;
}
