import React, { useState, useEffect, useRef } from 'react';
import { RotateCw, CheckCircle, AlertTriangle, UploadCloud, WifiOff } from 'lucide-react';
import { syncStatusChannel } from '../lib/syncService';
import { db } from '../db';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useLiveQuery } from 'dexie-react-hooks';

type SyncState = 'syncing' | 'pending' | 'synced' | 'error' | 'offline';

interface SyncStatusMessage {
    status: SyncState;
    processed?: number;
    total?: number;
    count?: number;
    remaining?: number;
}

const SyncStatus: React.FC = () => {
    const [status, setStatus] = useState<SyncState>('synced');
    const [message, setMessage] = useState('');
    const [isVisible, setIsVisible] = useState(false);
    const isOnline = useOnlineStatus();
    const syncQueueCount = useLiveQuery(() => db.syncQueue.count(), []);
    const hideTimerRef = useRef<number | null>(null);

    useEffect(() => {
        // Always clear any pending hide timer when state changes
        if (hideTimerRef.current) {
            clearTimeout(hideTimerRef.current);
            hideTimerRef.current = null;
        }

        if (!isOnline) {
            setStatus('offline');
            if (syncQueueCount !== undefined && syncQueueCount > 0) {
                setMessage(`آفلاین (${syncQueueCount} مورد در صف)`);
            } else {
                setMessage('شما آفلاین هستید');
            }
            setIsVisible(true);
        } else { // User is online
            if (syncQueueCount !== undefined && syncQueueCount > 0) {
                 // The broadcast channel will handle switching to 'syncing'.
                 // If no message is actively being processed, we show 'pending'.
                if (status !== 'syncing' && status !== 'error') {
                    setStatus('pending');
                    setMessage(`${syncQueueCount} تغییر در صف ارسال`);
                    setIsVisible(true);
                }
            } else {
                // Online and queue is empty.
                // If the last status was 'synced', we let its timer handle hiding it.
                // Otherwise, we can hide immediately.
                if (status !== 'synced') {
                    setIsVisible(false);
                }
            }
        }
    // `status` is included to re-evaluate visibility when status changes (e.g., from 'synced' to 'pending').
    }, [isOnline, syncQueueCount, status]);

    useEffect(() => {
        const handleMessage = (event: MessageEvent<SyncStatusMessage>) => {
            const data = event.data;
            
            if (hideTimerRef.current) {
                clearTimeout(hideTimerRef.current);
                hideTimerRef.current = null;
            }

            setStatus(data.status);
            setIsVisible(true); // Always show the component when a message arrives

            switch(data.status) {
                case 'syncing':
                    setMessage(`در حال ارسال (${data.processed} از ${data.total})...`);
                    break;
                case 'synced':
                    setMessage('همگام‌سازی کامل شد');
                    hideTimerRef.current = window.setTimeout(() => {
                        setIsVisible(false);
                        // We reset status so if a new item appears, we don't get stuck on 'synced'
                        setStatus('pending'); 
                    }, 2500);
                    break;
                case 'error':
                    setMessage(data.remaining ? `خطا! ${data.remaining} آیتم باقی مانده.` : 'خطا در همگام‌سازی');
                    break;
                // 'pending' and 'offline' are primarily handled by the other effect based on live data.
            }
        };

        syncStatusChannel.addEventListener('message', handleMessage);

        return () => {
            syncStatusChannel.removeEventListener('message', handleMessage);
            if (hideTimerRef.current) {
                clearTimeout(hideTimerRef.current);
            }
        };
    }, []);

    const statusConfig: Record<SyncState, { icon: React.ReactNode, color: string, title: string }> = {
        syncing: {
            icon: <RotateCw size={16} className="animate-spin" />,
            color: 'text-blue-300',
            title: 'داده‌ها در حال ارسال به سرور هستند.'
        },
        pending: {
            icon: <UploadCloud size={16} />,
            color: 'text-gray-300',
            title: 'تغییرات به صورت محلی ذخیره شده و منتظر ارسال هستند.'
        },
        synced: {
            icon: <CheckCircle size={16} />,
            color: 'text-green-300',
            title: 'تمام داده‌ها با موفقیت همگام‌سازی شدند.'
        },
        error: {
            icon: <AlertTriangle size={16} />,
            color: 'text-red-400',
            title: 'در حین همگام‌سازی خطا رخ داد. برخی تغییرات ممکن است ارسال نشده باشند.'
        },
        offline: {
            icon: <WifiOff size={16} />,
            color: 'text-yellow-400',
            title: 'شما آفلاین هستید. تغییرات به صورت محلی ذخیره خواهند شد.'
        }
    };

    if (!isVisible) {
        return null;
    }

    const config = statusConfig[status];

    return (
        <div 
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm font-medium bg-gray-700/50 transition-all duration-300 ${config.color}`}
            title={config.title}
        >
            {config.icon}
            <span className="hidden sm:inline">{message}</span>
        </div>
    );
};

export default SyncStatus;
