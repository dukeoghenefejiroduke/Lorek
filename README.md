# IzonLearner (LOREK) - Project Documentation

Welcome to the IzonLearner application repository. This project is a production-ready, AI-powered mobile application designed to help users learn the Izon language.

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v20+ recommended.
- **Expo CLI**: Installed globally (`npm install -g expo-cli`).
- **Android SDK**: Required for local Android builds.
- **Environment Variables**:
  - Backend: Create a `.env` file in `backend/` based on `.env.example`.
  - Mobile: Create a `.env` file in `mobile/`.

## ⚙️ Backend Operation

The backend serves the REST API, manages authentication, and integrates with the Generative AI engine.

### Setup
1. `cd backend`
2. `npm install`
3. `npm start` (for production) or `npm run dev` (for development).

### Key Features
- **Security**: JWT-based authentication with Redis blacklist support.
- **Validation**: All endpoints are protected by `express-validator`.
- **Error Handling**: Standardized `AppError` middleware for all routes.

## 📱 Mobile Operation

The frontend is a React Native mobile application built with Expo.

### Setup
1. `cd mobile`
2. `npm install`
3. `npx expo start`

### Production Builds
To generate a production-ready Android App Bundle (`.aab`):
1. Ensure your `android/` directory is clean: `npx expo prebuild --clean`
2. Build the bundle: `cd android && ./gradlew bundleRelease`
3. The bundle will be located in `android/app/build/outputs/bundle/release/`.

## 🛡️ Security Best Practices
- **Never commit secrets**: Environment variables are managed via `.env` files and should NEVER be checked into source control.
- **Secure Storage**: Sensitive authentication tokens are managed via `expo-secure-store`.
- **Validation**: Strict input validation is enforced on both ends; ensure all new routes follow the `validate[Entity]` pattern in `backend/src/routes`.

## 🛠️ Operational Guidelines for Maintainers
- **Performance**: Always use `expo-image` for high-performance network assets. 
- **Stability**: All UI components requiring user feedback (button presses, success/error states) MUST use the `haptics` utility in `mobile/src/utils/haptics.js`.
- **Modularity**: Maintain clean architecture; keep controllers, services, and models separated as per the current structure.
- **Compliance**: Any change to permissions in `app.json` requires a review of the Privacy Policy.

## 📦 Google Play Compliance
- **Permissions**: Current configuration is strictly limited to `INTERNET` and `ACCESS_NETWORK_STATE`.
- **Build**: Minification is enabled in `gradle.properties` (`android.enableMinifyInReleaseBuilds=true`).
