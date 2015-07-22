var fs = require("fs")
var tar = require("tar")


fs.createReadStream('D:\\dev\\gits\\dte\\pad-kit\\repos\\local\\0a936ea4da8a1e948e55de15dfe5e5d982491260.tar')
  .pipe(tar.Parse())
  /*.on("extendedHeader", function (e) {
    console.error("extended pax header", e.props)
    e.on("end", function () {
      console.error("extended pax fields:", e.fields)
    })
  })
  .on("ignoredEntry", function (e) {
    console.error("ignoredEntry?!?", e.props)
  })
  .on("longLinkpath", function (e) {
    console.error("longLinkpath entry", e.props)
    e.on("end", function () {
      console.error("value=%j", e.body.toString())
    })
  })
  .on("longPath", function (e) {
    console.error("longPath entry", e.props)
    e.on("end", function () {
      console.error("value=%j", e.body.toString())
    })
  })*/
  .on("entry", function (e) {
    if (e.path == 'package.json') {
      var meta = '';
      e.on("data", function (c) {
        //console.error("  >>>" + c.toString().replace(/\\n/g, "\\\\n"))
        meta += c.toString().replace(/\\n/g, "\\\\n");
      })
      e.on("end", function () {
        console.log(JSON.parse(meta));
      })
    }
    /*e.on("data", function (c) {
      console.error("  >>>" + c.toString().replace(/\\n/g, "\\\\n"))
    })
    e.on("end", function () {
      console.error("  <<<EOF")
    })*/
  })