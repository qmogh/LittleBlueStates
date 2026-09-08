import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const DATASET_ID = '9b4c142c-69cc-4a96-a09a-7cf2ba7f5816'
const SOURCE_URL = `https://data.cms.gov/data-api/v1/dataset/${DATASET_ID}/data?filter%5BGnrc_Name%5D=Sildenafil%20Citrate&filter%5BPrscrbr_Geo_Lvl%5D=State&size=500`
const OUTPUT_PATH = resolve('src/data/sildenafil-2024.json')

const stateCodes = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT',
  '10': 'DE', '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL',
  '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD',
  '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE',
  '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND',
  '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC', '46': 'SD',
  '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV',
  '55': 'WI', '56': 'WY', '72': 'PR',
}

function number(value) {
  if (value === '' || value === undefined || value === null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function blankMetrics() {
  return { claims: 0, prescribers: 0, beneficiaries: 0, fills30Day: 0, drugCost: 0 }
}

function addMetrics(target, record) {
  target.claims += number(record.Tot_Clms) ?? 0
  target.prescribers += number(record.Tot_Prscrbrs) ?? 0
  target.beneficiaries += number(record.Tot_Benes) ?? 0
  target.fills30Day += number(record.Tot_30day_Fills) ?? 0
  target.drugCost += number(record.Tot_Drug_Cst) ?? 0
}

function brandKey(name) {
  if (name === 'Viagra') return 'viagra'
  if (name === 'Revatio') return 'revatio'
  return 'generic'
}

const response = await fetch(SOURCE_URL)
if (!response.ok) throw new Error(`CMS request failed: ${response.status} ${response.statusText}`)
const records = await response.json()
if (!Array.isArray(records)) throw new Error('CMS response was not an array')

const states = new Map()
for (const record of records) {
  const code = record.Prscrbr_Geo_Cd
  if (!stateCodes[code]) continue
  if (!states.has(code)) {
    states.set(code, {
      fips: code,
      code: stateCodes[code],
      name: record.Prscrbr_Geo_Desc,
      ...blankMetrics(),
      brands: { generic: blankMetrics(), viagra: blankMetrics(), revatio: blankMetrics() },
    })
  }
  const state = states.get(code)
  addMetrics(state, record)
  addMetrics(state.brands[brandKey(record.Brnd_Name)], record)
}

const snapshot = {
  metadata: {
    title: 'Medicare Part D Prescribers — by Geography and Drug',
    year: 2024,
    unit: 'claims (original prescriptions and refills)',
    scope: 'Medicare Part D claims for records with generic name Sildenafil Citrate',
    source: 'Centers for Medicare & Medicaid Services',
    sourceUrl: SOURCE_URL,
    datasetId: DATASET_ID,
    notes: [
      'Sildenafil Citrate includes brand and generic records; it is not synonymous with Viagra.',
      'The source is Medicare Part D, not all prescriptions in the United States.',
      'Blank source values are treated as unavailable and excluded from totals for that field.',
    ],
  },
  states: [...states.values()].sort((a, b) => a.name.localeCompare(b.name)),
}

await mkdir(dirname(OUTPUT_PATH), { recursive: true })
await writeFile(OUTPUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`)
console.log(`Wrote ${snapshot.states.length} state and territory records to ${OUTPUT_PATH}`)
