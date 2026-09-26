# API Key Management & Workflow Documentation

## Overview
Lorek API keys allow users to access platform services programmatically. All user-generated API keys are securely hashed using SHA-256 before storage in MongoDB and are validated against user records when supplied in request headers.

## Key Features & Capabilities
- **Custom Naming:** Users can provide custom names when generating API keys (e.g., "Mobile App", "CLI Script"). Previously, keys defaulted to "Default" due to unpassed payload data in the frontend client.
- **Universal Language Support:** API keys grant permissions (`read`, `translate`) across all languages supported by the translation engine (`TranslationEngineFactory`), including Izon (IZO) and future language packs.

---

## API Key Workflow

1. **Creation & Generation**
   - **User Action:** Navigate to the API Keys screen, enter a name, and generate a key.
   - **Frontend:** Calls `authAPI.generateApiKey({ name: keyName })`, passing the key name in the request body.
   - **Backend Processing (`POST /api/auth/generate-api-key`):**
     - Authenticates user via JWT.
     - Generates a secure random token (`izon_<hex>`).
     - Hashes the token using SHA-256 and stores it in `user.security.apiKeys` with metadata (`name`, `permissions`, `createdAt`, `expiresAt`).
     - Returns the raw API key to the client (shown only once).

2. **Management & Revocation**
   - **Listing (`GET /api/auth/api-keys`):** Returns metadata (ID, name, creation date, last used, expiration) without exposing sensitive key hashes.
   - **Revocation (`DELETE /api/auth/api-keys/:keyId`):** Removes the key from the user's account, instantly invalidating further requests.

3. **Validation & Authentication (`validateApiKey` middleware)**
   - When a request includes the `X-API-Key` header:
     - The middleware checks static environment keys (`API_KEY_1`, `MASTER_API_KEY`).
     - If not static, it hashes the incoming key with SHA-256 and verifies it against active user API keys stored in MongoDB.
     - Automatically updates the `lastUsed` timestamp upon successful validation.

---

## Confirming API Keys with cURL

### 1. Generate an API Key
```bash
curl -X POST http://localhost:5000/api/auth/generate-api-key \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -d '{"name": "My cURL Test Key"}'
```

### 2. Test the API Key (e.g., Translation Service)
```bash
curl -X POST http://localhost:5000/api/translator/translate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: izon_your_generated_api_key_here" \
  -d '{"text": "Hello", "to": "izon"}'
```
