declare module "local-reverse-geocoder" {
  export interface GeoNameRecord {
    geoNameId: string;
    name: string;
    asciiName: string;
    alternateNames: string | null;
    latitude: string;
    longitude: string;
    featureClass: string;
    featureCode: string;
    countryCode: string;
    cc2: string | null;
    admin1Code: AdminCode | null;
    admin2Code: AdminCode | null;
    admin3Code: AdminCode | null;
    admin4Code: AdminCode | null;
    population: string;
    elevation: string;
    dem: string;
    timezone: string;
    modificationDate: string;
    distance: number;
  }

  export interface AdminCode {
    name: string;
    asciiName: string;
    geoNameId: string;
  }

  export interface LookUpPoint {
    latitude: number;
    longitude: number;
  }

  export interface InitOptions {
    citiesFileOverride?: string;
    load?: {
      admin1?: boolean;
      admin2?: boolean;
      admin3?: boolean;
      admin4?: boolean;
      alternateNames?: boolean;
    };
    countries?: string[];
    dumpDirectory?: string;
  }

  export function init(options: InitOptions, callback: () => void): void;
  export function init(callback: () => void): void;

  export function lookUp(
    point: LookUpPoint,
    maxResults: number,
    callback: (err: Error | null, results: GeoNameRecord[][]) => void,
  ): void;
  export function lookUp(
    points: LookUpPoint[],
    maxResults: number,
    callback: (err: Error | null, results: GeoNameRecord[][]) => void,
  ): void;
  export function lookUp(
    point: LookUpPoint,
    callback: (err: Error | null, results: GeoNameRecord[][]) => void,
  ): void;
  export function lookUp(
    points: LookUpPoint[],
    callback: (err: Error | null, results: GeoNameRecord[][]) => void,
  ): void;
}
