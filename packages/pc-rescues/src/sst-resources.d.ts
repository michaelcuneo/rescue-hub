import "sst";

declare module "sst" {
  interface Resource {
    RescueHubGeocodingCache: {
      name: string;
    };
    RescueHubData: {
      name: string;
    };
    RescueHubGraphQL: {
      url: string;
      apiKey: string;
    };
    RescueHubMailFrom: {
      value: string;
    };
  }
}

export {};
