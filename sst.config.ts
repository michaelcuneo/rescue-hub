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
    const { users, webAuthClient, mobileAuthClient } = await import("./packages/infra/auth");
    await import("./packages/infra/directory");

    const web = new sst.aws.SvelteKit("Web", {
      path: "packages/pc-rescues",
      link: [graphql, data, users, webAuthClient, mobileAuthClient],
      environment: {
        PUBLIC_MAPBOX_ACCESS_TOKEN: process.env.PUBLIC_MAPBOX_ACCESS_TOKEN ?? "",
        PUBLIC_COGNITO_USER_POOL_ID: users.id,
        PUBLIC_COGNITO_WEB_CLIENT_ID: webAuthClient.id,
      },
      permissions: [
        {
          actions: [
            "cognito-idp:ListUsers",
            "cognito-idp:AdminCreateUser",
            "cognito-idp:AdminDisableUser",
            "cognito-idp:AdminEnableUser",
            "cognito-idp:AdminDeleteUser",
            "cognito-idp:AdminResetUserPassword"
          ],
          resources: [users.arn],
        },
      ],
      dev: {
        autostart: true,
        command: "npm run dev -- --host 0.0.0.0 --port 3000",
        title: "Rescue Hub",
        url: "https://localhost:3000",
      },
    });

    return {
      web: web.url,
      dataTable: data.name,
      graphqlUrl: api.url,
      userPoolId: users.id,
      webClientId: webAuthClient.id,
      mobileClientId: mobileAuthClient.id,
    };
  },
});
