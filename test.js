var fs = require('fs');
var jsdiff = require('diff');
var baseDir = __dirname+'/global/';
var oldFile = baseDir +'build.scss';
var newFile = baseDir +'build_1.scss';
var patchFile = oldFile + ".patch";
fs.readFile(newFile, 'utf8', function (err, newText) {
  fs.readFile(oldFile, 'utf8', function (err, oldText) {
    var diffText = jsdiff.createPatch(patchFile, oldText, newText);
    fs.writeFile(patchFile, diffText, function (err) {
      console.log("Patch written to "+patchFile);
      if (err) {
        console.log(err);
      } else {
        fs.readFile(patchFile, 'utf8', function (err, diffText) {
          newText = jsdiff.applyPatch(oldText, diffText);
          console.log("oldText", oldText);
          console.log("diffText", diffText);
          console.log("newText", newText);
        });
      }
    });
  });
});
