// FDA NDC directory (openFDA) and Cost Plus Drugs price list, sildenafil packages only.
import { fetchJson, writeCsv } from "./lib/raw.mjs";

// 4-4-2, 5-3-2, and 5-4-1 package codes all normalize to the 11-digit 5-4-2 billing format.
function ndc11(packageNdc) {
  const [labeler, product, pack] = packageNdc.split("-");
  return labeler.padStart(5, "0") + product.padStart(4, "0") + pack.padStart(2, "0");
}

const { results } = await fetchJson(
  "https://api.fda.gov/drug/ndc.json?search=generic_name:sildenafil&limit=1000",
);
await writeCsv(
  "fda-ndc.csv",
  results.flatMap((product) =>
    (product.packaging ?? []).map((pack) => ({
      ndc11: ndc11(pack.package_ndc),
      package_ndc: pack.package_ndc,
      brand_name: product.brand_name,
      dosage_form: product.dosage_form,
      strength: product.active_ingredients?.map(({ strength }) => strength).join(";"),
      labeler_name: product.labeler_name,
      marketing_category: product.marketing_category,
      application_number: product.application_number,
      package_description: pack.description,
    })),
  ),
);

const pricelist = await fetchJson("https://api.costplusdrugs.com/pricelist/cpd");
await writeCsv(
  "costplus.csv",
  pricelist
    .filter(({ medication_name }) => /sildenafil/i.test(medication_name))
    .map(({ medication_name, brand_name, form, strength, rxnorm_id, cpd_channel }) => ({
      fetched_on: new Date().toISOString().slice(0, 10),
      medication_name,
      brand_name,
      form,
      strength,
      rxnorm_id,
      price_per_unit: cpd_channel.price_per_unit,
      cash_dispensing_fee: cpd_channel.cash_dispensing_fee,
      cash_shipping_cost: cpd_channel.cash_shipping_cost,
    })),
);
