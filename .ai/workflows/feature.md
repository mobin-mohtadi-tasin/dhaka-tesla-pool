# Feature Development Workflow

This document outlines the standard 13-step workflow that an AI coding agent must follow when implementing any new feature or functional extension in the Dhaka Tesla Pool repository.

---

## 13-Step Feature Process

1. **Understand Requirement**: Carefully review the user request and identify the specific business criteria, affected personas, and expected behavior.
2. **Read Relevant Documentation**: Consult only the documentation files directly related to the feature (e.g., `docs/pooling.md`, `docs/database.md`, `.ai/architecture.md`, `.ai/decisions.md`).
3. **Identify Affected Modules**: Pinpoint the precise components, controllers, domain services, or database models requiring updates.
4. **Inspect Only Relevant Files**: Open and inspect only the source and test files within the target subsystem. Do not scan unrelated areas of the repository.
5. **State Implementation Plan**: Formulate a clear, concise, step-by-step implementation plan and present it before executing edits.
6. **Implement Smallest Coherent Change**: Write clean, modular, and minimal code that directly satisfies the requirement. Maintain layer separation (Controller → Service → Repository).
7. **Add / Update Tests**: Create targeted unit or integration tests that validate both the happy path and critical boundary/error conditions (e.g., capacity limits, authorization checks).
8. **Run Targeted Tests**: Execute only the test suites corresponding to the modified modules to verify functional correctness.
9. **Run Typecheck**: Run static type verification (`tsc --noEmit` or equivalent) to confirm zero TypeScript compilation errors.
10. **Run Lint**: Run the project linter to ensure adherence to styling and code hygiene rules.
11. **Review Git Diff**: Inspect `git diff` thoroughly to ensure no unintended edits, leftover debug statements, or stray files are present.
12. **Update Relevant Documentation**: Update API specs, state diagrams, or `.ai/current-state.md` if the feature altered public contracts or system status.
13. **Report Changes and Verification**: Provide a structured final report detailing what files were modified, which tests were run, and the verification results.

---

## Strict Scope Rules

- **Zero Unrelated Refactoring**: An agent must NEVER refactor, reformat, rename, or clean up unrelated code during a feature task. Keep changes strictly localized to the assigned feature.
- **Preserve Architectural Invariants**: Ensure all modifications adhere to established architectural decisions (e.g., integer poysha for currency, row-level locking for seat allocation).