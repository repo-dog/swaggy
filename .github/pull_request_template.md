<!-- For security fixes, please coordinate privately first — see SECURITY.md. -->

## What & why

<!-- What does this change, and what problem does it solve? Link any related issue (e.g. Closes #123). -->

## How to test

<!-- Steps a reviewer can follow to verify the change. -->

## Checklist

- [ ] `pnpm -r test` passes
- [ ] `pnpm -r build` passes
- [ ] Added/updated tests for the changed behavior
- [ ] Preserves security invariants (proxy/OAuth host allow-list; no credentials or history persisted/exported)
- [ ] Change is focused and matches surrounding style
