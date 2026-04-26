"""Mental / behavioral health billing codes commonly found in TiC in-network files."""

# Psychotherapy & diagnostic (CPT)
MH_CPT_CODES: frozenset[str] = frozenset(
    {
        "90791",
        "90792",
        "90832",
        "90833",
        "90834",
        "90836",
        "90837",
        "90838",
        "90839",
        "90840",
        "90845",
        "90846",
        "90847",
        "90849",
        "90853",
        "90863",
        "90875",
    }
)

# Selected HCPCS used for BH (plans vary)
MH_HCPCS_CODES: frozenset[str] = frozenset(
    {
        "H0001",
        "H0002",
        "H0003",
        "H0004",
        "H0031",
        "H0032",
        "H0046",
        "H2010",
        "H2011",
        "H2012",
        "H2013",
        "H2014",
        "H2015",
        "H2016",
        "H2017",
        "H2018",
        "H2019",
        "H2020",
    }
)


def normalize_code(raw: str | int | None) -> str | None:
    if raw is None:
        return None
    s = str(raw).strip().upper()
    if not s:
        return None
    # strip CPT modifiers after colon/dash
    for sep in (":", "-", " "):
        if sep in s:
            s = s.split(sep, 1)[0]
    return s
