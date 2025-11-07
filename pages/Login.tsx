import React, { useState, FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Dna, User, Lock, LogIn } from 'lucide-react';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    const result = await login(username, password);
    
    // If login fails, the AuthProvider already showed a notification.
    // We just need to stop the loading spinner here.
    if (!result.success) {
      setIsLoading(false);
    }
    // On success, the AuthProvider will handle navigation by re-rendering AppContent.
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="w-full max-w-md p-8 space-y-8 bg-gray-800 rounded-2xl shadow-2xl border border-gray-700">
        <div className="text-center">
            <div className="inline-block p-3 bg-blue-600/20 rounded-full mb-4">
                <Dna size={40} className="text-blue-400" />
            </div>
            <h1 className="text-3xl font-bold text-white">ورود به شفا-یار</h1>
            <p className="mt-2 text-gray-400">برای دسترسی به سیستم وارد شوید.</p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="relative">
            <User className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full py-3 pr-10 pl-4 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="نام کاربری"
            />
          </div>
          <div className="relative">
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full py-3 pr-10 pl-4 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="رمز عبور"
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-gray-800 disabled:bg-gray-500 disabled:cursor-wait"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                    <LogIn className="h-5 w-5 text-blue-300 group-hover:text-blue-200" />
                  </span>
                  ورود
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;