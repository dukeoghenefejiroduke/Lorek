Since we have integrated several advanced features—specifically the **Public API**, **Translation utility**, and **User Progress tracking**—I’ve updated the documentation to reflect the full system architecture.
I’ve also included specific **Termux** and **Codemagic** optimization steps in the setup guide to align with your current workflow.
# 🇳🇬 Izon Language API & Platform Documentation
**Base URL:** https://your-api-url.com/api
## 🔐 Authentication
### User Authentication (Private)
Required for lessons and progress tracking.
 * **Header:** Authorization: Bearer <your-jwt-token>
### API Key Authentication (Public)
Required for third-party developers using the translation and vocabulary tools.
 * **Header:** X-API-Key: <your-api-key>
## 🚀 Endpoints
### 1. Authentication & API Management
| Method | Endpoint | Description |
|---|---|---|
| POST | /auth/register | Create user account |
| POST | /auth/login | Returns JWT and user profile |
| POST | /auth/generate-api-key | Generates a key for public API access |
### 2. Vocabulary & Translation
| Method | Endpoint | Description |
|---|---|---|
| GET | /vocabulary | Paginated list with category & difficulty filters |
| GET | /vocabulary/search?q= | Search Izon or English terms |
| GET | /public/translate | Direct translation (Public Key required) |
| POST | /public/validate | Checks if an Izon-English pair is correct |
### 3. Gamified Lessons & Progress
| Method | Endpoint | Description |
|---|---|---|
| GET | /lessons | List lessons by level (Beginner/Intermediate) |
| GET | /lessons/:id | Get lesson content and exercises |
| POST | /lessons/:id/complete | Submit score; updates user streak and points |
| GET | /progress | Get user’s XP, streak, and badges |
## 🛠 SETUP INSTRUCTIONS
### Backend (Node.js/Express)
 1. **Initialize & Install:**
   ```bash
   mkdir izon-backend && cd izon-backend
   npm init -y
   npm install express mongoose bcryptjs jsonwebtoken dotenv cors helmet express-rate-limit
   
   ```
 2. **Termux Note:** If developing on Android (Termux), ensure you have pkg install nodejs-lts. Use nodemon to keep the server alive during edits.
 3. **Environment:** Create a .env file with PORT, MONGODB_URI, and JWT_SECRET.
### Mobile App (Expo/React Native)
 1. **Initialize:**
   ```bash
   npx create-expo-app izon-mobile --template blank
   cd izon-mobile
   
   ```
 2. **Dependencies:**
   ```bash
   npm install @react-navigation/native @react-navigation/native-stack axios expo-av @react-native-async-storage/async-storage
   
   ```
 3. **CI/CD (Codemagic):**
   * Connect your repository to Codemagic.
   * Set build trigger to Push to Master.
   * In **Environment Variables**, add your EXPO_TOKEN for automated builds.
## 📊 DATA SEED (JSON Example)
To populate your database with initial Izon content, use this structure:
```json
[
  {
    "izonWord": "Mièbélou",
    "englishTranslation": "Good morning",
    "pronunciation": "mee-eh-beh-lou",
    "category": "greetings",
    "difficulty": "beginner",
    "examples": [
      {
        "izon": "Mièbélou, bọụ dẹ?",
        "english": "Good morning, how are you?"
      }
    ]
  },
  {
    "izonWord": "Ebí dọụ",
    "englishTranslation": "Goodnight",
    "pronunciation": "eh-bee doh-oo",
    "category": "greetings",
    "difficulty": "beginner"
  },
  {
    "izonWord": "Izon-otụ",
    "englishTranslation": "Ijaw people",
    "pronunciation": "ee-zon-oh-too",
    "category": "culture",
    "difficulty": "intermediate"
  }
]

```
## ⚠️ Error Reference
 * **429 Too Many Requests:** You've exceeded the rate limit (100 reqs/15 mins).
 * **401 Unauthorized:** Token is expired or API Key is invalid.
 * **400 Bad Request:** Missing required fields (e.g., email or password).
