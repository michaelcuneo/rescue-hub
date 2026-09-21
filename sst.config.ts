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
    const { mailFrom } = await import("./packages/infra/config");
    await import("./packages/infra/directory");
    await import("./packages/infra/demo");

    const web = new sst.aws.SvelteKit("Web", {
      path: "packages/pc-rescues",
      link: [graphql, data, mailFrom],
      environment: {
        PUBLIC_MAPBOX_ACCESS_TOKEN: process.env.PUBLIC_MAPBOX_ACCESS_TOKEN ?? "",
      },
      permissions: [
        {
          actions: ["ses:SendEmail"],
          resources: ["*"],
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
    };
  },
});
