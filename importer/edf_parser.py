"""
EDF/EDF+ binary parser for ResMed CPAP data.

Key ResMed deviation from EDF+ spec:
  - EVE files use \x15 (not \x14) to separate onset from duration in event TALs.
  - Standard: +onset\x14duration\x14annotation\x14
  - ResMed:   +onset\x15duration\x14annotation\x14
"""

import struct
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional


@dataclass
class EDFSignal:
    label: str
    dim: str
    pmin: float
    pmax: float
    dmin: float
    dmax: float
    num_samples_per_record: int
    gain: float = field(init=False)
    offset: float = field(init=False)

    def __post_init__(self):
        drange = self.dmax - self.dmin
        if drange == 0:
            self.gain = 1.0
            self.offset = 0.0
        else:
            self.gain = (self.pmax - self.pmin) / drange
            self.offset = self.pmin - self.dmin * self.gain

    def scale(self, raw: int) -> float:
        return raw * self.gain + self.offset


@dataclass
class EDFHeader:
    start_datetime: datetime
    num_records: int
    duration_per_record: float
    device_serial: str
    signals: list
    is_edfplus: bool


def _parse_header(data: bytes) -> EDFHeader:
    """Parse the 256-byte main EDF header + signal headers from raw bytes."""
    startdate = data[168:176].decode('ascii').strip()   # DD.MM.YY
    starttime = data[176:184].decode('ascii').strip()   # HH.MM.SS
    recording = data[88:168].decode('ascii')

    dd, mm, yy = startdate.split('.')
    hh, mi, ss = starttime.split('.')
    year = 2000 + int(yy)
    start_dt = datetime(year, int(mm), int(dd), int(hh), int(mi), int(ss))

    srn_match = re.search(r'SRN=(\S+)', recording)
    device_serial = srn_match.group(1) if srn_match else ''

    ns = int(data[252:256].strip())
    num_records = int(data[236:244].strip())
    duration_str = data[244:252].strip().decode('ascii')
    duration = float(duration_str) if duration_str else 0.0
    reserved = data[192:236].decode('ascii').strip()
    is_edfplus = reserved.startswith('EDF+')

    # Signal headers: each field stored as ns-length arrays
    sig_raw = data[256 : 256 + ns * 256]

    signals = []
    for i in range(ns):
        label = sig_raw[i*16        : (i+1)*16].decode('ascii').strip()
        dim   = sig_raw[ns*96+i*8   : ns*96+(i+1)*8].decode('ascii').strip()
        pmin  = float(sig_raw[ns*104+i*8 : ns*104+(i+1)*8].strip())
        pmax  = float(sig_raw[ns*112+i*8 : ns*112+(i+1)*8].strip())
        dmin  = float(sig_raw[ns*120+i*8 : ns*120+(i+1)*8].strip())
        dmax  = float(sig_raw[ns*128+i*8 : ns*128+(i+1)*8].strip())
        spr   = int(sig_raw[ns*216+i*8  : ns*216+(i+1)*8].strip())
        signals.append(EDFSignal(label, dim, pmin, pmax, dmin, dmax, spr))

    return EDFHeader(start_dt, num_records, duration, device_serial, signals, is_edfplus)


def read_header(path: str) -> EDFHeader:
    """Read only the EDF header from a file (fast, no data read)."""
    with open(path, 'rb') as f:
        raw = f.read(256)
        ns = int(raw[252:256].strip())
        sig_bytes = f.read(ns * 256)
    return _parse_header(raw + sig_bytes)


def parse_pld(path: str) -> tuple:
    """
    Parse a PLD (processed/derived metrics) EDF file.

    Returns:
        (EDFHeader, dict[label -> list[float]])
        Crc16 channel is excluded. All values are in physical units.
    """
    with open(path, 'rb') as f:
        raw = f.read(256)
        ns = int(raw[252:256].strip())
        sig_bytes = f.read(ns * 256)
        data_bytes = f.read()

    header = _parse_header(raw + sig_bytes)
    samples_per_record = sum(s.num_samples_per_record for s in header.signals)
    channels = {s.label: [] for s in header.signals if s.label != 'Crc16'}

    for rec in range(header.num_records):
        start = rec * samples_per_record * 2
        record_bytes = data_bytes[start : start + samples_per_record * 2]
        if len(record_bytes) < samples_per_record * 2:
            break
        all_samples = struct.unpack(f'<{samples_per_record}h', record_bytes)

        idx = 0
        for sig in header.signals:
            raw_vals = all_samples[idx : idx + sig.num_samples_per_record]
            idx += sig.num_samples_per_record
            if sig.label == 'Crc16':
                continue
            channels[sig.label].extend(sig.scale(v) for v in raw_vals)

    return header, channels


def parse_eve(path: str) -> tuple:
    """
    Parse an EVE (events) EDF+ file.

    Returns:
        (EDFHeader, list of (onset_seconds: float, duration_seconds: float, event_type: str))
        'Recording starts' annotations are excluded.

    CRITICAL: ResMed uses \\x15 between onset and duration (not \\x14 as per EDF+ spec).
    """
    with open(path, 'rb') as f:
        raw = f.read(256)
        ns = int(raw[252:256].strip())
        sig_bytes = f.read(ns * 256)
        data_bytes = f.read()

    header = _parse_header(raw + sig_bytes)

    samples_per_record = sum(s.num_samples_per_record for s in header.signals)
    record_size = samples_per_record * 2
    # Annotation signal is always index 0 in EDF+
    ann_bytes_per_record = header.signals[0].num_samples_per_record * 2

    events = []
    for rec in range(header.num_records):
        record = data_bytes[rec * record_size : (rec + 1) * record_size]
        if len(record) < record_size:
            break
        ann_bytes = record[:ann_bytes_per_record]

        # TALs are null-terminated within the annotation signal
        tals = ann_bytes.split(b'\x00')
        for tal in tals:
            tal = tal.rstrip(b'\x00')
            if not tal or tal[0:1] not in (b'+', b'-'):
                continue

            if b'\x15' in tal:
                # ResMed event TAL: +onset\x15duration\x14annotation\x14...
                sep_idx = tal.index(b'\x15')
                try:
                    onset = float(tal[1:sep_idx].decode('ascii'))
                except ValueError:
                    continue
                rest = tal[sep_idx + 1:]
                parts = rest.split(b'\x14')
                try:
                    duration = float(parts[0].decode('ascii')) if parts[0] else 0.0
                except ValueError:
                    duration = 0.0
                for ann_part in parts[1:]:
                    txt = ann_part.decode('ascii', errors='ignore').strip('\x00 ')
                    if txt and txt != 'Recording starts':
                        events.append((onset, duration, txt))
            # TALs with only \x14\x14 are timekeeping markers — skip

    return header, events


def parse_sa2(path: str) -> tuple:
    """
    Parse an SA2 (SpO2/pulse oximetry) EDF file.

    Returns:
        (EDFHeader, (pulse_list, spo2_list)) if oximeter was connected
        (EDFHeader, None) if all values are -1 (no oximeter)

    Signal order: index 0 = Pulse.1s, index 1 = SpO2.1s
    """
    with open(path, 'rb') as f:
        raw = f.read(256)
        ns = int(raw[252:256].strip())
        sig_bytes = f.read(ns * 256)
        data_bytes = f.read()

    header = _parse_header(raw + sig_bytes)

    pulse_sig = header.signals[0]  # Pulse.1s
    spo2_sig  = header.signals[1]  # SpO2.1s
    samples_per_record = sum(s.num_samples_per_record for s in header.signals)

    pulse_vals = []
    spo2_vals  = []

    for rec in range(header.num_records):
        start = rec * samples_per_record * 2
        record_bytes = data_bytes[start : start + samples_per_record * 2]
        if len(record_bytes) < samples_per_record * 2:
            break
        all_samples = struct.unpack(f'<{samples_per_record}h', record_bytes)

        pulse_raw = all_samples[:pulse_sig.num_samples_per_record]
        spo2_raw  = all_samples[pulse_sig.num_samples_per_record :
                                pulse_sig.num_samples_per_record + spo2_sig.num_samples_per_record]
        pulse_vals.extend(pulse_raw)
        spo2_vals.extend(spo2_raw)

    if all(v == -1 for v in spo2_vals):
        return header, None

    return header, (pulse_vals, spo2_vals)
