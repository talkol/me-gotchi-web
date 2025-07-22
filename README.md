# Me-gotchi Web

## Prerequisites

* Firebase CLI

    ```
    npm install firebase -g
    ```

## Install

1. NPM install

    ```
    cd repo
    npm install
    cd repo/functions
    npm install
    ```

2. Make sure functions are already deployed to server since local development is for the client only

3. Run local development server

    ```
    npm run dev
    ```

## Deploy

1. Create `repo/functions/.env` with contents:

    ```
    OPENAI_API_KEY=sk-proj-xxxxx-xxx...
    ```

2. Deploy functions to server

    ```
    cd functions
    firebase login
    npm run deploy
    ```

3. Deploy client to Firebase Hosting

    ```
    npm run build
    firebase deploy --only hosting
    ```