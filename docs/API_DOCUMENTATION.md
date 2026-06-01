```markdown
# Izon Language API Documentation

Base URL: `https://your-api-url.com/api
## Authentication

### User Authentication

All authenticated endpoints require a JWT token in the Authorization header:

```

Authorization: Bearer <your-jwt-token>

```

### API Key Authentication (for public API)

Public API endpoints require an API key in the header:

```

X-API-Key: <your-api-key>

```

## Endpoints

### Authentication

#### Register

```http

POST /auth/register

Content-Type: application/json

{

"username": "string",

"email": "string",

"password": "string"

}

Response: {

"token": "string",

"user": {

"id": "string",

"username": "string",

"email": "string"

}

}

```

#### Login

```http

POST /auth/login

Content-Type: application/json

{

"email": "string",

"password": "string"

}

Response: {

"token": "string",
"user": {

"id": "string",

"username": "string",

"email": "string",

"progress": {}

}

}

```

#### Generate API Key

```http

POST /auth/generate-api-key

Content-Type: application/json

{

"userId": "string"

}

Response: {

"apiKey": "string"

}

```

### Vocabulary

#### Get All Vocabulary

```http

GET /vocabulary?page=1&limit=20&category=greetings&difficulty=beginner

Response: {

"vocabulary": [],

"totalPages": number,

"currentPage": number,

"total": number

}

```

#### Search Vocabulary

```http

GET /vocabulary/search?q=hello

Response: [

{

"izonWord": "string",

"englishTranslation": "string",

"pronunciation": "string",

"category": "string",

"difficulty": "string"

}

]

```
#### Get Word by ID

```http

GET /vocabulary/:id

Response: {

"izonWord": "string",

"englishTranslation": "string",

"pronunciation": "string",

"audioUrl": "string",

"category": "string",

"difficulty": "string",

"examples": []

}

```

### Lessons

#### Get All Lessons

```http

GET /lessons?level=beginner&page=1&limit=10

Response: {

"lessons": [],

"totalPages": number,

"currentPage": number,

"total": number

}

```

#### Get Lesson by ID

```http

GET /lessons/:id

Response: {

"title": "string",

"description": "string",

"level": "string",

"content": {

"grammar": "string",

"vocabulary": [],

"examples": []

},

"exercises": []

}

```

#### Complete Lesson

```http

POST /lessons/:id/complete

Authorization: Bearer <token>
Content-Type: application/json

{

"score": number,

"timeSpent": number

}

Response: {

"progress": {},

"userProgress": {}

}

```

### Progress

#### Get User Progress

```http

GET /progress

Authorization: Bearer <token>

Response: {

"totalPoints": number,

"streak": number,

"completedLessons": number,

"lessonProgress": []

}

```

### Public API (for developers)

#### Get Vocabulary

```http

GET /public/vocabulary?limit=50&category=greetings

X-API-Key: <your-api-key>

Response: {

"success": true,

"count": number,

"data": []

}

```

#### Search Vocabulary

```http

GET /public/vocabulary/search?q=hello

X-API-Key: <your-api-key>

Response: {

"success": true,

"count": number,

"data": []
}

```

#### Translate

```http

GET /public/translate?text=hello&from=english&to=izon

X-API-Key: <your-api-key>

Response: {

"success": true,

"found": true,

"translation": {

"izon": "string",

"english": "string",

"pronunciation": "string"

}

}

```

#### Validate Translation

```http

POST /public/validate

X-API-Key: <your-api-key>

Content-Type: application/json

{

"izon": "string",

"english": "string"

}

Response: {

"success": true,

"valid": boolean,

"correctAnswer": "string"

}

```

## Error Responses

All endpoints may return these error responses:

```json

{

"error": "Error message description"

}

```

Status Codes:

- 200: Success

- 201: Created

- 400: Bad Request
- 401: Unauthorized

- 404: Not Found

- 500: Internal Server Error

## Rate Limiting

- Standard endpoints: 100 requests per 15 minutes

- Public API: Same rate limit applied per API key

## Sample Data

### Vocabulary Example

```json

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

}

```

```

---

## 🚀 SETUP INSTRUCTIONS

### Backend Setup (Complete Steps)

1. **Install Node.js** (if not installed)

- Download from nodejs.org

- Verify: `node --version`

2. **Create Backend Folder**

```bash

mkdir izon-backend

cd izon-backend

npm init -y

```

3. **Install Dependencies**

```bash

npm install express mongoose bcryptjs jsonwebtoken dotenv cors helmet express-rate-limit

validator

npm install --save-dev nodemon
```

4. **Create All Folders**

```bash

mkdir -p src/config src/models src/routes src/controllers src/middleware

```

5. **Setup MongoDB Atlas**

- Go to mongodb.com/cloud/atlas

- Create free account

- Create M0 (free) cluster

- Create database user

- Whitelist IP: 0.0.0.0/0

- Get connection string

- Create `.env` file:

```

PORT=5000

MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/izon-db

JWT_SECRET=your_super_secret_key_here_make_it_long

NODE_ENV=development

```

6. **Copy all the code files** from above into the correct folders

7. **Start Server**

```bash

npm run dev

```

### Mobile App Setup (Complete Steps)

1. **Install Expo CLI**

```bash

npm install -g expo-cli

```

2. **Create Mobile Folder**

```bash

npx create-expo-app izon-mobile

cd izon-mobile

```

3. **Install Dependencies**

```bash

npm install @react-navigation/native @react-navigation/bottom-tabs @react-navigation/native-stack

npm install axios @react-native-async-storage/async-storage

npm install expo-av

npm install react-native-safe-area-context react-native-screens

```

4. **Create All Folders**
```bash

mkdir -p src/screens src/components src/navigation src/services src/context src/utils

```

5. **Copy all mobile code files** from above

6. **Update API URL** in `src/services/api.js`:

```javascript

const API_URL = 'http://your-ip-address:5000/api'; // For local testing

// or

const API_URL = 'https://your-deployed-backend.com/api'; // For production

```

7. **Start Mobile App**

```bash

npx expo start

```

8. **Test on Phone**

- Install Expo Go from Play Store

- Scan QR code

---

## 📊 SAMPLE DATA TO INSERT

Run this in MongoDB or create a seed script:

```javascript

// Sample Vocabulary

[

{

izonWord: "Mièbélou",

englishTranslation: "Good morning",

pronunciation: "mee-eh-beh-lou",

category: "greetings",

difficulty: "beginner",

examples: [{

izon: "Mièbélou, bọụ dẹ?",

english: "Good morning, how are you?"

}]

},

{

izonWord: "Wáríbí",

englishTranslation: "Thank you",

pronunciation: "wah-ree-bee",

category: "greetings",

difficulty: "beginner"

},

{

izonWord: "Tọụ",
englishTranslation: "One",

pronunciation: "toh-oo",

category: "numbers",

difficulty: "beginner"

},

{

izonWord: "Ịmọ",

englishTranslation: "Mother",

pronunciation: "ee-moh",

category: "family",

difficulty: "beginner"

}

]

```

