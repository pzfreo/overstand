#!/usr/bin/env python3
"""
Backup Supabase tables (profiles, user_presets, shared_presets) to local JSON files.

Requires the service role key (not the anon key) to bypass RLS and read all rows.

Usage:
    # Set env vars (or use a .env file)
    export SUPABASE_URL="https://qmrrzigcqfrnhblxzcnq.supabase.co"
    export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

    # Run backup
    python scripts/backup_supabase.py

    # Keep only last 30 backups
    python scripts/backup_supabase.py --keep 30

Output:
    backups/
      2026-02-18T14-30-00/
        profiles.json
        user_presets.json
        shared_presets.json
        manifest.json
"""

import argparse
import json
import os
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

TABLES = ["profiles", "user_presets", "shared_presets"]
BACKUP_DIR = Path(__file__).resolve().parent.parent / "backups"


def fetch_table(base_url: str, key: str, table: str) -> list[dict]:
    """Fetch all rows from a Supabase table via the REST API."""
    url = f"{base_url}/rest/v1/{table}?select=*"
    req = Request(url, headers={
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
    })
    with urlopen(req) as resp:
        return json.loads(resp.read().decode())


def prune_old_backups(keep: int):
    """Remove oldest backups, keeping the most recent `keep` directories."""
    if not BACKUP_DIR.exists():
        return
    dirs = sorted(
        [d for d in BACKUP_DIR.iterdir() if d.is_dir()],
        key=lambda d: d.name,
    )
    to_remove = dirs[:-keep] if len(dirs) > keep else []
    for d in to_remove:
        shutil.rmtree(d)
        print(f"  Pruned old backup: {d.name}")


def main():
    parser = argparse.ArgumentParser(description="Backup Supabase tables to JSON")
    parser.add_argument("--keep", type=int, default=0,
                        help="Keep only the N most recent backups (0 = keep all)")
    args = parser.parse_args()

    base_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

    if not base_url or not key:
        print("Error: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.")
        print()
        print("  The service role key is in your Supabase dashboard under")
        print("  Settings > API > service_role (secret).")
        print("  It bypasses RLS so the backup can read all tables.")
        sys.exit(1)

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%S")
    dest = BACKUP_DIR / timestamp
    dest.mkdir(parents=True, exist_ok=True)

    manifest = {"timestamp": timestamp, "tables": {}}
    errors = []

    for table in TABLES:
        try:
            rows = fetch_table(base_url, key, table)
            outfile = dest / f"{table}.json"
            outfile.write_text(json.dumps(rows, indent=2, default=str))
            manifest["tables"][table] = {"rows": len(rows)}
            print(f"  {table}: {len(rows)} rows")
        except HTTPError as e:
            msg = f"{table}: HTTP {e.code} — {e.read().decode()[:200]}"
            errors.append(msg)
            print(f"  {msg}")
        except Exception as e:
            msg = f"{table}: {e}"
            errors.append(msg)
            print(f"  {msg}")

    if errors:
        manifest["errors"] = errors

    (dest / "manifest.json").write_text(json.dumps(manifest, indent=2))

    if errors:
        print(f"\nBackup completed with errors → {dest}")
    else:
        print(f"\nBackup complete → {dest}")

    if args.keep > 0:
        prune_old_backups(args.keep)


if __name__ == "__main__":
    main()
