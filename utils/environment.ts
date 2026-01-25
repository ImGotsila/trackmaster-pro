export const isDemoMode = (): boolean => {
    if (typeof window === 'undefined') return false;
    // GitHub Pages always runs in demo mode
    if (window.location.hostname.includes('github.io')) return true;

    // For localhost/internal IP, check if we have the API configured
    // If we are developing locally without a backend, might want to force demo mode manually or detect API failure
    // But for now, assume non-github is "Production-like" intended, unless API interactions fail (handled by callers)
    return false;
};

export const getApiUrl = (endpoint: string): string => {
    // 1. Check if a custom API base is defined (e.g. from Vite env or runtime config)
    const customApiBase = import.meta.env.VITE_API_BASE_URL;

    if (customApiBase) {
        // If we have a custom base (e.g. "https://my-nas.com"), prepend it
        const cleanBase = customApiBase.replace(/\/$/, '');
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        return `${cleanBase}${cleanEndpoint}`;
    }

    if (isDemoMode()) {
        // In demo mode, some endpoints might point to mock data or specialized handlers
        // For Google Sheets, we might go direct if allowed, or fail gracefully
        return endpoint;
    }
    // In production (NAS/Docker), relative paths work because FS serves FE
    return endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
};
