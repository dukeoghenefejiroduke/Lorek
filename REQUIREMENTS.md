# Minimum App Requirements Checklist

## 🛠 Status & Implementation
- [ ] **Splash screen:** Check `app.json` configuration and asset presence.
- [ ] **Proper icon:** Verify in `app.json` and `assets/images/icon.png`.
- [ ] **Privacy policy:** Must be finalized in `docs/compliance/PRIVACY_POLICY.md` and accessible in-app.
- [ ] **Stable navigation:** Verify in `frontend/src/navigation/AppNavigator.js`.
- [ ] **Error handling:** Ensure `frontend/src/middleware` or global error boundaries are robust.
- [ ] **Loading indicators:** Implement universally (use `ActivityIndicator` consistently).
- [ ] **Responsive UI:** Validate across screen sizes (Flexbox/Dimensions).
- [ ] **Support email:** Define and link in settings/about screen.
- [ ] **No placeholder text:** Audit all screens for remaining "Lorem ipsum" or "Coming soon" placeholders.
- [ ] **No fake buttons:** Remove or disable any non-functional UI elements.
- [ ] **Real onboarding flow:** Implement or refine `frontend/src/screens/OnboardingScreen.js`.
