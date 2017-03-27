const FS = (() => {

  let fs = null;

  function onError(DOMError) {
    let msg = '';

    switch (DOMError.name) {
      case 'QuotaExceededError':
        msg = 'QuotaExceededError';
        break;
      case 'NotFoundError':
        msg = 'NotFoundError';
        break;
      case 'SecurityError':
        msg = 'SecurityError';
        break;
      case 'InvalidModificationError':
        msg = 'InvalidModificationError';
        break;
      case 'InvalidStateError':
        msg = 'InvalidStateError';
        break;
      default:
        msg = 'Unknown Error';
        break;
    };
    console.error(msg);
  }

  return {
    init(size = 500, callback) {
      navigator.webkitPersistentStorage.requestQuota(1024 * 1024 * size, function (grantedBytes) {

        window.webkitRequestFileSystem(window.PERSISTENT, grantedBytes, function (filesystem) {
          fs = filesystem;
          if(callback) callback();
        }, onError);

      }, onError);
    },
    usedAndRemaining(callback) {
      navigator.webkitPersistentStorage.queryUsageAndQuota(function (used, remaining) {
        if (callback) { callback(used, remaining); }
      });
    },
    createDir(path, callback) {
      fs.root.getDirectory(path, { create: true }, function(dirEntry) {
        if (callback) callback(dirEntry);
      }, onError);
    },
    getDir(path, callback) {
      fs.root.getDirectory(path, {}, function (dirEntry) {
        if (callback) callback(dirEntry);
      }, onError);
    },
    deleteDir(path, flags, callback) {
      var flags = flags || {};
      if (flags.recursive === undefined) flags.recursive = false;

      var rootDir = fs.root;

      rootDir.getDirectory(path, {}, function (dirEntry) {
        if (flags.recursive) {
          dirEntry.removeRecursively(function () {
            //call callback function if specified
            if (callback) callback();
          }, onError);
        }
        else {
          dirEntry.remove(function () {
            //call callback function if specified
            if (callback) callback();
          }, onError);
        }
      }, onError);
    },
    createFile(path, data, callback) {
      fs.root.getFile(path, { create: true }, function(fileEntry) {
        fileEntry.createWriter(function(fileWriter) {
          fileWriter.onwriteend = function() {
            if(callback) callback(fileEntry);
          }
          fileWriter.onerror = function(e) {
            console.log(e);
          }
          var blob = new Blob([data.file], { type: data.fileType });
          fileWriter.write(blob);
        });
      });
    },
    deleteFile(path, callback) {
      fs.root.getFile(path, { create: false }, function (fileEntry) {
        fileEntry.remove(function () {
          if(callback) callback();
        }, onError);
      }, onError);
    },

    purge() {
      var dirReader = fs.root.createReader();
      dirReader.readEntries(function (entries) {
        for (var i = 0, entry; entry = entries[i]; ++i) {
          if (entry.isDirectory) {
            entry.removeRecursively(function () { }, onError);
          } else {
            entry.remove(function () { }, onError);
          }
        }
        console.info('Local storage emptied.');
      }, onError);
    }

  };

})();

export default FS;
