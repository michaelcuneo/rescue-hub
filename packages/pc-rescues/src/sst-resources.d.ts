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
    RescueHubUsers: {
      id: string;
    };
    RescueHubWeb: {
      id: string;
      secret: string;
    };
    RescueHubMobile: {
      id: string;
      secret: string;
    };
  }
}

export {};
