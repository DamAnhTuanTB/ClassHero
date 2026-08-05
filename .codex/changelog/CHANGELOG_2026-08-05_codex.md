# Changelog 2026-08-05

## feat(ai): remove priority fields and fix UI flickering
- Removed `focus` and `contentSections` logic from AI prompt generation schema and API endpoint.
- Fixed UI flickering during AI configuration preview update by managing stable local state.

## fix(web): globally remove cursor-wait and unify login error
- Removed all instances of `cursor-wait` and `disabled:cursor-wait` utility classes across the web app.
- Unified login API error message in the client to clearly denote bad credentials or validation issues with a single message.
- Fixed an issue where the logout logic failed to redirect correctly by enforcing a `window.location.href` reload instead of internal Next.js transitions.
- Centered the ClassHero logo horizontally in the admin panel sidebar.
