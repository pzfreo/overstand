#!/usr/bin/env python3
"""
One-time OAuth setup for Google Drive backups.

Run this locally to authorize your Google account and get a refresh token.
The refresh token is long-lived and lets the backup script upload files
to your Drive without further interaction.

Prerequisites:
    pip install google-auth-oauthlib

Setup:
    1. Google Cloud Console → APIs & Services → Credentials
    2. Create OAuth client ID → type "Desktop app"
    3. Download the JSON → note the client_id and client_secret

Usage:
    python scripts/gdrive_auth.py --client-id YOUR_ID --client-secret YOUR_SECRET

    Then add these 3 GitHub repo secrets:
      GDRIVE_CLIENT_ID      = your client_id
      GDRIVE_CLIENT_SECRET   = your client_secret
      GDRIVE_REFRESH_TOKEN   = (printed by this script)
"""

import argparse
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ["https://www.googleapis.com/auth/drive.file"]


def main():
    parser = argparse.ArgumentParser(description="Get Google Drive refresh token")
    parser.add_argument("--client-id", required=True, help="OAuth client ID")
    parser.add_argument("--client-secret", required=True, help="OAuth client secret")
    args = parser.parse_args()

    client_config = {
        "installed": {
            "client_id": args.client_id,
            "client_secret": args.client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": ["http://localhost"],
        }
    }

    flow = InstalledAppFlow.from_client_config(client_config, SCOPES)
    creds = flow.run_local_server(port=0)

    print()
    print("=" * 60)
    print("Add these as GitHub repo secrets (Settings → Secrets → Actions):")
    print("=" * 60)
    print(f"  GDRIVE_CLIENT_ID       = {args.client_id}")
    print(f"  GDRIVE_CLIENT_SECRET   = {args.client_secret}")
    print(f"  GDRIVE_REFRESH_TOKEN   = {creds.refresh_token}")
    print("=" * 60)


if __name__ == "__main__":
    main()
