import "sst";

declare module "sst" {
  interface Resource {
    RescueHubData: {
      name: string;
    };
    RescueHubGraphQL: {
      url: string;
      apiKey: string;
    };
  }
}

export {};
