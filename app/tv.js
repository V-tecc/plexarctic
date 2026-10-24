/* Samsung TV (Tizen) support: registers the remote's extra keys and turns them into the keys the app
   already understands. Does nothing in a normal browser. */
(function () {
  var isTV = typeof window.tizen !== 'undefined' && !!window.tizen.tvinputdevice;
  window.IS_TV = isTV;
  if (!isTV) return;
  /* TVs: lay the page out at 1920 px wide; the app then scales its 1920 x 1080 screen to fit exactly */
  var vp = document.querySelector('meta[name=viewport]');
  if (vp) vp.setAttribute('content', 'width=1920, initial-scale=1, user-scalable=no');
  try {
    tizen.tvinputdevice.registerKeyBatch(['MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop', 'MediaRewind', 'MediaFastForward',
      '0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
  } catch (e) { /* older firmware: register what we can */ }
  /* Back -> Escape, Play/Pause -> Space, Rewind/Fast forward -> Left/Right, Stop -> Escape */
  var map = { 10009: 'Escape', 10252: ' ', 415: ' ', 19: ' ', 413: 'Escape', 412: 'ArrowLeft', 417: 'ArrowRight' };
  window.addEventListener('keydown', function (e) {
    if (e.__tv) return;
    var k = map[e.keyCode];
    if (!k) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    var ev = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
    ev.__tv = true;
    document.dispatchEvent(ev);
  }, true);
  window.tvExit = function () { try { tizen.application.getCurrentApplication().exit(); } catch (e) { /* ignore */ } };
})();
