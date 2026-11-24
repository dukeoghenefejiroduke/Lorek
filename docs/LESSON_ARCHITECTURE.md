# Lesson System Architecture (Duolingo-Style Winding Path)

This document describes the architectural layout, components, models, and interaction flow of the Lorek Lesson System.

## 1. Domain Models & Architecture

The lesson system is built upon a relational hierarchy represented using MongoDB schemas and rendered using an immersive Duolingo-style learning path:

*   **Course / Unit:** Backend data structures grouping lessons by thematic categories and difficulty levels.
*   **Learning Path (`LessonsScreen.js`):** A serpentine winding skill tree layout featuring:
    *   Staggered horizontal node offsets (`0 → 95 → 0 → -95px`) creating a natural winding trail.
    *   Gamified node states: Completed (gold/amber glowing badges with trophy icons), Active/Next (Duolingo green with play actions), and Locked (grayed out with lock indicators).
    *   Virtualized performance rendering (`initialNumToRender`, `maxToRenderPerBatch`, `windowSize`, `removeClippedSubviews`) for zero-lag scrolling.
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
