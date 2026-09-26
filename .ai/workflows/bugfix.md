# Bugfix Workflow

This document defines the strict, disciplined process for identifying, isolating, repairing, and verifying bugs within the Dhaka Tesla Pool repository.

---

## 9-Step Bug-Fixing Process

1. **Reproduce**: Construct a minimal reproduction case (or test scenario) demonstrating the unexpected behavior or failure mode.
2. **Identify Root Cause**: Trace the issue to its origin (e.g., incorrect state transition logic, race condition in capacity calculation, boundary flaw in zone matrix, or unhandled exception).
3. **Identify Invariant Violated**: Explicitly determine which system invariant was breached (e.g., seat capacity exceeded, negative poysha balance, unauthorized ride cancellation, or illegal state jump).
4. **Implement Smallest Safe Fix**: Apply the most direct, minimal, and surgical fix that restores the invariant without altering unrelated behavior or over-engineering the solution.
5. **Add Regression Test**: Write an automated test that fails on the unpatched code and passes cleanly with the fix applied. For concurrency bugs, this must include a multi-request test.
6. **Run Targeted Tests**: Execute the regression test alongside existing tests in the affected module to ensure no regressions were introduced.
7. **Run Typecheck / Lint**: Confirm that TypeScript compiles cleanly (`tsc --noEmit`) and linter checks pass without errors or warnings.
8. **Review Diff**: Examine the `git diff` carefully to ensure the fix is focused, minimal, and contains no accidental changes or debug code.
9. **Document Architectural Impact**: If the fix requires modifying an established architectural assumption or data model, update the relevant ADR or documentation in `.ai/` and report it.