# GlobalTaxCalc TWA (Trusted Web Activity)

This directory contains the Android project for packaging the GlobalTaxCalc PWA as a native Android app using Trusted Web Activity (TWA) technology.

## Overview

Trusted Web Activity allows you to package your Progressive Web App as a native Android app that can be distributed through the Google Play Store while maintaining the web-based functionality.

## Prerequisites

- Android Studio Arctic Fox or later
- Android SDK 21+ (minimum)
- Android SDK 34 (target)
- JDK 8 or higher
- A valid PWA deployed at `https://globaltaxcalc.com`

## Setup Instructions

### 1. Configure Environment

Create a `local.properties` file in the project root with your signing configuration:

```properties
# Signing configuration (do not commit to version control)
RELEASE_STORE_FILE=/path/to/your/release.keystore
RELEASE_STORE_PASSWORD=your_keystore_password
RELEASE_KEY_ALIAS=your_key_alias
RELEASE_KEY_PASSWORD=your_key_password

# Optional: Set SDK path if needed
sdk.dir=/path/to/android/sdk
```

### 2. Generate Release Keystore

Create a release keystore for signing your app:

```bash
keytool -genkey -v -keystore release.keystore -alias globaltaxcalc -keyalg RSA -keysize 2048 -validity 10000
```

**Important**: Keep your keystore file and passwords secure and backed up!

### 3. Update Digital Asset Links

1. Get the SHA-256 fingerprint of your signing certificate:

```bash
keytool -list -v -keystore release.keystore -alias globaltaxcalc
```

2. Update the fingerprint in `../frontend/public/.well-known/assetlinks.json`

3. Deploy the updated assetlinks.json to your web server

### 4. Build the App

#### Debug Build
```bash
./gradlew assembleDebug
```

#### Release Build
```bash
./gradlew assembleRelease
```

#### App Bundle (Recommended for Play Store)
```bash
./gradlew bundleRelease
```

## File Structure

```
twa/
├── app/
│   ├── build.gradle              # App-level build configuration
│   ├── proguard-rules.pro        # ProGuard obfuscation rules
│   └── src/main/
│       ├── AndroidManifest.xml   # App manifest with TWA configuration
│       └── res/
│           ├── values/
│           │   ├── colors.xml    # App colors and theme
│           │   ├── strings.xml   # App strings and metadata
│           │   └── styles.xml    # App themes and styles
│           └── xml/
│               └── file_paths.xml # File provider paths
├── build.gradle                  # Project-level build configuration
├── gradle.properties            # Project properties and configuration
├── settings.gradle              # Gradle project settings
└── README.md                    # This file
```

## Configuration

### App Information

Update these values in `gradle.properties` to customize your TWA:

- `TWA_PACKAGE_NAME`: Android package name (e.g., `com.globaltaxcalc.app`)
- `TWA_APP_NAME`: Full app name displayed in settings
- `TWA_LAUNCHER_NAME`: Name shown on the home screen
- `TWA_HOST`: Your PWA's domain
- `TWA_START_URL`: Starting path for your PWA
- `TWA_THEME_COLOR`: Primary theme color
- `TWA_BACKGROUND_COLOR`: Background color for splash screen

### Permissions

The app requests these permissions:

**Required:**
- `INTERNET`: Access to the internet
- `ACCESS_NETWORK_STATE`: Check network connectivity

**Optional:**
- `ACCESS_COARSE_LOCATION`: For local tax information
- `ACCESS_FINE_LOCATION`: For precise local tax rates
- `POST_NOTIFICATIONS`: For tax deadline reminders
- `VIBRATE`: For haptic feedback
- `WAKE_LOCK`: To keep screen on during calculations

### Features

The app declares support for:
- WebView (required for TWA)
- Touchscreen (required)
- Portrait orientation (optional)

## Digital Asset Links

Digital Asset Links verify the relationship between your app and website. This is crucial for TWA functionality.

### Verification Steps

1. **Generate SHA-256 fingerprint** from your release keystore
2. **Update assetlinks.json** with the correct fingerprint
3. **Deploy to your website** at `https://yourdomain.com/.well-known/assetlinks.json`
4. **Verify accessibility** by visiting the URL directly

### Testing Asset Links

Use Google's Digital Asset Links API to verify:

```
https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://globaltaxcalc.com&relation=delegate_permission/common.handle_all_urls
```

## Play Store Deployment

### Preparation

1. **Build App Bundle**: Use `bundleRelease` for optimal size
2. **Test thoroughly**: Install and test on various devices
3. **Prepare store assets**:
   - App icon (512×512 PNG)
   - Feature graphic (1024×500 PNG)
   - Screenshots (various sizes)
   - App description and metadata

### Upload Process

1. **Create Play Console account** and pay registration fee
2. **Create new app** in Play Console
3. **Upload App Bundle** (.aab file)
4. **Fill out store listing** with descriptions and media
5. **Set content rating** and target audience
6. **Configure pricing and distribution**
7. **Submit for review**

### Store Listing Information

Use the metadata from `src/lib/pwa/twa-setup.js`:

- **Title**: GlobalTaxCalc
- **Short description**: Free tax calculator and financial planning tool
- **Category**: Finance
- **Content rating**: Everyone
- **Tags**: tax, calculator, finance, income, planning

## Testing

### Debug Testing

1. Enable USB debugging on your Android device
2. Connect device to your computer
3. Run: `./gradlew installDebug`
4. Launch the app and test functionality

### Release Testing

1. Build release APK: `./gradlew assembleRelease`
2. Install on test devices: `adb install app/build/outputs/apk/release/app-release.apk`
3. Test all features, especially deep linking and asset verification

### TWA Validation

Use the validation tools in the PWA project:

```javascript
import { TWAValidator } from '../frontend/src/lib/pwa/twa-setup.js';

const validator = new TWAValidator();
const results = await validator.validateTWASetup();
console.log('Validation results:', results);
```

## Troubleshooting

### Common Issues

**App opens in browser instead of TWA:**
- Check digital asset links are properly configured
- Verify SHA-256 fingerprint matches your signing certificate
- Ensure assetlinks.json is accessible at the correct URL

**App crashes on startup:**
- Check Android logs: `adb logcat`
- Verify PWA is accessible and working
- Check for JavaScript errors in the web app

**Deep links not working:**
- Verify intent filters in AndroidManifest.xml
- Test deep link with: `adb shell am start -W -a android.intent.action.VIEW -d "https://globaltaxcalc.com/calculators/income-tax" com.globaltaxcalc.app`

### Debug Commands

```bash
# View device logs
adb logcat | grep GlobalTaxCalc

# Test deep linking
adb shell am start -W -a android.intent.action.VIEW -d "https://globaltaxcalc.com/" com.globaltaxcalc.app

# Verify app installation
adb shell pm list packages | grep globaltaxcalc

# Clear app data
adb shell pm clear com.globaltaxcalc.app
```

## Security Considerations

1. **Keep keystore secure**: Never commit signing credentials
2. **Use environment variables**: For sensitive configuration
3. **Enable ProGuard**: For code obfuscation in release builds
4. **Validate certificates**: Ensure proper SSL/TLS configuration
5. **Regular updates**: Keep dependencies and SDK versions current

## Maintenance

### Regular Tasks

- **Update dependencies**: Keep Android libraries current
- **Monitor performance**: Check app startup time and memory usage
- **Update digital asset links**: When changing signing certificates
- **Test with new Android versions**: Ensure compatibility
- **Review security patches**: Apply critical updates promptly

### Version Management

Update version information in `gradle.properties`:

```properties
VERSION_CODE=2
VERSION_NAME=1.1.0
```

Version codes must always increase for Play Store updates.

## Support

For issues specific to TWA implementation:
- [Android Browser Helper documentation](https://github.com/GoogleChrome/android-browser-helper)
- [TWA Developer Guide](https://developer.chrome.com/docs/android/trusted-web-activity/)
- [Play Console Help](https://support.google.com/googleplay/android-developer/)

For GlobalTaxCalc-specific issues:
- Check the main project README
- Review PWA implementation in `../frontend/`
- Contact the development team

## License

This TWA wrapper follows the same license as the main GlobalTaxCalc project.