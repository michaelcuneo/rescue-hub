/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "rescue-hub",
      home: "aws",
      providers: {
        aws: {
          region: "ap-southeast-2",
        },
      },
      protect: input.stage === "production",
      removal: input.stage === "production" ? "retain" : "remove",
    };
  },

  async run() {
    const { data } = await import("./packages/infra/data");
    const { api, graphql } = await import("./packages/infra/api");
    const { realtime, realtimeLink } = await import("./packages/infra/realtime");
    const { mailFrom } = await import("./packages/infra/config");
    const { invitationEmailConfigurationSetName } = await import("./packages/infra/invitation-email");
    await import("./packages/infra/directory");
    await import("./packages/infra/demo");

    const web = new sst.aws.SvelteKit("Web", {
      path: "packages/pc-rescues",
      ...( $app.stage === "demo" ? {
        domain: {
          name: "rescue.michaelcuneo.com.au",
          // Let SST find the Route 53 hosted zone for the domain.
          // dns({ zone }) requires a hosted-zone ID (Z...), not the domain name.
          dns: sst.aws.dns(),
        },
      } : {}),
      link: [graphql, realtimeLink, data, mailFrom],
      environment: {
        PUBLIC_MAPBOX_ACCESS_TOKEN: process.env.PUBLIC_MAPBOX_ACCESS_TOKEN ?? "",
        RESCUE_HUB_SES_CONFIGURATION_SET: invitationEmailConfigurationSetName,
        // Trusted website origin for single-use organisation invitation links.
        RESCUE_HUB_PUBLIC_ORIGIN: process.env.RESCUE_HUB_PUBLIC_ORIGIN ?? ($app.stage === "demo" ? "https://rescue.michaelcuneo.com.au" : ""),
        // Server-side OAuth credentials; these are never PUBLIC_ variables.
        GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
        GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
        FACEBOOK_APP_ID: process.env.FACEBOOK_APP_ID ?? "",
        FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET ?? "",
        APPLE_SERVICE_ID: process.env.APPLE_SERVICE_ID ?? "",
        APPLE_TEAM_ID: process.env.APPLE_TEAM_ID ?? "",
        APPLE_KEY_ID: process.env.APPLE_KEY_ID ?? "",
        APPLE_PRIVATE_KEY: process.env.APPLE_PRIVATE_KEY ?? "",
      },
      permissions: [
        {
          actions: ["ses:SendEmail"],
          resources: ["*"],
        },
        {
          actions: ["appsync:GraphQL"],
          resources: [realtime.arn.apply((arn) => `${arn}/types/Mutation/fields/publishChange`)],
        },
      ],
      dev: {
        autostart: true,
        command: "npm run dev -- --host 0.0.0.0 --port 3000",
        title: "Rescue Hub",
        url: "http://localhost:3000",
      },
    });

    return {
      web: web.url,
      dataTable: data.name,
      graphqlUrl: api.url,
    };
  },
});
