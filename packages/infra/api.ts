import { appsync } from "@pulumi/aws";
import { data } from "./data";

export const api = new sst.aws.AppSync("RescueHubApi", {
  schema: "packages/core/schema.graphql",
  transform: {
    api(args) {
      args.authenticationType = "API_KEY";
    },
  },
});

const apiKey = new appsync.ApiKey("RescueHubApiKey", {
  apiId: api.id,
  description: "Rescue Hub server-side application access",
});

export const graphql = new sst.Linkable("RescueHubGraphQL", {
  properties: {
    url: api.url,
    apiKey: apiKey.key,
  },
});

const dynamo = api.addDataSource({
  name: "RescueHubDataSource",
  dynamodb: data.arn,
});

api.addResolver("Query rescue", {
  dataSource: dynamo.name,
  requestTemplate: `{"version":"2018-05-29","operation":"GetItem","key":{"pk":$util.dynamodb.toDynamoDBJson("RESCUE#$ctx.args.id"),"sk":$util.dynamodb.toDynamoDBJson("META")}}`,
  responseTemplate: `#if($ctx.result)$util.toJson($ctx.result)#else null#end`,
});

api.addResolver("Query rescues", {
  dataSource: dynamo.name,
  requestTemplate: `#if($ctx.args.status)
{"version":"2018-05-29","operation":"Query","index":"gsi1","query":{"expression":"#pk = :pk","expressionNames":{"#pk":"gsi1pk"},"expressionValues":{":pk":$util.dynamodb.toDynamoDBJson("STATUS#$ctx.args.status")}},"scanIndexForward":false,"limit":$util.defaultIfNull($ctx.args.limit,50)#if($ctx.args.nextToken),"nextToken":$util.toJson($ctx.args.nextToken)#end}
#else
{"version":"2018-05-29","operation":"Query","index":"gsi2","query":{"expression":"#pk = :pk","expressionNames":{"#pk":"gsi2pk"},"expressionValues":{":pk":$util.dynamodb.toDynamoDBJson("RESCUES")}},"scanIndexForward":false,"limit":$util.defaultIfNull($ctx.args.limit,50)#if($ctx.args.nextToken),"nextToken":$util.toJson($ctx.args.nextToken)#end}
#end`,
  responseTemplate: `#set($items=$util.defaultIfNull($ctx.result.items,[])) #set($nextToken=$util.defaultIfNull($ctx.result.nextToken,null)) {"items":$util.toJson($items),"nextToken":$util.toJson($nextToken)}`,
});

api.addResolver("Mutation createRescue", {
  dataSource: dynamo.name,
  requestTemplate: `#set($input=$ctx.args.input)#set($now=$util.time.nowISO8601())
{"version":"2018-05-29","operation":"PutItem","key":{"pk":$util.dynamodb.toDynamoDBJson("RESCUE#$input.id"),"sk":$util.dynamodb.toDynamoDBJson("META")},"attributeValues":{"entity":$util.dynamodb.toDynamoDBJson("rescue"),"id":$util.dynamodb.toDynamoDBJson($input.id),"type":$util.dynamodb.toDynamoDBJson($input.type),"breed":$util.dynamodb.toDynamoDBJson($util.defaultIfNull($input.breed,"")),"location":$util.dynamodb.toDynamoDBJson($util.defaultIfNull($input.location,"")),"latitude":$util.dynamodb.toDynamoDBJson($input.latitude),"longitude":$util.dynamodb.toDynamoDBJson($input.longitude),"injury":$util.dynamodb.toDynamoDBJson($util.defaultIfNull($input.injury,"")),"status":$util.dynamodb.toDynamoDBJson($input.status),"createdAt":$util.dynamodb.toDynamoDBJson($now),"updatedAt":$util.dynamodb.toDynamoDBJson($now),"gsi1pk":$util.dynamodb.toDynamoDBJson("STATUS#$input.status"),"gsi1sk":$util.dynamodb.toDynamoDBJson("$now#$input.id"),"gsi2pk":$util.dynamodb.toDynamoDBJson("RESCUES"),"gsi2sk":$util.dynamodb.toDynamoDBJson("$now#$input.id")#if($input.assignedUserId),"assignedUserId":$util.dynamodb.toDynamoDBJson($input.assignedUserId)#end},"condition":{"expression":"attribute_not_exists(pk) AND attribute_not_exists(sk)"}}`,
  responseTemplate: `$util.toJson($ctx.result)`,
});

api.addResolver("Mutation updateRescueStatus", {
  dataSource: dynamo.name,
  requestTemplate: `#set($input=$ctx.args.input)#set($now=$util.time.nowISO8601())
{"version":"2018-05-29","operation":"UpdateItem","key":{"pk":$util.dynamodb.toDynamoDBJson("RESCUE#$input.id"),"sk":$util.dynamodb.toDynamoDBJson("META")},"update":{"expression":"SET #status = :status, #gsi1pk = :gsi1pk, #updatedAt = :updatedAt","expressionNames":{"#status":"status","#gsi1pk":"gsi1pk","#updatedAt":"updatedAt"},"expressionValues":{":status":$util.dynamodb.toDynamoDBJson($input.status),":gsi1pk":$util.dynamodb.toDynamoDBJson("STATUS#$input.status"),":updatedAt":$util.dynamodb.toDynamoDBJson($now)}},"condition":{"expression":"attribute_exists(pk)"}}`,
  responseTemplate: `$util.toJson($ctx.result)`,
});

api.addResolver("Mutation assignRescue", {
  dataSource: dynamo.name,
  requestTemplate: `#set($input=$ctx.args.input)#set($now=$util.time.nowISO8601())
{"version":"2018-05-29","operation":"UpdateItem","key":{"pk":$util.dynamodb.toDynamoDBJson("RESCUE#$input.id"),"sk":$util.dynamodb.toDynamoDBJson("META")},"update":{"expression":"SET #status = :status, #assignedUserId = :assignedUserId, #gsi1pk = :gsi1pk, #updatedAt = :updatedAt","expressionNames":{"#status":"status","#assignedUserId":"assignedUserId","#gsi1pk":"gsi1pk","#updatedAt":"updatedAt"},"expressionValues":{":status":$util.dynamodb.toDynamoDBJson("ASSIGNED"),":assignedUserId":$util.dynamodb.toDynamoDBJson($input.userId),":gsi1pk":$util.dynamodb.toDynamoDBJson("STATUS#ASSIGNED"),":updatedAt":$util.dynamodb.toDynamoDBJson($now)}},"condition":{"expression":"attribute_exists(pk)"}}`,
  responseTemplate: `$util.toJson($ctx.result)`,
});
