declare module 'thai-address-database' {
    export interface SearchResult {
        district: string;
        amphoe: string;
        province: string;
        zipcode: string;
        district_code: string;
        amphoe_code: string;
        province_code: string;
    }

    export function searchAddressByDistrict(searchStr: string, maxResult?: number): SearchResult[];
    export function searchAddressByAmphoe(searchStr: string, maxResult?: number): SearchResult[];
    export function searchAddressByProvince(searchStr: string, maxResult?: number): SearchResult[];
    export function searchAddressByZipcode(searchStr: string, maxResult?: number): SearchResult[];
    export function splitAddress(fullAddress: string): any;
}
