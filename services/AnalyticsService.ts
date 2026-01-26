import { getAddressByZipCode } from './AddressService';

export interface AnalyticsStats {
    zipCode: string;
    province: string;
    district: string;
    subdistrict: string;
    count: number;
    totalCOD: number;
    totalCost: number;
    codCount: number;
    transferCount: number;
    lat?: number;
    lng?: number;
    isMatched?: boolean;
}

/**
 * Service to handle heavy computation for Analytics
 * Processed in chunks to avoid blocking the UI thread
 */
export const computeAnalytics = async (
    shipments: any[],
    onProgress?: (progress: { current: number; total: number; status: string }) => void
): Promise<AnalyticsStats[]> => {
    const stats = new Map<string, AnalyticsStats>();
    const total = shipments.length;
    const CHUNK_SIZE = 200;

    if (onProgress) onProgress({ current: 0, total, status: 'เริ่มต้นการวิเคราะห์...' });

    for (let i = 0; i < total; i += CHUNK_SIZE) {
        const chunk = shipments.slice(i, Math.min(i + CHUNK_SIZE, total));

        // Yield to keep UI responsive
        await new Promise(resolve => setTimeout(resolve, 0));

        chunk.forEach(s => {
            if (!s.zipCode) return;

            const addressInfo = getAddressByZipCode(s.zipCode)[0];
            if (!addressInfo) return;

            const zipKey = s.zipCode;
            const existing = stats.get(zipKey);
            const isCOD = (s.codAmount || 0) > 0;

            if (existing) {
                existing.count++;
                existing.totalCOD += (s.codAmount || 0);
                existing.totalCost += (s.shippingCost || 0);
                if (isCOD) existing.codCount++;
                else existing.transferCount++;
            } else {
                stats.set(zipKey, {
                    zipCode: s.zipCode,
                    province: addressInfo.province,
                    district: addressInfo.amphoe || addressInfo.district || 'ไม่ระบุ',
                    subdistrict: addressInfo.district || 'ไม่ระบุ',
                    count: 1,
                    totalCOD: (s.codAmount || 0),
                    totalCost: (s.shippingCost || 0),
                    codCount: isCOD ? 1 : 0,
                    transferCount: isCOD ? 0 : 1
                });
            }
        });

        if (onProgress) {
            const current = Math.min(i + CHUNK_SIZE, total);
            onProgress({
                current,
                total,
                status: `กำลังวิเคราะห์... (${current}/${total})`
            });
        }
    }

    if (onProgress) onProgress({ current: total, total, status: 'การวิเคราะห์เสร็จสมบูรณ์' });

    return Array.from(stats.values()).sort((a, b) => b.count - a.count);
};
