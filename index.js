'use strict';

/*!
 * PAD package engine.
 *
 * please see the LICENSE
 */

var fs = require('fs')
  , path = require('path')
  , AdmZip = require('adm-zip')
  , mkdirp = require("mkdirp")
  , mime = require("mime")
  , _ = require("underscore")
  , async = require("async")
  , Q = require("q");

function _readMetadata(task, cb){
  var filename = task.filename;

  try {
    var zip = new AdmZip(path.resolve(filename));

    zip.readAsTextAsync('package.json', function(metadata){
      if (metadata === undefined || metadata === "") {
        return cb && cb(new Error("metadata undefined"));
      }

      cb && cb(null, JSON.parse(metadata));
    });
    
  } catch (err){
    //console.error(err);
    return cb && cb(err);
  }
}

function _resolveAsset(metadata, asset){
  // image?
  if (asset.match(/(front|content)/ig)){
    var a = metadata.content.images.filter(function(i){
      return i.type === asset.toLowerCase();
    })

    if (a.length === 0) {
      return undefined
    }

    return a[0].src;
  }

  return undefined;
}

function _asset(task, cb){
  var repo = task.repo;
  var info = task.info;
  var meta = task.meta;
  var asset = task.asset;

  var key = info.uid + '-' + info.build
  var cf = repo.fs.resolve('cache-folder', key)

  var aFilename = _resolveAsset(meta, asset)
  if (aFilename === undefined){
    cb && cb(new Error('Unknown asset ' + asset))
    return;
  }

  var full = repo.fs.resolve('cache-folder', key, aFilename)

  if (fs.existsSync(full)) {
    cb && cb(null, full)
    return;
  }

  mkdirp(cf, function(err){
    if (err) return cb && cb(err);

    var zip = new AdmZip(repo.resolve(info.filename))
    //zip.extractAllTo(cf, true);
    zip.extractEntryTo(aFilename, cf, true, true);

    cb && cb(null, full)
  });

};

function _content(task, cb){
  
  var repo = task.repo;
  var info = task.info;
  var meta = task.meta;

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
    return new PadEngine();
  }

  self.queue = async.queue(function(task, callback){

    var _func;
    if (task.type === 'metadata'){
      _func = _readMetadata;
    }

    if (task.type === 'asset'){
      _func = _asset;
    }

    if (task.type === 'content'){
      _func = _content;
    }
    
    var cb = function(err, data){
      if (err){
        callback();
        return task.defer.reject(err);
      }

      task.defer.resolve(data);
      callback();
    };

    _func.apply(self, [task, cb]);

  });

  return self
}

// IMPORTANT !
PadEngine.files = [ ".zip", ".rar", ".tar", ".tar.gz" ];

PadEngine.type = 'epm-package-engine';

PadEngine.version = require('./package.json').version;

PadEngine.prototype.readMetadata = function(filename) {
  var self = this;

  var task = { type: 'metadata', filename: filename, defer: Q.defer() };

  self.queue.push(task);

  return task.defer.promise;
};

PadEngine.prototype.asset = function(repo, info, meta, asset){
  var self = this

  var task = { 
    type: 'asset', 
    repo: repo,
    info: info,
    meta: meta,
    asset: asset,
    defer: Q.defer() 
  };

  self.queue.push(task);

  return task.defer.promise;
};

PadEngine.prototype.content = function(repo, info, meta, cb){
  var self = this

  var task = { 
    type: 'content', 
    repo: repo,
    info: info,
    meta: meta,
    defer: Q.defer() 
  };

  self.queue.push(task);

  return task.defer.promise;
};