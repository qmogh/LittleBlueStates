# Little Blue States

An interactive atlas of publicly reported Medicare Part D claims for records with the generic name **Sildenafil Citrate**. Select a state to compare claims, beneficiaries, prescribers, total drug cost, and the mix of generic sildenafil, Viagra, and Revatio.

## Data scope

The first release uses CMS's 2024 _Medicare Part D Prescribers — by Geography and Drug_ dataset. It captures Medicare Part D claims (original prescriptions and refills), not every prescription in the United States. Sildenafil is not synonymous with Viagra and has uses beyond erectile dysfunction, so the app keeps the brand breakdown explicit.

The normalized snapshot is committed at `src/data/sildenafil-2024.json`. Rebuild it from the public CMS API with:

```sh
npm run data:build
```

The state receipt also includes a 2024 provider-practice footprint: reported sildenafil claims grouped by the prescriber's practice city and specialty. It is committed at `src/data/provider-footprint-2024.json`. Rebuild it by streaming the public CMS provider-and-drug CSV (the raw file is not saved locally):

```sh
npm run data:providers
```

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
4. **Fair comparisons:** add Census population denominators and an explicit per-capita toggle.
5. **Ship:** visual/accessibility QA, deployment, and an automated data-refresh check.
