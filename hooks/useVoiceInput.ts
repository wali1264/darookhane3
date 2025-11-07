import { useState, useEffect, useRef, useCallback } from 'react';

// Minimal type definitions for the experimental Web Speech API
interface SpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: () => void;
  onend: () => void;
  onerror: (event: { error: string }) => void;
  onresult: (event: any) => void;
  abort: () => void;
  stop: () => void;
  start: () => void;
}
interface SpeechRecognitionStatic {
  new(): SpeechRecognition;
}
declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionStatic;
    webkitSpeechRecognition: SpeechRecognitionStatic;
  }
}

interface UseVoiceInputOptions {
    onTranscript: (transcript: string) => void;
    onStateChange?: (isListening: boolean) => void; // Optional callback for state changes
}

export const useVoiceInput = ({ onTranscript, onStateChange }: UseVoiceInputOptions) => {
    const [isSupported, setIsSupported] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [recognitionLang, setRecognitionLang] = useState<'fa-IR' | 'en-US'>('fa-IR');
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const isListeningRef = useRef(isListening);

    useEffect(() => {
        isListeningRef.current = isListening;
    }, [isListening]);
    
    useEffect(() => {
        onStateChange?.(isListening);
    }, [isListening, onStateChange]);

    useEffect(() => {
        const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognitionAPI) {
            console.warn("Web Speech API is not supported by this browser.");
            setIsSupported(false);
            return;
        }
        setIsSupported(true);

        const recognition = new SpeechRecognitionAPI();
        recognition.lang = recognitionLang; // Set language on creation
        recognition.continuous = true;
        recognition.interimResults = false;

        recognition.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                }
            }
            if (finalTranscript) {
                onTranscript(finalTranscript.trim());
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (event.error !== 'no-speech' && event.error !== 'aborted') {
                setIsListening(false);
            }
        };

        recognition.onend = () => {
            // This now only handles unexpected stops, not intentional language changes
            if (isListeningRef.current) {
                try {
                    recognition.start();
                } catch (e) {
                    console.error("Could not restart recognition:", e);
                    setIsListening(false);
                }
            }
        };
        
        recognitionRef.current = recognition;

        // If we were already listening, start the new recognizer instance immediately
        if (isListening) {
            try {
                recognition.start();
            } catch(e) {
                console.error("Error starting new recognition instance after lang change:", e);
                setIsListening(false);
            }
        }

        return () => {
            // isListeningRef.current = false; // This can cause issues with fast restarts
            if (recognition) {
                recognition.onresult = null;
                recognition.onerror = null;
                recognition.onend = null;
                recognition.stop();
            }
        };
    }, [onTranscript, recognitionLang]); // CRITICAL: Re-run effect when language changes
    
    const toggleListening = useCallback(() => {
        if (!isSupported || !recognitionRef.current) return;
        
        const nextIsListening = !isListening;
        setIsListening(nextIsListening);

        if (nextIsListening) {
            try {
                if (document.activeElement === document.body || document.activeElement === null) {
                    (document.querySelector('input, select, textarea') as HTMLElement)?.focus();
                }
                recognitionRef.current.start();
            } catch (e) {
                console.error("Could not start recognition:", e);
                setIsListening(false);
            }
        } else {
            recognitionRef.current.stop();
        }
    }, [isListening, isSupported]);
    
    const toggleLanguage = useCallback(() => {
        setRecognitionLang(prev => prev === 'fa-IR' ? 'en-US' : 'fa-IR');
    }, []);

    return {
        isListening,
        recognitionLang,
        toggleListening,
        toggleLanguage,
        isSupported
    };
};