# Lorek - Izon & Ogbia Language Learning Platform

Lorek is the premier gamified language learning and crowdsourcing platform dedicated to **Izon (Ijaw)** and **Ogbia (AgBeya)** languages of the Niger Delta (Bayelsa State).

## Features
- **Izon & Ogbia Curricula**: Structured 6-unit courses with verified vocabulary (Ibasa, Nua, Indi, Buru, etc.).
- **Crowdsourced Ogbia Native Verification**: The first app to crowdsource Ogbia words and voice recordings with dialect support (Oloibiri, Kolo, Anyama).
- **Mascot Timi**: The friendly river canoe boy who celebrates with "Nua!" and "Doo!".
- **Offline Sync & Web Audio**: Robust last-write-wins sync queue and Web MediaRecorder fallback.
- **Real-Time Leaderboard & Gamification**: XP points, streaks, badges, and 30-second live polling.

---

## Running Locally

### Prerequisites
- Node.js (v18+)
- MongoDB Atlas or local MongoDB instance

### 1. Backend Setup
```bash
cd backend
npm install
cp .env.example .env   # Configure MONGODB_URI and JWT_SECRET
node src/seed.js       # Seed verified Izon & Ogbia curriculum & test users
npm run dev            # Starts backend on http://localhost:5000
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run start          # Starts Expo development server (web / emulator)
```

---

## How to Add a New Izon Word
1. Log in as Admin (`admin@lorek.com` / `password123`).
2. Navigate to the Admin / Content Studio panel.
3. Use the Add Vocabulary endpoint or UI form:
   - **Izon Word**: e.g., `Seridou`
   - **English Translation**: `Good morning`
   - **Category**: `greetings`
   - **Phonetic**: `seh-ree-doo`

---

## How to Approve Ogbia Contributions
1. Navigate to the Ogbia Contribute screen in the app.
2. Submit a new word with voice recording & dialect (Oloibiri / Kolo / Anyama).
3. Log in as Admin and access the **Pending Contributions Queue**.
4. Click **Approve** to instantly publish the crowdsourced word into Ogbia Lesson 1.

---

## Live Deployment URLs
- **Backend API (Render)**: `https://lorek.onrender.com`
- **Frontend App (Vercel)**: `https://lorek.vercel.app`
- **Demo Test Login**: `test1@test.com` / `Password123`
