import React, { createContext, useState, useContext, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Permission } from '../types';
import { useNotification } from './NotificationContext';
import { logActivity } from '../lib/activityLogger';
import { db } from '../db';

// Changed AuthenticatedUser to a discriminated union to correctly type employee vs supplier users.
interface BaseUser {
  id: number;
  username: string;
}
interface EmployeeUser extends BaseUser {
  type: 'employee';
  roleId: number;
}
interface SupplierUser extends BaseUser {
  type: 'supplier';
  supplierId: number;
}
export type AuthenticatedUser = EmployeeUser | SupplierUser;


interface AuthContextType {
  currentUser: AuthenticatedUser | null;
  permissions: Permission[];
  isLoading: boolean;
  login: (username: string, password_plaintext: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  hasPermission: (permission: Permission) => boolean;
  updateCurrentUsername: (newUsername: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { showNotification } = useNotification();
  
  // On initial load, we start with no user. Login is required.
  useEffect(() => {
    setIsLoading(false);
  }, []);


  const login = async (username_param: string, password_plaintext: string) => {
    setIsLoading(true);
    try {
        // Step 1: Attempt to log in as an employee
        const { data: employeeData, error: employeeError } = await supabase.rpc('verify_user_credentials', {
            p_username: username_param,
            p_password: password_plaintext
        });

        if (employeeError) {
            console.error('Employee Login RPC Error:', employeeError);
            showNotification('خطای داخلی در هنگام ورود.', 'error');
            return { success: false, message: employeeError.message };
        }
        
        if (employeeData && employeeData.length > 0) {
             const userData = employeeData[0];
             const userToStore: AuthenticatedUser = {
                 id: userData.id,
                 username: userData.username,
                 type: 'employee',
                 roleId: userData.role_id,
             };
             const userPermissions: Permission[] = userData.permissions;

             setCurrentUser(userToStore);
             setPermissions(userPermissions);
             
             sessionStorage.setItem('shafayar_user_info_for_logger', JSON.stringify({id: userToStore.id, username: userToStore.username, type: userToStore.type}));

             await logActivity('LOGIN', 'Authentication', userToStore.id, { message: 'User logged in successfully.' });
             showNotification('ورود موفقیت‌آمیز بود.', 'success');
             return { success: true, message: 'ورود موفقیت‌آمیز بود.' };
        }

        // Step 2: If employee login fails, attempt to log in as a supplier
        const { data: supplierData, error: supplierError } = await supabase.rpc('verify_supplier_credentials', {
            p_username: username_param,
            p_password: password_plaintext
        });
        
        if (supplierError) {
            console.error('Supplier Login RPC Error:', supplierError);
            showNotification('خطای داخلی در هنگام ورود.', 'error');
            return { success: false, message: supplierError.message };
        }

        if (supplierData && supplierData.length > 0) {
            const supplierAccountData = supplierData[0];
            const userToStore: AuthenticatedUser = {
                id: supplierAccountData.id,
                username: supplierAccountData.username,
                type: 'supplier',
                supplierId: supplierAccountData.supplier_id,
            };
            
            setCurrentUser(userToStore);
            setPermissions([]); // Suppliers have no RBAC permissions
            
            sessionStorage.setItem('shafayar_user_info_for_logger', JSON.stringify({id: userToStore.id, username: userToStore.username, type: userToStore.type}));
            
            showNotification('ورود موفقیت‌آمیز به پورتال.', 'success');
            return { success: true, message: 'ورود موفقیت‌آمیز بود.' };
        }

        // Step 3: If both fail, it's invalid credentials
        showNotification('نام کاربری یا رمز عبور اشتباه است.', 'error');
        return { success: false, message: 'Invalid credentials' };

    } catch (error: any) {
      console.error("Login error:", error);
      showNotification('خطای داخلی رخ داد.', 'error');
      return { success: false, message: error.message || 'خطای داخلی رخ داد.' };
    } finally {
        setIsLoading(false);
    }
  };

  const logout = async () => {
    if(currentUser) {
        await logActivity('LOGOUT', 'Authentication', currentUser.id, { message: 'User logged out.'});
    }
    setCurrentUser(null);
    setPermissions([]);
    sessionStorage.removeItem('shafayar_user_info_for_logger');
    showNotification('شما با موفقیت از سیستم خارج شدید.', 'info');
  };

  const hasPermission = (permission: Permission) => {
    // Grant all permissions to the special 'admin' user, bypassing the role check.
    if (currentUser?.type === 'employee' && currentUser.username.toLowerCase() === 'admin') {
      return true;
    }
    return permissions.includes(permission);
  };
  
  const updateCurrentUsername = (newUsername: string) => {
    if (currentUser) {
      const updatedUser = { ...currentUser, username: newUsername };
      setCurrentUser(updatedUser);
      sessionStorage.setItem('shafayar_user_info_for_logger', JSON.stringify({id: updatedUser.id, username: updatedUser.username, type: updatedUser.type}));
    }
  };

  const value = {
    currentUser,
    permissions,
    isLoading,
    login,
    logout,
    hasPermission,
    updateCurrentUsername,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};