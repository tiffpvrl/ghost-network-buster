# Building a real call list (NPPES + Aetna TiC)

This pipeline implements the **NPPES API × Aetna Transparency in Coverage (TiC) in-network MRF** join described in your research brief.

## 1. NPPES (always)

- Pulls **behavioral-health** taxonomies (psychiatry, psychology, LCSW, LPC, MFT, etc.) for each **5-digit ZIP** in `data/nyc_zips_core.json`.
- Uses the public API: `https://npiregistry.cms.hhs.gov/api/` (v2.1), with pagination and a small delay between calls.
- **Limitation:** many ZIPs = many HTTP requests. Use `--max-zips` for a demo slice.

## 2. Aetna TiC in-network file

1. Open Aetna’s **machine-readable** portal (search: *Aetna transparency in coverage machine readable* → `health1.aetna.com` TOC).
2. Download **one** `in-network-rates` JSON file for a **commercial** plan that applies to your geography (e.g. NY PPO). Files are often **very large** (GB), sometimes shipped as **`.json.gz`**.
3. Pass the local path as `--tic-file` — **plain `.json` or `.json.gz`**. You do **not** need to `gunzip` first: gzip is decompressed **in a stream** while parsing, so you avoid needing free disk space for a full uncompressed copy.

The parser **streams** with `ijson` and keeps NPIs that appear on rows whose `billing_code` is a **mental-health CPT/HCPCS** (see `mh_cpt.py`).

## 3. Join

- **With `--tic-file`:** output = NPI ∈ (NPPES BH in ZIPs) ∩ (TiC MH NPIs).
- **`--nppes-only`:** output = NPPES BH only (not “in-network Aetna,” useful to test phones).

## 4. Run

From repo root (with venv activated):

```bash
pip install -e .

# Small NPPES sample (8 zips), no TiC
python -m ghost_network_buster.data_ingestion.join_providers --nppes-only --max-zips 8

# Full join (after you download an MRF — .json or .json.gz)
python -m ghost_network_buster.data_ingestion.join_providers \
  --tic-file ./2026-04-05_pl-bq-hr23_Aetna-Health-Insurance-Company-of-New-York.json.gz \
  --output data/providers_aetna_nyc.json
```

Outputs:

- `data/providers_aetna_nyc.json` — array of `{npi,name,phone,specialty}` (drop-in for the app if you point `main.py` at this file or replace `providers_sample.json`).
- `*.meta.json` — counts and paths for your README / paper trail.

## 5. Point the API at the new file

Set **`PROVIDERS_DATA_FILE`** in `.env` to the output path (or replace `data/providers_sample.json`).
