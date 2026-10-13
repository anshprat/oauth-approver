# OAuth Auto-Approver

A Chrome extension that clicks through OAuth consent pages for Google, AWS SSO and Dex sign-in flows.

## Features

- Clicks the Allow or Continue button on Google OAuth consent pages.
- Selects the first account on the Google account chooser.
- Clicks through AWS SSO (OIDC device authorization) pages.
- Clicks through Dex connector and grant-access pages.
- Has an on/off toggle and a click delay setting (0.5 s to 5 s) in the popup.
- Shows the last 5 auto-approved pages in the popup.

## Installation

1. Clone this repository.
2. Open `chrome://extensions/`.
3. Turn on Developer mode.
4. Click **Load unpacked** and select this folder.

## Privacy

The extension stores its settings and activity log in Chrome sync storage. It sends no data to any server.

## Passkey logins

The extension never auto-approves in a tab that shows a passkey or security key login. This applies even when auto-approve is on.

- The extension detects a passkey login from Google `/challenge/pk` and `/challenge/sk` URLs, or from the visible text "passkey" or "security key".
- The tab stays excluded until you close it. So the consent page after the passkey step also needs a manual click.
- Other tabs are not affected.
