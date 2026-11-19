import * as aws from '@pulumi/aws';

// AWS Budgets is account-wide. Only imported by the demo SST stage.
// The filter captures all Amazon Location Service consumption in this AWS
// account (not merely Rescue Hub); billing service names must be confirmed
// in Cost Explorer during the first rollout.
const alertEmail = process.env.RESCUE_LOCATION_BUDGET_ALERT_EMAIL?.trim() ?? '';
const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(alertEmail);
const monthlyUsd = Number(process.env.RESCUE_LOCATION_BUDGET_USD ?? '25');
if (!Number.isFinite(monthlyUsd) || monthlyUsd < 1 || monthlyUsd > 10000)
  throw new Error('RESCUE_LOCATION_BUDGET_USD must be between 1 and 10000 (USD)');
if (alertEmail && !validEmail)
  throw new Error('RESCUE_LOCATION_BUDGET_ALERT_EMAIL must be a valid email address');
if (!validEmail)
  console.warn('AWS Places budget is created without email alerts. Set RESCUE_LOCATION_BUDGET_ALERT_EMAIL and redeploy demo to activate notifications.');

export const locationBudget = new aws.budgets.Budget('RescueHubLocationMonthlyBudget', {
  name: 'rescue-hub-location-monthly',
  budgetType: 'COST',
  timeUnit: 'MONTHLY',
  limitAmount: String(monthlyUsd),
  limitUnit: 'USD',
  costFilters: [{ name: 'Service', values: ['Amazon Location Service'] }],
  ...(validEmail ? {
    notifications: [50, 80, 100].map(threshold => ({
      comparisonOperator: 'GREATER_THAN' as const,
      threshold,
      thresholdType: 'PERCENTAGE' as const,
      notificationType: 'ACTUAL' as const,
      subscriberEmailAddresses: [alertEmail]
    }))
  } : {})
});
