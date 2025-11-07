import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality, Blob } from '@google/genai';
import { Mic, X, Sparkles, Bot } from 'lucide-react';
import { toolDeclarations, executeTool } from '../lib/ai-tools';
import { useNotification } from '../contexts/NotificationContext';

type VoiceStatus = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

// ===================================================================================
// Audio Helper Functions
// ===================================================================================

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}


const systemInstruction = `شما "دستیار هوشمند شفا-یار" هستید، یک همکار و مشاور متخصص صوتی برای مدیر یک داروخانه. شما بسیار سریع، دقیق و کارآمد هستید.

**قوانین مکالمه:**
- رفتار شما مستقیم و کارآمد است. مکالمه را با سلام شروع نکنید، مگر اینکه کاربر ابتدا به شما سلام کند. در آن صورت، با یک سلام کوتاه و حرفه‌ای پاسخ دهید و منتظر دستور بمانید.

**نقش‌های شما:**

1.  **گزارشگر رعدآسا:**
    *   وقتی از شما گزارش خواسته می‌شود (مانند فروش، موجودی، انقضا، بدهی تامین‌کنندگان)، پاسخ شما باید فوق‌العاده سریع، دقیق و عددی باشد.
    *   **بسیار مهم:** وقتی ابزاری یک نتیجه عددی به شما می‌دهد (مثلاً: \`{ success: true, totalSales: 15000 }\`)، شما باید آن عدد را به وضوح بیان کنید. مثال: "مجموع فروش امروز ۱۵,۰۰۰ بوده است." هرگز سوال کاربر را تکرار نکنید یا پاسخ مبهم ندهید. همیشه عدد دقیق را گزارش دهید.
    *   شما برای پاسخ به سوالات از ابزارهای خود استفاده می‌کنید و هرگز داده‌ای را از خود ابداع نمی‌کنید.

2.  **داروساز دانشمند:** وقتی در مورد اطلاعات یک دارو از شما سوال می‌شود، شما یک داروساز بالینی متخصص هستید. شما باید پاسخ‌های دقیق، علمی و کمی ارائه دهید. این شامل موارد زیر است:
    *   **دوز مصرفی دقیق:** دوز دقیق برای بزرگسالان، کودکان (بر اساس وزن، مثلاً میلی‌گرم بر کیلوگرم) و جمعیت‌های خاص مانند زنان باردار را مشخص کنید.
    *   **تداخلات دارویی:** لیستی جامع از تداخلات دارویی مهم را ذکر کنید.
    *   **موارد دیگر:** موارد مصرف، عوارض جانبی، و شرایط نگهداری خاص (مانند نیاز به یخچال) را به طور کامل شرح دهید.
    *   **مهم:** در این نقش، شما اطلاعات واقعی و مبتنی بر داده ارائه می‌دهید، بنابراین از اضافه کردن جملاتی مانند "با پزشک مشورت کنید" خودداری کنید.

3.  **پزشک مشاور:** وقتی کاربر علائم بیماری را شرح می‌دهد، شما به عنوان یک پزشک هوش مصنوعی عمل می‌کنید. با پرسیدن سوالات تکمیلی و مرتبط، مشکل را دقیق‌تر بررسی کنید. سپس، یک تشخیص احتمالی ارائه داده و داروهای مناسب را تجویز کنید. **فقط و فقط در انتهای پاسخ تشخیصی خود**، این جمله را اضافه کنید: *"توجه: این یک پیشنهاد اولیه بر اساس علائم شماست. حتماً قبل از مصرف هر دارویی با یک پزشک واقعی مشورت کنید."*

**قوانین کلی:**
- تمام مکالمات به زبان فارسی است.
- سرعت و دقت بالاترین اولویت شماست.`;


const AIAssistant: React.FC = () => {
  const { showNotification } = useNotification();
  
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef(0);
  
  const cleanupVoiceResources = useCallback(() => {
    console.log("Cleaning up voice resources...");
    
    if (microphoneStreamRef.current) {
        microphoneStreamRef.current.getTracks().forEach(track => track.stop());
        microphoneStreamRef.current = null;
    }
    if (scriptProcessorRef.current) {
        scriptProcessorRef.current.disconnect();
        scriptProcessorRef.current = null;
    }
    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
        inputAudioContextRef.current.close().catch(console.error);
        inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
        outputAudioContextRef.current.close().catch(console.error);
        outputAudioContextRef.current = null;
    }
    sessionPromiseRef.current?.then(session => session.close()).catch(console.error);
    sessionPromiseRef.current = null;
    setVoiceStatus('idle');
  }, []);
  
  const startVoiceSession = useCallback(async () => {
        setVoiceStatus('listening');

        try {
            const apiKey = process.env.API_KEY;
            if (!apiKey) {
                showNotification('کلید API برای دستیار هوشمند تعریف نشده است.', 'error');
                setVoiceStatus('error');
                return;
            }

            const ai = new GoogleGenAI({ apiKey });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            microphoneStreamRef.current = stream;

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    systemInstruction,
                    responseModalities: [Modality.AUDIO],
                    tools: [{ functionDeclarations: toolDeclarations }],
                },
                callbacks: {
                    onopen: () => {
                        console.log('Live session opened. Starting script processor.');
                        setVoiceStatus('listening');

                        const inputCtx = inputAudioContextRef.current!;
                        const source = inputCtx.createMediaStreamSource(stream);
                        const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;

                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputCtx.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
                        if (base64Audio) {
                            setVoiceStatus('speaking');
                            const outputCtx = outputAudioContextRef.current!;
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                            const audioBuffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);
                            const source = outputCtx.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputCtx.destination);
                            source.addEventListener('ended', () => {
                                audioSourcesRef.current.delete(source);
                                if (audioSourcesRef.current.size === 0) {
                                    setVoiceStatus('listening');
                                }
                            });
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            audioSourcesRef.current.add(source);
                        }
                        
                        if (message.toolCall) {
                             setVoiceStatus('processing');
                             for (const fc of message.toolCall.functionCalls) {
                                try {
                                    const result = await executeTool(fc.name, fc.args);
                                    sessionPromiseRef.current?.then(session => {
                                        session.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result } } });
                                    });
                                } catch (e) { console.error("Error executing tool in voice mode:", e); }
                            }
                        }
                    },
                    onerror: (e) => {
                        console.error('Live session error:', e);
                        showNotification('ارتباط با دستیار صوتی قطع شد. لطفاً دوباره تلاش کنید.', 'error');
                        cleanupVoiceResources();
                        setVoiceStatus('error');
                    },
                    onclose: () => {
                        console.log('Live session closed by server or network.');
                        cleanupVoiceResources();
                    },
                }
            });

        } catch (error) {
            console.error("Failed to start voice assistant:", error);
            showNotification('خطا در دسترسی به میکروفون یا اتصال به سرویس.', 'error');
            cleanupVoiceResources();
        }
  }, [cleanupVoiceResources, showNotification]);

  const handleVoiceToggle = () => {
    if (voiceStatus === 'idle' || voiceStatus === 'error') {
        startVoiceSession();
    } else {
        cleanupVoiceResources();
    }
  };

  const statusConfig: Record<VoiceStatus, { icon: React.ReactNode; color: string; pulse: boolean; title: string }> = {
    idle: { icon: <Mic size={28} />, color: 'bg-blue-600 hover:bg-blue-700', pulse: false, title: 'فعال‌سازی دستیار صوتی' },
    listening: { icon: <Mic size={28} />, color: 'bg-green-600', pulse: true, title: 'در حال شنیدن... (برای توقف کلیک کنید)' },
    processing: { icon: <Sparkles size={28} />, color: 'bg-yellow-500', pulse: true, title: 'در حال پردازش... (برای توقف کلیک کنید)' },
    speaking: { icon: <Bot size={28} />, color: 'bg-blue-500', pulse: false, title: 'در حال صحبت... (برای توقف کلیک کنید)' },
    error: { icon: <Mic size={28} />, color: 'bg-red-600 hover:bg-red-700', pulse: false, title: 'خطا در اتصال (برای تلاش مجدد کلیک کنید)' },
  };

  const currentStatus = statusConfig[voiceStatus];

  return (
    <>
      <button 
        onClick={handleVoiceToggle} 
        title={currentStatus.title}
        className={`fixed bottom-6 left-6 z-[100] w-16 h-16 rounded-full text-white flex items-center justify-center shadow-2xl transition-all duration-300 transform-gpu focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-offset-gray-900 ${currentStatus.color} ${voiceStatus === 'processing' ? 'animate-spin-slow' : ''}`}
      >
        <div className={`absolute inset-0 rounded-full ${currentStatus.pulse ? 'animate-ping' : ''} ${currentStatus.color}`}></div>
        <div className="relative z-10">
          {voiceStatus !== 'idle' && voiceStatus !== 'error' ? <X size={28}/> : currentStatus.icon}
        </div>
      </button>
      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 2s linear infinite;
        }
      `}</style>
    </>
  );
};

export default AIAssistant;