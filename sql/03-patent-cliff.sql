-- Claim 3: when the patent ran out, prices collapsed on the pre-registered dates (data/manual/events.csv),
-- the coverage spread beyond Florida, and Medicare paid less for more.

-- @output national_by_year
WITH yearly AS (
  SELECT year,
    sum(claims) AS claims, sum(cost) AS cost,
    sum(claims) FILTER (WHERE brand = 'Viagra') AS viagra,
    sum(claims) FILTER (WHERE brand = 'Generic') AS generic,
    sum(claims) FILTER (WHERE brand = 'Revatio') AS revatio,
    sum(benes) AS benes
  FROM partd_geo WHERE level = 'National' GROUP BY year
)
SELECT year, claims::INT AS claims, round(cost)::INT AS cost, round(cost / claims, 2) AS cost_per_claim,
  viagra::INT AS viagra_claims, generic::INT AS generic_claims, revatio::INT AS revatio_claims,
  benes::INT AS benes_summed_across_labels,
  round(100 * claims / (SELECT claims FROM yearly WHERE year = 2017), 1) AS claims_index_2017,
  round(100 * (cost / claims) / (SELECT cost / claims FROM yearly WHERE year = 2017), 1) AS cost_per_claim_index_2017
FROM yearly ORDER BY year;

-- Monthly median NADAC per tablet for the four series that matter.
-- @output nadac_monthly
SELECT date_trunc('month', as_of_date)::DATE AS month,
  brand, mg::INT AS mg,
  round(median(per_unit), 4) AS per_tablet,
  count(DISTINCT ndc)::INT AS ndcs
FROM nadac
WHERE form = 'tablet' AND (mg = 100 OR mg = 20)
GROUP BY ALL ORDER BY month, brand, mg;

-- Pre-registered inflection check: for each series and event, mean price in the 6 months before vs
-- after, and the month (anywhere in the series) with the steepest month-over-month drop.
-- "Lands on the event" = steepest drop within 2 months of the event date.
-- @output inflections
WITH monthly AS (
  SELECT date_trunc('month', as_of_date)::DATE AS month, brand, mg, median(per_unit) AS price
  FROM nadac WHERE form = 'tablet' AND mg IN (20, 100) GROUP BY ALL
), changes AS (
  SELECT *, price / lag(price) OVER (PARTITION BY brand, mg ORDER BY month) - 1 AS mom
  FROM monthly
), steepest AS (
  SELECT brand, mg, arg_min(month, mom) AS steepest_drop_month, round(min(mom), 4) AS steepest_drop
  FROM changes GROUP BY brand, mg
), tests AS (
  SELECT * FROM (VALUES
    ('Generic', 100, DATE '2018-06-11', 'Teva exclusivity ends; more generics approved'),
    ('Generic', 100, DATE '2017-12-11', 'Generic Viagra launches'),
    ('Generic', 20, DATE '2012-11-06', 'Generic Revatio approved')
  ) t(brand, mg, event_date, event)
)
SELECT t.brand, t.mg, t.event_date, t.event, s.steepest_drop_month, s.steepest_drop,
  round(avg(m.price) FILTER (WHERE m.month >= t.event_date - INTERVAL 6 MONTH AND m.month < t.event_date), 4) AS mean_6mo_before,
  round(avg(m.price) FILTER (WHERE m.month >= t.event_date AND m.month < t.event_date + INTERVAL 6 MONTH), 4) AS mean_6mo_after,
  date_diff('month', t.event_date, s.steepest_drop_month)::INT AS months_after_event,
  -- NADAC starts Nov 2013, so the 2012 Revatio event has no "before" window: NULL = not testable here.
  CASE WHEN min(m.month) > t.event_date THEN NULL
       ELSE abs(date_diff('month', t.event_date, s.steepest_drop_month)) <= 2 END AS lands_on_event
FROM tests t
JOIN steepest s USING (brand, mg)
LEFT JOIN monthly m USING (brand, mg)
GROUP BY t.brand, t.mg, t.event_date, t.event, s.steepest_drop_month, s.steepest_drop
ORDER BY t.event_date;

-- Volume side of the inflection: which year did brand Viagra claims fall the most, and when
-- did the Viagra-strength generic label first appear (and with how many claims per beneficiary)?
-- @output volume_inflection
WITH v AS (
  SELECT year, claims, claims / lag(claims) OVER (ORDER BY year) - 1 AS yoy
  FROM partd_geo WHERE level = 'National' AND brand = 'Viagra'
)
SELECT
  (SELECT arg_min(year, yoy) FROM v WHERE year >= 2015) AS steepest_viagra_drop_year,
  (SELECT round(min(yoy), 4) FROM v WHERE year >= 2015) AS steepest_viagra_drop,
  (SELECT min(year) FROM partd_geo WHERE label = 'Generic (Viagra label)') AS generic_viagra_label_first_year,
  (SELECT round(claims / benes, 2) FROM partd_geo WHERE level = 'National' AND label = 'Generic (Viagra label)' AND year = 2017) AS first_year_claims_per_bene;

-- The week-by-week generic 100 mg price through the end of Teva's exclusivity and the drop.
-- @output cliff_weeks
SELECT as_of_date, round(median(per_unit), 4) AS per_tablet, count(DISTINCT ndc)::INT AS ndcs
FROM nadac
WHERE brand = 'Generic' AND form = 'tablet' AND mg = 100
  AND as_of_date BETWEEN DATE '2018-04-01' AND DATE '2018-12-31'
GROUP BY as_of_date ORDER BY as_of_date;
