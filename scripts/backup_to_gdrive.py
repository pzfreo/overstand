#!/usr/bin/env python3
"""
Backup Supabase tables to Google Drive.

Fetches all rows from profiles, user_presets, and shared_presets via the
Supabase REST API, then uploads timestamped JSON files to a Google Drive
folder using a service account.

Environment variables:
    SUPABASE_URL              - Supabase project URL
    SUPABASE_SERVICE_ROLE_KEY - Service role key (bypasses RLS)
    GOOGLE_SERVICE_ACCOUNT    - Service account JSON key (as a string)
    GDRIVE_FOLDER_ID          - Google Drive folder ID to upload into
    BACKUP_KEEP               - Number of backup folders to retain (default: 30)

Setup:
    1. Google Cloud Console → create project → enable Drive API
    2. Create service account → download JSON key
    3. Create a Google Drive folder → share it with the service account email
       (the email looks like: name@project.iam.gserviceaccount.com)
    4. Copy the folder ID from the Drive URL:
       https://drive.google.com/drive/folders/<THIS_IS_THE_FOLDER_ID>
    5. Add all 4 env vars as GitHub repo secrets
"""

import io
import json
import os
import sys
from datetime import datetime, timezone
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

TABLES = ["profiles", "user_presets", "shared_presets"]
SCOPES = ["https://www.googleapis.com/auth/drive.file"]


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


def get_drive_service(service_account_json: str):
    """Build a Google Drive API service from a service account JSON string."""
    info = json.loads(service_account_json)
    creds = service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
    return build("drive", "v3", credentials=creds)


def create_drive_folder(service, name: str, parent_id: str) -> str:
    """Create a folder in Google Drive and return its ID."""
    metadata = {
        "name": name,
        "mimeType": "application/vnd.google-apps.folder",
        "parents": [parent_id],
    }
    folder = service.files().create(body=metadata, fields="id").execute()
    return folder["id"]


def upload_json_to_drive(service, filename: str, data: str, folder_id: str):
    """Upload a JSON string as a file to a Google Drive folder."""
    metadata = {"name": filename, "parents": [folder_id]}
    media = MediaIoBaseUpload(
        io.BytesIO(data.encode("utf-8")),
        mimetype="application/json",
    )
    service.files().create(body=metadata, media_body=media, fields="id").execute()


def list_backup_folders(service, parent_id: str) -> list[dict]:
    """List subfolders in the backup folder, sorted oldest-first."""
    query = (
        f"'{parent_id}' in parents and "
        f"mimeType = 'application/vnd.google-apps.folder' and "
        f"trashed = false"
    )
    results = service.files().list(
        q=query,
        fields="files(id, name, createdTime)",
        orderBy="createdTime",
        pageSize=1000,
    ).execute()
    return results.get("files", [])


def prune_old_backups(service, parent_id: str, keep: int):
    """Delete oldest backup folders, keeping the most recent `keep`."""
    folders = list_backup_folders(service, parent_id)
    to_remove = folders[:-keep] if len(folders) > keep else []
    for f in to_remove:
        service.files().delete(fileId=f["id"]).execute()
        print(f"  Pruned: {f['name']}")


def main():
    base_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    sa_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT", "")
    folder_id = os.environ.get("GDRIVE_FOLDER_ID", "")
    keep = int(os.environ.get("BACKUP_KEEP", "30"))

    missing = []
    if not base_url:
        missing.append("SUPABASE_URL")
    if not key:
        missing.append("SUPABASE_SERVICE_ROLE_KEY")
    if not sa_json:
        missing.append("GOOGLE_SERVICE_ACCOUNT")
    if not folder_id:
        missing.append("GDRIVE_FOLDER_ID")

    if missing:
        print(f"Error: Missing environment variables: {', '.join(missing)}")
        sys.exit(1)

    # 1. Fetch tables from Supabase
    print("Fetching Supabase tables...")
    backup_data = {}
    row_counts = {}
    for table in TABLES:
        try:
            rows = fetch_table(base_url, key, table)
            backup_data[table] = json.dumps(rows, indent=2, default=str)
            row_counts[table] = len(rows)
            print(f"  {table}: {len(rows)} rows")
        except HTTPError as e:
            print(f"  {table}: HTTP {e.code} — {e.read().decode()[:200]}")
            sys.exit(1)
        except Exception as e:
            print(f"  {table}: {e}")
            sys.exit(1)

    # 2. Upload to Google Drive
    print("Uploading to Google Drive...")
    service = get_drive_service(sa_json)

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%S")
    backup_folder_id = create_drive_folder(service, timestamp, folder_id)
    print(f"  Created folder: {timestamp}")

    for table in TABLES:
        upload_json_to_drive(service, f"{table}.json", backup_data[table], backup_folder_id)

    # Upload manifest
    manifest = json.dumps({
        "timestamp": timestamp,
        "tables": {t: {"rows": row_counts[t]} for t in TABLES},
    }, indent=2)
    upload_json_to_drive(service, "manifest.json", manifest, backup_folder_id)
    print("  Uploaded all files")

    # 3. Prune old backups
    if keep > 0:
        print(f"Pruning backups (keeping {keep})...")
        prune_old_backups(service, folder_id, keep)

    total_rows = sum(row_counts.values())
    print(f"\nDone — {total_rows} total rows backed up to Google Drive")


if __name__ == "__main__":
    main()
