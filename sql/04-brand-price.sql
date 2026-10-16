-- Claim 4: brand Viagra raised its price while it lost the market; Pfizer's US revenue fell in step
-- with Part D's Viagra claims.

-- Annual mean NADAC per tablet, 100 mg: brand vs generic.
-- @output brand_vs_generic
WITH annual AS (
  SELECT year(as_of_date) AS year, brand, avg(per_unit) AS per_tablet
  FROM nadac WHERE form = 'tablet' AND mg = 100 AND brand IN ('Viagra', 'Generic')
  GROUP BY ALL
)
SELECT year,
  round(avg(per_tablet) FILTER (WHERE brand = 'Viagra'), 2) AS viagra_100mg,
  round(avg(per_tablet) FILTER (WHERE brand = 'Generic'), 4) AS generic_100mg,
  round(avg(per_tablet) FILTER (WHERE brand = 'Viagra') / avg(per_tablet) FILTER (WHERE brand = 'Generic'), 0) AS brand_multiple
FROM annual GROUP BY year ORDER BY year;

-- Viagra is priced per tablet, not per milligram (a 100 mg tablet split in four is four doses).
-- @output strength_flat_pricing
SELECT mg::INT AS mg, round(median(per_unit), 2) AS per_tablet_2014
FROM nadac WHERE brand = 'Viagra' AND form = 'tablet' AND year(as_of_date) = 2014
GROUP BY mg ORDER BY mg;

-- @output pfizer_vs_partd
WITH partd AS (
  SELECT year, claims, cost FROM partd_geo WHERE level = 'National' AND brand = 'Viagra'
)
SELECT p.year, p.viagra_us_musd, p.viagra_worldwide_musd, p.months,
  partd.claims::INT AS partd_viagra_claims, round(partd.cost)::INT AS partd_viagra_cost,
  round(100 * p.viagra_us_musd / (SELECT viagra_us_musd FROM pfizer WHERE year = 2016), 1) AS pfizer_us_index_2016,
  round(100 * partd.claims / (SELECT claims FROM partd WHERE year = 2016), 1) AS partd_claims_index_2016,
  p.source_url
FROM pfizer p LEFT JOIN partd USING (year)
ORDER BY p.year;

-- Revatio: the brand that stayed on, at a rising cost per claim (formulation mix not separable here).
-- @output revatio
SELECT year, claims::INT AS claims, benes::INT AS benes, round(cost / claims, 2) AS cost_per_claim
FROM partd_geo WHERE level = 'National' AND brand = 'Revatio' ORDER BY year;
