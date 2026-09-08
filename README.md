# Little Blue States

An interactive atlas of publicly reported Medicare Part D claims for records with the generic name **Sildenafil Citrate**. Select a state to compare claims, beneficiaries, prescribers, total drug cost, and the mix of generic sildenafil, Viagra, and Revatio.

## Data scope

The first release uses CMS's 2024 *Medicare Part D Prescribers — by Geography and Drug* dataset. It captures Medicare Part D claims (original prescriptions and refills), not every prescription in the United States. Sildenafil is not synonymous with Viagra and has uses beyond erectile dysfunction, so the app keeps the brand breakdown explicit.

The normalized snapshot is committed at `src/data/sildenafil-2024.json`. Rebuild it from the public CMS API with:

```sh
npm run data:build
```

## Development

```sh
npm install
npm run dev
```

`npm run build` refreshes the data snapshot, type-checks the app, and produces the production bundle.

## Roadmap

1. **Map MVP (complete):** normalized 2024 data, selectable state map, metrics, brand filter, and state profile.
2. **Fair comparisons:** add Census population denominators and an explicit per-capita toggle.
3. **Time machine:** ingest the 2013–2024 CMS releases, add a year control, trend chart, and state-versus-national comparison.
4. **Story layer:** call out notable patterns, document methodology/suppression behavior, and add shareable state URLs.
5. **Ship:** visual/accessibility QA, deployment, and an automated data-refresh check.

