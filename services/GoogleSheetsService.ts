import { Shipment } from '../types';

const SEARCH_ENDPOINT = import.meta.env.VITE_GOOGLE_SHEETS_SCRIPT_URL;
const isDemoMode = typeof window !== 'undefined' && (
    window.location.hostname.includes('github.io') ||
    window.location.hostname.includes('localhost') && !SEARCH_ENDPOINT
);

// Helper to determine if we should use local NAS proxy or direct GAS
const getServiceUrl = (action: string) => {
    if (isDemoMode) {
        return `${SEARCH_ENDPOINT}?action=${action}`;
    }
    return `/api/gsheets/${action}`;
};

export const GoogleSheetsService = {
    /**
     * Fetch all shipments from the Google Sheet
     */
    async fetchShipments(): Promise<Shipment[]> {
        // Use backend proxy on NAS, direct fetch on Demo/Dev if needed
        const url = getServiceUrl('get');

        console.log('Fetching shipments from:', url);

        try {
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const json = await response.json();

            if (json.status === 'success' && Array.isArray(json.data)) {
                return json.data as Shipment[];
            } else {
                console.error('Invalid data format:', json);
                return [];
            }
        } catch (error) {
            console.error('Failed to fetch shipments:', error);
            return [];
        }
    },

    /**
     * Save (Append/Update) shipments to the Google Sheet
     */
    async saveShipments(shipments: Shipment[]): Promise<{ added: number; updated: number }> {
        const url = getServiceUrl('save');

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': isDemoMode ? 'text/plain;charset=utf-8' : 'application/json',
                },
                body: JSON.stringify(shipments),
            });

            const json = await response.json();

            if (json.status === 'success') {
                return { added: json.added || 0, updated: json.updated || 0 };
            } else {
                throw new Error(json.message || 'Unknown error');
            }

        } catch (error) {
            console.error('Failed to save shipments:', error);
            throw error;
        }
    },

    /**
     * Delete a shipment by Tracking Number
     */
    async deleteShipment(trackingNumber: string): Promise<boolean> {
        const url = getServiceUrl('delete');

        try {
            // Send delete action
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': isDemoMode ? 'text/plain;charset=utf-8' : 'application/json',
                },
                body: JSON.stringify({ trackingNumber }),
            });

            const json = await response.json();
            return json.status === 'success';

        } catch (error) {
            console.error('Failed to delete shipment:', error);
            return false;
        }
    }
};
