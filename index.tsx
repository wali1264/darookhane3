import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { db } from './db';
import { Dna } from 'lucide-react';

const AppInitializer: React.FC = () => {
    const [dbReady, setDbReady] = useState(false);
    const [dbError, setDbError] = useState<any>(null);

    useEffect(() => {
        // This effect runs once on component mount to initialize the database.
        
        // Hook registration is now handled inside the Dexie constructor in db.ts
        // to prevent circular dependencies and ensure hooks are always ready.

        // Open the database and update state based on the outcome.
        db.open()
            .then(() => {
                console.log("Database opened successfully.");
                setDbReady(true);
            })
            .catch(e => {
                console.error("Fatal: Could not open Dexie database.", e);
                setDbError(e);
            });
    }, []); // Empty dependency array ensures this runs only once.

    if (dbError) {
        // If the database fails to open, render a user-friendly error message.
        return (
             <div style={{ color: 'red', padding: '20px', fontFamily: 'sans-serif', backgroundColor: '#1a1a1a', height: '100vh', direction: 'rtl' }}>
                <h1>خطای پایگاه داده</h1>
                <p>امکان باز کردن پایگاه داده محلی وجود ندارد. این مشکل ممکن است به دلیل حالت مرور خصوصی (incognito) یا تنظیمات امنیتی مرورگر باشد.</p>
                <p>لطفاً حافظه پنهان و کوکی‌های مرورگر خود را برای این سایت پاک کرده و صفحه را دوباره بارگذاری کنید.</p>
                <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word', marginTop: '20px', border: '1px solid #555', padding: '10px' }}>
                    {dbError instanceof Error ? dbError.stack : String(dbError)}
                </pre>
            </div>
        );
    }

    if (!dbReady) {
        // While the database is opening, show a loading indicator.
        return (
            <div className="flex h-screen w-full items-center justify-center bg-gray-900">
                <div className="flex flex-col items-center gap-4">
                     <Dna size={48} className="text-blue-400 animate-spin" />
                    <p className="text-lg text-gray-300">آماده‌سازی پایگاه داده...</p>
                </div>
            </div>
        );
    }

    // Once the database is ready, render the main application.
    return (
        <NotificationProvider>
            <AuthProvider>
                <App />
            </AuthProvider>
        </NotificationProvider>
    );
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

console.log("Application starting in offline-first mode.");

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AppInitializer />
  </React.StrictMode>
);