# PLEX:arctic

A Plex client for Samsung TVs (Tizen) and the web, built for a living room: big type, a release calendar, Watch Together and a calm dark or light look. It plays from your own Plex server.

Not made by or affiliated with Plex, Inc.

## What's in it

- Home: Spotlight banner, Continue watching with end times, This week, Fits before…, Finish the season, Pick for me, Most watched this week, Watching now (server admins), Trending and your server's own rows. Hold OK on anything for more options.
- Movies and TV shows in five views, with search (on-screen keyboard or voice), filters and sorting.
- Player: subtitles (burned in by the server, or two at once with a second subtitle at the top), audio and quality choices, Skip intro / Skip credits / Next episode, info panel.
- Release calendar: new episodes of your shows (from TVmaze), shows you add by hand, and cinema premieres in your country (from TMDB). Week, month and list views.
- Watch Together with [Open Watch Party](https://openwatch.party): start a room, share the 6-character code, and everyone plays their own copy in step. Works with other Open Watch Party apps such as Plezy.
- Five languages: English, Svenska, Čeština, Українська, Ελληνικά.

## Run it in a browser

The `app` folder is a plain web page. Serve it with any static web server, for example:

```sh
cd app
python3 -m http.server 8765
```

and open http://localhost:8765. On Windows, double-click `app/Start.bat`. Sign in with the code shown at plex.tv/link.

This repository's GitHub Pages also serve it at `https://<owner>.github.io/plexarctic/app/`.

## Install it on a Samsung TV

1. Copy `tizen/config.xml` and `tizen/icon.png` into the `app` folder.
2. Zip the contents of `app` (not the folder itself) and rename the zip to `PLEXarctic.wgt`.
3. Install it with a tool such as Apps2Samsung (Custom WGT), or with Tizen Studio, on a TV in developer mode.

## Your own settings

Copy `app/config.example.js` to `app/config.js` and add your TMDB API key and trailer page address. `config.js` is never committed.

## Trailers

YouTube only plays inside pages that have a web address, so TV apps can't embed it directly. `yt.html` is a small page you host (GitHub Pages works) that plays the trailer; the app shows it and steers it with play/pause and skip. Set its address in Settings → Trailer page.

## License

MIT, see [LICENSE](LICENSE). Third-party parts are listed in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

## Watch together and privacy

Watch together uses the [Open Watch Party](https://openwatch.party) public relay to keep everyone's playback in step.
Each person plays their own copy from Plex; the relay only sees display names, the room code and the title being
watched. See the relay's [privacy notice](https://openwatch.party/privacy) and [terms](https://openwatch.party/terms).

Invites to people in the same Plex Home are carried by Plex itself (a short-lived playlist on the server owner's
account), not by the relay.
