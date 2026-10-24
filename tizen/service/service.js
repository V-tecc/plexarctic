/* PLEX:arctic background service: puts the row of posters the app sends on the TV's home screen
   (Samsung Smart Hub preview), then ends. The row itself is built by the app. */
var lastData = null;
function done() { try { tizen.application.getCurrentApplication().exit(); } catch (e) { /* already ending */ } }
function show(json) {
  try {
    webapis.preview.setPreviewData(json, function () { done(); }, function (e) { console.log('setPreviewData failed: ' + (e && e.message)); done(); });
  } catch (e) { console.log('preview not available: ' + e); done(); }
}
module.exports.onStart = function () { console.log('PLEX:arctic preview service start'); };
module.exports.onRequest = function () {
  try {
    var req = tizen.application.getCurrentApplication().getRequestedAppControl();
    var data = (req && req.appControl && req.appControl.data) || [];
    var fromApp = false, json = null;
    for (var i = 0; i < data.length; i++) {
      if (data[i].key === 'caller' && data[i].value[0] === 'ForegroundApp') fromApp = true;
      if (data[i].key === 'preview') json = data[i].value[0];
    }
    if (fromApp && json) { lastData = json; show(json); return; }
    /* the TV's own regular call: nothing new to show, keep what's there */
    if (lastData) show(lastData); else done();
  } catch (e) { console.log('preview service error: ' + e); done(); }
};
module.exports.onExit = function () { console.log('PLEX:arctic preview service exit'); };
