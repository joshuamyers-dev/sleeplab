#!/usr/bin/env python3
"""Export filtered OpenAPI specs to disk.

Usage:
    python scripts/export-openapi.py              # writes all three specs
    python scripts/export-openapi.py --public      # public only
    python scripts/export-openapi.py --internal    # internal only
    python scripts/export-openapi.py --full        # full spec only
    python scripts/export-openapi.py --output-dir ./docs/openapi

Outputs:
    openapi.json          — full spec (default)
    openapi-public.json   — public-facing endpoints only
    openapi-internal.json — internal/frontend-facing endpoints only
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from api.main import app, PUBLIC_TAGS, INTERNAL_TAGS, _filter_openapi_by_tags  # noqa: E402

DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parent.parent / "docs" / "openapi"


def write_spec(path: Path, spec: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(spec, indent=2) + "\n")
    print(f"  wrote {path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Export SleepLab OpenAPI specs")
    parser.add_argument("--public", action="store_true", help="Export public spec only")
    parser.add_argument("--internal", action="store_true", help="Export internal spec only")
    parser.add_argument("--full", action="store_true", help="Export full spec only")
    parser.add_argument("--output-dir", type=str, default=str(DEFAULT_OUTPUT_DIR), help="Output directory")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    spec = app.openapi()

    if args.full and not args.public and not args.internal:
        write_spec(output_dir / "openapi.json", spec)
        return

    if args.public and not args.internal and not args.full:
        write_spec(output_dir / "openapi-public.json", _filter_openapi_by_tags(spec, PUBLIC_TAGS))
        return

    if args.internal and not args.public and not args.full:
        write_spec(output_dir / "openapi-internal.json", _filter_openapi_by_tags(spec, INTERNAL_TAGS))
        return

    write_spec(output_dir / "openapi.json", spec)
    write_spec(output_dir / "openapi-public.json", _filter_openapi_by_tags(spec, PUBLIC_TAGS))
    write_spec(output_dir / "openapi-internal.json", _filter_openapi_by_tags(spec, INTERNAL_TAGS))


if __name__ == "__main__":
    main()
