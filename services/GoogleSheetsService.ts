import { Shipment } from '../types';

const SEARCH_ENDPOINT = import.meta.env.VITE_GOOGLE_SHEETS_SCRIPT_URL;

export const GoogleSheetsService = {
    /**
     * Fetch all shipments from the Google Sheet
     */
    async fetchShipments(): Promise<Shipment[]> {
        if (!SEARCH_ENDPOINT) {
            console.warn('Google Sheets URL is not configured.');
            return [];
        }

        try {
            // The GAS script uses 'action=get' for fetching data
            const response = await fetch(`${SEARCH_ENDPOINT}?action=get`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const json = await response.json();

            if (json.status === 'success' && Array.isArray(json.data)) {
                return json.data as Shipment[];
            } else {
                console.error('Invalid data format from Google Sheets:', json);
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
        if (!SEARCH_ENDPOINT) {
            console.warn('Google Sheets URL is not configured.');
            return { added: 0, updated: 0 };
        }

        try {
            // The GAS script expects POST data with 'action=save'
            // Note: GAS Web Apps often require 'no-cors' for POST from browser, 
            // BUT 'no-cors' prevents reading the response. 
            // Standard practice for GAS is using `application/x-www-form-urlencoded` or JSON.
            // However, to read response, we might need a proxy or rely on the script headers (CORS).
            // If the user deployed with "Anyone", it usually supports CORS for GET.
            // For POST, simple requests are better.
            //
            // Using 'no-cors' means we won't know if it succeeded, but it will work.
            // Let's try standard fetch first. 
            // If CORS fails, we might need to use `no-cors` mode or ask user to fix script headers (which they can't easily).
            // actually, standard GAS "Web App" doesn't fully support CORS preflight options easily.
            // The most reliable way for browser-to-GAS is often `no-cors` or JSONP (deprecated).
            // But let's try standard POST. The simple "text/plain" content-type usually avoids preflight.

            const response = await fetch(`${SEARCH_ENDPOINT}?action=save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8', // Avoids preflight
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
        if (!SEARCH_ENDPOINT) {
            console.warn('Google Sheets URL is not configured.');
            return false;
        }

        try {
            // Send delete action
            const response = await fetch(`${SEARCH_ENDPOINT}?action=delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
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
