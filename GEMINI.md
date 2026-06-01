# Project Engineering Conventions

## Refactoring & Automation Safety
- **StyleSheet Integrity:** NEVER inject logic (e.g., `useContext`, `const` declarations) into `StyleSheet.create` objects. All style definitions must be static objects. Dynamic styling must be handled inline in the component JSX.
- **Automated Refactoring:** Any scripts created for automated refactoring MUST be rigorously tested on a single file before running across the codebase. Remove automation scripts immediately after a successful execution to prevent accidental re-runs.
- **Post-Refactor Validation:** Always inspect `StyleSheet.create` definitions after automated edits. Ensure the object structure remains intact (`{ key: { style } }`) and valid.
- **Import Integrity:** NEVER duplicate import statements. Always check if a module is already imported before adding a new import line. Use IDE features or systematic code reviews to catch redundant imports.
- **Validation:** After any automated refactor, verify functional integrity by testing core screens (e.g., check for syntax errors, visual regressions, and theme-awareness).
