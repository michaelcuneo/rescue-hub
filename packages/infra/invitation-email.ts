import { cloudwatch, lambda, sesv2 } from "@pulumi/aws";
import { data } from "./data";

// Only invitation emails use this configuration set. No other application
// email traffic needs to expose delivery events to the directory.
export const invitationEmailConfigurationSetName = `rescue-hub-${$app.stage}-invitations`;
const config = new sesv2.ConfigurationSet("RescueHubInvitationEmailConfiguration", {
  configurationSetName: invitationEmailConfigurationSetName,
});
const eventBus = cloudwatch.getEventBus({ name: "default" });
new sesv2.ConfigurationSetEventDestination("RescueHubInvitationEmailEvents", {
  configurationSetName: config.configurationSetName,
  eventDestinationName: "rescue-hub-invitation-events",
  eventDestination: {
    enabled: true,
    matchingEventTypes: ["DELIVERY", "BOUNCE", "COMPLAINT", "REJECT", "RENDERING_FAILURE", "DELIVERY_DELAY"],
    eventBridgeDestination: { eventBusArn: eventBus.then(bus => bus.arn) },
  },
});
const receiver = new sst.aws.Function("RescueHubInvitationStatusReceiver", {
  handler: "packages/infra/invitation-events.handler",
  link: [data],
  timeout: "20 seconds",
});
const rule = new cloudwatch.EventRule("RescueHubInvitationSesEventsRule", {
  eventPattern: JSON.stringify({
    source: ["aws.ses"],
    "detail-type": [
      "Email Delivered", "Email Bounced", "Email Complaint Received",
      "Email Rejected", "Email Rendering Failed", "Email Delivery Delayed"
    ],
  }),
});
new cloudwatch.EventTarget("RescueHubInvitationSesEventsTarget", {
  rule: rule.name,
  arn: receiver.arn,
});
new lambda.Permission("RescueHubInvitationSesInvokePermission", {
  action: "lambda:InvokeFunction",
  principal: "events.amazonaws.com",
  function: receiver.arn,
  sourceArn: rule.arn,
});
