/*!
 * PAD package engine.
 *
 * please see the LICENSE
 */

var fs = require('fs')
  , path = require('path')
  , AdmZip = require('adm-zip')
  , wordsUtils = require("./utils/words")
  , mkdirp = require("mkdirp")
  , mime = require("mime")
  , _ = require("underscore")

/**
 * Simple Package Engine
 * 
 * Initialize a new PadEngine.
 *
 * @param {Object} repo
 */
var PadEngine = module.exports = function() {
  var self = this

  if(false === (self instanceof PadEngine)) {
    return new PadEngine()
  }

  return self
}

// IMPORTANT !
PadEngine.files = [ ".zip", ".rar", ".tar", ".tar.gz" ];

PadEngine.type = 'epm-package-engine';

PadEngine.version = require('./package.json').version;

PadEngine.prototype.readMetadata = function(filename, cb) {
  var self = this
  try {
    var zip = new AdmZip(path.resolve(filename));

    zip.readAsTextAsync('package.json', function(metadata){
      if (metadata === undefined || metadata === "") {
        return cb && cb(new Error("metadata undefined"));
      }

      cb && cb(null, JSON.parse(metadata));
    });
    
  } catch (err){
    console.error(err);
    return cb && cb(err);
  }
}


PadEngine.prototype.cutUid = function(uid){
  return uid.substring(0, 7) + ".." + uid.substring(uid.length-7)
}

PadEngine.prototype.getTags = function(metadata){
  if (   metadata === undefined 
      || metadata.content === undefined 
      || metadata.content.tags === undefined) return []
    
  return wordsUtils.splitTags(metadata.content.tags)
}

PadEngine.prototype.isMatch = function(metadata, query){
  var self = this;

  var meta = metadata
    , res

  var where = _.clone(query.where);

  var prev;

  while (where !== undefined){
    //console.info(where);
    var pred = _.clone(where.predicate);

    var curr = self.isMatchPredicate(pred, metadata)

    if (res === undefined){
      res = curr
    } else if (prev === 'and'){
      res = res && curr;
      
      //if (curr === false) return false;

    } else {
      res = res || curr;
    }

    if (where.and !== undefined) {
      prev = 'and'
    } else {
      prev = 'or'
    }

    if (where.and !== undefined) {
      where = _.clone(where.and);
    } else if (where.or !== undefined) {
      where = _.clone(where.or);
    } else {
      where = undefined;
    }
  }

  return res
}

PadEngine.prototype.isMatchPredicate = function(predicate, metadata) {
  var self = this;

  try {
    var key = predicate.key.toLowerCase();

    if (key.match(/(uid|id)/gi)){
      return compareScape(
          predicate,
          metadata.uid
        );
    } else if (key.match(/(area|axis|block|title)/gi)){

      return compareScape(
          predicate,
          metadata.content[key]
        );
      
    } else if (key === 'tag'){
      var tags = wordsUtils.splitTags(metadata.content.tags);
      
      if (tags.length === 0) return false;

      return _.any(tags.map(function(t){
        return compareScape(predicate, t);
      }));
    }

  } catch(err){
    console.error(err);
    return false;
  }
}

function compareScape(predicate, text){
  var ps = wordsUtils.escape(predicate.value);
  var pv = wordsUtils.escape(text);

  if (pv === undefined || pv === '') return false;
  //console.log("'%s' '%s' '%s'", ps, predicate.operator, pv);
  switch(predicate.operator){
    
    case '!=': return ps !== pv;

    case 'contains': return pv.indexOf(ps) !== -1;

    case '=':
      default: return ps === pv;
  }
}

PadEngine.prototype.asset = function(repo, info, meta, asset, cb){
  var self = this

  var key = info.uid + '-' + info.build
  var cf = repo.fs.resolve('cache-folder', key)

  var aFilename = self.resolveAsset(meta, asset)

  if (aFilename === undefined){
    cb && cb(new Error('Unknown asset ' + asset))
    return self
  }

  var full = repo.fs.resolve('cache-folder', key, aFilename)

  if (fs.existsSync(full)) {
    cb && cb(null, full)
    return self
  }

  mkdirp(cf, function(err){
    if (err) return cb && cb(err);

    var zip = new AdmZip(repo.resolve(info.filename))
    zip.extractAllTo(cf, true);

    cb && cb(null, full)
  })

  return self
}

PadEngine.prototype.resolveAsset = function(metadata, asset){
  var self = this

  // image?
  if (asset.match(/(front|content)/ig)){
    var a = metadata.content.images.filter(function(i){
      return i.type === asset.toLowerCase()
    })

    if (a.length === 0) return undefined

    return a[0].src
  }

  return undefined
}

PadEngine.prototype.content = function(repo, info, meta, cb){
  var self = this

  var key = info.uid + '-' + info.build;
  var cf = repo.fs.resolve('cache-folder', key);

  var cfiles = meta.content.files;

  if (cfiles.length === 0){
    return cb && cb(new Error('Unknown content'));
  }

  var extracteds = false;

  if (fs.existsSync(cf)) {
    extracteds = !_.any(cfiles, function(f){
      return !fs.existsSync(path.join(cf, f.filename));
    });
  }

  mkdirp(cf, function(err){
    if (err) return cb && cb(err);

    if (!extracteds){
      var zip = new AdmZip(repo.resolve(info.filename))
      zip.extractAllTo(cf, true);  
    }

    var files = cfiles.map(function(f){
      return path.join(cf, f.filename);
    });
    
    cb && cb(null, files);
  });
}