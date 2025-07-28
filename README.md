# Me-gotchi Web

## Prerequisites

* Release APK of the Me-gotchi android-app project

* Firebase CLI

    ```bash
    npm install firebase -g
    ```

## Install

1. NPM install

    ```bash
    npm install
    cd functions
    npm install
    ```

2. Make sure functions are already deployed to server since local development is for the client only

## Development

### Cloud Functions

```bash
cd functions
npm test
```

### Website

```bash
npm run dev
```

## Deploy

### Cloud Functions

1. Make sure the release APK has been built with:

    ```bash
    cd ../android-app
    ./build-and-install.sh
    ```

2. Refresh the APK:

    ```bash
    cd functions
    npm run refresh-apk
    ```

3. Create `functions/.env` with contents:

    ```bash
    OPENAI_API_KEY=sk-proj-xxxxx-xxx...
    ```

4. Deploy functions to server

    ```bash
    cd functions
    firebase login
    npm run deploy
    ```

### Website

```bash
npm run build
firebase login
firebase deploy --only hosting
```