# Me-gotchi Release

## Install app

Replace `0000-0000-0000` with correct invite code

1. Download the customized APK from the bucket using the invite code URL

    ```bash
    curl -o me-gotchi.apk "https://storage.googleapis.com/me-gotchi.firebasestorage.app/0000-0000-0000/Me-gotchi.apk"
    ```

2. Sign the APK with release keystore

    ```bash
    apksigner sign --ks release.keystore --ks-pass pass:trustno1 --key-pass pass:trustno1 --out me-gotchi-signed.apk me-gotchi.apk
    ```

3. Install the signed APK using adb (phone should be connected with USB debugging on)

    ```bash
    adb install -t me-gotchi-signed.apk
    ```

4. Set device owner for kiosk mode

    ```bash
    adb shell dpm set-device-owner com.megotchi.v1/.KioskDeviceAdminReceiver
    ```

5. Start the Me-gotchi app

    ```bash
    adb shell am start -n com.megotchi.v1/com.megotchi.v1.GodotApp
    ```

## Uninstall app

1. Remove device owner

    ```bash
    adb shell dpm remove-active-admin com.megotchi.v1/.KioskDeviceAdminReceiver
    ```

2. Uninstall the APK

    ```bash
    adb uninstall com.megotchi.v1
    ```
