# Me-gotchi Web

## Prerequisites

* Firebase CLI

    ```
    npm install firebase -g
    ```

## Install

1. Create `repo/functions/.env` with contents:

    ```
    OPENAI_API_KEY=sk-proj-xxxxx-xxx...
    ```

2. NPM install

    ```
    cd repo
    npm install
    cd repo/functions
    npm install
    ```

3. Push functions to server

    ```
    cd functions
    firebase login
    npm run deploy
    ```

4. Run development server

    ```
    npm run dev
    ```