import React from 'react';
import { PenLine } from 'lucide-react';
import { useHandwriting } from './HandwritingProvider';

const HandwritingToggleButton: React.FC = () => {
  const { isEnabled, isSupported, toggleHandwriting } = useHandwriting();

  const getTitle = () => {
    if (!isSupported) {
      return 'حالت نوشتاری در این مرورگر پشتیبانی نمی‌شود';
    }
    return isEnabled ? 'غیرفعال کردن حالت نوشتاری' : 'فعال کردن حالت نوشتاری';
  };

  return (
    <button
      type="button"
      onClick={toggleHandwriting}
      title={getTitle()}
      disabled={!isSupported}
      className={`p-2 rounded-full transition-colors duration-200 ${
        isEnabled 
        ? 'bg-blue-600 text-white' 
        : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
      } ${!isSupported ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <PenLine size={18} />
    </button>
  );
};

export default HandwritingToggleButton;
