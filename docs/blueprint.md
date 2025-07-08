# **App Name**: Me-Gotchi Web

## Core Features:

- Invite Code Management: Admin console for invite code generation and user overview.
- Onboarding Form: Onboarding form for users to input personal data and preferences, including photo upload.
- AI Asset Generation: AI-powered asset generation based on user input and uploaded photo, leveraging OpenAI's API. Use the admin's OpenAI API key.
- Asset Preview: Preview generated assets within the onboarding form.
- Asset Storage: Secure storage of generated assets on Firebase Storage, organized by invite code.
- Android Integration: Integrate with the Android game 'me-gotchi' to download assets upon successful invite code authentication. Assets for invite code `XYZ` would live in Firebase storage at `/XYZ/file.png` or similar.

## Style Guidelines:

- Primary color: A friendly, inviting pastel purple (#D8B4FE), suggesting both personality and technology.
- Background color: Light, desaturated pastel purple (#F5EEFF), for a clean and soft backdrop.
- Accent color: Soft blue (#A7D9ED) for interactive elements.
- Headline font: 'Space Grotesk' (sans-serif) for a techy but playful feel.
- Body font: 'Inter' (sans-serif), to ensure good legibility with 'Space Grotesk'.
- Use custom, minimalist icons relevant to Tamagotchi care, reflecting user's personality and preferences.
- Subtle animations to acknowledge user interaction during onboarding, like asset generation and form submission.