import * as React from 'react';
import { createContext, useContext, useState, useEffect } from 'react';

interface Settings {
    cod_fee: number;
    [key: string]: any;
}

interface SettingsContextType {
    settings: Settings;
    updateSetting: (key: string, value: any) => Promise<void>;
    isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<Settings>({ cod_fee: 3 });
    const [isLoading, setIsLoading] = useState(true);
    const isDemoMode = typeof window !== 'undefined' && window.location.hostname.includes('github.io');

    const fetchSettings = async () => {
        if (isDemoMode) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const res = await fetch('/api/settings');
            if (res.ok) {
                const data = await res.json();
                // Convert string values to numbers where appropriate
                const formatted = { ...data };
                if (formatted.cod_fee) formatted.cod_fee = Number(formatted.cod_fee);
                setSettings(prev => ({ ...prev, ...formatted }));
            }
        } catch (e) {
            console.error('Failed to fetch settings', e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const updateSetting = async (key: string, value: any) => {
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, value }),
        });

        if (res.ok) {
            setSettings(prev => ({ ...prev, [key]: value }));
        } else {
            throw new Error('บันทึกการตั้งค่าล้มเหลว');
        }
    };

    return (
        <SettingsContext.Provider value={{ settings, updateSetting, isLoading }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) throw new Error('useSettings must be used within a SettingsProvider');
    return context;
};
