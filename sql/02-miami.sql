-- Claim 2: for most of a decade, Medicare's Viagra claims came overwhelmingly from Florida,
-- and Florida's from Miami-Dade, where most plans offered the supplemental benefit.

-- @output florida_share
WITH fl AS (
  SELECT g.year,
    sum(g.claims) FILTER (WHERE s.state = 'FL' AND g.brand = 'Viagra') AS fl_viagra,
    sum(g.claims) FILTER (WHERE g.brand = 'Viagra') AS us_viagra,
    sum(g.claims) FILTER (WHERE s.state = 'FL') AS fl_all,
    sum(g.claims) AS us_all
  FROM partd_geo g JOIN state_codes s ON s.fips = g.fips
  WHERE g.level = 'State'
  GROUP BY g.year
), enrolled AS (
  SELECT year,
    sum(partd_benes) FILTER (WHERE state = 'FL') AS fl_partd,
    sum(partd_benes) AS us_partd
  FROM enrollment WHERE level = 'State' GROUP BY year
)
SELECT year,
  fl_viagra::INT AS fl_viagra_claims, us_viagra::INT AS us_viagra_claims,
  round(fl_viagra / us_viagra, 4) AS fl_share_of_viagra,
  round(fl_all / us_all, 4) AS fl_share_of_all_sildenafil,
  round(fl_partd / us_partd, 4) AS fl_share_of_partd_enrollees,
  (us_all - fl_all)::INT AS claims_outside_fl,
  fl_all::INT AS claims_in_fl
FROM fl JOIN enrolled USING (year)
ORDER BY year;

-- Claims per 1,000 Part D enrollees, by state and year (for the map and the FL-vs-rest ratio).
-- @output state_rates
SELECT g.year, s.state, s.state_name,
  sum(g.claims)::INT AS claims,
  sum(g.claims) FILTER (WHERE g.brand = 'Viagra')::INT AS viagra_claims,
  any_value(e.partd_benes)::INT AS partd_enrollees,
  round(1000 * sum(g.claims) / any_value(e.partd_benes), 2) AS claims_per_1000,
  round(1000 * coalesce(sum(g.claims) FILTER (WHERE g.brand = 'Viagra'), 0) / any_value(e.partd_benes), 2) AS viagra_per_1000
FROM partd_geo g
JOIN state_codes s ON s.fips = g.fips
JOIN enrollment e ON e.level = 'State' AND e.fips = g.fips AND e.year = g.year
WHERE g.level = 'State'
GROUP BY g.year, s.state, s.state_name
ORDER BY g.year, s.state;

-- Within Florida: Viagra-strength claims (brand + its generic) from prescribers in Miami and Hialeah.
-- Provider rows under 11 claims are suppressed, so these shares are of reported rows only.
-- @output miami_share
SELECT year,
  sum(claims) FILTER (WHERE city IN ('Miami', 'Hialeah'))::INT AS miami_hialeah_claims,
  sum(claims)::INT AS fl_reported_claims,
  round(sum(claims) FILTER (WHERE city IN ('Miami', 'Hialeah')) / sum(claims), 4) AS miami_hialeah_share,
  count(DISTINCT npi)::INT AS fl_prescribers
FROM providers
WHERE state = 'FL' AND label IN ('Viagra', 'Generic (Viagra label)')
GROUP BY year
ORDER BY year;

-- Top-10 prescriber concentration (a plan benefit spreads across many prescribers; a mill doesn't).
-- @output prescriber_concentration
WITH ranked AS (
  SELECT year, npi, sum(claims) AS claims,
    row_number() OVER (PARTITION BY year ORDER BY sum(claims) DESC) AS rank
  FROM providers
  WHERE state = 'FL' AND label IN ('Viagra', 'Generic (Viagra label)')
  GROUP BY year, npi
)
SELECT year, round(sum(claims) FILTER (WHERE rank <= 10) / sum(claims), 4) AS top10_share,
  count(*)::INT AS prescribers
FROM ranked GROUP BY year ORDER BY year;

-- Share of Part D plans covering Viagra-strength sildenafil (25/50/100 mg) as a supplemental benefit.
-- A plan offered in several counties counts once per area.
-- @output plan_coverage
WITH areas AS (
  SELECT plan_year, plan,
    CASE WHEN state = 'FL' AND county = 'MIAMI-DADE' THEN 'Miami-Dade'
         WHEN state = 'FL' THEN 'Rest of Florida'
         ELSE 'Rest of US' END AS area
  FROM plan_areas
), covering AS (
  SELECT DISTINCT plan_year, plan FROM supplemental_sildenafil WHERE mg IN (25, 50, 100)
)
SELECT a.plan_year, a.area,
  count(DISTINCT a.plan)::INT AS plans,
  count(DISTINCT c.plan)::INT AS covering_plans,
  round(count(DISTINCT c.plan) / count(DISTINCT a.plan), 4) AS covering_share
FROM areas a LEFT JOIN covering c USING (plan_year, plan)
GROUP BY ALL ORDER BY a.plan_year, a.area;

-- Medicare Advantage penetration: Miami-Dade vs the US.
-- @output ma_penetration
SELECT year,
  round(sum(ma_benes) FILTER (WHERE level = 'County' AND state = 'FL' AND county = 'MIAMI-DADE COUNTY')
      / sum(benes) FILTER (WHERE level = 'County' AND state = 'FL' AND county = 'MIAMI-DADE COUNTY'), 4) AS miami_dade_ma_share,
  round(sum(ma_benes) FILTER (WHERE level = 'National') / sum(benes) FILTER (WHERE level = 'National'), 4) AS us_ma_share
FROM enrollment GROUP BY year ORDER BY year;
