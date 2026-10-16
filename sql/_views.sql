-- Typed views over data/raw/*.csv (fetched by `npm run data:raw`). Every story query reads these.
-- Raw files are read as text and cast here, so a CMS formatting change fails loudly in one place.

-- RxNorm sildenafil concepts (RxNav /REST/rxcui/136411/related.json?tty=SCD+SBD).
CREATE OR REPLACE TABLE rxcui_strength AS
SELECT * FROM (VALUES
  ('577033', 20, 'tablet', 'Generic'), ('581645', 20, 'tablet', 'Revatio'),
  ('314228', 25, 'tablet', 'Generic'), ('213269', 25, 'tablet', 'Viagra'),
  ('312950', 50, 'tablet', 'Generic'), ('213270', 50, 'tablet', 'Viagra'),
  ('314229', 100, 'tablet', 'Generic'), ('213271', 100, 'tablet', 'Viagra'),
  ('1307427', 10, 'suspension', 'Generic'), ('1307431', 10, 'suspension', 'Revatio'),
  ('2637050', 10, 'suspension', 'Generic'), ('2637056', 10, 'suspension', 'Liqrev')
) t(rxcui, mg, form, brand);

-- Part D Prescribers by Geography and Drug. Until 2018 CMS published two generic labels:
-- "Sildenafil" (the 20 mg Revatio generic, on sale since Nov 2012) and "Sildenafil Citrate"
-- (the Viagra-strength generic, on sale since Dec 2017). From 2019 they are one label.
CREATE OR REPLACE VIEW partd_geo AS
SELECT
  year::INT AS year,
  Prscrbr_Geo_Lvl AS level,
  Prscrbr_Geo_Cd AS fips,
  Prscrbr_Geo_Desc AS geo,
  CASE Brnd_Name WHEN 'Viagra' THEN 'Viagra' WHEN 'Revatio' THEN 'Revatio' ELSE 'Generic' END AS brand,
  CASE
    WHEN Brnd_Name = 'Sildenafil' THEN 'Generic (Revatio label)'
    WHEN Brnd_Name = 'Sildenafil Citrate' AND year::INT <= 2018 THEN 'Generic (Viagra label)'
    WHEN Brnd_Name = 'Sildenafil Citrate' THEN 'Generic (merged label)'
    ELSE Brnd_Name
  END AS label,
  TRY_CAST(Tot_Clms AS DOUBLE) AS claims,
  TRY_CAST(Tot_Benes AS DOUBLE) AS benes,
  TRY_CAST(Tot_Prscrbrs AS DOUBLE) AS prescribers,
  TRY_CAST(Tot_30day_Fills AS DOUBLE) AS fills30,
  TRY_CAST(Tot_Drug_Cst AS DOUBLE) AS cost,
  TRY_CAST(GE65_Tot_Clms AS DOUBLE) AS claims_65
FROM read_csv('data/raw/partd-geo.csv', all_varchar = true);

-- Medicare Monthly Enrollment, annual rows. partd_benes = enrolled in any Part D plan.
CREATE OR REPLACE VIEW enrollment AS
SELECT
  YEAR::INT AS year,
  BENE_GEO_LVL AS level,
  BENE_STATE_ABRVTN AS state,
  BENE_STATE_DESC AS state_name,
  upper(BENE_COUNTY_DESC) AS county,
  BENE_FIPS_CD AS fips,
  TRY_CAST(TOT_BENES AS DOUBLE) AS benes,
  TRY_CAST(MA_AND_OTH_BENES AS DOUBLE) AS ma_benes,
  TRY_CAST(PRSCRPTN_DRUG_TOT_BENES AS DOUBLE) AS partd_benes
FROM read_csv('data/raw/enrollment.csv', all_varchar = true);

CREATE OR REPLACE VIEW state_codes AS
SELECT DISTINCT fips, state, state_name FROM enrollment WHERE level = 'State';

-- Part D Prescribers by Provider and Drug (rows with >= 11 claims; smaller rows are suppressed).
CREATE OR REPLACE VIEW providers AS
SELECT
  year::INT AS year,
  Prscrbr_NPI AS npi,
  Prscrbr_City AS city,
  Prscrbr_State_Abrvtn AS state,
  Prscrbr_Type AS specialty,
  CASE
    WHEN regexp_matches(Prscrbr_Type, 'Pulmonary|Cardiolog|Critical Care|Heart') THEN 'Lung & heart'
    WHEN Prscrbr_Type = 'Urology' THEN 'Urology'
    WHEN regexp_matches(Prscrbr_Type, 'Internal Medicine|Family|General Practice|Nurse Practitioner|Physician Assistant') THEN 'Primary care'
    ELSE 'Other'
  END AS specialty_group,
  CASE Brnd_Name WHEN 'Viagra' THEN 'Viagra' WHEN 'Revatio' THEN 'Revatio' ELSE 'Generic' END AS brand,
  CASE
    WHEN Brnd_Name = 'Sildenafil' THEN 'Generic (Revatio label)'
    WHEN Brnd_Name = 'Sildenafil Citrate' AND year::INT <= 2018 THEN 'Generic (Viagra label)'
    WHEN Brnd_Name = 'Sildenafil Citrate' THEN 'Generic (merged label)'
    ELSE Brnd_Name
  END AS label,
  TRY_CAST(Tot_Clms AS DOUBLE) AS claims,
  TRY_CAST(Tot_Day_Suply AS DOUBLE) AS days,
  TRY_CAST(Tot_Drug_Cst AS DOUBLE) AS cost,
  TRY_CAST(GE65_Tot_Clms AS DOUBLE) AS claims_65
FROM read_csv('data/raw/partd-providers-*.csv', all_varchar = true, union_by_name = true);

-- NADAC: one row per NDC per weekly file (as_of_date).
CREATE OR REPLACE VIEW nadac AS
SELECT
  ndc,
  ndc_description AS description,
  TRY_CAST(nadac_per_unit AS DOUBLE) AS per_unit,
  coalesce(TRY_CAST(as_of_date AS DATE), TRY_STRPTIME(as_of_date, '%m/%d/%Y')::DATE) AS as_of_date,
  pricing_unit,
  CASE
    WHEN ndc_description ILIKE 'VIAGRA%' THEN 'Viagra'
    WHEN ndc_description ILIKE 'REVATIO%' THEN 'Revatio'
    ELSE 'Generic'
  END AS brand,
  TRY_CAST(regexp_extract(ndc_description, '([0-9.]+) MG', 1) AS DOUBLE) AS mg,
  CASE
    WHEN ndc_description ILIKE '%TABLET%' THEN 'tablet'
    WHEN ndc_description ILIKE '%SUSP%' THEN 'suspension'
    ELSE 'other'
  END AS form
FROM read_csv('data/raw/nadac.csv', all_varchar = true);

-- NDC -> strength, from NADAC descriptions and the FDA NDC directory.
CREATE OR REPLACE VIEW ndc_strength AS
SELECT ndc, any_value(mg) AS mg, any_value(form) AS form, any_value(brand) AS brand
FROM (
  SELECT ndc, mg, form, brand FROM nadac
  UNION ALL
  SELECT
    ndc11,
    TRY_CAST(regexp_extract(strength, '^([0-9.]+) mg', 1) AS DOUBLE),
    CASE
      WHEN dosage_form ILIKE '%TABLET%' THEN 'tablet'
      WHEN dosage_form ILIKE '%SUSP%' THEN 'suspension'
      ELSE 'other'
    END,
    CASE upper(brand_name) WHEN 'VIAGRA' THEN 'Viagra' WHEN 'REVATIO' THEN 'Revatio' ELSE 'Generic' END
  FROM read_csv('data/raw/fda-ndc.csv', all_varchar = true)
)
GROUP BY ndc;

-- Medicaid State Drug Utilization Data. state = 'XX' rows are CMS's national totals.
CREATE OR REPLACE VIEW sdud AS
SELECT
  state,
  ndc,
  year::INT AS year,
  quarter::INT AS quarter,
  utilization_type,
  suppression_used = 'true' AS suppressed,
  TRY_CAST(units_reimbursed AS DOUBLE) AS units,
  TRY_CAST(number_of_prescriptions AS DOUBLE) AS rx,
  TRY_CAST(total_amount_reimbursed AS DOUBLE) AS amount
FROM read_csv('data/raw/sdud.csv', all_varchar = true);

-- Part D plan × county service areas from the quarterly formulary files (2019+).
CREATE OR REPLACE VIEW plan_areas AS
SELECT DISTINCT
  p.plan_year::INT AS plan_year,
  p.CONTRACT_ID || '-' || p.PLAN_ID AS plan,
  p.STATE AS state,
  upper(g.COUNTY) AS county
FROM read_csv('data/raw/formulary-plans.csv', all_varchar = true) p
LEFT JOIN read_csv('data/raw/formulary-counties.csv', all_varchar = true) g
  ON g.plan_year = p.plan_year AND g.COUNTY_CODE = p.COUNTY_CODE;

-- Excluded-drug (supplemental) coverage of sildenafil tablets. 2019 lists NDCs; 2020+ lists RXCUIs.
CREATE OR REPLACE VIEW supplemental_sildenafil AS
SELECT DISTINCT
  e.plan_year::INT AS plan_year,
  e.CONTRACT_ID || '-' || e.PLAN_ID AS plan,
  coalesce(r.mg, n.mg) AS mg,
  TRY_CAST(e.QUANTITY_LIMIT_AMOUNT AS DOUBLE) AS quantity_limit,
  TRY_CAST(e.QUANTITY_LIMIT_DAYS AS DOUBLE) AS quantity_limit_days,
  e.PRIOR_AUTH_YN = 'Y' AS prior_auth
FROM read_csv('data/raw/formulary-excluded.csv', all_varchar = true) e
LEFT JOIN rxcui_strength r ON r.rxcui = e.RXCUI
LEFT JOIN ndc_strength n ON n.ndc = e.NDC
WHERE coalesce(r.form, n.form) = 'tablet';

-- Basic (non-supplemental) formulary listings of sildenafil, by formulary.
CREATE OR REPLACE VIEW basic_sildenafil AS
SELECT
  f.plan_year::INT AS plan_year,
  f.FORMULARY_ID AS formulary,
  r.mg,
  r.form,
  f.PRIOR_AUTHORIZATION_YN = 'Y' AS prior_auth,
  f.QUANTITY_LIMIT_YN = 'Y' AS quantity_limited
FROM read_csv('data/raw/formulary-sildenafil.csv', all_varchar = true) f
JOIN rxcui_strength r ON r.rxcui = f.RXCUI;

CREATE OR REPLACE VIEW formularies AS
SELECT DISTINCT plan_year::INT AS plan_year, FORMULARY_ID AS formulary
FROM read_csv('data/raw/formulary-plans.csv', all_varchar = true);

CREATE OR REPLACE VIEW pfizer AS
SELECT * FROM read_csv('data/manual/pfizer-revenue.csv');

CREATE OR REPLACE VIEW events AS
SELECT * FROM read_csv('data/manual/events.csv');

CREATE OR REPLACE VIEW costplus AS
SELECT * FROM read_csv('data/raw/costplus.csv');

CREATE OR REPLACE VIEW spending AS
SELECT * FROM read_csv('data/raw/partd-spending.csv', all_varchar = true);
