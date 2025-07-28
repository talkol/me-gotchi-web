# Testing Setup for Firebase Functions

This directory contains unit tests for the Firebase Functions, specifically for the `apkUtils.js` utility functions.

## Dependencies

### apksigner Tool

The APK utilities require the `apksigner` tool from Android Build Tools for signing APKs.

#### Local Development (Mac)

Install Android command line tools via Homebrew:

```bash
brew install android-commandlinetools
```

This installs `apksigner` at:
- `/opt/homebrew/share/android-commandlinetools/build-tools/34.0.0/apksigner`
- `/opt/homebrew/share/android-commandlinetools/build-tools/30.0.3/apksigner`

The `apkUtils.js` automatically detects and uses the correct path.

#### Firebase Cloud Functions

The `apksigner` tool should be available in the PATH in the Cloud Functions environment.

### Release Keystore

The APK signing tests require the release keystore from the `android-app` directory.

#### Keystore Location
- **Path**: `android-app/release.keystore`
- **Password**: `trustno1`
- **Key Alias**: `release` (common default)
- **Key Password**: `trustno1` (same as keystore password)

#### Certificate Information
The release keystore contains the certificate for:
- **Issuer**: `CN=Tal Kol, OU=Tal Kol, O=Tal Kol, L=London, ST=Unknown, C=UK`
- **SHA-256 Digest**: `1435dd4376f96277a6e5fcb2419551ea5be5c81b891589c9d8b47aa8e0269f4a`

#### Testing with Release Keystore
The tests verify that:
1. APKs can be signed with the release keystore
2. Signatures are valid and intact after signing
3. Certificate information matches the original signer
4. Same certificate identity is maintained across signing operations

## Test Structure

- `setup.js` - Global test configuration and utilities
- `apkUtils.test.js` - Unit tests for APK utility functions (extraction, signing, file copying)

## Running Tests

From the `website/functions` directory:

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Test Utilities

The `setup.js` file provides global test utilities:

- `testUtils.createMockPreferences(overrides)` - Creates mock user preferences
- `testUtils.createMockCustomizations(overrides)` - Creates mock APK customizations
- `testUtils.wait(ms)` - Helper for async operations

## APK Utilities Testing

The `apkUtils.test.js` includes tests for:

- **apksigner availability**: Checks if the signing tool is properly installed and accessible
- **Cross-platform compatibility**: Verifies the tool works on both local Mac and Firebase Cloud Functions environments
- **Error handling**: Tests proper error messages when apksigner is not available
- **APK extraction and packing**: Tests the complete APK processing pipeline
- **Release keystore signing**: Verifies APKs can be signed with the production release keystore
- **Signature verification**: Ensures signatures are valid and intact after signing
- **Certificate comparison**: Confirms the same signer certificate is used across operations

## Example Usage

```javascript
import { testUtils } from '../test/setup.js';

describe('Example Test', () => {
  it('should work with mock data', async () => {
    const preferences = testUtils.createMockPreferences({
      firstName: 'John',
      favoriteColor: '#FF0000'
    });
    
    // Your test logic here
  });
});
```

## Adding New Tests

1. Create a new test file in the `test/` directory
2. Follow the naming convention: `[filename].test.js`
3. Import the functions you want to test from `../src/[filename].js`
4. Use Jest's `describe` and `it` blocks for test organization
5. Mock external dependencies using `jest.mock()`

### Testing APK Utilities

When testing APK-related functions:

- Use the `checkApksignerAvailability()` function to verify the signing tool is available
- Mock file system operations for APK extraction/packing tests
- Test both success and error scenarios for robust coverage
- Use the actual release keystore (`android-app/release.keystore`) for signing tests
- Verify signature integrity using `apksigner verify` commands
- Compare certificate information to ensure same signer identity
- Test with actual APK files for integration testing

## Mocking Firebase Services

The tests include mocks for:
- Firebase Admin Storage
- Firebase Functions Logger
- Firebase Functions HttpsError

These mocks are defined in the test files and can be extended as needed. 