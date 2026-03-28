# AI Prompt Examples By Seeded Application

These examples are based on the current seeded applications and event schemas in [prisma/seed.ts](/Users/e.dosreissilvajunior/Documents/insights/prisma/seed.ts).

They are intended for testing the AI Analytics panel on `/query`.

## Demo Web App

This app has seeded events for:
- `signup`
- `page_view`
- `button_click`
- `purchase`
- `onboarding_step_completed`
- `workspace_created`
- `integration_connected`
- `report_exported`
- `invite_sent`

Useful prompt examples:

- How many signups happened in the last 7 days?
- How many signups happened in the last 7 days, broken down by plan?
- How many signups happened in the last 7 days, grouped by acquisition source?
- How many signups happened in the last 7 days, grouped by marketing campaign?
- How many signups happened in the last 7 days, broken down by region?
- How many invited signups happened in the last 7 days?
- How many page views happened in the last 7 days?
- How many page views happened in the last 7 days, grouped by page type?
- How many page views happened in the last 7 days, grouped by device?
- Which referrers drove the most page views in the last 7 days?
- How many button clicks happened in the last 7 days, grouped by button label?
- How many button clicks happened in the last 7 days, broken down by CTA variant?
- How many purchases happened in the last 30 days?
- What was the total purchase amount in the last 30 days?
- What was the average purchase amount in the last 30 days?
- How many purchases happened in the last 30 days, grouped by billing cycle?
- How many purchases happened in the last 30 days, grouped by payment method?
- How many purchases used a coupon in the last 30 days?
- What was total revenue by product in the last 30 days?
- What was total revenue by currency in the last 30 days?
- How many onboarding steps were completed in the last 14 days, grouped by acquisition channel?
- How many onboarding steps were completed in the last 14 days, grouped by onboarding phase?
- How many workspaces were created in the last 14 days, grouped by use case?
- How many workspaces were created in the last 14 days, grouped by template?
- How many integrations were connected in the last 14 days, grouped by integration?
- How many successful integrations were connected in the last 14 days?
- How many integrations were connected in the last 14 days, grouped by provider?
- How many reports were exported in the last 14 days, grouped by format?
- How many reports were exported in the last 14 days, grouped by destination?
- How many invites were sent in the last 14 days, grouped by requested role?

Good seed-aware natural-language variants:

- Show signups by subscription tier from the past week.
- Break down recent purchases by billing period.
- Group onboarding completions by acquisition channel.
- Compare page views by device category over the past week.
- Show report exports by delivery destination.

## EventPulse iOS

This app has seeded events for:
- `app_open`
- `push_notification_tapped`
- `subscription_started`

Useful prompt examples:

- How many app opens happened in the last 7 days?
- How many app opens happened in the last 7 days, grouped by app version?
- How many app opens happened in the last 7 days, grouped by platform?
- How many cold app opens happened in the last 7 days?
- How many push notifications were tapped in the last 14 days?
- How many push notifications were tapped in the last 14 days, grouped by campaign?
- How many push notifications were tapped in the last 14 days, grouped by action?
- How many subscriptions started in the last 30 days?
- How many subscriptions started in the last 30 days, grouped by plan?
- How many subscriptions started in the last 30 days, grouped by billing period?
- Compare app opens and subscription starts over the last 30 days.

Good seed-aware natural-language variants:

- Show mobile subscriptions by billing period.
- Break down push taps by campaign.
- Group recent app opens by mobile platform.

## Admin Dashboard

This app has seeded events for:
- `page_view`
- `report_exported`

Useful prompt examples:

- How many admin page views happened in the last 7 days?
- How many admin page views happened in the last 7 days, grouped by path?
- What are the most viewed admin routes in the last 7 days?
- How many admin report exports happened in the last 14 days?
- How many admin report exports happened in the last 14 days, grouped by format?
- How many admin report exports happened in the last 14 days, grouped by report type?

Good seed-aware natural-language variants:

- Show admin exports by file format.
- Break down admin page views by route.
- Which admin reports were exported most often recently?

## Prompts That Exercise Property Descriptions

These are useful for testing schema grounding beyond exact property names:

- Show signups by subscription tier in the last week.
- Group onboarding completions by acquisition channel.
- Break down page views by device category.
- Show purchases by billing period.
- Show report exports by delivery destination.
- Group invites by requested workspace role.

## Notes

- The AI query generator is grounded to the available seeded event schemas, so prompts work best when they clearly imply one seeded event and one seeded property.
- Relative windows like `last 7 days`, `last 14 days`, and `last 30 days` are good matches for the seeded distributions.
- If you reseed and change the schema or event mix, update this file to keep the examples aligned.
