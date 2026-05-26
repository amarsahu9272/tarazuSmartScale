export interface VoiceResult {
  transcript: string;
  numbers: number[];
}

export function isSpeechSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  return !!SpeechRecognition;
}

export function startSpeechListening(
  lang: 'en' | 'hi',
  onResult: (result: VoiceResult) => void,
  onError: (error: string) => void,
  onEnd: () => void
): any {
  if (!isSpeechSupported()) {
    onError('Speech recognition not supported');
    onEnd();
    return null;
  }

  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const recognition = new SpeechRecognition();

  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = lang === 'hi' ? 'hi-IN' : 'en-US';

  recognition.onresult = (event: any) => {
    const transcript = event.results[0][0].transcript || '';
    
    // Parse numbers from transcription text
    // E.g., "price 80" -> matches [80]
    // Note: Google voice engine usually transcribes digits directly (e.g. 50 or 120) instead of words even if spoken.
    const numberRegex = /\d+(?:\.\d+)?/g;
    const matches = transcript.match(numberRegex);
    const numbers: number[] = [];
    
    if (matches) {
      matches.forEach((m: string) => {
        const val = parseFloat(m);
        if (!isNaN(val)) {
          numbers.push(val);
        }
      });
    }

    onResult({
      transcript,
      numbers,
    });
  };

  recognition.onerror = (event: any) => {
    onError(event.error || 'Speech sensing failed');
  };

  recognition.onend = () => {
    onEnd();
  };

  recognition.start();
  return recognition;
}
