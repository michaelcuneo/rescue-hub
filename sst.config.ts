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
    await import("./packages/infra/directory");

    const admin = new sst.aws.SvelteKit("Admin", {
      path: "packages/admin",
      link: [graphql, data],
      dev: {
        title: "Admin",
        url: "http://localhost:5173",
      },
    });

    const rescues = new sst.aws.SvelteKit("PCRescues", {
      path: "packages/pc-rescues",
      link: [graphql, data],
      environment: {
        PUBLIC_MAPBOX_ACCESS_TOKEN: process.env.PUBLIC_MAPBOX_ACCESS_TOKEN ?? "",
      },
      dev: {
        title: "PC Rescues",
        url: "https://localhost:3000",
      },
    });

    return {
      admin: admin.url,
      rescues: rescues.url,
      dataTable: data.name,
      graphqlUrl: api.url,
    };
  },
});
