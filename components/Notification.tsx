import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

type NotificationType = 'success' | 'error' | 'info';

interface NotificationProps {
  message: string;
  type: NotificationType;
  onClose: () => void;
}

const icons: Record<NotificationType, React.ReactNode> = {
  success: <CheckCircle className="text-green-300" size={24} />,
  error: <XCircle className="text-red-300" size={24} />,
  info: <Info className="text-blue-300" size={24} />,
};

const colors: Record<NotificationType, string> = {
  success: 'border-green-500/50 bg-green-500/20',
  error: 'border-red-500/50 bg-red-500/20',
  info: 'border-blue-500/50 bg-blue-500/20',
};

const Notification: React.FC<NotificationProps> = ({ message, type, onClose }) => {
    const [visible, setVisible] = useState(false);

    const handleClose = () => {
        setVisible(false);
        setTimeout(onClose, 300); // Allow fade-out animation before calling parent's onClose
    };

    useEffect(() => {
        setVisible(true); // Trigger fade-in
        const timer = setTimeout(() => {
            handleClose();
        }, 3700); // A bit less than 4s to account for fade-out animation

        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run only on mount
    

  return (
    <div
      className={`fixed top-5 right-5 z-[200] w-full max-w-sm p-4 rounded-lg shadow-lg border backdrop-blur-md flex items-start gap-4 transition-all duration-300 ease-in-out ${colors[type]} ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'}`}
    >
      <div className="flex-shrink-0">{icons[type]}</div>
      <div className="flex-grow">
        <p className="font-semibold text-gray-100">{message}</p>
      </div>
      <button onClick={handleClose} className="flex-shrink-0 p-1 rounded-full text-gray-400 hover:bg-white/10">
        <X size={18} />
      </button>
    </div>
  );
};

export default Notification;
