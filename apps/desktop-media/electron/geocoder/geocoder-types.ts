export interface GeocodedLocation {
  countryCode: string;
  countryName: string;
  admin1Name: string | null;
  cityName: string;
  distance: number;
}

export type GeocoderStatus = "idle" | "downloading" | "loading-cache" | "parsing" | "ready" | "error";

export interface GeocoderInitProgress {
  status: GeocoderStatus;
  error?: string;
}
