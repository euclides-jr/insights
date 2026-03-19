# Quickstart: Query Explorer Completion

## 1. Start the app

```bash
bun dev
```

Open `http://localhost:3000/query`.

## 2. Verify property filters

1. Select `Demo Web App`
2. Set `Event Name` to `purchase`
3. Add property filters:
   - `currency = USD`
   - `amount > 100`
4. Set `Aggregation` to `count`
5. Run the query

Expected:

- query succeeds
- result count matches the seeded purchase data
- chart toggle is enabled only if the returned shape is chart-eligible
- `Export CSV` and `Export JSON` remain disabled until results are present

## 3. Verify time bucketing

1. Select `Demo Web App`
2. Leave `Event Name` blank or choose `purchase`
3. Set `Aggregation` to `count`
4. Set `Group By` to `day`
5. Run the query

Expected:

- results are grouped by day
- rows are in chronological order
- chart view renders a time-series style result

## 4. Verify schema-aware pickers

1. Select `Demo Web App`
2. Enter `purchase` as `Event Name`
3. Open the aggregation-field picker
4. Open the group-by picker

Expected:

- schema-derived fields such as `amount` and `currency` appear
- manual entry remains possible if the field is not listed
- grouped queries expose sort controls, row limit, and next/previous page when multiple result pages exist

## 5. Verify report hydration

1. Configure a query and save it as a report
2. Open the saved report
3. Use the Query Explorer reopen flow

Expected:

- the Query Explorer form is prefilled from the saved config
- rerunning the query produces the same result shape
- the URL includes serialized query state that can be reopened directly

## 6. Verify exports

1. Run any grouped query
2. Click `Export CSV`
3. Click `Export JSON`

Expected:

- both exports complete from the current result set
- row contents match the rendered results
