# Third-party software

## Mediabunny 1.55.7

- Purpose: local media decoding, encoding and MP4/WebM container writing.
- Author: Vanilagy and contributors.
- License: Mozilla Public License 2.0 (MPL-2.0).
- License text is included at `public/licenses/mediabunny.txt`.
- Project and source: https://github.com/Vanilagy/mediabunny
- Exact package source: https://www.npmjs.com/package/mediabunny/v/1.55.7

Mediabunny source files have not been modified for this application. Retain its notices and license when redistributing the built site.

## Vite 8.2.2

- Purpose: development/build/static-preview tooling; not a media-processing backend.
- License: MIT.
- Project: https://github.com/vitejs/vite

Dependency versions and transitive dependencies are pinned in `package-lock.json`.

FFmpeg and Playwright were used only for workspace QA. They are not shipped in the app or required on the user's computer.
