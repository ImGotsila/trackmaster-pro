import { searchAddressByZipcode } from 'thai-address-database';

export interface AddressResult {
    district: string; // Tambon
    amphoe: string;   // Amphoe
    province: string; // Province
    zipcode: string;  // ZipCode
}

export const getAddressByZipCode = (zipCode: string): AddressResult[] => {
    try {
        // searchAddressByZipcode returns exact match or partial match.
        // We want to limit results and mainly look for exact zip code matches.
        const results = searchAddressByZipcode(zipCode, 50);
        return results as AddressResult[];
    } catch (error) {
        console.error("Error fetching address by zip code:", error);
        return [];
    }
};
