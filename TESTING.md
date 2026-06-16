# App Launch Checklist

## 🛠 Testing Requirements
- [ ] **Sign up/login:** Verify flows, email verification, and error handling.
- [ ] **Dark mode:** Ensure all screens and components adhere to theme context.
- [ ] **Slow internet:** Test `api` interceptor retry logic and loading states.
- [ ] **Offline behavior:** Verify `requestQueue` processing and data persistence.
- [ ] **Payment flow:** Validate subscription/premium service integration.
- [ ] **Notifications:** Check registration and display of push notifications.
- [ ] **Different screen sizes:** Ensure responsive layout (`Dimensions`, `Flexbox`).

## 📋 Preparation Requirements
- [ ] **Screenshots:** Generate app store compliant screenshots.
- [ ] **Privacy policy:** Review `docs/compliance/PRIVACY_POLICY.md`.
- [ ] **Description:** Draft store listing description.
- [ ] **Keywords:** Define ASO keywords.
- [ ] **Support email:** Ensure configured in app and store.
- [ ] **App category:** Confirm and set in store console.
- [ ] **Age rating:** Determine and set in store console.

## ✅ Operational Mandates
- [ ] **Onboarding:** Keep simple and intuitive.
- [ ] **UI:** Maintain clean, consistent design.
- [ ] **Loading states:** Implement everywhere data is fetched.
- [ ] **App size:** Monitor `node_modules` and asset usage.
- [ ] **Real device testing:** Prioritize Android/iOS hardware.
- [ ] **Analytics/Crash Reporting:** Ensure Sentry/Analytics are active.
