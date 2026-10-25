/* Built-in settings for your own copy of the app. Copy this file to config.js and fill in what you want.
   A value here is used until a different one is saved in the app's Settings.
   config.js is not part of the published code (it can hold your own keys). */
window.PRESET = {
  tmdb: '',    // your TMDB API key (https://www.themoviedb.org/settings/api) for Trending, trailers and the movie calendar
  ytPage: '',  // address of your trailer page (see yt.html in this repository), e.g. https://<you>.github.io/plexarctic/yt.html
  fanart: '',  // your fanart.tv API key (https://fanart.tv/get-an-api-key/) for clearart and more logos
  ghToken: '', // optional: a GitHub token with only the "gist" scope; keeps an off-site copy of your artwork choices in a private gist
  osKey: '', osUser: '', osPass: '', // optional: your own OpenSubtitles.com API key + account, used when Plex can't fetch a subtitle
  audd: '',    // your AudD API token (https://dashboard.audd.io) for "What's this song?" in the player
  // your own poster and background for the Arrowverse series, as files next to the app (e.g. in a local/ folder):
  // woArt: { arrowverse: { poster: 'local/arrowverse-poster.jpg', art: 'local/arrowverse-art.jpg' } }
};
