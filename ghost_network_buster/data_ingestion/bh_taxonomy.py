"""
Behavioral-health NUCC / CMS taxonomy codes for NPPES filtering.

Expand or trim as needed; see https://nucc.org/index.php/code-sets-mainmenu-41-provider-taxonomy-mainmenu-40
"""

# Psychiatry, psychology, clinical social work, professional counseling, MFT, MH counselor, etc.
BEHAVIORAL_HEALTH_TAXONOMY_CODES: frozenset[str] = frozenset(
    {
        # Psychiatry / neuro
        "2084P0800X",  # psychiatry
        "2084P0010X",  # pediatric psychiatry
        # Psychology
        "103T00000X",  # psychologist
        "103K00000X",  # behavioral analyst
        # Social work
        "1041C0700X",  # LCSW
        # Counseling
        "101Y00000X",  # counselor
        "101YM0800X",  # mental health counselor
        "101YP1600X",  # pastoral counselor
        "101YP2500X",  # professional counselor
        # MFT
        "106H00000X",  # marriage & family therapist
        # Psychiatric MH nursing
        "363LP0808X",  # psychiatric/mental health NP
        "364SP0808X",  # psychiatric/mental health CNS
        # Rehabilitation / psych (optional)
        "225XP0019X",  # occupational therapist mental health
    }
)


def is_behavioral_health_taxonomy(code: str | None) -> bool:
    if not code:
        return False
    return code in BEHAVIORAL_HEALTH_TAXONOMY_CODES
