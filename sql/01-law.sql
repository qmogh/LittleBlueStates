-- Claim 1: Part D has excluded erectile-dysfunction drugs since 2007 (Pub. L. 109-91 §103),
-- yet CMS logged hundreds of thousands of Viagra claims — paid as optional supplemental benefits.

-- @output viagra_by_year
SELECT year, claims::INT AS claims, benes::INT AS benes, prescribers::INT AS prescribers,
  round(cost)::INT AS cost, round(cost / claims, 2) AS cost_per_claim
FROM partd_geo
WHERE level = 'National' AND brand = 'Viagra'
ORDER BY year;

-- Fill fingerprint by label: ED fills are a few tablets, mostly 65+; PAH fills are ~90 tablets.
-- @output label_fingerprint
SELECT year, label, claims::INT AS claims, benes::INT AS benes,
  round(cost / claims, 2) AS cost_per_claim,
  round(claims / benes, 2) AS claims_per_bene,
  round(claims_65 / claims, 4) AS share_65_plus
FROM partd_geo
WHERE level = 'National'
ORDER BY year, label;
