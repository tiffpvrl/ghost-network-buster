import gzip
from pathlib import Path

from ghost_network_buster.data_ingestion.tic_parse import extract_bh_npis_from_tic


def test_extract_bh_npis_synthetic_fixture() -> None:
    path = Path(__file__).resolve().parent / "fixtures" / "tic_synthetic.json"
    npis = extract_bh_npis_from_tic(path)
    assert npis == {"1234567893"}


def test_extract_bh_npis_gzipped_fixture(tmp_path: Path) -> None:
    src = Path(__file__).resolve().parent / "fixtures" / "tic_synthetic.json"
    gz = tmp_path / "tic_synthetic.json.gz"
    gz.write_bytes(gzip.compress(src.read_bytes()))
    npis = extract_bh_npis_from_tic(gz)
    assert npis == {"1234567893"}
