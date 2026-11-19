#!/usr/bin/env python3
"""Extract the two Ril-808 catalogs into JSON seeds the app can import.

Usage: python3 scripts/extract_katalog.py
Reads from ~/Desktop/ and writes to src/features/kostenermittlung/data/.
"""
import json
import os
import sys
from pathlib import Path

from openpyxl import load_workbook

HOME = Path.home()
SRC_KGK = HOME / 'Desktop' / 'Datenbank gem. Ril 808.xlsx'
SRC_FREI = HOME / 'Desktop' / 'Datenbank_freie_Einheitspreise (1).xlsx'

OUT_DIR = Path(__file__).resolve().parent.parent / 'src' / 'features' / 'kostenermittlung' / 'data'


# Normalize messy unit strings. The free DB mixes St/st/St./"St; st" etc. —
# fold these onto a single canonical form the Positionen tab can show.
UNIT_MAP = {
    'st': 'St',
    'st.': 'St',
    'St.': 'St',
    'St; st': 'St',
    'm2': 'm²',
    'm3': 'm³',
    'lfd. m; lfdm': 'lfdm',
    'lfd. m': 'lfdm',
    'je Weiche': 'St',
}


def norm_unit(u):
    if not u:
        return None
    s = str(u).strip()
    return UNIT_MAP.get(s, s)


def to_str(v):
    if v is None:
        return None
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v)


def to_num(v):
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return v
    return None


def extract_kgk():
    wb = load_workbook(SRC_KGK, data_only=True, read_only=True)
    ws = wb['Datenbank']
    entries = []
    # header row is row 7; data starts row 8
    for r in ws.iter_rows(min_row=8, values_only=True):
        code = r[0]
        if code is None:
            continue
        code = to_str(code)
        entries.append(
            {
                'code': code,
                'ebene': int(r[1]) if r[1] is not None else None,
                'bezeichnung': r[2],
                'einheit': norm_unit(r[3]),
                'anmerkung': r[4],
                'pfad': r[5],
                'codeInQuelle': r[6],
                'parent': to_str(r[7]),
                'kostengliederung': r[8],
                'ebene1': r[9],
                'ebene2': r[10],
                'ebene3': r[11],
                'ebene4': r[12],
                'ebene5': r[13],
                'ebene6': r[14],
                'faktor': to_num(r[15]),
                'epVon': to_num(r[16]),
                'epBis': to_num(r[17]),
                'epEinheit': norm_unit(r[18]),
                'epAktuellVon': to_num(r[19]),
                'epAktuellBis': to_num(r[20]),
                'epAktuellEinheit': norm_unit(r[21]),
            }
        )
    return entries


def extract_frei():
    wb = load_workbook(SRC_FREI, data_only=True, read_only=True)
    ws = wb['Freie Datenbank']
    out = []
    for i, r in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        bez = r[0]
        if not bez:
            continue
        anmerkung = r[1] if r[1] != 'k.A.' else None
        betrag = r[2]
        einheit = norm_unit(r[3])
        if not isinstance(betrag, (int, float)):
            betrag = None
        out.append(
            {
                'id': i,  # stable row id for keys
                'bezeichnung': bez,
                'anmerkung': anmerkung,
                'betrag': betrag,
                'einheit': einheit,
            }
        )
    return out


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    kgk = extract_kgk()
    frei = extract_frei()
    meta = {
        'quartal': 'Q3/2026',
        'faktor': 141.7,
        'quelle': 'Ril 808.0210A01, gültig ab 14.03.2022',
        'kgkCount': len(kgk),
        'freiCount': len(frei),
        'kgkMitPreis': sum(1 for e in kgk if e['epVon'] is not None),
        'freiMitPreis': sum(1 for e in frei if e['betrag'] is not None),
    }
    (OUT_DIR / 'katalog_kgk.json').write_text(
        json.dumps(kgk, ensure_ascii=False, separators=(',', ':')) + '\n'
    )
    (OUT_DIR / 'katalog_frei.json').write_text(
        json.dumps(frei, ensure_ascii=False, separators=(',', ':')) + '\n'
    )
    (OUT_DIR / 'katalogMeta.json').write_text(
        json.dumps(meta, ensure_ascii=False, indent=2) + '\n'
    )
    print(f'wrote {len(kgk)} KGK entries, {len(frei)} free entries')
    print(f'meta: {meta}')


if __name__ == '__main__':
    main()
