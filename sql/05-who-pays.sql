-- Claim 5: Medicare's basic drug benefit never paid for this. Every basic formulary that lists the
-- 20 mg tablet requires prior authorization (for pulmonary hypertension); no basic formulary lists
-- 25/50/100 mg. Viagra-strength coverage exists only as a supplemental extra, and after the generic
-- arrived, far more plans started offering it.

-- @output basic_formulary
SELECT f.plan_year,
  count(DISTINCT f.formulary)::INT AS formularies,
  count(DISTINCT b.formulary) FILTER (WHERE b.mg = 20 AND b.form = 'tablet')::INT AS list_20mg,
  round(avg(b.prior_auth::INT) FILTER (WHERE b.mg = 20 AND b.form = 'tablet'), 4) AS share_20mg_with_prior_auth,
  count(DISTINCT b.formulary) FILTER (WHERE b.mg IN (25, 50, 100))::INT AS list_viagra_strengths
FROM formularies f LEFT JOIN basic_sildenafil b USING (plan_year, formulary)
GROUP BY f.plan_year ORDER BY f.plan_year;

-- @output supplemental_share
WITH covering AS (
  SELECT plan_year, plan, mode(quantity_limit / nullif(quantity_limit_days, 0) * 30) AS tablets_per_30_days
  FROM supplemental_sildenafil WHERE mg IN (25, 50, 100) GROUP BY ALL
)
SELECT p.plan_year,
  count(DISTINCT p.plan)::INT AS plans,
  count(DISTINCT c.plan)::INT AS covering_plans,
  round(count(DISTINCT c.plan) / count(DISTINCT p.plan), 4) AS covering_share,
  mode(c.tablets_per_30_days) AS typical_tablets_per_30_days
FROM (SELECT DISTINCT plan_year, plan FROM plan_areas) p
LEFT JOIN covering c USING (plan_year, plan)
GROUP BY p.plan_year ORDER BY p.plan_year;

-- Prescriber specialty mix by label (reported provider rows only).
-- @output specialty_by_label
SELECT year, label, specialty_group,
  sum(claims)::INT AS claims,
  round(sum(claims) / sum(sum(claims)) OVER (PARTITION BY year, label), 4) AS share
FROM providers GROUP BY year, label, specialty_group ORDER BY year, label, specialty_group;

-- Estimate (not a measurement): what share of 2024's single generic label carries the
-- Viagra-strength fingerprint, using the two generic labels' fingerprints from 2018, the last
-- year CMS kept them apart. Share = (merged - revatio_label) / (viagra_label - revatio_label).
-- @output mixture_estimate
WITH spec AS (
  SELECT year, label,
    sum(claims) FILTER (WHERE specialty_group = 'Lung & heart') / sum(claims) AS lung_heart
  FROM providers WHERE year IN (2018, 2024) GROUP BY ALL
), age AS (
  SELECT year, label, claims_65 / claims AS share_65 FROM partd_geo
  WHERE level = 'National' AND year IN (2018, 2024)
), s AS (
  SELECT
    max(lung_heart) FILTER (WHERE label = 'Generic (Revatio label)') AS lh_pah,
    max(lung_heart) FILTER (WHERE label = 'Generic (Viagra label)') AS lh_ed,
    max(lung_heart) FILTER (WHERE label = 'Generic (merged label)') AS lh_2024
  FROM spec
), a AS (
  SELECT
    max(share_65) FILTER (WHERE label = 'Generic (Revatio label)') AS a_pah,
    max(share_65) FILTER (WHERE label = 'Generic (Viagra label)') AS a_ed,
    max(share_65) FILTER (WHERE label = 'Generic (merged label)') AS a_2024
  FROM age
), f AS (
  SELECT * FROM s, a
)
SELECT
  round(lh_pah, 4) AS lung_heart_revatio_label_2018, round(lh_ed, 4) AS lung_heart_viagra_label_2018,
  round(lh_2024, 4) AS lung_heart_merged_2024,
  round(least(1, greatest(0, (lh_2024 - lh_pah) / (lh_ed - lh_pah))), 3) AS viagra_pattern_share_by_specialty,
  round(a_pah, 4) AS age65_revatio_label_2018, round(a_ed, 4) AS age65_viagra_label_2018,
  round(a_2024, 4) AS age65_merged_2024,
  round(least(1, greatest(0, (a_2024 - a_pah) / (a_ed - a_pah))), 3) AS viagra_pattern_share_by_age
FROM f;

-- Medicaid excludes ED use too (SSA §1927(d)(2)). National SDUD prescriptions by strength.
-- @output medicaid_by_strength
SELECT s.year,
  sum(s.rx) FILTER (WHERE n.mg = 20 AND n.form = 'tablet')::INT AS rx_20mg,
  sum(s.rx) FILTER (WHERE n.mg IN (25, 50, 100) AND n.form = 'tablet')::INT AS rx_viagra_strengths,
  sum(s.rx) FILTER (WHERE n.form = 'suspension')::INT AS rx_suspension,
  sum(s.rx) FILTER (WHERE n.ndc IS NULL)::INT AS rx_unmatched_ndc
FROM sdud s LEFT JOIN ndc_strength n USING (ndc)
WHERE s.state = 'XX'
GROUP BY s.year ORDER BY s.year;
