# Security Policy

## Supported Versions

Only the latest version available on the Chrome Web Store is supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |
| < Latest| :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in Chrome Issue Reporter, please report it responsibly:

### Please DO NOT:
- Open a public GitHub issue about the vulnerability
- Disclose the vulnerability publicly before it has been addressed

### Please DO:
1. **Email** the maintainers privately (create a private security advisory on GitHub)
2. **Use GitHub Security Advisories**: Go to the Security tab → Report a vulnerability
3. **Provide details**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if you have one)

### What to Expect:
- **Acknowledgment**: Within 48 hours of your report
- **Status Updates**: Regular updates on the progress
- **Resolution Timeline**: We aim to address critical vulnerabilities within 7 days
- **Credit**: You'll be credited in the security advisory (unless you prefer to remain anonymous)

## Security Best Practices

When using Chrome Issue Reporter:

1. **OAuth Configuration**:
   - Keep your GitHub OAuth Client ID and Secret secure
   - Never share your OAuth credentials publicly
   - Use unique OAuth Apps per environment

2. **Repository Access**:
   - Only grant the extension access to repositories you trust
   - Review the permissions requested by the extension
   - Regularly audit OAuth token access in GitHub settings

3. **Extension Updates**:
   - Keep the extension updated (automatic via Chrome Web Store)
   - Review changelogs for security updates
   - Report any suspicious behavior immediately

4. **Captured Data**:
   - Review captured context before submitting issues
   - Be aware that page content is sent to GitHub
   - Avoid capturing sensitive information (passwords, tokens, etc.)

## Security Features

This extension implements several security measures:

- **Manifest V3**: Uses the latest Chrome extension security standards
- **Minimal Permissions**: Only requests necessary permissions
- **Secure Storage**: Uses `chrome.storage.sync` for sensitive data
- **No External Services**: Only communicates with GitHub APIs
- **Input Sanitization**: Sanitizes all user input before submission
- **OAuth Device Flow**: Uses secure GitHub OAuth device authorization

## Security Audit

Last security audit: 2024

If you're interested in performing a security audit, please contact the maintainers.

## Questions?

For security-related questions that don't constitute a vulnerability, please open a regular GitHub issue or discussion.

Thank you for helping keep Chrome Issue Reporter secure! 🔒
