import React, { useState, FormEvent } from 'react';
import { Wifi, WifiOff, LogOut, UserCircle, User, KeyRound, Save } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useAuth } from '../contexts/AuthContext';
import Modal from './Modal';
import { supabase } from '../lib/supabaseClient';
import { useNotification } from '../contexts/NotificationContext';
import { logActivity } from '../lib/activityLogger';
import SyncStatus from './SyncStatus';


const MyProfileModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { currentUser, updateCurrentUsername } = useAuth();
    const { showNotification } = useNotification();
    const [newUsername, setNewUsername] = useState(currentUser?.username || '');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!currentUser || currentUser.type !== 'employee') return;

        if (newPassword && newPassword !== confirmPassword) {
            showNotification('رمزهای عبور جدید با هم مطابقت ندارند.', 'error');
            return;
        }

        const usernameChanged = newUsername.trim() !== currentUser.username;
        const passwordChanged = newPassword.trim() !== '';

        if (!usernameChanged && !passwordChanged) {
            showNotification('هیچ تغییری برای ذخیره وجود ندارد.', 'info');
            return;
        }

        setIsSaving(true);
        let success = true;
        let changesMade = false;

        try {
            if (usernameChanged) {
                const { data, error } = await supabase.rpc('update_my_username', {
                    p_user_id: currentUser.id,
                    p_new_username: newUsername.trim()
                });
                
                const result = data?.[0];
                if (error || !result?.success) {
                    success = false;
                    showNotification(result?.message || error?.message || 'خطا در تغییر نام کاربری.', 'error');
                } else {
                    changesMade = true;
                    await logActivity('UPDATE', 'User', currentUser.id, { old: { username: currentUser.username }, new: { username: newUsername.trim() }});
                    updateCurrentUsername(newUsername.trim());
                }
            }

            if (success && passwordChanged) {
                // Here we pass the plain text password. The trigger will hash it.
                const { error } = await supabase.rpc('update_my_password', {
                    p_user_id: currentUser.id,
                    p_new_password: newPassword.trim()
                });

                if (error) {
                    success = false;
                    showNotification('خطا در تغییر رمز عبور.', 'error');
                } else {
                    changesMade = true;
                    // Log the action but not the password itself for security
                    await logActivity('UPDATE', 'User', currentUser.id, { details: `Password changed for user ${currentUser.username}` });
                }
            }

            if (success && changesMade) {
                showNotification('اطلاعات شما با موفقیت به‌روزرسانی شد.', 'success');
                onClose();
            }
        } catch (err) {
            console.error("Profile update error:", err);
            showNotification('یک خطای پیش‌بینی نشده رخ داد.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    if (!currentUser || currentUser.type !== 'employee') return null;

    return (
        <Modal title="پروفایل من" onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block mb-2 text-sm font-medium text-gray-400 flex items-center gap-2"><User size={16}/>نام کاربری</label>
                    <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} required className="input-style" />
                </div>
                <div>
                    <label className="block mb-2 text-sm font-medium text-gray-400 flex items-center gap-2"><KeyRound size={16}/>رمز عبور جدید</label>
                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="برای تغییر، رمز جدید را وارد کنید" className="input-style" />
                </div>
                <div>
                    <label className="block mb-2 text-sm font-medium text-gray-400 flex items-center gap-2"><KeyRound size={16}/>تکرار رمز عبور جدید</label>
                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="رمز عبور جدید را دوباره وارد کنید" className="input-style" />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-600">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500">لغو</button>
                    <button type="submit" disabled={isSaving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-500">
                        <Save size={18}/> {isSaving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
                    </button>
                </div>
            </form>
            <style>{`.input-style { background-color: #1f2937; border: 1px solid #4b5563; color: #d1d5db; border-radius: 0.5rem; padding: 0.75rem; width: 100%; }`}</style>
        </Modal>
    );
};


interface HeaderProps {
    currentPageTitle: string;
}

const Header: React.FC<HeaderProps> = ({ currentPageTitle }) => {
    const isOnline = useOnlineStatus();
    const { currentUser, logout } = useAuth();
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);


    return (
        <>
            <header className="bg-gray-800 shadow-md p-4 flex justify-between items-center border-b border-gray-700">
                <h1 className="text-2xl font-bold text-white">{currentPageTitle}</h1>
                <div className="flex items-center space-x-4">
                    <SyncStatus />
                     {currentUser && (
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 text-sm text-gray-300">
                                <UserCircle size={20} />
                                <span>{currentUser.username}</span>
                            </div>
                            {currentUser.type === 'employee' && (
                                <button onClick={() => setIsProfileModalOpen(true)} className="p-2 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white" title="پروفایل من">
                                    <User size={18} />
                                </button>
                            )}
                            <button onClick={logout} className="p-2 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white" title="خروج">
                                <LogOut size={18} />
                            </button>
                        </div>
                     )}
                </div>
            </header>
            {isProfileModalOpen && <MyProfileModal onClose={() => setIsProfileModalOpen(false)} />}
        </>
    );
};

export default Header;