import React from 'react';
import { Mic, MicOff } from 'lucide-react';

interface VoiceControlHeaderProps {
    isListening: boolean;
    recognitionLang: 'fa-IR' | 'en-US';
    toggleListening: () => void;
    toggleLanguage: () => void;
    isSupported: boolean;
}

const VoiceControlHeader: React.FC<VoiceControlHeaderProps> = ({
    isListening,
    recognitionLang,
    toggleListening,
    toggleLanguage,
    isSupported
}) => {
    if (!isSupported) {
        return null; // Or a message saying it's not supported
    }

    return (
        <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={toggleLanguage}
                disabled={!isListening}
                title={recognitionLang === 'fa-IR' ? 'تغییر به انگلیسی' : 'تغییر به فارسی'}
                className={`w-10 h-8 text-xs font-bold rounded-full flex items-center justify-center transition-colors ${
                    !isListening 
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                        : 'bg-gray-500 text-white hover:bg-gray-400'
                }`}
            >
                {recognitionLang === 'fa-IR' ? 'FA' : 'EN'}
            </button>
            <button
                type="button"
                onClick={toggleListening}
                title={isListening ? 'غیرفعال کردن ورودی صوتی' : 'فعال کردن ورودی صوتی'}
                className={`p-2 rounded-full transition-all duration-200 ease-in-out ${
                    isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                }`}
            >
                {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
        </div>
    );
};

export default VoiceControlHeader;
