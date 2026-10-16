-- Claim 6: outside insurance, the pill now costs pennies — less than Medicare's average claim,
-- and a market Medicare data can't see opened the same quarter as the generic.

-- @output costplus
SELECT fetched_on, strength, price_per_unit, cash_dispensing_fee,
  round(30 * price_per_unit + cash_dispensing_fee + 5.25, 2) AS total_30_tablets_shipped,
  round(90 * price_per_unit + cash_dispensing_fee + 5.25, 2) AS total_90_tablets_shipped
FROM costplus ORDER BY TRY_CAST(regexp_extract(strength, '[0-9]+') AS INT);

-- Part D gross spending per tablet (before rebates; includes dispensing fees) vs pharmacy
-- acquisition cost (NADAC), generic sildenafil, all strengths.
-- @output partd_vs_nadac
WITH partd AS (
  SELECT year, spend / units AS partd_per_unit, spend / claims AS partd_per_claim
  FROM (
    SELECT unnest([2020, 2021, 2022, 2023, 2024]) AS year,
      unnest([Tot_Spndng_2020, Tot_Spndng_2021, Tot_Spndng_2022, Tot_Spndng_2023, Tot_Spndng_2024])::DOUBLE AS spend,
      unnest([Tot_Dsg_Unts_2020, Tot_Dsg_Unts_2021, Tot_Dsg_Unts_2022, Tot_Dsg_Unts_2023, Tot_Dsg_Unts_2024])::DOUBLE AS units,
      unnest([Tot_Clms_2020, Tot_Clms_2021, Tot_Clms_2022, Tot_Clms_2023, Tot_Clms_2024])::DOUBLE AS claims
    FROM spending WHERE Brnd_Name = 'Sildenafil Citrate' AND Mftr_Name = 'Overall'
  )
), acquisition AS (
  SELECT year(as_of_date) AS year,
    median(per_unit) FILTER (WHERE mg = 20) AS nadac_20mg,
    median(per_unit) FILTER (WHERE mg = 100) AS nadac_100mg
  FROM nadac WHERE brand = 'Generic' AND form = 'tablet' GROUP BY 1
)
SELECT year, round(partd_per_unit, 3) AS partd_per_unit, round(partd_per_claim, 2) AS partd_per_claim,
  round(nadac_20mg, 3) AS nadac_20mg, round(nadac_100mg, 3) AS nadac_100mg,
  round(partd_per_unit / nadac_20mg, 1) AS partd_multiple_of_nadac_20mg
FROM partd JOIN acquisition USING (year) ORDER BY year;
