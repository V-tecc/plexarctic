# Third-party code and fonts

PLEX:arctic's own code is under the MIT license (see LICENSE). It ships with these parts made by others, each under its own license:

| Part | Where | License |
|---|---|---|
| Open Watch Party SDK 1.1.0 (TypeScript), bundled for older TV browsers | `app/lib/owp.js` | Apache License 2.0, see `licenses/openwatchparty-APACHE-2.0.txt`. Source: https://github.com/edde746/openwatchparty (`sdk/typescript`). Built with `tools/owp-entry.js` (adds two small polyfills) and esbuild: `npx esbuild tools/owp-entry.js --bundle --format=iife --global-name=OWP --target=chrome85 --minify --outfile=app/lib/owp.js` |
| hls.js | `app/lib/hls.min.js` | Apache License 2.0, https://github.com/video-dev/hls.js |
| Manrope font | `app/fonts/manrope` | SIL Open Font License 1.1, https://github.com/sharanda/manrope |
| Questrial font | `app/fonts/questrial/Questrial-Regular.woff2` | SIL Open Font License 1.1, https://fonts.google.com/specimen/Questrial |
| Roboto font | `app/fonts/questrial/roboto-*.woff2` | Apache License 2.0, https://github.com/googlefonts/roboto |

Data comes from your own Plex server and plex.tv, TVmaze (https://www.tvmaze.com/api) and TMDB (https://www.themoviedb.org). This product uses the TMDB API but is not endorsed or certified by TMDB. PLEX:arctic is not made by or affiliated with Plex, Inc.
