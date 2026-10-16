-- "Done means" checks that don't depend on us. Each output row has a pass flag; the story shows
-- every row, including failures.

-- 1. Our national totals vs CMS Part D Spending by Drug (2020–2024 vintage; older vintages are not
--    published on data.cms.gov). Tolerance: generic within 1% of claims and spending; low-volume
--    brands within 100 claims.
-- @output reconcile_spending
WITH theirs AS (
  SELECT CASE Brnd_Name WHEN 'Sildenafil Citrate' THEN 'Generic' ELSE Brnd_Name END AS brand,
    unnest([2020, 2021, 2022, 2023, 2024]) AS year,
    unnest([Tot_Clms_2020, Tot_Clms_2021, Tot_Clms_2022, Tot_Clms_2023, Tot_Clms_2024])::DOUBLE AS claims,
    unnest([Tot_Spndng_2020, Tot_Spndng_2021, Tot_Spndng_2022, Tot_Spndng_2023, Tot_Spndng_2024])::DOUBLE AS spending
  FROM spending WHERE Mftr_Name = 'Overall'
), ours AS (
  SELECT brand, year, sum(claims) AS claims, sum(cost) AS cost
  FROM partd_geo WHERE level = 'National' GROUP BY ALL
)
SELECT year, brand, ours.claims::INT AS our_claims, theirs.claims::INT AS cms_claims,
  round(ours.claims / theirs.claims - 1, 4) AS claims_diff,
  round(ours.cost)::INT AS our_cost, round(theirs.spending)::INT AS cms_spending,
  round(ours.cost / theirs.spending - 1, 4) AS cost_diff,
  CASE WHEN brand = 'Generic'
       THEN abs(ours.claims / theirs.claims - 1) <= 0.01 AND abs(ours.cost / theirs.spending - 1) <= 0.01
       ELSE abs(ours.claims - theirs.claims) <= 100 END AS pass
FROM ours JOIN theirs USING (brand, year)
ORDER BY year, brand;

-- 2. Internal: state rows add up to the national row (they shouldn't exceed it; small gaps are
--    claims with no state, e.g. military/foreign addresses).
-- @output states_vs_national
SELECT year,
  sum(claims) FILTER (WHERE level = 'State')::INT AS state_sum,
  sum(claims) FILTER (WHERE level = 'National')::INT AS national,
  round(sum(claims) FILTER (WHERE level = 'State') / sum(claims) FILTER (WHERE level = 'National'), 4) AS coverage,
  sum(claims) FILTER (WHERE level = 'State') <= sum(claims) FILTER (WHERE level = 'National') AS pass
FROM partd_geo GROUP BY year ORDER BY year;

-- 3. NADAC per-tablet trend agrees with Part D cost per claim: both fall by more than half from
--    the last pre-generic year (2017) to 2021.
-- @output nadac_vs_cost_per_claim
WITH cpc AS (
  SELECT year, sum(cost) / sum(claims) AS cost_per_claim FROM partd_geo WHERE level = 'National' GROUP BY year
), tablet AS (
  -- What a Viagra-strength 100 mg tablet cost a pharmacy: brand until the generic has a NADAC.
  SELECT year(as_of_date) AS year,
    coalesce(median(per_unit) FILTER (WHERE brand = 'Generic'), median(per_unit) FILTER (WHERE brand = 'Viagra')) AS per_tablet
  FROM nadac WHERE form = 'tablet' AND mg = 100 GROUP BY 1
)
SELECT
  round((SELECT cost_per_claim FROM cpc WHERE year = 2021) / (SELECT cost_per_claim FROM cpc WHERE year = 2017) - 1, 4) AS cost_per_claim_change_2017_2021,
  round((SELECT per_tablet FROM tablet WHERE year = 2021) / (SELECT per_tablet FROM tablet WHERE year = 2017) - 1, 4) AS nadac_100mg_change_2017_2021,
  (SELECT cost_per_claim FROM cpc WHERE year = 2021) < 0.5 * (SELECT cost_per_claim FROM cpc WHERE year = 2017)
    AND (SELECT per_tablet FROM tablet WHERE year = 2021) < 0.5 * (SELECT per_tablet FROM tablet WHERE year = 2017) AS pass;

-- 4. Pfizer's US Viagra revenue and Part D Viagra claims move the same direction, year by year.
-- @output pfizer_direction
WITH paired AS (
  SELECT p.year, p.viagra_us_musd * 12 / p.months AS us_revenue, g.claims
  FROM pfizer p JOIN partd_geo g ON g.year = p.year AND g.level = 'National' AND g.brand = 'Viagra'
), changes AS (
  SELECT year,
    us_revenue / lag(us_revenue) OVER (ORDER BY year) - 1 AS revenue_change,
    claims / lag(claims) OVER (ORDER BY year) - 1 AS claims_change
  FROM paired
)
SELECT year, round(revenue_change, 4) AS pfizer_us_change, round(claims_change, 4) AS partd_claims_change,
  sign(revenue_change) = sign(claims_change) AS pass
FROM changes WHERE revenue_change IS NOT NULL ORDER BY year;
