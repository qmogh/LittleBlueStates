# Little Blue States

**Medicare doesn't pay for Viagra.** Federal law has excluded erectile-dysfunction drugs from Medicare's drug benefit since 2007, yet CMS data shows 327,372 Viagra claims in 2013. They were paid as optional plan extras, and for most of a decade nearly all of them came from Florida, mostly Miami. The story then follows the patent cliff, the national spread of the extra, the brand's price, and the cash market Medicare can't see. It ends with an interactive state map.

## Data

Every number in the story is computed by a DuckDB query in `sql/` from raw public files:

| Source | Script | Used for |
|---|---|---|
| CMS Part D Prescribers by Geography and Drug, 2013–2024 | `raw-partd-geo.mjs` | Claims, cost, age mix by brand label, state, year |
| CMS Part D Prescribers by Provider and Drug, 2013–2024 | `raw-partd-providers.mjs` | Prescriber city and specialty (rows with 11+ claims) |
| CMS Part D Spending by Drug (2020–2024) | `raw-partd-spending.mjs` | Reconciliation only |
| CMS quarterly Part D formulary files, 2019–2026 | `raw-formulary.mjs` | Which plans cover sildenafil, by strength and county |
| CMS Medicare Monthly Enrollment | `raw-enrollment.mjs` | Per-enrollee rates, Medicare Advantage share |
| NADAC (Medicaid), weekly, 2013–present | `raw-nadac.mjs` | Pharmacy cost per tablet |
| Medicaid State Drug Utilization Data, 2010–present | `raw-sdud.mjs` | Medicaid comparison by strength |
| openFDA NDC directory, Cost Plus Drugs price list | `raw-ndc.mjs` | NDC strengths, cash prices |
| Pfizer SEC filings, FDA/patent dates | `data/manual/*.csv` | Hand-entered, each row sourced |

```sh
npm run data:raw     # fetch raw extracts into data/raw/ (gitignored, ~15 min)
npm run data:story   # run sql/*.sql → src/data/story/*.json
```

`sql/07-checks.sql` holds the independent checks shown at the bottom of the page: reconciliation against CMS Spending by Drug, the pre-registered FDA dates, NADAC against cost per claim, and Pfizer revenue. Two of them fail, and the page says so.

The map still uses `npm run data:build` and the `data:providers*` scripts described in earlier commits.

## Development

```sh
npm install
npm run dev
```

`npm run build` refreshes the data snapshot, type-checks the app, and produces the production bundle.

## Roadmap

1. **Map MVP (complete):** normalized 2024 data, selectable state map, metrics, brand filter, and state profile.
2. **The blue-to-beige story (complete):** 2013–2024 time machine, generic-share trend, and a deeper state receipt.
3. **Provider layer (complete):** add 2024 city and specialty aggregates from CMS's provider-and-drug release, explicitly labeled as prescriber practice locations.
4. **Fair comparisons (complete):** claims per 1,000 Part D enrollees view.
5. **Data story (complete):** six sourced chapters plus independent checks.
6. **Ship:** visual/accessibility QA, deployment, and an automated data-refresh check.
