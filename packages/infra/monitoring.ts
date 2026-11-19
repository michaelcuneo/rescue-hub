import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

/**
 * Demo-stage operations visibility. Resource names come from actual SST
 * outputs, not guessed stage-specific strings. Avoid sensitive log payloads.
 * CloudWatch dashboards are billable; deploy once for demo.
 */
export function createDemoOperationsMonitoring(
  web: sst.aws.SvelteKit,
  data: sst.aws.Dynamo,
  geocodingCache: sst.aws.Dynamo
) {
  const server = web.nodes.server;
  if (!server) throw new Error('SvelteKit server Lambda is required for monitoring');
  const functionName = server.apply(fn => fn.name);

  const email = process.env.RESCUE_MONITOR_ALERT_EMAIL?.trim() ??
    process.env.RESCUE_LOCATION_BUDGET_ALERT_EMAIL?.trim() ?? '';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error('RESCUE_MONITOR_ALERT_EMAIL must be a valid email address');

  const topic = new aws.sns.Topic('RescueHubDemoAlerts', {
    name: 'rescue-hub-demo-alarms'
  });
  if (email) {
    // Email recipients must confirm the SNS subscription to receive alerts.
    new aws.sns.TopicSubscription('RescueHubDemoAlertSubscription', {
      topic: topic.arn,
      protocol: 'email',
      endpoint: email
    });
  } else {
    console.warn('Set RESCUE_MONITOR_ALERT_EMAIL to send CloudWatch alarm notifications.');
  }

  new aws.cloudwatch.MetricAlarm('RescueHubDemoLambdaErrorAlarm', {
    alarmName: 'rescue-hub-demo-lambda-errors',
    alarmDescription: 'Three or more SvelteKit Lambda errors in five minutes',
    comparisonOperator: 'GreaterThanOrEqualToThreshold',
    evaluationPeriods: 1,
    threshold: 3,
    period: 300,
    statistic: 'Sum',
    namespace: 'AWS/Lambda',
    metricName: 'Errors',
    dimensions: { FunctionName: functionName },
    treatMissingData: 'notBreaching',
    alarmActions: [topic.arn]
  });

  new aws.cloudwatch.MetricAlarm('RescueHubDemoGeocodingThrottleAlarm', {
    alarmName: 'rescue-hub-demo-geocoding-cache-throttles',
    alarmDescription: 'DynamoDB throttle on the distributed Places quota/cache table',
    comparisonOperator: 'GreaterThanOrEqualToThreshold',
    evaluationPeriods: 1,
    threshold: 1,
    period: 300,
    statistic: 'Sum',
    namespace: 'AWS/DynamoDB',
    metricName: 'ThrottledRequests',
    dimensions: { TableName: geocodingCache.name },
    treatMissingData: 'notBreaching',
    alarmActions: [topic.arn]
  });

  new aws.cloudwatch.Dashboard('RescueHubDemoOperationsDashboard', {
    dashboardName: 'rescue-hub-demo-operations',
    dashboardBody: pulumi.all([functionName, data.name, geocodingCache.name]).apply(
      ([lambda, operationsTable, addressTable]) => JSON.stringify({
        widgets: [
          { type: 'text', x: 0, y: 0, width: 24, height: 2,
            properties: { markdown: '# Rescue Hub demo — operations\nPrivate AWS monitoring; no incident locations or personal data.' } },
          { type: 'metric', x: 0, y: 2, width: 12, height: 6, properties: {
            title: 'SvelteKit errors and throttles', region: 'ap-southeast-2', stat: 'Sum', period: 300,
            metrics: [
              ['AWS/Lambda', 'Errors', 'FunctionName', lambda],
              ['AWS/Lambda', 'Throttles', 'FunctionName', lambda]
            ]
          }},
          { type: 'metric', x: 12, y: 2, width: 12, height: 6, properties: {
            title: 'Server duration (milliseconds)', region: 'ap-southeast-2', stat: 'p95', period: 300,
            metrics: [['AWS/Lambda', 'Duration', 'FunctionName', lambda]]
          }},
          { type: 'metric', x: 0, y: 8, width: 12, height: 6, properties: {
            title: 'Operational table throttling', region: 'ap-southeast-2', stat: 'Sum', period: 300,
            metrics: [['AWS/DynamoDB', 'ThrottledRequests', 'TableName', operationsTable]]
          }},
          { type: 'metric', x: 12, y: 8, width: 12, height: 6, properties: {
            title: 'Geocoding quota/cache throttling', region: 'ap-southeast-2', stat: 'Sum', period: 300,
            metrics: [['AWS/DynamoDB', 'ThrottledRequests', 'TableName', addressTable]]
          }}
        ]
      })
    )
  });
}
