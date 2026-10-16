// CMS release locations shared by the build and raw-fetch scripts.

// Medicare Part D Prescribers — by Geography and Drug (data.cms.gov API dataset ids).
export const PARTD_GEO_DATASET_IDS = {
  2013: "9aec2a70-4ef2-438a-bc35-1747fe2492c9",
  2014: "63099eb4-6c9e-4fec-8c9e-b6b132f1b7f4",
  2015: "73748d0b-2acb-420a-ac66-27d8e238fdc8",
  2016: "c5b3c840-5eb2-4e4c-ac35-c30995dcb051",
  2017: "7863e41c-3f6f-4889-93a8-be65e9f3d073",
  2018: "b083c9b6-b841-4676-8d0a-fb03ee1431a1",
  2019: "73a6335e-f16f-4c81-a84b-6b5a986e2bf8",
  2020: "83891e77-99cf-4865-b60a-97703b916e09",
  2021: "7dda2a9d-034a-446a-b4b3-e1254e0127b2",
  2022: "1fc57194-a51d-4864-aee6-de0889488151",
  2023: "3463648b-1971-478d-84ca-80cadc758153",
  2024: "9b4c142c-69cc-4a96-a09a-7cf2ba7f5816",
};

// Medicare Part D Prescribers — by Provider and Drug (full CSV per data year).
export const PARTD_PROVIDER_CSV_URLS = {
  2013: "https://data.cms.gov/sites/default/files/2024-05/5fb694b1-2ec5-4e00-8efe-14161bdbdbea/MUP_DPR_RY24_P04_V10_DY13_NPIBN.csv",
  2014: "https://data.cms.gov/sites/default/files/2024-05/06e87540-68a5-4a10-bf9c-a0521dc4ebed/MUP_DPR_RY24_P04_V10_DY14_NPIBN.csv",
  2015: "https://data.cms.gov/sites/default/files/2024-05/bc1caf7f-dcbb-4258-b243-ee3666b6a20b/MUP_DPR_RY24_P04_V10_DY15_NPIBN.csv",
  2016: "https://data.cms.gov/sites/default/files/2024-05/67c457c6-b62d-424f-ad85-2bb8117c928d/MUP_DPR_RY24_P04_V10_DY16_NPIBN.csv",
  2017: "https://data.cms.gov/sites/default/files/2024-05/d9d685a0-dc49-4da5-9416-4cf3e6349296/MUP_DPR_RY24_P04_V10_DY17_NPIBN.csv",
  2018: "https://data.cms.gov/sites/default/files/2024-05/be3019b4-1164-4b40-af5d-cab40847d222/MUP_DPR_RY24_P04_V10_DY18_NPIBN.csv",
  2019: "https://data.cms.gov/sites/default/files/2024-05/129e7c21-d492-425b-be03-d2e59d933ab6/MUP_DPR_RY24_P04_V10_DY19_NPIBN.csv",
  2020: "https://data.cms.gov/sites/default/files/2024-05/75fecc51-c9e8-4904-b570-9da9dc101721/MUP_DPR_RY24_P04_V10_DY20_NPIBN.csv",
  2021: "https://data.cms.gov/sites/default/files/2024-05/43359391-e7fa-40b9-9bd4-5dc295e18712/MUP_DPR_RY24_P04_V10_DY21_NPIBN.csv",
  2022: "https://data.cms.gov/sites/default/files/2024-05/18f82097-61a6-4889-9941-9a0b6ad7523c/MUP_DPR_RY24_P04_V10_DY22_NPIBN.csv",
  2023: "https://data.cms.gov/sites/default/files/2025-04/0d5915ce-002c-4d87-bde8-24ffb08bb6cc/MUP_DPR_RY25_P04_V10_DY23_NPIBN.csv",
  2024: "https://data.cms.gov/sites/default/files/2026-05/0ae165f4-eb44-495d-8cac-67f4571b6b83/MUP_DPR_RY26_P04_V10_DY24_NPIBN.csv",
};
