# Security Guidelines for Olly Molly

## Sensitive Data Protection

### API Keys and Credentials

**NEVER commit the following files to the repository:**
- `db/image-settings.json` - Contains API keys and server URLs
- `.env` files - Contains environment-specific secrets
- Any files with API keys, passwords, or tokens

### Configuration Files

#### Image Settings
The `db/image-settings.json` file contains sensitive configuration for image generation:
- Gemini API keys
- ComfyUI server URLs
- Provider settings

**Setup Instructions:**
1. Copy `db/image-settings.example.json` to `db/image-settings.json`
2. Fill in your actual API keys and server URLs
3. This file is gitignored and will not be committed

Example structure:
```json
{
  "provider": "nanobanana",
  "comfyuiServerUrl": "http://localhost:8188",
  "geminiApiKey": "your-actual-api-key-here"
}
```

### Best Practices

1. **Use Example Files**: Always commit `.example.json` or `.example.env` files showing the structure without sensitive values
2. **Update .gitignore**: Add any new sensitive files to `.gitignore` immediately
3. **Local Configuration**: Keep all API keys and credentials in local files that are gitignored
4. **Regular Audits**: Review commits before pushing to ensure no sensitive data is included

### If Sensitive Data is Committed

If you accidentally commit sensitive data:

1. **Immediately revoke** the exposed credentials (API keys, tokens, etc.)
2. **Remove from git history** using `git filter-branch` or BFG Repo-Cleaner
3. **Force push** the cleaned history (requires write access)
4. **Generate new credentials** and update local configuration

### SQLite Database

The SQLite database (`*.sqlite` files) contains local user data and should never be committed to the repository. The `.gitignore` file already excludes these files.

## Reporting Security Issues

If you discover a security vulnerability, please email ruucm.a@gmail.com instead of creating a public issue.
