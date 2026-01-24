import * as React from 'react';
import { createContext, useContext, useState, useEffect } from 'react';
import { isDemoMode } from '../utils/environment';

interface User {
    id: string;
    username: string;
    role: 'admin' | 'user';
}

interface AuthContextType {
    user: User | null;
    login: (username: string, password: string) => Promise<void>;
    logout: () => void;
    isAuthenticated: boolean;
    isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        const savedUser = localStorage.getItem('trackmaster_user');
        if (savedUser) {
            try {
                setUser(JSON.parse(savedUser));
            } catch (e) {
                localStorage.removeItem('trackmaster_user');
            }
        }
    }, []);


    const login = async (username: string, password: string) => {
        // demo mode bypass
        if (isDemoMode()) {
            const demoUser: User = {
                id: 'demo-admin',
                username: username || 'Demo Admin',
                role: 'admin' // Force admin for demo
            };
            setUser(demoUser);
            localStorage.setItem('trackmaster_user', JSON.stringify(demoUser));
            return;
        }

        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'การเข้าสู่ระบบล้มเหลว');
        }

        const data = await res.json();
        setUser(data.user);
        localStorage.setItem('trackmaster_user', JSON.stringify(data.user));
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('trackmaster_user');
    };

    return (
        <AuthContext.Provider value={{
            user,
            login,
            logout,
            isAuthenticated: !!user || (isDemoMode() && !!localStorage.getItem('trackmaster_user')),
            isAdmin: user?.role === 'admin' || isDemoMode()
        }}>
            {children}
        </AuthContext.Provider>
    );

};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};
