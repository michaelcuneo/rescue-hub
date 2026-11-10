import { appsync } from "@pulumi/aws";
import { readFileSync } from "node:fs";

// A second, deliberately minimal API. The main RescueHubApi uses an API key
// for its data mutations and must NEVER be exposed to browsers or mobile apps.
export const realtime = new appsync.GraphQLApi("RescueHubRealtimeApi", {
  name: `rescue-hub-${$app.stage}-realtime`,
  authenticationType: "AWS_IAM",
  additionalAuthenticationProviders: [{ authenticationType: "API_KEY" }],
  schema: readFileSync("packages/core/realtime.graphql", "utf8"),
  xrayEnabled: false,
});

export const realtimeKey = new appsync.ApiKey("RescueHubRealtimeKey", {
  apiId: realtime.id,
  description: "Read-only opaque change subscriptions; never use for rescue records",
  expires: new Date(Date.now() + 364 * 24 * 60 * 60 * 1000).toISOString(),
});

// NONE datasource only mirrors an opaque revision; it never reads the data table.
const none = new appsync.DataSource("RescueHubRealtimeNone", {
  apiId: realtime.id,
  name: "RescueHubRealtimeNone",
  type: "NONE",
});

new appsync.Resolver("RescueHubRealtimePublishResolver", {
  apiId: realtime.id,
  type: "Mutation",
  field: "publishChange",
  dataSource: none.name,
  requestTemplate: `{"version":"2018-05-29","payload":{"revision":$util.toJson($ctx.args.revision)}}`,
  responseTemplate: "$util.toJson($ctx.result)",
});

// The key is intentionally limited to subscription and the opaque signal type.
// Publish permissions are granted only to the trusted SvelteKit Lambda via IAM.
export const realtimeLink = new sst.Linkable("RescueHubRealtime", {
  properties: {
    url: realtime.uris.apply(uris => uris?.GRAPHQL ?? ''),
    apiKey: realtimeKey.key,
  },
});
