export const data = new sst.aws.Dynamo("RescueHubData", {
  fields: {
    pk: "string",
    sk: "string",
    gsi1pk: "string",
    gsi1sk: "string",
    gsi2pk: "string",
    gsi2sk: "string",
  },
  primaryIndex: { hashKey: "pk", rangeKey: "sk" },
  globalIndexes: {
    gsi1: { hashKey: "gsi1pk", rangeKey: "gsi1sk" },
    gsi2: { hashKey: "gsi2pk", rangeKey: "gsi2sk" },
  },
});
