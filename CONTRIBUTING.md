# Contributing to Chrome Issue Reporter

Thank you for your interest in contributing to Chrome Issue Reporter! This document provides guidelines for contributing to the project.

## Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/Chrome-Issue-Reporter.git
   cd Chrome-Issue-Reporter
   ```

2. **Install for Development**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable **Developer mode**
   - Click **Load unpacked**
   - Select the `extension/` folder

3. **Make Changes**
   - Edit files in the `extension/` directory
   - Click the Reload button in `chrome://extensions/` to test changes

## Code Guidelines

### JavaScript
- Use modern ES6+ syntax
- Follow existing code style and formatting
- Use async/await for asynchronous operations
- Add comments for complex logic

### Manifest V3
- This extension uses Manifest V3 - do not introduce V2 features
- Follow Chrome extension best practices
- Minimize permissions requested

### Security
- Never commit API keys, tokens, or secrets
- Sanitize all user input
- Use secure storage (`chrome.storage.sync`) for sensitive data
- Follow the principle of least privilege

## Testing Your Changes

1. **Build the extension**
   ```bash
   npm run build
   ```

2. **Manual Testing**
   - Test on various websites
   - Verify OAuth flow works correctly
   - Check console for errors
   - Test with different GitHub repositories

3. **Cross-browser Testing**
   - Test in different Chrome versions if possible
   - Verify on different operating systems

## Submitting Changes

1. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Commit Your Changes**
   ```bash
   git add .
   git commit -m "Description of your changes"
   ```

3. **Push to Your Fork**
   ```bash
   git push origin feature/your-feature-name
   ```

4. **Open a Pull Request**
   - Go to the original repository
   - Click "New Pull Request"
   - Select your fork and branch
   - Provide a clear description of your changes

## Pull Request Guidelines

- **Title**: Clear and descriptive (e.g., "Add support for issue templates")
- **Description**: Explain what you changed and why
- **Testing**: Describe how you tested your changes
- **Screenshots**: Include screenshots for UI changes
- **Breaking Changes**: Clearly mark any breaking changes

## Code Review Process

1. Maintainers will review your PR
2. Address any feedback or requested changes
3. Once approved, your changes will be merged
4. Your contribution will be included in the next release

## Reporting Bugs

- Use the GitHub Issues page
- Provide clear reproduction steps
- Include browser version and OS
- Add screenshots if applicable
- Check if the issue already exists

## Feature Requests

- Open a GitHub Issue with the "enhancement" label
- Clearly describe the feature and use case
- Explain why it would be valuable
- Be open to discussion and feedback

## Documentation

- Update README.md if you add/change features
- Update INSTALL.md if setup process changes
- Add comments for complex code
- Keep documentation clear and concise

## Questions?

- Open a GitHub Discussion
- Check existing Issues and Discussions first
- Be respectful and constructive

## License

By contributing to Chrome Issue Reporter, you agree that your contributions will be licensed under the MIT License.

Thank you for contributing! 🎉
