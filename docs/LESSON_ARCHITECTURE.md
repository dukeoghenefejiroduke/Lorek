# Lesson System Architecture

This document describes the architectural layout, components, models, and interaction flow of the Lorek Lesson System.

## 1. Domain Models

The lesson system is built upon a relational hierarchy represented using MongoDB schemas:

*   **Course:** The top-level learning module (e.g., Izon Language).
*   **Unit:** Groups related lessons under thematic categories (e.g., Greetings, Family).
*   **Lesson:** The primary lesson content holding teaching items and interactive exercises.
*   **Progress:** Persists overall user lesson completion, best scores, and locking status.

## 2. Interactive Exercise Engine

Exercises are modular React Native components defined in `frontend/src/components/exercises/`. These are rendered dynamically based on the exercise type specified in the database.

Supported Exercise Types:
1.  **Multiple Choice (`MultipleChoice.js`):** Pick one correct answer out of several.
2.  **Translation (`Translation.js`):** Input custom text to translate content.
3.  **Fill-in-the-Blank (`FillBlank.js`):** Complete sentences by inserting the missing word.
4.  **Matching (`Matching.js`):** Interactive pairing of corresponding terms.
5.  **Reorder (`Reorder.js`):** Reconstruct valid sentence grammar by arranging word chips.

## 3. Session and Completion Flow

```
START LESSON (LessonDetailScreen)
  │
  ├──► 1. Study Content (Grammar / Examples / Cultural Notes)
  │
  ├──► 2. Interactive Quiz (Loads dynamic exercise components)
  │
  ├──► 3. Results Calculation (Calculates score on client)
  │
  └──► 4. Secure Backend Synchronization (POST /api/lessons/:id/complete)
         ├── Validation: Prevents XP farming / double completions
         ├── Updates user streak and experience metrics
         └── Redirects to ResultScreen
```

## 4. Audio Architecture

The schema defines support for `audioUrl` and phonetic `pronunciation` guides. Audio playback utilizes the modular `AudioPlayer.js` component, with fallback error boundaries in place to handle missing or corrupt audio resources gracefully without breaking the lesson thread.
