# Monzo Bank Integration Addon

Automatically sync transactions from your Monzo bank account into Wealthfolio.

## Features

- **One-click Monzo authentication** via OAuth
- **Automatic transaction sync** into your Wealthfolio accounts
- **Smart filtering** - skips pending transactions and pot transfers
- **Duplicate detection** - won't import the same transaction twice
- **Account mapping** - link your Monzo accounts to Wealthfolio accounts

## Installation

1. Ensure the Monzo proxy is running (see parent README)
2. In Wealthfolio, go to Settings > Addons
3. Upload the `monzo-addon.zip` file
4. Enable the addon

## Quick Start

1. **Configure Proxy URL**
   - Go to Monzo Sync > Settings
   - Enter your proxy URL (e.g., `http://localhost:8000`)
   - Click "Save Proxy URL"

2. **Connect Your Monzo Account**
   - Click "Connect Monzo Account"
   - Authenticate with your Monzo credentials
   - The addon will fetch your accounts

3. **Map Accounts**
   - Select a Wealthfolio account for each Monzo account
   - Click "Save Mapping"

4. **Start Syncing**
   - Go to the main dashboard
   - Click "Sync Now"
   - Transactions will be imported automatically

## Permissions

- **Accounts**: Map Monzo accounts to Wealthfolio accounts
- **Activities**: Import transactions as activities
- **Secrets**: Securely store OAuth tokens and configuration
- **UI**: Add sidebar item and routing

## Security

- Tokens are stored securely in your OS keyring (via Wealthfolio's secrets API)
- Never stored in browser localStorage
- The proxy holds client credentials - tokens never reach your browser
- All communication is HTTPS in production

## Troubleshooting

**Authentication fails**
- Ensure the proxy is running and accessible
- Check proxy URL configuration
- Verify Monzo Client ID and Secret are set correctly on the proxy

**Transactions not syncing**
- Check that accounts are mapped
- Verify token is still valid
- Check browser console for errors

**Duplicate transactions**
- The addon uses transaction IDs to prevent duplicates
- If you see duplicates, run the sync again - checkImport should filter them

## Support

For issues, check the proxy logs and browser console for error messages.
