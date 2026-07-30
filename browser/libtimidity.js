// include: shell.js
// include: minimum_runtime_check.js
(function() {
  // "30.0.0" -> 300000
  function humanReadableVersionToPacked(str) {
    str = str.split('-')[0]; // Remove any trailing part from e.g. "12.53.3-alpha"
    var vers = str.split('.').slice(0, 3);
    while(vers.length < 3) vers.push('00');
    vers = vers.map((n, i, arr) => n.padStart(2, '0'));
    return vers.join('');
  }
  // 300000 -> "30.0.0"
  var packedVersionToHumanReadable = n => [n / 10000 | 0, (n / 100 | 0) % 100, n % 100].join('.');

  var TARGET_NOT_SUPPORTED = 2147483647;

  // Note: We use a typeof check here instead of optional chaining using
  // globalThis because older browsers might not have globalThis defined.

  // We skip the node version checking when running on Bun/Deno since the node
  // version they report doesn't seem to be useful.
  if (typeof process !== 'undefined' && !process.versions?.bun && typeof Deno == "undefined") {
    var currentNodeVersion = process.versions?.node ? humanReadableVersionToPacked(process.versions.node) : TARGET_NOT_SUPPORTED;
    if (currentNodeVersion < 180300) {
      throw new Error(`This emscripten-generated code requires node v${ packedVersionToHumanReadable(180300) } (detected v${packedVersionToHumanReadable(currentNodeVersion)})`);
    }
  }

  var userAgent = typeof navigator !== 'undefined' && navigator.userAgent;
  if (!userAgent) {
    return;
  }

  var currentSafariVersion = userAgent.includes("Safari/") && !userAgent.includes("Chrome/") && userAgent.match(/Version\/(\d+\.?\d*\.?\d*)/) ? humanReadableVersionToPacked(userAgent.match(/Version\/(\d+\.?\d*\.?\d*)/)[1]) : TARGET_NOT_SUPPORTED;
  if (currentSafariVersion < 150000) {
    throw new Error(`This emscripten-generated code requires Safari v${ packedVersionToHumanReadable(150000) } (detected v${currentSafariVersion})`);
  }

  var currentFirefoxVersion = userAgent.match(/Firefox\/(\d+(?:\.\d+)?)/) ? parseFloat(userAgent.match(/Firefox\/(\d+(?:\.\d+)?)/)[1]) : TARGET_NOT_SUPPORTED;
  if (currentFirefoxVersion < 79) {
    throw new Error(`This emscripten-generated code requires Firefox v79 (detected v${currentFirefoxVersion})`);
  }

  var currentChromeVersion = userAgent.match(/Chrome\/(\d+(?:\.\d+)?)/) ? parseFloat(userAgent.match(/Chrome\/(\d+(?:\.\d+)?)/)[1]) : TARGET_NOT_SUPPORTED;
  if (currentChromeVersion < 85) {
    throw new Error(`This emscripten-generated code requires Chrome v85 (detected v${currentChromeVersion})`);
  }
})();

// end include: minimum_runtime_check.js
// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(moduleArg) => Promise<Module>
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module = typeof Module != 'undefined' ? Module : {};

// Determine the runtime environment we are in. You can customize this by
// setting the ENVIRONMENT setting at compile time (see settings.js).

// Attempt to auto-detect the environment
var ENVIRONMENT_IS_WEB = !!globalThis.window;
var ENVIRONMENT_IS_WORKER = !!globalThis.WorkerGlobalScope;
// N.b. Electron.js environment is simultaneously a NODE-environment, but
// also a web environment.
var ENVIRONMENT_IS_NODE = globalThis.process?.versions?.node && globalThis.process?.type != 'renderer';
var ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)


var programArgs = [];
var thisProgram = './this.program';
var quit_ = (status, toThrow) => {
  throw toThrow;
};

// In MODULARIZE mode _scriptName needs to be captured already at the very top of the page immediately when the page is parsed, so it is generated there
// before the page load. In non-MODULARIZE modes generate it here.
var _scriptName = globalThis.document?.currentScript?.src;

if (typeof __filename != 'undefined') { // Node
  _scriptName = __filename;
} else
if (ENVIRONMENT_IS_WORKER) {
  _scriptName = self.location.href;
}

// `/` should be present at the end if `scriptDirectory` is not empty
var scriptDirectory = '';
function locateFile(path) {
  if (Module['locateFile']) {
    return Module['locateFile'](path, scriptDirectory);
  }
  return scriptDirectory + path;
}

// Hooks that are implemented differently in different runtime environments.
var readAsync, readBinary;

if (ENVIRONMENT_IS_NODE) {
  const isNode = globalThis.process?.versions?.node && globalThis.process?.type != 'renderer';
  if (!isNode) throw new Error('not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)');

  // These modules will usually be used on Node.js. Load them eagerly to avoid
  // the complexity of lazy-loading.
  var fs = require('node:fs');

  scriptDirectory = __dirname + '/';

// include: node_shell_read.js
readBinary = (filename) => {
  // We need to re-wrap `file://` strings to URLs.
  filename = isFileURI(filename) ? new URL(filename) : filename;
  var ret = fs.readFileSync(filename);
  assert(Buffer.isBuffer(ret));
  return ret;
};

readAsync = async (filename, binary = true) => {
  // See the comment in the `readBinary` function.
  filename = isFileURI(filename) ? new URL(filename) : filename;
  var ret = fs.readFileSync(filename, binary ? undefined : 'utf8');
  assert(binary ? Buffer.isBuffer(ret) : typeof ret == 'string');
  return ret;
};
// end include: node_shell_read.js
  if (process.argv.length > 1) {
    thisProgram = process.argv[1].replace(/\\/g, '/');
  }

  programArgs = process.argv.slice(2);

  // MODULARIZE will export the module in the proper place outside, we don't need to export here
  if (typeof module != 'undefined') {
    module['exports'] = Module;
  }

  quit_ = (status, toThrow) => {
    process.exitCode = status;
    throw toThrow;
  };

} else
if (ENVIRONMENT_IS_SHELL) {

} else

// Note that this includes Node.js workers when relevant (pthreads is enabled).
// Node.js workers are detected as a combination of ENVIRONMENT_IS_WORKER and
// ENVIRONMENT_IS_NODE.
if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  try {
    scriptDirectory = new URL('.', _scriptName).href; // includes trailing slash
  } catch {
    // Must be a `blob:` or `data:` URL (e.g. `blob:http://site.com/etc/etc`), we cannot
    // infer anything from them.
  }

  if (!(globalThis.window || globalThis.WorkerGlobalScope)) throw new Error('not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)');

  {
// include: web_or_worker_shell_read.js
if (ENVIRONMENT_IS_WORKER) {
    readBinary = (url) => {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.responseType = 'arraybuffer';
      xhr.send(null);
      return new Uint8Array(/** @type{!ArrayBuffer} */(xhr.response));
    };
  }

  readAsync = async (url) => {
    // Fetch has some additional restrictions over XHR, like it can't be used on a file:// url.
    // See https://github.com/github/fetch/pull/92#issuecomment-140665932
    // Cordova or Electron apps are typically loaded from a file:// url.
    // So use XHR on webview if URL is a file URL.
    if (isFileURI(url)) {
      return new Promise((resolve, reject) => {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'arraybuffer';
        xhr.onload = () => {
          if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
            resolve(xhr.response);
            return;
          }
          reject(xhr.status);
        };
        xhr.onerror = reject;
        xhr.send(null);
      });
    }
    var response = await fetch(url, { credentials: 'same-origin' });
    if (response.ok) {
      return response.arrayBuffer();
    }
    throw new Error(response.status + ' : ' + response.url);
  };
// end include: web_or_worker_shell_read.js
  }
} else
{
  throw new Error('environment detection error');
}

var out = console.log.bind(console);
var err = console.error.bind(console);

var IDBFS = 'IDBFS is no longer included by default; build with -lidbfs.js';
var PROXYFS = 'PROXYFS is no longer included by default; build with -lproxyfs.js';
var WORKERFS = 'WORKERFS is no longer included by default; build with -lworkerfs.js';
var FETCHFS = 'FETCHFS is no longer included by default; build with -lfetchfs.js';
var ICASEFS = 'ICASEFS is no longer included by default; build with -licasefs.js';
var JSFILEFS = 'JSFILEFS is no longer included by default; build with -ljsfilefs.js';
var OPFS = 'OPFS is no longer included by default; build with -lopfs.js';

var NODEFS = 'NODEFS is no longer included by default; build with -lnodefs.js';

// perform assertions in shell.js after we set up out() and err(), as otherwise
// if an assertion fails it cannot print the message

assert(!ENVIRONMENT_IS_SHELL, 'shell environment detected but not enabled at build time (add `shell` to `-sENVIRONMENT` to enable)');

// end include: shell.js

// include: preamble.js
// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html

var wasmBinary;

// WASM == 2 includes wasm2js.js separately.
// include: wasm2js.js
// wasm2js.js - enough of a polyfill for the WebAssembly object so that we can load
// wasm2js code that way.

/** @suppress{duplicate, const, checkTypes} */
var WebAssembly = {
  // Note that we do not use closure quoting (this['buffer'], etc.) on these
  // functions, as they are just meant for internal use. In other words, this is
  // not a fully general polyfill.
  /** @constructor */
  Memory: function(opts) {
    this.buffer = new ArrayBuffer(opts['initial'] * 65536);
  },

  Module: function(binary) {
    // TODO: use the binary and info somehow - right now the wasm2js output is embedded in
    // the main JS
  },

  /** @constructor */
  Instance: function(module, info) {
    // TODO: use the module somehow - right now the wasm2js output is embedded in
    // the main JS
    // This will be replaced by the actual wasm2js code.
    this.exports = (
function instantiate(info) {
function Table(ret) {
  ret.grow = function(by) {
    var old = this.length;
    this.length = this.length + by;
    return old;
  };
  ret.set = function(i, func) {
    this[i] = func;
  };
  ret.get = function(i) {
    return this[i];
  };
  return ret;
}

  var bufferView;
  var base64ReverseLookup = new Uint8Array(123/*'z'+1*/);
  for (var i = 25; i >= 0; --i) {
    base64ReverseLookup[48+i] = 52+i; // '0-9'
    base64ReverseLookup[65+i] = i; // 'A-Z'
    base64ReverseLookup[97+i] = 26+i; // 'a-z'
  }
  base64ReverseLookup[43] = 62; // '+'
  base64ReverseLookup[47] = 63; // '/'
  /** @noinline Inlining this function would mean expanding the base64 string 4x times in the source code, which Closure seems to be happy to do. */
  function base64DecodeToExistingUint8Array(uint8Array, offset, b64) {
    var b1, b2, i = 0, j = offset, bLength = b64.length, end = offset + (bLength*3>>2) - (b64[bLength-2] == '=') - (b64[bLength-1] == '=');
    for (; i < bLength; i += 4) {
      b1 = base64ReverseLookup[b64.charCodeAt(i+1)];
      b2 = base64ReverseLookup[b64.charCodeAt(i+2)];
      uint8Array[j++] = base64ReverseLookup[b64.charCodeAt(i)] << 2 | b1 >> 4;
      if (j < end) uint8Array[j++] = b1 << 4 | b2 >> 2;
      if (j < end) uint8Array[j++] = b2 << 6 | base64ReverseLookup[b64.charCodeAt(i+3)];
    }
    return uint8Array;
  }
function initActiveSegments(imports) {
  base64DecodeToExistingUint8Array(bufferView, 65536, "IAmgAEhUVFBwcm94eQBGVFBwcm94eQBlbnYAdGltZW91dABvcHQAc291bmRmb250AGRlZmF1bHQAcmlnaHQAbGVmdABjb3B5ZHJ1bXNldAAucGF0AFVua25vd24gZXJyb3IAZGlyAGNlbnRlcgBtYWlsYWRkcgBsb29wAGFtcABzdHJpcABrZWVwAG1hcAAjZXh0ZW5zaW9uAGFsdGFzc2lnbgBwYW4AY29tbQB0YWlsAE1UcmsAY29weWJhbmsAdGltaWRpdHkuY2ZnAHVuZGVmAG5vdGUAcHJvZ2Jhc2UAc291cmNlAE1UaGQAcmIAcndhAGRhdGEAUklGRgBSTUlEAD8/Pz8/PwBHRjFQQVRDSDExMABJRCMwMDAwMDIAR0YxUEFUQ0gxMDAASUQjMDAwMDAyAAAAAAAAAAAAAADwHwAA1iEAANkjAAD7JQAAPSgAAKEqAAAqLQAA2i8AALIyAAC2NQAA6DgAAEo8AADgPwAArEMAALJHAAD1SwAAelAAAENVAABVWgAAtF8AAGVlAABsawAAz3EAAJR4AAC/fwAAWIcAAGSPAADrlwAA86AAAIaqAACptAAAZ78AAMnKAADY1gAAnuMAACfxAAB+/wAAsA4BAMgeAQDWLwEA50EBAAtVAQBTaQEAz34BAJKVAQCwrQEAPccBAE/iAQD9/gEAXx0CAJA9AgCrXwIAzoMCABaqAgCl0gIAnv0CACQrAwBgWwMAeo4DAJ7EAwD6/QMAvzoEACF7BABXvwQAnAcFACxUBQBKpQUAO/sFAElWBgDAtgYA9BwHADuJBwDz+wcAfXUIAEL2CACufgkANw8KAFioCgCVSgsAd/YLAJGsDACAbQ0A6DkOAHcSDwDm9w8A++oQAIPsEQBc/RIAbh4UALFQFQAqlRYA7uwXACNZGQAA2xoAz3McAO0kHgDN7x8A9dUhAAbZIwC4+iUA3DwoAGKhKgBTKi0A29kvAEayMgAAtjUAnuc4ANpJPACZ3z8A6qtDAAyyRwBw9UsAuXlQAMRCVQCnVFoAt7NfAItkZQAAbGsAPM9xALWTeAAyv38A1FeHABlkjwDf6pcAcvOgAIeFqgBOqbQAbme/AAAAAAAAAJA/S781QVqIkD/xLr2CPhWRP/nGM3PTppE/wm3dCkE9kj89wp2WsNiSP+jqTsNMeZM/zAZ5qUEflD+sd23ZvMqUP4hYyWfte5U/mo9i+gMzlj9ZCKPVMvCWP0XAVeqts5c/YnDp46p9mD/yvSw3YU6ZP739hzEKJpo/VLi4COEEmz/oQBPrIuubP2XVThAP2Zw/UuTgyubOnT9uPOyZ7cyeP5USyTtp058/J3qV4FBxoD+B9HTQcP2gPycYOuY6jqE/Sh134tYjoj8yVIPYbb6iP4knwjkqXqM/wzlK4TcDpD/h0O8fxK2kP43etcj9XaU/Pg+pPRUUpj/fZyh9PNCmP5sXny+nkqc/lEKztYpbqD9Qqu02HiupP+053rCaAao/aJ7BBjvfqj+2NqwRPMSrP/jLPrHcsKw/Majp3F2lrT9zyMK1AqKuP2wQ9JgQp68/TkdjmWdasD/VBShJxOWwPxEm5J7EdbE/uczFI5AKsj+AK+ixT6SyP5jMin8tQ7M/eXOoKlXnsz+BwfDE85C0PxPoJ+A3QLU/8s3vmlH1tT95Kv6tcrC2Pz43w3nOcbc/lreEFJo5uD98NfFYDAi5Pyh0L/Vd3bk/6jpuesm5uj8Avvhsi527P7kP1FTiiLw/dynqzg58vT9aQ8eeU3e+P3FZ7sD1er8/WvPkPp5DwD+GBJ++OM7AP/q2cG1wXcE/hkpxnWzxwT+eks/vVYrCP/Gg+V9WKMM/NYAjT5nLwz8IKTCQS3TEPzT2/3ObIsU/PPkn1rjWxT/nrBUq1ZDGP2ehoogjUcc/QNwbvtgXyD/9xcBYK+XIP6mgvbdTuck/l6OlGoyUyj9w/HCxEHfLP4QZA60fYcw/xMY9UPlSzT+BzaUB4EzOPwzvnV0YT88/s52epPQs0D8Y+OICzrbQP90bYSI+RdE/8SZmHmzY0T+434NfgHDSP4/UqKakDdM/9gaXGASw0z8ZSLxJy1fUPyaHb0ooBdU/6m2Ws0q41T9exLazY3HWP78xdxymMNc/QBCTcEb21z/1J0XyesLYP0RGLbJ7ldk/6si0noJv2j9kVvaTy1DbP8whLWyUOdw/ET2wEB0q3T87o36LpyLePw3MYBl4I98/oWFSnmoW4D8q9Dzog5/gP6LTeI4tLeE/JlTVdY6/4T+7EZbOzlbiP1Saex8Y8+I/2h8qUZWU4z9ZU/G5cjvkP2+l+Cne5+Q/kUPT9waa5T8gRn8NHlLmP9ig0/VVEOc/iYVg6uLU5z9MCMbh+p/oPxv1hJ7Vcek/CehNvqxK6j8s3NLJuyrrP/6IH0VAEuw/Cwt9wHkB7T/0euXpqfjtP4I9DJ8U+O4/AAAAAAAA8D8AAAAAAADwP3Fd9Z7sAPA/VBKWS9kB8D/P6OIFxgLwPxWr3M2yA/A/ZiOEo58E8D8KHNqGjAXwP1hf33d5BvA/sbeUdmYH8D+D7/qCUwjwP0bREp1ACfA/fyfdxC0K8D+/vFr6GgvwP6BbjD0IDPA/zM5yjvUM8D/14A7t4g3wP9pcYVnQDvA/Rw1r070P8D8RvSxbqxDwPxw3p/CYEfA/VUbbk4YS8D+1tclEdBPwP0JQcwNiFPA/DuHYz08V8D81M/upPRbwP+AR25ErF/A/REh5hxkY8D+fodaKBxnwPz/p85v1GfA/eurRuuMa8D+0cHHn0RvwP11H0yHAHPA/7jn4aa4d8D/vE+G/nB7wP/KgjiOLH/A/lKwBlXkg8D+BAjsUaCHwP21uO6FWIvA/GrwDPEUj8D9Vt5TkMyTwP/cr75oiJfA/5OUTXxEm8D8OsQMxACfwP3BZvxDvJ/A/E6tH/t0o8D8Kcp35zCnwP3V6wQK8KvA/gJC0Gasr8D9hgHc+mizwP1wWC3GJLfA/vx5wsXgu8D/mZaf/Zy/wPza4sVtXMPA/IuKPxUYx8D8nsEI9NjLwP9HuysIlM/A/tGopVhU08D9x8F73BDXwP7dMbKb0NfA/P0xSY+Q28D/MuxEu1DfwPzFoqwbEOPA/SR4g7bM58D/+qnDhozrwP0PbneOTO/A/GHyo84M88D+KWpERdD3wP7FDWT1kPvA/sAQBd1Q/8D+2aom+REDwPwBD8xM1QfA/1Fo/dyVC8D+Ff27oFUPwP3J+gWcGRPA/ByV59PZE8D+5QFaP50XwPwyfGTjYRvA/jQ3E7shH8D/YWVazuUjwP5JR0YWqSfA/bcI1ZptK8D8oeoRUjEvwP4xGvlB9TPA/bvXjWm5N8D+xVPZyX07wP0Iy9phQT/A/GlzkzEFQ8D8/oMEOM1HwP8LMjl4kUvA/wK9MvBVT8D9iF/wnB1TwP9zRnaH4VPA/cK0yKepV8D9reLu+21bwPyUBOWLNV/A/AhasE79Y8D90hRXTsFnwP/cddqCiWvA/Eq7Oe5Rb8D9bBCBlhlzwP3Hvalx4XfA/AT6wYWpe8D/CvvB0XF/wP3pALZZOYPA/95FmxUBh8D8Wgp0CM2LwP7/f0k0lY/A/5XkHpxdk8D+JHzwOCmXwP7WfcYP8ZfA/gsmoBu9m8D8UbOKX4WfwP5pWHzfUaPA/T1hg5MZp8D98QKafuWrwP3Pe8Wisa/A/lQFEQJ9s8D9NeZ0lkm3wPxIV/xiFbvA/aKRpGnhv8D/e9t0pa3DwPxDcXEdecfA/pSPnclFy8D9RnX2sRHPwP9MYIfQ3dPA/9mXSSSt18D+TVJKtHnbwP4y0YR8Sd/A/0VVBnwV48D9dCDIt+XjwPzmcNMnsefA/duFJc+B68D82qHIr1HvwP6PAr/HHfPA/9voBxrt98D9xJ2qor37wP2UW6Zijf/A/LJh/l5eA8D8wfS6ki4HwP+KV9r5/gvA/xbLY53OD8D9ipNUeaITwP1I77mNchfA/Okgjt1CG8D/Im3UYRYfwP7kG5oc5iPA/1ll1BS6J8D/yZSSRIorwP+378yoXi/A/tOzk0guM8D8/CfiIAI3wP5MiLk31jfA/wAmIH+qO8D/ijwYA34/wPyOGqu7TkPA/uL1068iR8D/gB2b2vZLwP+k1fw+zk/A/LBnBNqiU8D8NgyxsnZXwPwBFwq+SlvA/fzCDAYiX8D8WF3BhfZjwP1nKic9ymfA/6hvRS2ia8D933UbWXZvwP7ng625TnPA/d/fAFUmd8D+D88bKPp7wP7um/o00n/A/CeNoXyqg8D9jegY/IKHwP80+2CwWovA/VQLfKAyj8D8VlxszAqTwPzXPjkv4pPA/6Xw5cu6l8D9uchyn5KbwPxGCOOrap/A/KH6OO9Go8D8ZOR+bx6nwP1OF6wi+qvA/UTX0hLSr8D+cGzoPq6zwP8gKvqehrfA/dtWATpiu8D9SToMDj6/wPxZIxsaFsPA/hpVKmHyx8D90CRF4c7LwP7x2GmZqs/A/SbBnYmG08D8PiflsWLXwPxLU0IVPtvA/X2TurEa38D8RDVPiPbjwP06h/yU1ufA/SPT0dyy68D8/2TPYI7vwP30jvUYbvPA/W6aRwxK98D87NbJOCr7wP46jH+gBv/A/zsTaj/m/8D+FbORF8cDwP0duPQrpwfA/tJ3m3ODC8D96zuC92MPwP1DULK3QxPA//YLLqsjF8D9Trr22wMbwPy4qBNG4x/A/ecqf+bDI8D8qY5EwqcnwP0PI2XWhyvA/1M15yZnL8D/3R3IrkszwP9QKxJuKzfA/nupvGoPO8D+Uu3ane8/wPwNS2UJ00PA/RIKY7GzR8D+6ILWkZdLwP9YBMGte0/A/FvoJQFfU8D8C3kMjUNXwPzKC3hRJ1vA/RbvaFELX8D/sXTkjO9jwP98++z802fA/5jIhay3a8D/VDqykJtvwP4mnnOwf3PA/8NHzQhnd8D8AY7KnEt7wP78v2RoM3/A/PQ1pnAXg8D+W0GIs/+DwP/VOx8r44fA/jV2Xd/Li8D+i0dMy7OPwP4GAffzl5PA/hT+V1N/l8D8V5Bu72ebwP6NDErDT5/A/sDN5s83o8D/GiVHFx+nwP38bnOXB6vA/fr5ZFLzr8D90SItRtuzwPx+PMZ2w7fA/SGhN96ru8D/Fqd9fpe/wP3cp6daf8PA/T71qXJrx8D9FO2XwlPLwPwAAAAAAAPA/Y3nZko/z8D/A1sfDmvXxPxW3MQr+BvM/i3KN+aIo9D9e7PAIgVv1P807f2aeoPY/sM9o1xD59z88bj2l/mX5P63TWpmf6Po/KcFOBz6C/D9DExDnNzT+PwAAAAAAAABAY3nZko/zAEDA1sfDmvUBQBW3MQr+BgNAi3KN+aIoBEBe7PAIgVsFQM07f2aeoAZAsM9o1xD5B0A9bj2l/mUJQK3TWpmf6ApAKcFOBz6CDEBEExDnNzQOQAAAAAAAABBAY3nZko/zEEC/1sfDmvURQBW3MQr+BhNAi3KN+aIoFEBd7PAIgVsVQM07f2aeoBZAsc9o1xD5F0A8bj2l/mUZQK3TWpmf6BpAKsFOBz6CHEBDExDnNzQeQAAAAAAAACBAY3nZko/zIEC/1sfDmvUhQBW3MQr+BiNAi3KN+aIoJEBd7PAIgVslQM07f2aeoCZAsc9o1xD5J0A8bj2l/mUpQK3TWpmf6CpAKsFOBz6CLEBDExDnNzQuQAAAAAAAADBAYnnZko/zMEDB1sfDmvUxQBW3MQr+BjNAinKN+aIoNEBf7PAIgVs1QM07f2aeoDZAr89o1xD5N0A+bj2l/mU5QK3TWpmf6DpAKMFOBz6CPEBFExDnNzQ+QAAAAAAAAEBAYnnZko/zQEDB1sfDmvVBQBW3MQr+BkNAinKN+aIoREBf7PAIgVtFQM07f2aeoEZAr89o1xD5R0A+bj2l/mVJQK3TWpmf6EpAKMFOBz6CTEBFExDnNzROQAAAAAAAAFBAYnnZko/zUEDB1sfDmvVRQBW3MQr+BlNAinKN+aIoVEBf7PAIgVtVQM07f2aeoFZAr89o1xD5V0A+bj2l/mVZQK3TWpmf6FpAKMFOBz6CXEBFExDnNzReQAAAAAAAAGBAYnnZko/zYEDB1sfDmvVhQBW3MQr+BmNAinKN+aIoZEBf7PAIgVtlQM07f2aeoGZAr89o1xD5Z0A+bj2l/mVpQK3TWpmf6GpAKMFOBz6CbEBFExDnNzRuQAAAAAAAAHBAZXnZko/zcEC+1sfDmvVxQBW3MQr+BnNAjXKN+aIodEBc7PAIgVt1QM07f2aeoHZAs89o1xD5d0A6bj2l/mV5QK3TWpmf6HpALcFOBz6CfEBAExDnNzR+QAAAAAAAAIBAZXnZko/zgEC+1sfDmvWBQBW3MQr+BoNAjXKN+aIohEBc7PAIgVuFQM07f2aeoIZAs89o1xD5h0A6bj2l/mWJQK3TWpmf6IpALcFOBz6CjEBAExDnNzSOQAAAAAAAAJBAZXnZko/zkEC+1sfDmvWRQBW3MQr+BpNAjXKN+aIolEBc7PAIgVuVQM07f2aeoJZAs89o1xD5l0ADAAAABAAAAAQAAAAGAAAAg/miAERObgD8KRUA0VcnAN009QBi28AAPJmVAEGQQwBjUf4Au96rALdhxQA6biQA0k1CAEkG4AAJ6i4AHJLRAOsd/gApsRwA6D6nAPU1ggBEuy4AnOmEALQmcABBfl8A1pE5AFODOQCc9DkAi1+EACj5vQD4HzsA3v+XAA+YBQARL+8AClqLAG0fbQDPfjYACcsnAEZPtwCeZj8ALepfALondQDl68cAPXvxAPc5BwCSUooA+2vqAB+xXwAIXY0AMANWAHv8RgDwq2sAILzPADb0mgDjqR0AXmGRAAgb5gCFmWUAoBRfAI1AaACA2P8AJ3NNAAYGMQDKVhUAyahzAHviYABrjMAAGcRHAM1nwwAJ6NwAWYMqAIt2xACmHJYARK/dABlX0QClPgUABQf/ADN+PwDCMugAmE/eALt9MgAmPcMAHmvvAJ/4XgA1HzoAf/LKAPGHHQB8kCEAaiR8ANVu+gAwLXcAFTtDALUUxgDDGZ0ArcTCACxNQQAMAF0Ahn1GAONxLQCbxpoAM2IAALTSfAC0p5cAN1XVANc+9gCjEBgATXb8AGSdKgBw16sAY3z4AHqwVwAXFecAwElWADvW2QCnhDgAJCPLANaKdwBaVCMAAB+5APEKGwAZzt8AnzH/AGYeagCZV2EArPtHAH5/2AAiZbcAMuiJAOa/YADvxM0AbDYJAF0/1AAW3tcAWDveAN6bkgDSIigAKIboAOJYTQDGyjIACOMWAOB9ywAXwFAA8x2nABjgWwAuEzQAgxJiAINIAQD1jlsArbB/AB7p8gBISkMAEGfTAKrd2ACuX0IAamHOAAoopADTmbQABqbyAFx3fwCjwoMAYTyIAIpzeACvjFoAb9e9AC2mYwD0v8sAjYHvACbBZwBVykUAytk2ACio0gDCYY0AEsl3AAQmFAASRpsAxFnEAMjFRABNspEAABfzANRDrQApSeUA/dUQAAC+/AAelMwAcM7uABM+9QDs8YAAs+fDAMf4KACTBZQAwXE+AC4JswALRfMAiBKcAKsgewAutZ8AR5LCAHsyLwAMVW0AcqeQAGvnHwAxy5YAeRZKAEF54gD034kA6JSXAOLmhACZMZcAiO1rAF9fNgC7/Q4ASJq0AGekbABxckIAjV0yAJ8VuAC85QkAjTElAPd0OQAwBRwADQwBAEsIaAAs7lgAR6qQAHTnAgC91iQA932mAG5IcgCfFu8AjpSmALSR9gDRU1EAzwryACCYMwD1S34AsmNoAN0+XwBAXQMAhYl/AFVSKQA3ZMAAbdgQADJIMgBbTHUATnHUAEVUbgALCcEAKvVpABRm1QAnB50AXQRQALQ72wDqdsUAh/kXAElrfQAdJ7oAlmkpAMbMrACtFFQAkOJqAIjZiQAsclAABKS+AHcHlADzMHAAAPwnAOpxqABmwkkAZOA9AJfdgwCjP5cAQ5T9AA2GjAAxQd4AkjmdAN1wjAAXt+cACN87ABU3KwBcgKAAWoCTABARkgAP6NgAbICvANv/SwA4kA8AWRh2AGKlFQBhy7sAx4m5ABBAvQDS8gQASXUnAOu29gDbIrsAChSqAIkmLwBkg3YACTszAA6UGgBROqoAHaPCAK/trgBcJhIAbcJNAC16nADAVpcAAz+DAAnw9gArQIwAbTGZADm0BwAMIBUA2MNbAPWSxADGrUsATsqlAKc3zQDmqTYAq5KUAN1CaAAZY94AdozvAGiLUgD82zcArqGrAN8VMQAArqEADPvaAGRNZgDtBbcAKWUwAFdWvwBH/zoAavm5AHW+8wAok98Aq4AwAGaM9gAEyxUA+iIGANnkHQA9s6QAVxuPADbNCQBOQukAE76kADMjtQDwqhoAT2WoANLBpQALPw8AW3jNACP5dgB7iwQAiRdyAMamUwBvbuIA7+sAAJtKWADE2rcAqma6AHbPzwDRAh0AsfEtAIyZwQDDrXcAhkjaAPddoADGgPQArPAvAN3smgA/XLwA0N5tAJDHHwAq27YAoyU6AACvmgCtU5MAtlcEACkttABLgH4A2genAHaqDgB7WaEAFhIqANy3LQD65f0Aidv+AIm+/QDkdmwABqn8AD6AcACFbhUA/Yf/ACg+BwBhZzMAKhiGAE296gCz568Aj21uAJVnOQAxv1sAhNdIADDfFgDHLUMAJWE1AMlwzgAwy7gAv2z9AKQAogAFbOQAWt2gACFvRwBiEtIAuVyEAHBhSQBrVuAAmVIBAFBVNwAe1bcAM/HEABNuXwBdMOQAhS6pAB2ywwChMjYACLekAOqx1AAW9yEAj2nkACf/dwAMA4AAjUAtAE/NoAAgpZkAs6LTAC9dCgC0+UIAEdrLAH2+0ACb28EAqxe9AMqigQAIalwALlUXACcAVQB/FPAA4QeGABQLZACWQY0Ah77eANr9KgBrJbYAe4k0AAXz/gC5v54AaGpPAEoqqABPxFoALfi8ANdamAD0x5UADU2NACA6pgCkV18AFD+xAIA4lQDMIAEAcd2GAMnetgC/YPUATWURAAEHawCMsKwAssDQAFFVSAAe+w4AlXLDAKMGOwDAQDUABtx7AOBFzABOKfoA1srIAOjzQQB8ZN4Am2TYANm+MQCkl8MAd1jUAGnjxQDw2hMAujo8AEYYRgBVdV8A0r31AG6SxgCsLl0ADkTtABw+QgBhxIcAKf3pAOfW8wAifMoAb5E1AAjgxQD/140AbmriALD9xgCTCMEAfF10AGutsgDNbp0APnJ7AMYRagD3z6kAKXPfALXJugC3AFEA4rINAHS6JADlfWAAdNiKAA0VLACBGAwAfmaUAAEpFgCfenYA/f2+AFZF7wDZfjYA7NkTAIu6uQDEl/wAMagnAPFuwwCUxTYA2KhWALSotQDPzA4AEoktAG9XNAAsVokAmc7jANYguQBrXqoAPiqcABFfzAD9C0oA4fT7AI47bQDihiwA6dSEAPy0qQDv7tEALjXJAC85YQA4IUQAG9nIAIH8CgD7SmoALxzYAFO0hABOmYwAVCLMACpV3ADAxtYACxmWABpwuABplWQAJlpgAD9S7gB/EQ8A9LURAPzL9QA0vC0ANLzuAOhdzADdXmAAZ46bAJIz7wDJF7gAYVibAOFXvABRg8YA2D4QAN1xSAAtHN0ArxihACEsRgBZ89cA2XqYAJ5UwABPhvoAVgb8AOV5rgCJIjYAOK0iAGeT3ABV6KoAgiY4AMrnmwBRDaQAmTOxAKnXDgBpBUgAZbLwAH+IpwCITJcA+dE2ACGSswB7gkoAmM8hAECf3ADcR1UA4XQ6AGfrQgD+nd8AXtRfAHtnpAC6rHoAVfaiACuIIwBBulUAWW4IACEqhgA5R4MAiePmAOWe1ABJ+0AA/1bpABwPygDFWYoAlPorANPBxQAPxc8A21quAEfFhgCFQ2IAIYY7ACx5lAAQYYcAKkx7AIAsGgBDvxIAiCaQAHg8iQCoxOQA5dt7AMQ6wgAm9OoA92eKAA2SvwBloysAPZOxAL18CwCkUdwAJ91jAGnh3QCalBkAqCmVAGjOKAAJ7bQARJ8gAE6YygBwgmMAfnwjAA+5MgCn9Y4AFFbnACHxCAC1nSoAb35NAKUZUQC1+asAgt/WAJbdYQAWNgIAxDqfAIOioQBy7W0AOY16AIK4qQBrMlwARidbAAA07QDSAHcA/PRVAAFZTQDgcYAAAAAAAAAAAAAAAABA+yH5PwAAAAAtRHQ+AAAAgJhG+DwAAABgUcx4OwAAAICDG/A5AAAAQCAlejgAAACAIoLjNgAAAAAd82k1AACgAk4A6wGnBX4FIAF1BhgDhgT6ALkDLAP9BbcBigF6A7wEHgD6BqIAPQNJA9cBAAQIAJMGCAGPAgYCKgZfArcC+gJYA9kEKwfKAr0F4QXNBdwCEAZAAngAfQJnA2EE7ADlAwoF1ADMAz4GTwJ2AZgDrwQAAEQAEAKuAK4DYAD6AXcEIQXrBCsAYAFBAZIAqQajAW4CTgEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAATBAAAAAAAAAAAKgIAAAAAAAAAAAAAAAAAAAAAAAAAACcEOQRIBAAAAAAAAAAAAAAAAAAAAACSBAAAAAAAAAAAAAAAAAAAAAAAADgFUgVgBVMGAADKAbsGAADSBgAA6QYJBxkHPgdZB2kHfgdTdWNjZXNzAElsbGVnYWwgYnl0ZSBzZXF1ZW5jZQBEb21haW4gZXJyb3IAUmVzdWx0IG5vdCByZXByZXNlbnRhYmxlAE5vdCBhIHR0eQBQZXJtaXNzaW9uIGRlbmllZABPcGVyYXRpb24gbm90IHBlcm1pdHRlZABObyBzdWNoIGZpbGUgb3IgZGlyZWN0b3J5AE5vIHN1Y2ggcHJvY2VzcwBGaWxlIGV4aXN0cwBWYWx1ZSB0b28gbGFyZ2UgZm9yIGRlZmluZWQgZGF0YSB0eXBlAE5vIHNwYWNlIGxlZnQgb24gZGV2aWNlAE91dCBvZiBtZW1vcnkAUmVzb3VyY2UgYnVzeQBJbnRlcnJ1cHRlZCBzeXN0ZW0gY2FsbABSZXNvdXJjZSB0ZW1wb3JhcmlseSB1bmF2YWlsYWJsZQBJbnZhbGlkIHNlZWsAQ3Jvc3MtZGV2aWNlIGxpbmsAUmVhZC1vbmx5IGZpbGUgc3lzdGVtAERpcmVjdG9yeSBub3QgZW1wdHkAQ29ubmVjdGlvbiByZXNldCBieSBwZWVyAE9wZXJhdGlvbiB0aW1lZCBvdXQAQ29ubmVjdGlvbiByZWZ1c2VkAEhvc3QgaXMgZG93bgBIb3N0IGlzIHVucmVhY2hhYmxlAEFkZHJlc3MgaW4gdXNlAEJyb2tlbiBwaXBlAEkvTyBlcnJvcgBObyBzdWNoIGRldmljZSBvciBhZGRyZXNzAEJsb2NrIGRldmljZSByZXF1aXJlZABObyBzdWNoIGRldmljZQBOb3QgYSBkaXJlY3RvcnkASXMgYSBkaXJlY3RvcnkAVGV4dCBmaWxlIGJ1c3kARXhlYyBmb3JtYXQgZXJyb3IASW52YWxpZCBhcmd1bWVudABBcmd1bWVudCBsaXN0IHRvbyBsb25nAFN5bWJvbGljIGxpbmsgbG9vcABGaWxlbmFtZSB0b28gbG9uZwBUb28gbWFueSBvcGVuIGZpbGVzIGluIHN5c3RlbQBObyBmaWxlIGRlc2NyaXB0b3JzIGF2YWlsYWJsZQBCYWQgZmlsZSBkZXNjcmlwdG9yAE5vIGNoaWxkIHByb2Nlc3MAQmFkIGFkZHJlc3MARmlsZSB0b28gbGFyZ2UAVG9vIG1hbnkgbGlua3MATm8gbG9ja3MgYXZhaWxhYmxlAFJlc291cmNlIGRlYWRsb2NrIHdvdWxkIG9jY3VyAFN0YXRlIG5vdCByZWNvdmVyYWJsZQBPd25lciBkaWVkAE9wZXJhdGlvbiBjYW5jZWxlZABGdW5jdGlvbiBub3QgaW1wbGVtZW50ZWQATm8gbWVzc2FnZSBvZiBkZXNpcmVkIHR5cGUASWRlbnRpZmllciByZW1vdmVkAERldmljZSBub3QgYSBzdHJlYW0ATm8gZGF0YSBhdmFpbGFibGUARGV2aWNlIHRpbWVvdXQAT3V0IG9mIHN0cmVhbXMgcmVzb3VyY2VzAExpbmsgaGFzIGJlZW4gc2V2ZXJlZABQcm90b2NvbCBlcnJvcgBCYWQgbWVzc2FnZQBGaWxlIGRlc2NyaXB0b3IgaW4gYmFkIHN0YXRlAE5vdCBhIHNvY2tldABEZXN0aW5hdGlvbiBhZGRyZXNzIHJlcXVpcmVkAE1lc3NhZ2UgdG9vIGxhcmdlAFByb3RvY29sIHdyb25nIHR5cGUgZm9yIHNvY2tldABQcm90b2NvbCBub3QgYXZhaWxhYmxlAFByb3RvY29sIG5vdCBzdXBwb3J0ZWQAU29ja2V0IHR5cGUgbm90IHN1cHBvcnRlZABOb3Qgc3VwcG9ydGVkAFByb3RvY29sIGZhbWlseSBub3Qgc3VwcG9ydGVkAEFkZHJlc3MgZmFtaWx5IG5vdCBzdXBwb3J0ZWQgYnkgcHJvdG9jb2wAQWRkcmVzcyBub3QgYXZhaWxhYmxlAE5ldHdvcmsgaXMgZG93bgBOZXR3b3JrIHVucmVhY2hhYmxlAENvbm5lY3Rpb24gcmVzZXQgYnkgbmV0d29yawBDb25uZWN0aW9uIGFib3J0ZWQATm8gYnVmZmVyIHNwYWNlIGF2YWlsYWJsZQBTb2NrZXQgaXMgY29ubmVjdGVkAFNvY2tldCBub3QgY29ubmVjdGVkAENhbm5vdCBzZW5kIGFmdGVyIHNvY2tldCBzaHV0ZG93bgBPcGVyYXRpb24gYWxyZWFkeSBpbiBwcm9ncmVzcwBPcGVyYXRpb24gaW4gcHJvZ3Jlc3MAU3RhbGUgZmlsZSBoYW5kbGUARGF0YSBjb25zaXN0ZW5jeSBlcnJvcgBSZXNvdXJjZSBub3QgYXZhaWxhYmxlAFJlbW90ZSBJL08gZXJyb3IAUXVvdGEgZXhjZWVkZWQATm8gbWVkaXVtIGZvdW5kAFdyb25nIG1lZGl1bSB0eXBlAE11bHRpaG9wIGF0dGVtcHRlZABSZXF1aXJlZCBrZXkgbm90IGF2YWlsYWJsZQBLZXkgaGFzIGV4cGlyZWQAS2V5IGhhcyBiZWVuIHJldm9rZWQAS2V5IHdhcyByZWplY3RlZCBieSBzZXJ2aWNlAA==");
  base64DecodeToExistingUint8Array(bufferView, 75568, "UAABAAAAAAAFAAAAAAAAAAAAAAAOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAACwAAAGAtAQAAAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAAA//////////8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4JwEAUC8BAA==");
}

  var scratchBuffer = new ArrayBuffer(16);
  var i32ScratchView = new Int32Array(scratchBuffer);
  var f32ScratchView = new Float32Array(scratchBuffer);
  var f64ScratchView = new Float64Array(scratchBuffer);
  
  function wasm2js_scratch_load_i32(index) {
    return i32ScratchView[index];
  }
      
  function wasm2js_scratch_store_i32(index, value) {
    i32ScratchView[index] = value;
  }
      
  function wasm2js_scratch_load_f64() {
    return f64ScratchView[0];
  }
      
  function wasm2js_scratch_store_f64(value) {
    f64ScratchView[0] = value;
  }
      
  function wasm2js_memory_copy(dest, source, size) {
    // TODO: traps on invalid things
    bufferView.copyWithin(dest, source, source + size);
  }
      
  function wasm2js_memory_fill(dest, value, size) {
    dest = dest >>> 0;
    size = size >>> 0;
    if (dest + size > bufferView.length) throw "trap: invalid memory.fill";
    bufferView.fill(value, dest, dest + size);
  }
      function wasm2js_trap() { throw new Error('abort'); }

  function wasm2js_scratch_load_f32() {
    return f32ScratchView[2];
  }
      
function asmFunc(imports) {
 var buffer = new ArrayBuffer(16908288);
 var HEAP8 = new Int8Array(buffer);
 var HEAP16 = new Int16Array(buffer);
 var HEAP32 = new Int32Array(buffer);
 var HEAPU8 = new Uint8Array(buffer);
 var HEAPU16 = new Uint16Array(buffer);
 var HEAPU32 = new Uint32Array(buffer);
 var HEAPF32 = new Float32Array(buffer);
 var HEAPF64 = new Float64Array(buffer);
 var Math_imul = Math.imul;
 var Math_fround = Math.fround;
 var Math_abs = Math.abs;
 var Math_clz32 = Math.clz32;
 var Math_min = Math.min;
 var Math_max = Math.max;
 var Math_floor = Math.floor;
 var Math_ceil = Math.ceil;
 var Math_trunc = Math.trunc;
 var Math_sqrt = Math.sqrt;
 var env = imports.env;
 var fimport$0 = env.__syscall_openat;
 var fimport$1 = env.__syscall_fcntl64;
 var fimport$2 = env.__syscall_ioctl;
 var wasi_snapshot_preview1 = imports.wasi_snapshot_preview1;
 var fimport$3 = wasi_snapshot_preview1.fd_write;
 var fimport$4 = wasi_snapshot_preview1.fd_read;
 var fimport$5 = wasi_snapshot_preview1.fd_close;
 var fimport$6 = env._abort_js;
 var fimport$7 = env.emscripten_resize_heap;
 var fimport$8 = wasi_snapshot_preview1.fd_seek;
 var global$0 = 65536;
 var global$1 = 0;
 var global$2 = 0;
 var global$3 = 0;
 var __wasm_intrinsics_temp_i64 = 0;
 var __wasm_intrinsics_temp_i64$hi = 0;
 var i64toi32_i32$HIGH_BITS = 0;
 // EMSCRIPTEN_START_FUNCS
;
 function $0() {
  $197();
 }
 
 function $1($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, $4_1 = 0, $7_1 = 0, $8_1 = 0, $12_1 = 0, $5_1 = 0, $6_1 = 0, $13_1 = 0, $142_1 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $1_1 = global$0 - 1056 | 0;
  global$0 = $1_1;
  HEAP32[($1_1 + 1048 | 0) >> 2] = $0_1;
  block2 : {
   block1 : {
    block : {
     if (!((HEAP32[($1_1 + 1048 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
      break block
     }
     if ((HEAPU8[(HEAP32[($1_1 + 1048 | 0) >> 2] | 0) >> 0] | 0 | 0) != (0 & 255 | 0 | 0) & 1 | 0) {
      break block1
     }
    }
    HEAP32[($1_1 + 1052 | 0) >> 2] = 0;
    break block2;
   }
   $4_1 = $143(HEAP32[($1_1 + 1048 | 0) >> 2] | 0 | 0, 65773 | 0) | 0;
   HEAP32[($1_1 + 1044 | 0) >> 2] = $4_1;
   block3 : {
    if (!(($4_1 | 0) != (0 | 0) & 1 | 0)) {
     break block3
    }
    HEAP32[($1_1 + 1052 | 0) >> 2] = HEAP32[($1_1 + 1044 | 0) >> 2] | 0;
    break block2;
   }
   block4 : {
    if ((HEAP8[(HEAP32[($1_1 + 1048 | 0) >> 2] | 0) >> 0] | 0 | 0) == (47 | 0) & 1 | 0) {
     break block4
    }
    HEAP32[($1_1 + 12 | 0) >> 2] = HEAP32[(0 + 75728 | 0) >> 2] | 0;
    block5 : {
     label : while (1) {
      if (!((HEAP32[($1_1 + 12 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
       break block5
      }
      HEAP8[($1_1 + 16 | 0) >> 0] = 0;
      HEAP32[($1_1 + 8 | 0) >> 2] = $1_1 + 16 | 0;
      (wasm2js_i32$0 = $1_1, wasm2js_i32$1 = $171(HEAP32[(HEAP32[($1_1 + 12 | 0) >> 2] | 0) >> 2] | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 4 | 0) >> 2] = wasm2js_i32$1;
      block6 : {
       if (!((HEAP32[($1_1 + 4 | 0) >> 2] | 0) >>> 0 >= 1021 >>> 0 & 1 | 0)) {
        break block6
       }
       HEAP32[($1_1 + 4 | 0) >> 2] = 0;
      }
      block7 : {
       if (!(HEAP32[($1_1 + 4 | 0) >> 2] | 0)) {
        break block7
       }
       $5_1 = $1_1 + 16 | 0;
       $6_1 = HEAP32[(HEAP32[($1_1 + 12 | 0) >> 2] | 0) >> 2] | 0;
       $7_1 = HEAP32[($1_1 + 4 | 0) >> 2] | 0;
       block8 : {
        if (!$7_1) {
         break block8
        }
        wasm2js_memory_copy($5_1, $6_1, $7_1);
       }
       HEAP32[($1_1 + 8 | 0) >> 2] = (HEAP32[($1_1 + 4 | 0) >> 2] | 0) + (HEAP32[($1_1 + 8 | 0) >> 2] | 0) | 0;
       block9 : {
        if ((HEAP8[((HEAP32[($1_1 + 8 | 0) >> 2] | 0) + -1 | 0) >> 0] | 0 | 0) == (47 | 0) & 1 | 0) {
         break block9
        }
        $8_1 = HEAP32[($1_1 + 8 | 0) >> 2] | 0;
        HEAP32[($1_1 + 8 | 0) >> 2] = $8_1 + 1 | 0;
        HEAP8[$8_1 >> 0] = 47;
        HEAP32[($1_1 + 4 | 0) >> 2] = (HEAP32[($1_1 + 4 | 0) >> 2] | 0) + 1 | 0;
       }
      }
      $2(HEAP32[($1_1 + 8 | 0) >> 2] | 0 | 0, HEAP32[($1_1 + 1048 | 0) >> 2] | 0 | 0, 1024 - (HEAP32[($1_1 + 4 | 0) >> 2] | 0) | 0 | 0) | 0;
      $12_1 = $143($1_1 + 16 | 0 | 0, 65773 | 0) | 0;
      HEAP32[($1_1 + 1044 | 0) >> 2] = $12_1;
      block10 : {
       if (!(($12_1 | 0) != (0 | 0) & 1 | 0)) {
        break block10
       }
       HEAP32[($1_1 + 1052 | 0) >> 2] = HEAP32[($1_1 + 1044 | 0) >> 2] | 0;
       break block2;
      }
      HEAP32[($1_1 + 12 | 0) >> 2] = HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
      continue label;
     };
    }
   }
   HEAP32[($1_1 + 1052 | 0) >> 2] = 0;
  }
  $13_1 = HEAP32[($1_1 + 1052 | 0) >> 2] | 0;
  global$0 = $1_1 + 1056 | 0;
  return $13_1 | 0;
 }
 
 function $2($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, $7_1 = 0, $9_1 = 0, $77_1 = 0;
  $3_1 = global$0 - 32 | 0;
  HEAP32[($3_1 + 24 | 0) >> 2] = $0_1;
  HEAP32[($3_1 + 20 | 0) >> 2] = $1_1;
  HEAP32[($3_1 + 16 | 0) >> 2] = $2_1;
  block3 : {
   block : {
    if (!(HEAP32[($3_1 + 16 | 0) >> 2] | 0)) {
     break block
    }
    HEAP32[($3_1 + 12 | 0) >> 2] = 0;
    HEAP32[($3_1 + 16 | 0) >> 2] = (HEAP32[($3_1 + 16 | 0) >> 2] | 0) + -1 | 0;
    label : while (1) {
     $7_1 = 0;
     block1 : {
      if (!((HEAP32[($3_1 + 12 | 0) >> 2] | 0) >>> 0 < (HEAP32[($3_1 + 16 | 0) >> 2] | 0) >>> 0 & 1 | 0)) {
       break block1
      }
      $7_1 = (HEAP8[((HEAP32[($3_1 + 20 | 0) >> 2] | 0) + (HEAP32[($3_1 + 12 | 0) >> 2] | 0) | 0) >> 0] | 0 | 0) != (0 | 0);
     }
     block2 : {
      if (!($7_1 & 1 | 0)) {
       break block2
      }
      HEAP8[((HEAP32[($3_1 + 24 | 0) >> 2] | 0) + (HEAP32[($3_1 + 12 | 0) >> 2] | 0) | 0) >> 0] = HEAPU8[((HEAP32[($3_1 + 20 | 0) >> 2] | 0) + (HEAP32[($3_1 + 12 | 0) >> 2] | 0) | 0) >> 0] | 0;
      HEAP32[($3_1 + 12 | 0) >> 2] = (HEAP32[($3_1 + 12 | 0) >> 2] | 0) + 1 | 0;
      continue label;
     }
     break label;
    };
    HEAP8[((HEAP32[($3_1 + 24 | 0) >> 2] | 0) + (HEAP32[($3_1 + 12 | 0) >> 2] | 0) | 0) >> 0] = 0;
    $9_1 = (HEAP32[($3_1 + 12 | 0) >> 2] | 0) + 1 | 0;
    HEAP32[($3_1 + 12 | 0) >> 2] = $9_1;
    HEAP32[($3_1 + 28 | 0) >> 2] = $9_1;
    break block3;
   }
   HEAP32[($3_1 + 28 | 0) >> 2] = 0;
  }
  return HEAP32[($3_1 + 28 | 0) >> 2] | 0 | 0;
 }
 
 function $3($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0, $8_1 = 0, $3_1 = 0, $6_1 = 0, $7_1 = 0, $9_1 = 0, $70_1 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $2_1 = global$0 - 16 | 0;
  global$0 = $2_1;
  HEAP32[($2_1 + 8 | 0) >> 2] = $0_1;
  HEAP32[($2_1 + 4 | 0) >> 2] = $1_1;
  (wasm2js_i32$0 = $2_1, wasm2js_i32$1 = $182(8 | 0) | 0), HEAP32[wasm2js_i32$0 >> 2] = wasm2js_i32$1;
  block1 : {
   block : {
    if ((HEAP32[$2_1 >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
     break block
    }
    HEAP32[($2_1 + 12 | 0) >> 2] = -2;
    break block1;
   }
   $3_1 = $182((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 1 | 0 | 0) | 0;
   HEAP32[(HEAP32[$2_1 >> 2] | 0) >> 2] = $3_1;
   block2 : {
    if ((HEAP32[(HEAP32[$2_1 >> 2] | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
     break block2
    }
    $184(HEAP32[$2_1 >> 2] | 0 | 0);
    HEAP32[($2_1 + 12 | 0) >> 2] = -2;
    break block1;
   }
   HEAP32[((HEAP32[$2_1 >> 2] | 0) + 4 | 0) >> 2] = HEAP32[(0 + 75728 | 0) >> 2] | 0;
   HEAP32[(0 + 75728 | 0) >> 2] = HEAP32[$2_1 >> 2] | 0;
   $6_1 = HEAP32[(HEAP32[$2_1 >> 2] | 0) >> 2] | 0;
   $7_1 = HEAP32[($2_1 + 8 | 0) >> 2] | 0;
   $8_1 = HEAP32[($2_1 + 4 | 0) >> 2] | 0;
   block3 : {
    if (!$8_1) {
     break block3
    }
    wasm2js_memory_copy($6_1, $7_1, $8_1);
   }
   HEAP8[((HEAP32[(HEAP32[$2_1 >> 2] | 0) >> 2] | 0) + (HEAP32[($2_1 + 4 | 0) >> 2] | 0) | 0) >> 0] = 0;
   HEAP32[($2_1 + 12 | 0) >> 2] = 0;
  }
  $9_1 = HEAP32[($2_1 + 12 | 0) >> 2] | 0;
  global$0 = $2_1 + 16 | 0;
  return $9_1 | 0;
 }
 
 function $4() {
  var $0_1 = 0;
  $0_1 = global$0 - 16 | 0;
  global$0 = $0_1;
  HEAP32[($0_1 + 12 | 0) >> 2] = HEAP32[(0 + 75728 | 0) >> 2] | 0;
  block : {
   label : while (1) {
    if (!((HEAP32[($0_1 + 12 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
     break block
    }
    HEAP32[($0_1 + 8 | 0) >> 2] = HEAP32[((HEAP32[($0_1 + 12 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
    $184(HEAP32[(HEAP32[($0_1 + 12 | 0) >> 2] | 0) >> 2] | 0 | 0);
    $184(HEAP32[($0_1 + 12 | 0) >> 2] | 0 | 0);
    HEAP32[($0_1 + 12 | 0) >> 2] = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
    continue label;
   };
  }
  HEAP32[(0 + 75728 | 0) >> 2] = 0;
  global$0 = $0_1 + 16 | 0;
  return;
 }
 
 function $5($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, $6_1 = 0, $16_1 = 0, $17_1 = 0, $18_1 = 0, $19_1 = 0, $15_1 = 0, $182_1 = 0;
  $3_1 = global$0 - 32 | 0;
  HEAP32[($3_1 + 24 | 0) >> 2] = $0_1;
  HEAP32[($3_1 + 20 | 0) >> 2] = $1_1;
  HEAP32[($3_1 + 16 | 0) >> 2] = $2_1;
  HEAP32[($3_1 + 12 | 0) >> 2] = HEAP32[($3_1 + 20 | 0) >> 2] | 0;
  block2 : {
   block1 : {
    block : {
     if (!((HEAP32[($3_1 + 20 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
      break block
     }
     if (!((HEAP32[($3_1 + 16 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
      break block
     }
     if ((HEAP32[($3_1 + 24 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
      break block1
     }
     if ((HEAP32[(HEAP32[($3_1 + 16 | 0) >> 2] | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
      break block1
     }
    }
    HEAP32[($3_1 + 28 | 0) >> 2] = 0;
    break block2;
   }
   block4 : {
    block3 : {
     if (!((HEAP32[($3_1 + 24 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
      break block3
     }
     HEAP32[(HEAP32[($3_1 + 16 | 0) >> 2] | 0) >> 2] = HEAP32[($3_1 + 24 | 0) >> 2] | 0;
     break block4;
    }
    block5 : {
     if (!((HEAP32[(HEAP32[($3_1 + 16 | 0) >> 2] | 0) >> 2] | 0 | 0) == (0 | 0) & 1 | 0)) {
      break block5
     }
     HEAP32[($3_1 + 28 | 0) >> 2] = 0;
     break block2;
    }
    HEAP32[($3_1 + 24 | 0) >> 2] = HEAP32[(HEAP32[($3_1 + 16 | 0) >> 2] | 0) >> 2] | 0;
   }
   label : while (1) {
    $6_1 = 0;
    block6 : {
     if (!(HEAP8[(HEAP32[($3_1 + 12 | 0) >> 2] | 0) >> 0] | 0)) {
      break block6
     }
     $6_1 = (HEAP8[(HEAP32[($3_1 + 24 | 0) >> 2] | 0) >> 0] | 0 | 0) != (0 | 0);
    }
    block7 : {
     if (!($6_1 & 1 | 0)) {
      break block7
     }
     block8 : {
      if (!((HEAP8[(HEAP32[($3_1 + 24 | 0) >> 2] | 0) >> 0] | 0 | 0) == (HEAP8[(HEAP32[($3_1 + 12 | 0) >> 2] | 0) >> 0] | 0 | 0) & 1 | 0)) {
       break block8
      }
      HEAP32[($3_1 + 24 | 0) >> 2] = (HEAP32[($3_1 + 24 | 0) >> 2] | 0) + 1 | 0;
      HEAP32[($3_1 + 12 | 0) >> 2] = HEAP32[($3_1 + 20 | 0) >> 2] | 0;
      continue label;
     }
     HEAP32[($3_1 + 12 | 0) >> 2] = (HEAP32[($3_1 + 12 | 0) >> 2] | 0) + 1 | 0;
     continue label;
    }
    break label;
   };
   block9 : {
    if ((HEAPU8[(HEAP32[($3_1 + 24 | 0) >> 2] | 0) >> 0] | 0 | 0) != (0 & 255 | 0 | 0) & 1 | 0) {
     break block9
    }
    HEAP32[(HEAP32[($3_1 + 16 | 0) >> 2] | 0) >> 2] = HEAP32[($3_1 + 24 | 0) >> 2] | 0;
    HEAP32[($3_1 + 28 | 0) >> 2] = 0;
    break block2;
   }
   HEAP32[(HEAP32[($3_1 + 16 | 0) >> 2] | 0) >> 2] = HEAP32[($3_1 + 24 | 0) >> 2] | 0;
   block10 : {
    label2 : while (1) {
     if (!((HEAPU8[(HEAP32[(HEAP32[($3_1 + 16 | 0) >> 2] | 0) >> 2] | 0) >> 0] | 0 | 0) != (0 & 255 | 0 | 0) & 1 | 0)) {
      break block10
     }
     HEAP32[($3_1 + 12 | 0) >> 2] = HEAP32[($3_1 + 20 | 0) >> 2] | 0;
     block11 : {
      label1 : while (1) {
       if (!((HEAPU8[(HEAP32[($3_1 + 12 | 0) >> 2] | 0) >> 0] | 0 | 0) != (0 & 255 | 0 | 0) & 1 | 0)) {
        break block11
       }
       $15_1 = HEAP8[(HEAP32[(HEAP32[($3_1 + 16 | 0) >> 2] | 0) >> 2] | 0) >> 0] | 0;
       $16_1 = HEAP32[($3_1 + 12 | 0) >> 2] | 0;
       HEAP32[($3_1 + 12 | 0) >> 2] = $16_1 + 1 | 0;
       block12 : {
        if (!(($15_1 | 0) == (HEAP8[$16_1 >> 0] | 0 | 0) & 1 | 0)) {
         break block12
        }
        $17_1 = HEAP32[($3_1 + 16 | 0) >> 2] | 0;
        $18_1 = HEAP32[$17_1 >> 2] | 0;
        HEAP32[$17_1 >> 2] = $18_1 + 1 | 0;
        HEAP8[$18_1 >> 0] = 0;
        HEAP32[($3_1 + 28 | 0) >> 2] = HEAP32[($3_1 + 24 | 0) >> 2] | 0;
        break block2;
       }
       continue label1;
      };
     }
     $19_1 = HEAP32[($3_1 + 16 | 0) >> 2] | 0;
     HEAP32[$19_1 >> 2] = (HEAP32[$19_1 >> 2] | 0) + 1 | 0;
     continue label2;
    };
   }
   HEAP32[($3_1 + 28 | 0) >> 2] = HEAP32[($3_1 + 24 | 0) >> 2] | 0;
  }
  return HEAP32[($3_1 + 28 | 0) >> 2] | 0 | 0;
 }
 
 function $6($0_1, $1_1, $2_1, $3_1, $4_1, $5_1, $6_1, $7_1, $8_1, $9_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  $4_1 = $4_1 | 0;
  $5_1 = $5_1 | 0;
  $6_1 = $6_1 | 0;
  $7_1 = $7_1 | 0;
  $8_1 = $8_1 | 0;
  $9_1 = $9_1 | 0;
  var $10_1 = 0, $102_1 = 0, $13_1 = 0, $19_1 = 0, $27_1 = 0, $44_1 = 0, $67_1 = 0, $71_1 = 0, $73_1 = 0, $75_1 = 0, $77_1 = 0, $78_1 = 0, $80_1 = 0, $91_1 = 0, $92_1 = 0, $93_1 = 0, $94_1 = 0, $95_1 = 0, $96_1 = 0, $98_1 = 0, $101_1 = 0, $108_1 = 0, $109_1 = 0, $110_1 = 0, $111_1 = 0, $113_1 = 0, $114_1 = 0, $115_1 = 0, $116_1 = 0, $117_1 = 0, $118_1 = 0, $120_1 = 0, $122_1 = 0, $22_1 = 0, $24_1 = 0, $52_1 = 0, $54_1 = 0, $59_1 = 0, $63_1 = 0, $83_1 = 0, $85_1 = 0, $86_1 = 0, $97_1 = 0, $125_1 = 0, $1103 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $10_1 = global$0 - 1152 | 0;
  global$0 = $10_1;
  HEAP32[($10_1 + 1144 | 0) >> 2] = $0_1;
  HEAP32[($10_1 + 1140 | 0) >> 2] = $1_1;
  HEAP32[($10_1 + 1136 | 0) >> 2] = $2_1;
  HEAP32[($10_1 + 1132 | 0) >> 2] = $3_1;
  HEAP32[($10_1 + 1128 | 0) >> 2] = $4_1;
  HEAP32[($10_1 + 1124 | 0) >> 2] = $5_1;
  HEAP32[($10_1 + 1120 | 0) >> 2] = $6_1;
  HEAP32[($10_1 + 1116 | 0) >> 2] = $7_1;
  HEAP32[($10_1 + 1112 | 0) >> 2] = $8_1;
  HEAP32[($10_1 + 1108 | 0) >> 2] = $9_1;
  HEAP32[(HEAP32[($10_1 + 1136 | 0) >> 2] | 0) >> 2] = 0;
  block2 : {
   block1 : {
    block : {
     if (!((HEAP32[($10_1 + 1140 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
      break block
     }
     if ((HEAPU8[(HEAP32[($10_1 + 1140 | 0) >> 2] | 0) >> 0] | 0 | 0) != (0 & 255 | 0 | 0) & 1 | 0) {
      break block1
     }
    }
    HEAP32[($10_1 + 1148 | 0) >> 2] = -1;
    break block2;
   }
   HEAP32[($10_1 + 60 | 0) >> 2] = -1;
   $13_1 = $1(HEAP32[($10_1 + 1140 | 0) >> 2] | 0 | 0) | 0;
   HEAP32[($10_1 + 1096 | 0) >> 2] = $13_1;
   block3 : {
    if (!(($13_1 | 0) == (0 | 0) & 1 | 0)) {
     break block3
    }
    HEAP32[($10_1 + 60 | 0) >> 2] = 0;
    block4 : {
     label : while (1) {
      if (!((HEAP32[(75568 + ((HEAP32[($10_1 + 60 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
       break block4
      }
      (wasm2js_i32$0 = $10_1, wasm2js_i32$1 = ($2($10_1 + 64 | 0 | 0, HEAP32[($10_1 + 1140 | 0) >> 2] | 0 | 0, 1024 | 0) | 0) - 1 | 0), HEAP32[(wasm2js_i32$0 + 52 | 0) >> 2] = wasm2js_i32$1;
      $2(($10_1 + 64 | 0) + (HEAP32[($10_1 + 52 | 0) >> 2] | 0) | 0 | 0, HEAP32[(75568 + ((HEAP32[($10_1 + 60 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0, 1024 - (HEAP32[($10_1 + 52 | 0) >> 2] | 0) | 0 | 0) | 0;
      $19_1 = $1($10_1 + 64 | 0 | 0) | 0;
      HEAP32[($10_1 + 1096 | 0) >> 2] = $19_1;
      block5 : {
       if (!(($19_1 | 0) != (0 | 0) & 1 | 0)) {
        break block5
       }
       break block4;
      }
      HEAP32[($10_1 + 60 | 0) >> 2] = (HEAP32[($10_1 + 60 | 0) >> 2] | 0) + 1 | 0;
      continue label;
     };
    }
   }
   block6 : {
    if (!((HEAP32[($10_1 + 1096 | 0) >> 2] | 0 | 0) == (0 | 0) & 1 | 0)) {
     break block6
    }
    HEAP32[($10_1 + 1148 | 0) >> 2] = -1;
    break block2;
   }
   block9 : {
    block8 : {
     block7 : {
      if (($147($10_1 + 64 | 0 | 0, 1 | 0, 239 | 0, HEAP32[($10_1 + 1096 | 0) >> 2] | 0 | 0) | 0 | 0) != (239 | 0) & 1 | 0) {
       break block7
      }
      if (!($152($10_1 + 64 | 0 | 0, 65802 | 0, 22 | 0) | 0)) {
       break block8
      }
      if (!($152($10_1 + 64 | 0 | 0, 65824 | 0, 22 | 0) | 0)) {
       break block8
      }
     }
     break block9;
    }
    block10 : {
     if (!((HEAP8[($10_1 + 146 | 0) >> 0] | 0 | 0) != (1 | 0) & 1 | 0)) {
      break block10
     }
     if (!(HEAP8[($10_1 + 146 | 0) >> 0] | 0)) {
      break block10
     }
     break block9;
    }
    block11 : {
     if (!((HEAP8[($10_1 + 215 | 0) >> 0] | 0 | 0) != (1 | 0) & 1 | 0)) {
      break block11
     }
     if (!(HEAP8[($10_1 + 215 | 0) >> 0] | 0)) {
      break block11
     }
     break block9;
    }
    $22_1 = $182(8 | 0) | 0;
    HEAP32[(HEAP32[($10_1 + 1136 | 0) >> 2] | 0) >> 2] = $22_1;
    HEAP32[($10_1 + 1104 | 0) >> 2] = HEAP32[(HEAP32[($10_1 + 1136 | 0) >> 2] | 0) >> 2] | 0;
    block66 : {
     block17 : {
      block13 : {
       block12 : {
        if ((HEAP32[($10_1 + 1104 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
         break block12
        }
        break block13;
       }
       HEAP32[(HEAP32[($10_1 + 1104 | 0) >> 2] | 0) >> 2] = HEAP8[($10_1 + 262 | 0) >> 0] | 0;
       $24_1 = $185(HEAP32[(HEAP32[($10_1 + 1104 | 0) >> 2] | 0) >> 2] | 0 | 0, 108 | 0) | 0;
       HEAP32[((HEAP32[($10_1 + 1104 | 0) >> 2] | 0) + 4 | 0) >> 2] = $24_1;
       block14 : {
        if ((HEAP32[((HEAP32[($10_1 + 1104 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
         break block14
        }
        break block13;
       }
       HEAP32[($10_1 + 60 | 0) >> 2] = 0;
       block15 : {
        label5 : while (1) {
         if (!((HEAP32[($10_1 + 60 | 0) >> 2] | 0 | 0) < (HEAP32[(HEAP32[($10_1 + 1104 | 0) >> 2] | 0) >> 2] | 0 | 0) & 1 | 0)) {
          break block15
         }
         $150(HEAP32[($10_1 + 1096 | 0) >> 2] | 0 | 0, 7 | 0, 1 | 0) | 0;
         $27_1 = 1;
         block16 : {
          if (!(($147($10_1 + 51 | 0 | 0, $27_1 | 0, $27_1 | 0, HEAP32[($10_1 + 1096 | 0) >> 2] | 0 | 0) | 0 | 0) != (1 | 0) & 1 | 0)) {
           break block16
          }
          break block17;
         }
         HEAP32[($10_1 + 1100 | 0) >> 2] = (HEAP32[((HEAP32[($10_1 + 1104 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) + Math_imul(HEAP32[($10_1 + 60 | 0) >> 2] | 0, 108) | 0;
         block18 : {
          if (!(($147($10_1 + 44 | 0 | 0, 4 | 0, 1 | 0, HEAP32[($10_1 + 1096 | 0) >> 2] | 0 | 0) | 0 | 0) != (1 | 0) & 1 | 0)) {
           break block18
          }
          break block17;
         }
         HEAP32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 8 | 0) >> 2] = HEAP32[($10_1 + 44 | 0) >> 2] | 0;
         block19 : {
          if (!(($147($10_1 + 44 | 0 | 0, 4 | 0, 1 | 0, HEAP32[($10_1 + 1096 | 0) >> 2] | 0 | 0) | 0 | 0) != (1 | 0) & 1 | 0)) {
           break block19
          }
          break block17;
         }
         HEAP32[(HEAP32[($10_1 + 1100 | 0) >> 2] | 0) >> 2] = HEAP32[($10_1 + 44 | 0) >> 2] | 0;
         block20 : {
          if (!(($147($10_1 + 44 | 0 | 0, 4 | 0, 1 | 0, HEAP32[($10_1 + 1096 | 0) >> 2] | 0 | 0) | 0 | 0) != (1 | 0) & 1 | 0)) {
           break block20
          }
          break block17;
         }
         HEAP32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 4 | 0) >> 2] = HEAP32[($10_1 + 44 | 0) >> 2] | 0;
         block21 : {
          if (!(($147($10_1 + 42 | 0 | 0, 2 | 0, 1 | 0, HEAP32[($10_1 + 1096 | 0) >> 2] | 0 | 0) | 0 | 0) != (1 | 0) & 1 | 0)) {
           break block21
          }
          break block17;
         }
         HEAP32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 12 | 0) >> 2] = HEAPU16[($10_1 + 42 | 0) >> 1] | 0;
         block22 : {
          if (!(($147($10_1 + 44 | 0 | 0, 4 | 0, 1 | 0, HEAP32[($10_1 + 1096 | 0) >> 2] | 0 | 0) | 0 | 0) != (1 | 0) & 1 | 0)) {
           break block22
          }
          break block17;
         }
         HEAP32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 16 | 0) >> 2] = HEAP32[($10_1 + 44 | 0) >> 2] | 0;
         block23 : {
          if (!(($147($10_1 + 44 | 0 | 0, 4 | 0, 1 | 0, HEAP32[($10_1 + 1096 | 0) >> 2] | 0 | 0) | 0 | 0) != (1 | 0) & 1 | 0)) {
           break block23
          }
          break block17;
         }
         HEAP32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 20 | 0) >> 2] = HEAP32[($10_1 + 44 | 0) >> 2] | 0;
         block24 : {
          if (!(($147($10_1 + 44 | 0 | 0, 4 | 0, 1 | 0, HEAP32[($10_1 + 1096 | 0) >> 2] | 0 | 0) | 0 | 0) != (1 | 0) & 1 | 0)) {
           break block24
          }
          break block17;
         }
         HEAP32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 24 | 0) >> 2] = HEAP32[($10_1 + 44 | 0) >> 2] | 0;
         $150(HEAP32[($10_1 + 1096 | 0) >> 2] | 0 | 0, 2 | 0, 1 | 0) | 0;
         $44_1 = 1;
         block25 : {
          if (!(($147($10_1 + 41 | 0 | 0, $44_1 | 0, $44_1 | 0, HEAP32[($10_1 + 1096 | 0) >> 2] | 0 | 0) | 0 | 0) != (1 | 0) & 1 | 0)) {
           break block25
          }
          break block17;
         }
         HEAP8[($10_1 + 64 | 0) >> 0] = HEAPU8[($10_1 + 41 | 0) >> 0] | 0;
         block27 : {
          block26 : {
           if (!((HEAP32[($10_1 + 1128 | 0) >> 2] | 0 | 0) == (-1 | 0) & 1 | 0)) {
            break block26
           }
           HEAP8[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 103 | 0) >> 0] = (((HEAP8[($10_1 + 64 | 0) >> 0] | 0) << 3 | 0) + 4 | 0) & 127 | 0;
           break block27;
          }
          HEAP8[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 103 | 0) >> 0] = (HEAP32[($10_1 + 1128 | 0) >> 2] | 0) & 127 | 0;
         }
         block28 : {
          if (!(($147($10_1 + 64 | 0 | 0, 1 | 0, 18 | 0, HEAP32[($10_1 + 1096 | 0) >> 2] | 0 | 0) | 0 | 0) != (18 | 0) & 1 | 0)) {
           break block28
          }
          break block17;
         }
         block31 : {
          block30 : {
           block29 : {
            if (!((HEAPU8[($10_1 + 77 | 0) >> 0] | 0 | 0) != (0 & 255 | 0 | 0) & 1 | 0)) {
             break block29
            }
            if ((HEAPU8[($10_1 + 78 | 0) >> 0] | 0 | 0) != (0 & 255 | 0 | 0) & 1 | 0) {
             break block30
            }
           }
           HEAP8[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 100 | 0) >> 0] = 0;
           HEAP32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 88 | 0) >> 2] = 0;
           HEAP32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 84 | 0) >> 2] = 0;
           break block31;
          }
          $52_1 = $7(HEAP32[($10_1 + 1144 | 0) >> 2] | 0 | 0, HEAPU8[($10_1 + 76 | 0) >> 0] | 0 | 0) | 0;
          HEAP32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 84 | 0) >> 2] = $52_1;
          $54_1 = $8(HEAP32[($10_1 + 1144 | 0) >> 2] | 0 | 0, HEAPU8[($10_1 + 77 | 0) >> 0] | 0 | 0) | 0;
          HEAP32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 88 | 0) >> 2] = $54_1;
          HEAP8[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 100 | 0) >> 0] = HEAPU8[($10_1 + 78 | 0) >> 0] | 0;
         }
         block34 : {
          block33 : {
           block32 : {
            if (!((HEAPU8[($10_1 + 80 | 0) >> 0] | 0 | 0) != (0 & 255 | 0 | 0) & 1 | 0)) {
             break block32
            }
            if ((HEAPU8[($10_1 + 81 | 0) >> 0] | 0 | 0) != (0 & 255 | 0 | 0) & 1 | 0) {
             break block33
            }
           }
           HEAP8[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 101 | 0) >> 0] = 0;
           HEAP32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 96 | 0) >> 2] = 0;
           HEAP32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 92 | 0) >> 2] = 0;
           break block34;
          }
          $59_1 = $9(HEAP32[($10_1 + 1144 | 0) >> 2] | 0 | 0, HEAPU8[($10_1 + 80 | 0) >> 0] | 0 | 0) | 0;
          HEAP32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 96 | 0) >> 2] = $59_1;
          $63_1 = $10(HEAP32[($10_1 + 1144 | 0) >> 2] | 0 | 0, (HEAPU8[($10_1 + 79 | 0) >> 0] | 0) & 255 | 0 | 0, HEAP32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 96 | 0) >> 2] | 0 | 0) | 0;
          HEAP32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 92 | 0) >> 2] = $63_1;
          HEAP8[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 101 | 0) >> 0] = HEAPU8[($10_1 + 81 | 0) >> 0] | 0;
         }
         $67_1 = 1;
         block35 : {
          if (!(($147($10_1 + 41 | 0 | 0, $67_1 | 0, $67_1 | 0, HEAP32[($10_1 + 1096 | 0) >> 2] | 0 | 0) | 0 | 0) != (1 | 0) & 1 | 0)) {
           break block35
          }
          break block17;
         }
         HEAP8[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 102 | 0) >> 0] = HEAPU8[($10_1 + 41 | 0) >> 0] | 0;
         $150(HEAP32[($10_1 + 1096 | 0) >> 2] | 0 | 0, 40 | 0, 1 | 0) | 0;
         block37 : {
          block36 : {
           if (!((HEAP32[($10_1 + 1120 | 0) >> 2] | 0 | 0) != (-1 | 0) & 1 | 0)) {
            break block36
           }
           HEAP8[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 104 | 0) >> 0] = HEAP32[($10_1 + 1120 | 0) >> 2] | 0;
           break block37;
          }
          HEAP8[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 104 | 0) >> 0] = 0;
         }
         block38 : {
          if (!((HEAPU8[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 102 | 0) >> 0] | 0) & 4 | 0)) {
           break block38
          }
          $71_1 = HEAP32[($10_1 + 1100 | 0) >> 2] | 0;
          HEAP8[($71_1 + 102 | 0) >> 0] = HEAPU8[($71_1 + 102 | 0) >> 0] | 0 | 32 | 0;
         }
         block39 : {
          if (!((HEAP32[($10_1 + 1116 | 0) >> 2] | 0 | 0) == (1 | 0) & 1 | 0)) {
           break block39
          }
          if (!((HEAPU8[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 102 | 0) >> 0] | 0) & 60 | 0)) {
           break block39
          }
          $73_1 = HEAP32[($10_1 + 1100 | 0) >> 2] | 0;
          HEAP8[($73_1 + 102 | 0) >> 0] = (HEAPU8[($73_1 + 102 | 0) >> 0] | 0) & -61 | 0;
         }
         block42 : {
          block40 : {
           if (!((HEAP32[($10_1 + 1112 | 0) >> 2] | 0 | 0) == (1 | 0) & 1 | 0)) {
            break block40
           }
           block41 : {
            if (!((HEAPU8[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 102 | 0) >> 0] | 0) & 64 | 0)) {
             break block41
            }
           }
           $75_1 = HEAP32[($10_1 + 1100 | 0) >> 2] | 0;
           HEAP8[($75_1 + 102 | 0) >> 0] = (HEAPU8[($75_1 + 102 | 0) >> 0] | 0) & -65 | 0;
           break block42;
          }
          block43 : {
           if (!(HEAP32[($10_1 + 1112 | 0) >> 2] | 0)) {
            break block43
           }
           block45 : {
            block44 : {
             if ((HEAPU8[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 102 | 0) >> 0] | 0) & 28 | 0) {
              break block44
             }
             $77_1 = HEAP32[($10_1 + 1100 | 0) >> 2] | 0;
             HEAP8[($77_1 + 102 | 0) >> 0] = (HEAPU8[($77_1 + 102 | 0) >> 0] | 0) & -97 | 0;
             break block45;
            }
            block48 : {
             block47 : {
              block46 : {
               if (!($152($10_1 + 64 | 0 | 0, 65795 | 0, 6 | 0) | 0)) {
                break block46
               }
               if (!((HEAP8[($10_1 + 75 | 0) >> 0] | 0 | 0) >= (100 | 0) & 1 | 0)) {
                break block47
               }
              }
              $78_1 = HEAP32[($10_1 + 1100 | 0) >> 2] | 0;
              HEAP8[($78_1 + 102 | 0) >> 0] = (HEAPU8[($78_1 + 102 | 0) >> 0] | 0) & -65 | 0;
              break block48;
             }
             block49 : {
              if ((HEAPU8[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 102 | 0) >> 0] | 0) & 32 | 0) {
               break block49
              }
              $80_1 = HEAP32[($10_1 + 1100 | 0) >> 2] | 0;
              HEAP8[($80_1 + 102 | 0) >> 0] = (HEAPU8[($80_1 + 102 | 0) >> 0] | 0) & -65 | 0;
             }
            }
           }
          }
         }
         HEAP32[($10_1 + 56 | 0) >> 2] = 0;
         block50 : {
          label1 : while (1) {
           if (!((HEAP32[($10_1 + 56 | 0) >> 2] | 0 | 0) < (6 | 0) & 1 | 0)) {
            break block50
           }
           $83_1 = $11(HEAP32[($10_1 + 1144 | 0) >> 2] | 0 | 0, HEAPU8[((HEAP32[($10_1 + 56 | 0) >> 2] | 0) + ($10_1 + 64 | 0) | 0) >> 0] | 0 | 0) | 0;
           HEAP32[(((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 28 | 0) + ((HEAP32[($10_1 + 56 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] = $83_1;
           $85_1 = $12(HEAPU8[(((HEAP32[($10_1 + 56 | 0) >> 2] | 0) + 6 | 0) + ($10_1 + 64 | 0) | 0) >> 0] | 0 | 0) | 0;
           HEAP32[(((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 52 | 0) + ((HEAP32[($10_1 + 56 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] = $85_1;
           HEAP32[($10_1 + 56 | 0) >> 2] = (HEAP32[($10_1 + 56 | 0) >> 2] | 0) + 1 | 0;
           continue label1;
          };
         }
         $86_1 = $182((HEAP32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0) + 4 | 0 | 0) | 0;
         HEAP32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 80 | 0) >> 2] = $86_1;
         block51 : {
          if ((HEAP32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 80 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
           break block51
          }
          break block13;
         }
         block52 : {
          if (!(($147(HEAP32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 80 | 0) >> 2] | 0 | 0, HEAP32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0 | 0, 1 | 0, HEAP32[($10_1 + 1096 | 0) >> 2] | 0 | 0) | 0 | 0) != (1 | 0) & 1 | 0)) {
           break block52
          }
          break block17;
         }
         block53 : {
          if ((HEAPU8[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 102 | 0) >> 0] | 0) & 1 | 0) {
           break block53
          }
          HEAP32[($10_1 + 36 | 0) >> 2] = HEAP32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0;
          HEAP32[($10_1 + 32 | 0) >> 2] = HEAP32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 80 | 0) >> 2] | 0;
          $91_1 = HEAP32[($10_1 + 1100 | 0) >> 2] | 0;
          HEAP32[($91_1 + 8 | 0) >> 2] = (HEAP32[($91_1 + 8 | 0) >> 2] | 0) << 1 | 0;
          $92_1 = HEAP32[($10_1 + 1100 | 0) >> 2] | 0;
          HEAP32[$92_1 >> 2] = (HEAP32[$92_1 >> 2] | 0) << 1 | 0;
          $93_1 = HEAP32[($10_1 + 1100 | 0) >> 2] | 0;
          HEAP32[($93_1 + 4 | 0) >> 2] = (HEAP32[($93_1 + 4 | 0) >> 2] | 0) << 1 | 0;
          $94_1 = $182((HEAP32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0) + 4 | 0 | 0) | 0;
          HEAP32[($10_1 + 24 | 0) >> 2] = $94_1;
          HEAP32[($10_1 + 28 | 0) >> 2] = $94_1;
          block54 : {
           if ((HEAP32[($10_1 + 24 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
            break block54
           }
           break block13;
          }
          block55 : {
           label2 : while (1) {
            $95_1 = HEAP32[($10_1 + 36 | 0) >> 2] | 0;
            HEAP32[($10_1 + 36 | 0) >> 2] = $95_1 + -1 | 0;
            if (!$95_1) {
             break block55
            }
            $96_1 = HEAP32[($10_1 + 32 | 0) >> 2] | 0;
            HEAP32[($10_1 + 32 | 0) >> 2] = $96_1 + 1 | 0;
            $97_1 = ((HEAPU8[$96_1 >> 0] | 0) & 65535 | 0) << 8 | 0;
            $98_1 = HEAP32[($10_1 + 28 | 0) >> 2] | 0;
            HEAP32[($10_1 + 28 | 0) >> 2] = $98_1 + 2 | 0;
            HEAP16[$98_1 >> 1] = $97_1;
            continue label2;
           };
          }
          $184(HEAP32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 80 | 0) >> 2] | 0 | 0);
          HEAP32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 80 | 0) >> 2] = HEAP32[($10_1 + 24 | 0) >> 2] | 0;
         }
         block56 : {
          if (!((HEAPU8[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 102 | 0) >> 0] | 0) & 2 | 0)) {
           break block56
          }
          HEAP32[($10_1 + 20 | 0) >> 2] = (HEAP32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0 | 0) / (2 | 0) | 0;
          HEAP32[($10_1 + 16 | 0) >> 2] = HEAP32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 80 | 0) >> 2] | 0;
          block57 : {
           label3 : while (1) {
            $101_1 = HEAP32[($10_1 + 20 | 0) >> 2] | 0;
            HEAP32[($10_1 + 20 | 0) >> 2] = $101_1 + -1 | 0;
            if (!$101_1) {
             break block57
            }
            $102_1 = HEAP32[($10_1 + 16 | 0) >> 2] | 0;
            HEAP32[($10_1 + 16 | 0) >> 2] = $102_1 + 2 | 0;
            HEAP16[$102_1 >> 1] = (HEAP16[$102_1 >> 1] | 0) ^ 32768 | 0;
            continue label3;
           };
          }
         }
         block58 : {
          if (!((HEAPU8[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 102 | 0) >> 0] | 0) & 16 | 0)) {
           break block58
          }
          $13(HEAP32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 80 | 0) >> 2] | 0 | 0, 0 | 0, (HEAP32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0 | 0) / (2 | 0) | 0 | 0);
          HEAP32[($10_1 + 12 | 0) >> 2] = HEAP32[(HEAP32[($10_1 + 1100 | 0) >> 2] | 0) >> 2] | 0;
          HEAP32[(HEAP32[($10_1 + 1100 | 0) >> 2] | 0) >> 2] = (HEAP32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0) - (HEAP32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) | 0;
          HEAP32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 4 | 0) >> 2] = (HEAP32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0) - (HEAP32[($10_1 + 12 | 0) >> 2] | 0) | 0;
          $108_1 = HEAP32[($10_1 + 1100 | 0) >> 2] | 0;
          HEAP8[($108_1 + 102 | 0) >> 0] = (HEAPU8[($108_1 + 102 | 0) >> 0] | 0) & -17 | 0;
          $109_1 = HEAP32[($10_1 + 1100 | 0) >> 2] | 0;
          HEAP8[($109_1 + 102 | 0) >> 0] = HEAPU8[($109_1 + 102 | 0) >> 0] | 0 | 4 | 0;
         }
         block60 : {
          block59 : {
           if (!((HEAP32[($10_1 + 1124 | 0) >> 2] | 0 | 0) != (-1 | 0) & 1 | 0)) {
            break block59
           }
           HEAPF32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 76 | 0) >> 2] = Math_fround(+(HEAP32[($10_1 + 1124 | 0) >> 2] | 0 | 0) / 100.0);
           break block60;
          }
          HEAP32[($10_1 + 8 | 0) >> 2] = (HEAP32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0 | 0) / (2 | 0) | 0;
          HEAP16[($10_1 + 6 | 0) >> 1] = 0;
          HEAP32[$10_1 >> 2] = HEAP32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 80 | 0) >> 2] | 0;
          block61 : {
           label4 : while (1) {
            $110_1 = HEAP32[($10_1 + 8 | 0) >> 2] | 0;
            HEAP32[($10_1 + 8 | 0) >> 2] = $110_1 + -1 | 0;
            if (!$110_1) {
             break block61
            }
            $111_1 = HEAP32[$10_1 >> 2] | 0;
            HEAP32[$10_1 >> 2] = $111_1 + 2 | 0;
            HEAP16[($10_1 + 4 | 0) >> 1] = HEAPU16[$111_1 >> 1] | 0;
            block62 : {
             if (!((HEAP16[($10_1 + 4 | 0) >> 1] | 0 | 0) < (0 | 0) & 1 | 0)) {
              break block62
             }
             HEAP16[($10_1 + 4 | 0) >> 1] = 0 - (HEAP16[($10_1 + 4 | 0) >> 1] | 0) | 0;
            }
            block63 : {
             if (!((HEAP16[($10_1 + 4 | 0) >> 1] | 0 | 0) > (HEAP16[($10_1 + 6 | 0) >> 1] | 0 | 0) & 1 | 0)) {
              break block63
             }
             HEAP16[($10_1 + 6 | 0) >> 1] = HEAPU16[($10_1 + 4 | 0) >> 1] | 0;
            }
            continue label4;
           };
          }
          HEAPF32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 76 | 0) >> 2] = Math_fround(32768.0 / +(HEAP16[($10_1 + 6 | 0) >> 1] | 0 | 0));
         }
         $113_1 = HEAP32[($10_1 + 1100 | 0) >> 2] | 0;
         HEAP32[($113_1 + 8 | 0) >> 2] = (HEAP32[($113_1 + 8 | 0) >> 2] | 0 | 0) / (2 | 0) | 0;
         $114_1 = HEAP32[($10_1 + 1100 | 0) >> 2] | 0;
         HEAP32[$114_1 >> 2] = (HEAP32[$114_1 >> 2] | 0 | 0) / (2 | 0) | 0;
         $115_1 = HEAP32[($10_1 + 1100 | 0) >> 2] | 0;
         HEAP32[($115_1 + 4 | 0) >> 2] = (HEAP32[($115_1 + 4 | 0) >> 2] | 0 | 0) / (2 | 0) | 0;
         HEAP16[((HEAP32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 80 | 0) >> 2] | 0) + (((HEAP32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0) + 1 | 0) << 1 | 0) | 0) >> 1] = 0;
         HEAP16[((HEAP32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 80 | 0) >> 2] | 0) + ((HEAP32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0) << 1 | 0) | 0) >> 1] = 0;
         $116_1 = HEAP32[($10_1 + 1100 | 0) >> 2] | 0;
         HEAP32[($116_1 + 8 | 0) >> 2] = (HEAP32[($116_1 + 8 | 0) >> 2] | 0) << 12 | 0;
         $117_1 = HEAP32[($10_1 + 1100 | 0) >> 2] | 0;
         HEAP32[$117_1 >> 2] = (HEAP32[$117_1 >> 2] | 0) << 12 | 0;
         $118_1 = HEAP32[($10_1 + 1100 | 0) >> 2] | 0;
         HEAP32[($118_1 + 4 | 0) >> 2] = (HEAP32[($118_1 + 4 | 0) >> 2] | 0) << 12 | 0;
         $120_1 = HEAP32[($10_1 + 1100 | 0) >> 2] | 0;
         HEAP32[$120_1 >> 2] = ((HEAPU8[($10_1 + 51 | 0) >> 0] | 0) & 15 | 0) << 8 | 0 | (HEAP32[$120_1 >> 2] | 0) | 0;
         $122_1 = HEAP32[($10_1 + 1100 | 0) >> 2] | 0;
         HEAP32[($122_1 + 4 | 0) >> 2] = (((HEAPU8[($10_1 + 51 | 0) >> 0] | 0) >> 4 | 0) & 15 | 0) << 8 | 0 | (HEAP32[($122_1 + 4 | 0) >> 2] | 0) | 0;
         block64 : {
          if (!(HEAP8[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 104 | 0) >> 0] | 0)) {
           break block64
          }
          if ((HEAPU8[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 102 | 0) >> 0] | 0) & 4 | 0) {
           break block64
          }
          $127(HEAP32[($10_1 + 1144 | 0) >> 2] | 0 | 0, HEAP32[($10_1 + 1100 | 0) >> 2] | 0 | 0);
          block65 : {
           if (!(HEAP32[(HEAP32[($10_1 + 1144 | 0) >> 2] | 0) >> 2] | 0)) {
            break block65
           }
           break block66;
          }
         }
         block67 : {
          if (!((HEAP32[($10_1 + 1108 | 0) >> 2] | 0 | 0) == (1 | 0) & 1 | 0)) {
           break block67
          }
          HEAP32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 8 | 0) >> 2] = HEAP32[((HEAP32[($10_1 + 1100 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
         }
         HEAP32[($10_1 + 60 | 0) >> 2] = (HEAP32[($10_1 + 60 | 0) >> 2] | 0) + 1 | 0;
         continue label5;
        };
       }
       $132(HEAP32[($10_1 + 1096 | 0) >> 2] | 0 | 0) | 0;
       HEAP32[($10_1 + 1148 | 0) >> 2] = 0;
       break block2;
      }
      HEAP32[(HEAP32[($10_1 + 1144 | 0) >> 2] | 0) >> 2] = 1;
      break block66;
     }
    }
    $14(HEAP32[($10_1 + 1104 | 0) >> 2] | 0 | 0);
   }
   $132(HEAP32[($10_1 + 1096 | 0) >> 2] | 0 | 0) | 0;
   HEAP32[(HEAP32[($10_1 + 1136 | 0) >> 2] | 0) >> 2] = 0;
   HEAP32[($10_1 + 1148 | 0) >> 2] = -1;
  }
  $125_1 = HEAP32[($10_1 + 1148 | 0) >> 2] | 0;
  global$0 = $10_1 + 1152 | 0;
  return $125_1 | 0;
 }
 
 function $7($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0, $36_1 = 0;
  $2_1 = global$0 - 16 | 0;
  HEAP32[($2_1 + 8 | 0) >> 2] = $0_1;
  HEAP8[($2_1 + 7 | 0) >> 0] = $1_1;
  block1 : {
   block : {
    if ((HEAPU8[($2_1 + 7 | 0) >> 0] | 0 | 0) != (0 & 255 | 0 | 0) & 1 | 0) {
     break block
    }
    HEAP32[($2_1 + 12 | 0) >> 2] = 0;
    break block1;
   }
   HEAP32[($2_1 + 12 | 0) >> 2] = (Math_imul(HEAP32[((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 13060 | 0) >> 2] | 0, 38) << 16 | 0 | 0) / (Math_imul(HEAP32[((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0, HEAPU8[($2_1 + 7 | 0) >> 0] | 0) | 0) | 0;
  }
  return HEAP32[($2_1 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function $8($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0, $24_1 = 0;
  $2_1 = global$0 - 16 | 0;
  HEAP32[($2_1 + 12 | 0) >> 2] = $0_1;
  HEAP8[($2_1 + 11 | 0) >> 0] = $1_1;
  return (Math_imul((HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 13060 | 0) >> 2] | 0) << 10 | 0, HEAPU8[($2_1 + 11 | 0) >> 0] | 0) << 5 | 0 | 0) / (Math_imul(HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0, 38) | 0) | 0 | 0;
 }
 
 function $9($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0, $20_1 = 0;
  $2_1 = global$0 - 16 | 0;
  HEAP32[($2_1 + 12 | 0) >> 2] = $0_1;
  HEAP8[($2_1 + 11 | 0) >> 0] = $1_1;
  return (Math_imul(HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0, 38) | 0) / (((HEAPU8[($2_1 + 11 | 0) >> 0] | 0) << 1 | 0) << 5 | 0 | 0) | 0 | 0;
 }
 
 function $10($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, $7_1 = 0.0, $46_1 = 0, $33_1 = 0, $50_1 = 0;
  $3_1 = global$0 - 16 | 0;
  HEAP32[($3_1 + 8 | 0) >> 2] = $0_1;
  HEAP8[($3_1 + 7 | 0) >> 0] = $1_1;
  HEAP32[$3_1 >> 2] = $2_1;
  block1 : {
   block : {
    if ((HEAPU8[($3_1 + 7 | 0) >> 0] | 0 | 0) != (0 & 255 | 0 | 0) & 1 | 0) {
     break block
    }
    HEAP32[($3_1 + 12 | 0) >> 2] = 0;
    break block1;
   }
   $33_1 = $3_1;
   $7_1 = +Math_fround(+(HEAP32[$3_1 >> 2] | 0 | 0) * 38.0 * 65536.0) / +(Math_imul(HEAP32[((HEAP32[($3_1 + 8 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0, HEAPU8[($3_1 + 7 | 0) >> 0] | 0) | 0);
   if (Math_abs($7_1) < 2147483647.0) {
    $46_1 = ~~$7_1
   } else {
    $46_1 = -2147483648
   }
   HEAP32[($33_1 + 12 | 0) >> 2] = $46_1;
  }
  return HEAP32[($3_1 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function $11($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0, $43_1 = 0;
  $2_1 = global$0 - 16 | 0;
  HEAP32[($2_1 + 12 | 0) >> 2] = $0_1;
  HEAP8[($2_1 + 11 | 0) >> 0] = $1_1;
  HEAP32[($2_1 + 4 | 0) >> 2] = 3 - (((HEAPU8[($2_1 + 11 | 0) >> 0] | 0) >> 6 | 0) & 3 | 0) | 0;
  HEAP32[($2_1 + 4 | 0) >> 2] = Math_imul(HEAP32[($2_1 + 4 | 0) >> 2] | 0, 3);
  HEAP32[($2_1 + 4 | 0) >> 2] = ((HEAPU8[($2_1 + 11 | 0) >> 0] | 0) & 63 | 0) << (HEAP32[($2_1 + 4 | 0) >> 2] | 0) | 0;
  HEAP32[($2_1 + 4 | 0) >> 2] = Math_imul((Math_imul(HEAP32[($2_1 + 4 | 0) >> 2] | 0, 44100) | 0) / (HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0 | 0) | 0, HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 13060 | 0) >> 2] | 0);
  return (HEAP32[($2_1 + 4 | 0) >> 2] | 0) << 10 | 0 | 0;
 }
 
 function $12($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, $9_1 = 0;
  $1_1 = global$0 - 16 | 0;
  HEAP8[($1_1 + 15 | 0) >> 0] = $0_1;
  return (HEAPU8[($1_1 + 15 | 0) >> 0] | 0) << 22 | 0 | 0;
 }
 
 function $13($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, $6_1 = 0, $8_1 = 0, $10_1 = 0, $7_1 = 0, $9_1 = 0;
  $3_1 = global$0 - 32 | 0;
  HEAP32[($3_1 + 28 | 0) >> 2] = $0_1;
  HEAP32[($3_1 + 24 | 0) >> 2] = $1_1;
  HEAP32[($3_1 + 20 | 0) >> 2] = $2_1;
  HEAP32[($3_1 + 12 | 0) >> 2] = (HEAP32[($3_1 + 28 | 0) >> 2] | 0) + ((HEAP32[($3_1 + 20 | 0) >> 2] | 0) << 1 | 0) | 0;
  HEAP32[($3_1 + 28 | 0) >> 2] = (HEAP32[($3_1 + 28 | 0) >> 2] | 0) + ((HEAP32[($3_1 + 24 | 0) >> 2] | 0) << 1 | 0) | 0;
  HEAP32[($3_1 + 20 | 0) >> 2] = (HEAP32[($3_1 + 20 | 0) >> 2] | 0) - (HEAP32[($3_1 + 24 | 0) >> 2] | 0) | 0;
  HEAP32[($3_1 + 20 | 0) >> 2] = (HEAP32[($3_1 + 20 | 0) >> 2] | 0 | 0) / (2 | 0) | 0;
  block : {
   label : while (1) {
    $6_1 = HEAP32[($3_1 + 20 | 0) >> 2] | 0;
    HEAP32[($3_1 + 20 | 0) >> 2] = $6_1 + -1 | 0;
    if (!$6_1) {
     break block
    }
    HEAP16[($3_1 + 18 | 0) >> 1] = HEAPU16[(HEAP32[($3_1 + 28 | 0) >> 2] | 0) >> 1] | 0;
    $7_1 = HEAPU16[(HEAP32[($3_1 + 12 | 0) >> 2] | 0) >> 1] | 0;
    $8_1 = HEAP32[($3_1 + 28 | 0) >> 2] | 0;
    HEAP32[($3_1 + 28 | 0) >> 2] = $8_1 + 2 | 0;
    HEAP16[$8_1 >> 1] = $7_1;
    $9_1 = HEAPU16[($3_1 + 18 | 0) >> 1] | 0;
    $10_1 = HEAP32[($3_1 + 12 | 0) >> 2] | 0;
    HEAP32[($3_1 + 12 | 0) >> 2] = $10_1 + -2 | 0;
    HEAP16[$10_1 >> 1] = $9_1;
    continue label;
   };
  }
  return;
 }
 
 function $14($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0;
  $1_1 = global$0 - 16 | 0;
  global$0 = $1_1;
  HEAP32[($1_1 + 12 | 0) >> 2] = $0_1;
  block1 : {
   block : {
    if ((HEAP32[($1_1 + 12 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
     break block
    }
    break block1;
   }
   block2 : {
    if (!((HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
     break block2
    }
    HEAP32[($1_1 + 4 | 0) >> 2] = 0;
    block3 : {
     label : while (1) {
      if (!((HEAP32[($1_1 + 4 | 0) >> 2] | 0 | 0) < (HEAP32[(HEAP32[($1_1 + 12 | 0) >> 2] | 0) >> 2] | 0 | 0) & 1 | 0)) {
       break block3
      }
      HEAP32[($1_1 + 8 | 0) >> 2] = (HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) + Math_imul(HEAP32[($1_1 + 4 | 0) >> 2] | 0, 108) | 0;
      $184(HEAP32[((HEAP32[($1_1 + 8 | 0) >> 2] | 0) + 80 | 0) >> 2] | 0 | 0);
      HEAP32[($1_1 + 4 | 0) >> 2] = (HEAP32[($1_1 + 4 | 0) >> 2] | 0) + 1 | 0;
      continue label;
     };
    }
    $184(HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0 | 0);
   }
   $184(HEAP32[($1_1 + 12 | 0) >> 2] | 0 | 0);
  }
  global$0 = $1_1 + 16 | 0;
  return;
 }
 
 function $15($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, $2_1 = 0, $7_1 = 0, $71_1 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $1_1 = global$0 - 16 | 0;
  global$0 = $1_1;
  HEAP32[($1_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($1_1 + 8 | 0) >> 2] = 128;
  HEAP32[($1_1 + 4 | 0) >> 2] = 0;
  block : {
   label : while (1) {
    $2_1 = HEAP32[($1_1 + 8 | 0) >> 2] | 0;
    HEAP32[($1_1 + 8 | 0) >> 2] = $2_1 + -1 | 0;
    if (!$2_1) {
     break block
    }
    block1 : {
     if (!((HEAP32[(((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 28 | 0) + ((HEAP32[($1_1 + 8 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
      break block1
     }
     (wasm2js_i32$0 = $1_1, wasm2js_i32$1 = ($16(HEAP32[($1_1 + 12 | 0) >> 2] | 0 | 0, 0 | 0, HEAP32[($1_1 + 8 | 0) >> 2] | 0 | 0) | 0) + (HEAP32[($1_1 + 4 | 0) >> 2] | 0) | 0), HEAP32[(wasm2js_i32$0 + 4 | 0) >> 2] = wasm2js_i32$1;
    }
    block2 : {
     if (!((HEAP32[(((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 540 | 0) + ((HEAP32[($1_1 + 8 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
      break block2
     }
     (wasm2js_i32$0 = $1_1, wasm2js_i32$1 = ($16(HEAP32[($1_1 + 12 | 0) >> 2] | 0 | 0, 1 | 0, HEAP32[($1_1 + 8 | 0) >> 2] | 0 | 0) | 0) + (HEAP32[($1_1 + 4 | 0) >> 2] | 0) | 0), HEAP32[(wasm2js_i32$0 + 4 | 0) >> 2] = wasm2js_i32$1;
    }
    continue label;
   };
  }
  $7_1 = HEAP32[($1_1 + 4 | 0) >> 2] | 0;
  global$0 = $1_1 + 16 | 0;
  return $7_1 | 0;
 }
 
 function $16($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, $4_1 = 0, $12_1 = 0, $13_1 = 0, $15_1 = 0, $18_1 = 0, $5_1 = 0, $6_1 = 0, $7_1 = 0, $9_1 = 0, $10_1 = 0, $11_1 = 0, $14_1 = 0, $17_1 = 0, $20_1 = 0, $292 = 0;
  $3_1 = global$0 - 32 | 0;
  global$0 = $3_1;
  HEAP32[($3_1 + 24 | 0) >> 2] = $0_1;
  HEAP32[($3_1 + 20 | 0) >> 2] = $1_1;
  HEAP32[($3_1 + 16 | 0) >> 2] = $2_1;
  HEAP32[($3_1 + 8 | 0) >> 2] = 0;
  block1 : {
   block : {
    if (!(HEAP32[($3_1 + 20 | 0) >> 2] | 0)) {
     break block
    }
    $4_1 = HEAP32[(((HEAP32[($3_1 + 24 | 0) >> 2] | 0) + 540 | 0) + ((HEAP32[($3_1 + 16 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0;
    break block1;
   }
   $4_1 = HEAP32[(((HEAP32[($3_1 + 24 | 0) >> 2] | 0) + 28 | 0) + ((HEAP32[($3_1 + 16 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0;
  }
  HEAP32[($3_1 + 4 | 0) >> 2] = $4_1;
  block3 : {
   block2 : {
    if ((HEAP32[($3_1 + 4 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
     break block2
    }
    HEAP32[($3_1 + 28 | 0) >> 2] = 0;
    break block3;
   }
   HEAP32[($3_1 + 12 | 0) >> 2] = 0;
   block4 : {
    label : while (1) {
     if (!((HEAP32[($3_1 + 12 | 0) >> 2] | 0 | 0) < (128 | 0) & 1 | 0)) {
      break block4
     }
     block5 : {
      if (!((HEAP32[(((HEAP32[($3_1 + 4 | 0) >> 2] | 0) + 4 | 0) + ((HEAP32[($3_1 + 12 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) == (-1 | 0) & 1 | 0)) {
       break block5
      }
      block12 : {
       block6 : {
        if ((HEAP32[((HEAP32[(HEAP32[($3_1 + 4 | 0) >> 2] | 0) >> 2] | 0) + Math_imul(HEAP32[($3_1 + 12 | 0) >> 2] | 0, 28) | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
         break block6
        }
        block7 : {
         if (!(HEAP32[($3_1 + 16 | 0) >> 2] | 0)) {
          break block7
         }
         block10 : {
          block8 : {
           if (HEAP32[($3_1 + 20 | 0) >> 2] | 0) {
            break block8
           }
           block9 : {
            if ((HEAP32[(((HEAP32[((HEAP32[($3_1 + 24 | 0) >> 2] | 0) + 28 | 0) >> 2] | 0) + 4 | 0) + ((HEAP32[($3_1 + 12 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
             break block9
            }
            HEAP32[(((HEAP32[((HEAP32[($3_1 + 24 | 0) >> 2] | 0) + 28 | 0) >> 2] | 0) + 4 | 0) + ((HEAP32[($3_1 + 12 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] = -1;
           }
           break block10;
          }
          block11 : {
           if ((HEAP32[(((HEAP32[((HEAP32[($3_1 + 24 | 0) >> 2] | 0) + 540 | 0) >> 2] | 0) + 4 | 0) + ((HEAP32[($3_1 + 12 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
            break block11
           }
           HEAP32[(((HEAP32[((HEAP32[($3_1 + 24 | 0) >> 2] | 0) + 540 | 0) >> 2] | 0) + 4 | 0) + ((HEAP32[($3_1 + 12 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] = -1;
          }
         }
        }
        HEAP32[(((HEAP32[($3_1 + 4 | 0) >> 2] | 0) + 4 | 0) + ((HEAP32[($3_1 + 12 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] = 0;
        HEAP32[($3_1 + 8 | 0) >> 2] = (HEAP32[($3_1 + 8 | 0) >> 2] | 0) + 1 | 0;
        break block12;
       }
       $5_1 = HEAP32[($3_1 + 24 | 0) >> 2] | 0;
       $6_1 = HEAP32[((HEAP32[(HEAP32[($3_1 + 4 | 0) >> 2] | 0) >> 2] | 0) + Math_imul(HEAP32[($3_1 + 12 | 0) >> 2] | 0, 28) | 0) >> 2] | 0;
       $7_1 = ((HEAP32[($3_1 + 4 | 0) >> 2] | 0) + 4 | 0) + ((HEAP32[($3_1 + 12 | 0) >> 2] | 0) << 2 | 0) | 0;
       $9_1 = HEAP32[($3_1 + 20 | 0) >> 2] | 0 ? 1 : 0;
       $10_1 = HEAP32[(((HEAP32[(HEAP32[($3_1 + 4 | 0) >> 2] | 0) >> 2] | 0) + Math_imul(HEAP32[($3_1 + 12 | 0) >> 2] | 0, 28) | 0) + 12 | 0) >> 2] | 0;
       $11_1 = HEAP32[(((HEAP32[(HEAP32[($3_1 + 4 | 0) >> 2] | 0) >> 2] | 0) + Math_imul(HEAP32[($3_1 + 12 | 0) >> 2] | 0, 28) | 0) + 8 | 0) >> 2] | 0;
       block14 : {
        block13 : {
         if (!((HEAP32[(((HEAP32[(HEAP32[($3_1 + 4 | 0) >> 2] | 0) >> 2] | 0) + Math_imul(HEAP32[($3_1 + 12 | 0) >> 2] | 0, 28) | 0) + 4 | 0) >> 2] | 0 | 0) != (-1 | 0) & 1 | 0)) {
          break block13
         }
         $12_1 = HEAP32[(((HEAP32[(HEAP32[($3_1 + 4 | 0) >> 2] | 0) >> 2] | 0) + Math_imul(HEAP32[($3_1 + 12 | 0) >> 2] | 0, 28) | 0) + 4 | 0) >> 2] | 0;
         break block14;
        }
        block16 : {
         block15 : {
          if (!(HEAP32[($3_1 + 20 | 0) >> 2] | 0)) {
           break block15
          }
          $13_1 = HEAP32[($3_1 + 12 | 0) >> 2] | 0;
          break block16;
         }
         $13_1 = -1;
        }
        $12_1 = $13_1;
       }
       $14_1 = $12_1;
       block18 : {
        block17 : {
         if (!((HEAP32[(((HEAP32[(HEAP32[($3_1 + 4 | 0) >> 2] | 0) >> 2] | 0) + Math_imul(HEAP32[($3_1 + 12 | 0) >> 2] | 0, 28) | 0) + 16 | 0) >> 2] | 0 | 0) != (-1 | 0) & 1 | 0)) {
          break block17
         }
         $15_1 = HEAP32[(((HEAP32[(HEAP32[($3_1 + 4 | 0) >> 2] | 0) >> 2] | 0) + Math_imul(HEAP32[($3_1 + 12 | 0) >> 2] | 0, 28) | 0) + 16 | 0) >> 2] | 0;
         break block18;
        }
        $15_1 = HEAP32[($3_1 + 20 | 0) >> 2] | 0 ? 1 : -1;
       }
       $17_1 = $15_1;
       block20 : {
        block19 : {
         if (!((HEAP32[(((HEAP32[(HEAP32[($3_1 + 4 | 0) >> 2] | 0) >> 2] | 0) + Math_imul(HEAP32[($3_1 + 12 | 0) >> 2] | 0, 28) | 0) + 20 | 0) >> 2] | 0 | 0) != (-1 | 0) & 1 | 0)) {
          break block19
         }
         $18_1 = HEAP32[(((HEAP32[(HEAP32[($3_1 + 4 | 0) >> 2] | 0) >> 2] | 0) + Math_imul(HEAP32[($3_1 + 12 | 0) >> 2] | 0, 28) | 0) + 20 | 0) >> 2] | 0;
         break block20;
        }
        $18_1 = HEAP32[($3_1 + 20 | 0) >> 2] | 0 ? 1 : -1;
       }
       $6($5_1 | 0, $6_1 | 0, $7_1 | 0, $9_1 | 0, $10_1 | 0, $11_1 | 0, $14_1 | 0, $17_1 | 0, $18_1 | 0, HEAP32[(((HEAP32[(HEAP32[($3_1 + 4 | 0) >> 2] | 0) >> 2] | 0) + Math_imul(HEAP32[($3_1 + 12 | 0) >> 2] | 0, 28) | 0) + 24 | 0) >> 2] | 0 | 0) | 0;
       block21 : {
        if ((HEAP32[(((HEAP32[($3_1 + 4 | 0) >> 2] | 0) + 4 | 0) + ((HEAP32[($3_1 + 12 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
         break block21
        }
        HEAP32[($3_1 + 8 | 0) >> 2] = (HEAP32[($3_1 + 8 | 0) >> 2] | 0) + 1 | 0;
       }
      }
     }
     HEAP32[($3_1 + 12 | 0) >> 2] = (HEAP32[($3_1 + 12 | 0) >> 2] | 0) + 1 | 0;
     continue label;
    };
   }
   HEAP32[($3_1 + 28 | 0) >> 2] = HEAP32[($3_1 + 8 | 0) >> 2] | 0;
  }
  $20_1 = HEAP32[($3_1 + 28 | 0) >> 2] | 0;
  global$0 = $3_1 + 32 | 0;
  return $20_1 | 0;
 }
 
 function $17($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, $2_1 = 0;
  $1_1 = global$0 - 16 | 0;
  global$0 = $1_1;
  HEAP32[($1_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($1_1 + 8 | 0) >> 2] = 128;
  block : {
   label : while (1) {
    $2_1 = HEAP32[($1_1 + 8 | 0) >> 2] | 0;
    HEAP32[($1_1 + 8 | 0) >> 2] = $2_1 + -1 | 0;
    if (!$2_1) {
     break block
    }
    block1 : {
     if (!((HEAP32[(((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 28 | 0) + ((HEAP32[($1_1 + 8 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
      break block1
     }
     $18(HEAP32[($1_1 + 12 | 0) >> 2] | 0 | 0, 0 | 0, HEAP32[($1_1 + 8 | 0) >> 2] | 0 | 0);
    }
    block2 : {
     if (!((HEAP32[(((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 540 | 0) + ((HEAP32[($1_1 + 8 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
      break block2
     }
     $18(HEAP32[($1_1 + 12 | 0) >> 2] | 0 | 0, 1 | 0, HEAP32[($1_1 + 8 | 0) >> 2] | 0 | 0);
    }
    continue label;
   };
  }
  global$0 = $1_1 + 16 | 0;
  return;
 }
 
 function $18($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, $4_1 = 0;
  $3_1 = global$0 - 32 | 0;
  global$0 = $3_1;
  HEAP32[($3_1 + 28 | 0) >> 2] = $0_1;
  HEAP32[($3_1 + 24 | 0) >> 2] = $1_1;
  HEAP32[($3_1 + 20 | 0) >> 2] = $2_1;
  block1 : {
   block : {
    if (!(HEAP32[($3_1 + 24 | 0) >> 2] | 0)) {
     break block
    }
    $4_1 = HEAP32[(((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 540 | 0) + ((HEAP32[($3_1 + 20 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0;
    break block1;
   }
   $4_1 = HEAP32[(((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 28 | 0) + ((HEAP32[($3_1 + 20 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0;
  }
  HEAP32[($3_1 + 12 | 0) >> 2] = $4_1;
  HEAP32[($3_1 + 16 | 0) >> 2] = 0;
  block2 : {
   label : while (1) {
    if (!((HEAP32[($3_1 + 16 | 0) >> 2] | 0 | 0) < (128 | 0) & 1 | 0)) {
     break block2
    }
    block3 : {
     if (!((HEAP32[(((HEAP32[($3_1 + 12 | 0) >> 2] | 0) + 4 | 0) + ((HEAP32[($3_1 + 16 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
      break block3
     }
     block4 : {
      if (!((HEAP32[(((HEAP32[($3_1 + 12 | 0) >> 2] | 0) + 4 | 0) + ((HEAP32[($3_1 + 16 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) != (-1 | 0) & 1 | 0)) {
       break block4
      }
      $14(HEAP32[(((HEAP32[($3_1 + 12 | 0) >> 2] | 0) + 4 | 0) + ((HEAP32[($3_1 + 16 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0);
     }
     HEAP32[(((HEAP32[($3_1 + 12 | 0) >> 2] | 0) + 4 | 0) + ((HEAP32[($3_1 + 16 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] = 0;
    }
    HEAP32[($3_1 + 16 | 0) >> 2] = (HEAP32[($3_1 + 16 | 0) >> 2] | 0) + 1 | 0;
    continue label;
   };
  }
  global$0 = $3_1 + 32 | 0;
  return;
 }
 
 function $19($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0, $6_1 = 0, $7_1 = 0, $8_1 = 0, $48_1 = 0;
  $2_1 = global$0 - 16 | 0;
  global$0 = $2_1;
  HEAP32[($2_1 + 8 | 0) >> 2] = $0_1;
  HEAP32[($2_1 + 4 | 0) >> 2] = $1_1;
  $6_1 = 0;
  $7_1 = -1;
  $6(HEAP32[($2_1 + 8 | 0) >> 2] | 0 | 0, HEAP32[($2_1 + 4 | 0) >> 2] | 0 | 0, (HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 1052 | 0 | 0, $6_1 | 0, $7_1 | 0, $7_1 | 0, $7_1 | 0, $6_1 | 0, $6_1 | 0, $6_1 | 0) | 0;
  block1 : {
   block : {
    if ((HEAP32[((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 1052 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
     break block
    }
    HEAP32[($2_1 + 12 | 0) >> 2] = -1;
    break block1;
   }
   HEAP32[((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 1056 | 0) >> 2] = -1;
   HEAP32[($2_1 + 12 | 0) >> 2] = 0;
  }
  $8_1 = HEAP32[($2_1 + 12 | 0) >> 2] | 0;
  global$0 = $2_1 + 16 | 0;
  return $8_1 | 0;
 }
 
 function $20($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0, $11_1 = 0, $247 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $2_1 = global$0 - 16 | 0;
  global$0 = $2_1;
  HEAP32[($2_1 + 8 | 0) >> 2] = $0_1;
  HEAP32[($2_1 + 4 | 0) >> 2] = $1_1;
  HEAP32[$2_1 >> 2] = HEAP32[((((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 4 | 0) >> 2] | 0, 236) | 0) + 220 | 0) >> 2] | 0;
  block1 : {
   block : {
    if (!((HEAP32[$2_1 >> 2] | 0 | 0) > (5 | 0) & 1 | 0)) {
     break block
    }
    HEAP8[(((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 4 | 0) >> 2] | 0, 236) | 0) >> 0] = 0;
    HEAP32[($2_1 + 12 | 0) >> 2] = 1;
    break block1;
   }
   block2 : {
    if (!((HEAPU8[((HEAP32[((((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 4 | 0) >> 2] | 0, 236) | 0) + 4 | 0) >> 2] | 0) + 102 | 0) >> 0] | 0) & 64 | 0)) {
     break block2
    }
    block4 : {
     block3 : {
      if ((HEAPU8[(((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 4 | 0) >> 2] | 0, 236) | 0) >> 0] | 0 | 0) == (1 | 0) & 1 | 0) {
       break block3
      }
      if (!((HEAPU8[(((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 4 | 0) >> 2] | 0, 236) | 0) >> 0] | 0 | 0) == (2 | 0) & 1 | 0)) {
       break block4
      }
     }
     block5 : {
      if (!((HEAP32[$2_1 >> 2] | 0 | 0) > (2 | 0) & 1 | 0)) {
       break block5
      }
      HEAP32[((((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 4 | 0) >> 2] | 0, 236) | 0) + 32 | 0) >> 2] = 0;
      HEAP32[($2_1 + 12 | 0) >> 2] = 0;
      break block1;
     }
    }
   }
   HEAP32[((((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 4 | 0) >> 2] | 0, 236) | 0) + 220 | 0) >> 2] = (HEAP32[$2_1 >> 2] | 0) + 1 | 0;
   block7 : {
    block6 : {
     if ((HEAP32[((((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 4 | 0) >> 2] | 0, 236) | 0) + 24 | 0) >> 2] | 0 | 0) == (HEAP32[(((HEAP32[((((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 4 | 0) >> 2] | 0, 236) | 0) + 4 | 0) >> 2] | 0) + 52 | 0) + ((HEAP32[$2_1 >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) & 1 | 0) {
      break block6
     }
     if (!((HEAP32[$2_1 >> 2] | 0 | 0) > (2 | 0) & 1 | 0)) {
      break block7
     }
     if (!((HEAP32[((((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 4 | 0) >> 2] | 0, 236) | 0) + 24 | 0) >> 2] | 0 | 0) < (HEAP32[(((HEAP32[((((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 4 | 0) >> 2] | 0, 236) | 0) + 4 | 0) >> 2] | 0) + 52 | 0) + ((HEAP32[$2_1 >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) & 1 | 0)) {
      break block7
     }
    }
    (wasm2js_i32$0 = $2_1, wasm2js_i32$1 = $20(HEAP32[($2_1 + 8 | 0) >> 2] | 0 | 0, HEAP32[($2_1 + 4 | 0) >> 2] | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 12 | 0) >> 2] = wasm2js_i32$1;
    break block1;
   }
   HEAP32[((((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 4 | 0) >> 2] | 0, 236) | 0) + 28 | 0) >> 2] = HEAP32[(((HEAP32[((((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 4 | 0) >> 2] | 0, 236) | 0) + 4 | 0) >> 2] | 0) + 52 | 0) + ((HEAP32[$2_1 >> 2] | 0) << 2 | 0) | 0) >> 2] | 0;
   HEAP32[((((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 4 | 0) >> 2] | 0, 236) | 0) + 32 | 0) >> 2] = HEAP32[(((HEAP32[((((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 4 | 0) >> 2] | 0, 236) | 0) + 4 | 0) >> 2] | 0) + 28 | 0) + ((HEAP32[$2_1 >> 2] | 0) << 2 | 0) | 0) >> 2] | 0;
   block8 : {
    if (!((HEAP32[((((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 4 | 0) >> 2] | 0, 236) | 0) + 28 | 0) >> 2] | 0 | 0) < (HEAP32[((((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 4 | 0) >> 2] | 0, 236) | 0) + 24 | 0) >> 2] | 0 | 0) & 1 | 0)) {
     break block8
    }
    HEAP32[((((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 4 | 0) >> 2] | 0, 236) | 0) + 32 | 0) >> 2] = 0 - (HEAP32[((((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 4 | 0) >> 2] | 0, 236) | 0) + 32 | 0) >> 2] | 0) | 0;
   }
   HEAP32[($2_1 + 12 | 0) >> 2] = 0;
  }
  $11_1 = HEAP32[($2_1 + 12 | 0) >> 2] | 0;
  global$0 = $2_1 + 16 | 0;
  return $11_1 | 0;
 }
 
 function $21($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0, $6_1 = 0, $8_1 = 0, $10_1 = 0, $12_1 = 0, $14_1 = 0, $19_1 = Math_fround(0), $160_1 = 0, $20_1 = Math_fround(0), $179_1 = 0, $21_1 = Math_fround(0), $268 = 0, $149_1 = 0, $168_1 = 0, $257 = 0;
  $2_1 = global$0 - 32 | 0;
  HEAP32[($2_1 + 28 | 0) >> 2] = $0_1;
  HEAP32[($2_1 + 24 | 0) >> 2] = $1_1;
  HEAPF32[($2_1 + 20 | 0) >> 2] = Math_fround(HEAPF32[((((HEAP32[($2_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 24 | 0) >> 2] | 0, 236) | 0) + 68 | 0) >> 2]);
  block5 : {
   block : {
    if (HEAP32[((((HEAP32[($2_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 24 | 0) >> 2] | 0, 236) | 0) + 232 | 0) >> 2] | 0) {
     break block
    }
    HEAPF32[($2_1 + 16 | 0) >> 2] = Math_fround(HEAPF32[((((HEAP32[($2_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 24 | 0) >> 2] | 0, 236) | 0) + 72 | 0) >> 2]);
    block1 : {
     if (!(HEAP32[((((HEAP32[($2_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 24 | 0) >> 2] | 0, 236) | 0) + 48 | 0) >> 2] | 0)) {
      break block1
     }
     HEAPF32[($2_1 + 20 | 0) >> 2] = Math_fround(Math_fround(HEAPF32[((((HEAP32[($2_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 24 | 0) >> 2] | 0, 236) | 0) + 76 | 0) >> 2]) * Math_fround(HEAPF32[($2_1 + 20 | 0) >> 2]));
     HEAPF32[($2_1 + 16 | 0) >> 2] = Math_fround(Math_fround(HEAPF32[((((HEAP32[($2_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 24 | 0) >> 2] | 0, 236) | 0) + 76 | 0) >> 2]) * Math_fround(HEAPF32[($2_1 + 16 | 0) >> 2]));
    }
    block2 : {
     if (!((HEAPU8[((HEAP32[((((HEAP32[($2_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 24 | 0) >> 2] | 0, 236) | 0) + 4 | 0) >> 2] | 0) + 102 | 0) >> 0] | 0) & 64 | 0)) {
      break block2
     }
     $6_1 = 236;
     $8_1 = 1748;
     $10_1 = 23;
     $12_1 = 3;
     $14_1 = 66368;
     HEAPF32[($2_1 + 20 | 0) >> 2] = Math_fround(Math_fround(+HEAPF64[($14_1 + (((HEAP32[(((HEAP32[($2_1 + 28 | 0) >> 2] | 0) + Math_imul(HEAP32[($2_1 + 24 | 0) >> 2] | 0, $6_1) | 0) + $8_1 | 0) >> 2] | 0) >> $10_1 | 0) << $12_1 | 0) | 0) >> 3]) * Math_fround(HEAPF32[($2_1 + 20 | 0) >> 2]));
     HEAPF32[($2_1 + 16 | 0) >> 2] = Math_fround(Math_fround(+HEAPF64[($14_1 + (((HEAP32[($8_1 + ((HEAP32[($2_1 + 28 | 0) >> 2] | 0) + Math_imul($6_1, HEAP32[($2_1 + 24 | 0) >> 2] | 0) | 0) | 0) >> 2] | 0) >> $10_1 | 0) << $12_1 | 0) | 0) >> 3]) * Math_fround(HEAPF32[($2_1 + 16 | 0) >> 2]));
    }
    $149_1 = $2_1;
    $19_1 = Math_fround(+Math_fround(HEAPF32[($2_1 + 20 | 0) >> 2]) * 4096.0);
    if (Math_fround(Math_abs($19_1)) < Math_fround(2147483648.0)) {
     $160_1 = ~~$19_1
    } else {
     $160_1 = -2147483648
    }
    HEAP32[($149_1 + 12 | 0) >> 2] = $160_1;
    block3 : {
     if (!((HEAP32[($2_1 + 12 | 0) >> 2] | 0 | 0) > (8191 | 0) & 1 | 0)) {
      break block3
     }
     HEAP32[($2_1 + 12 | 0) >> 2] = 8191;
    }
    $168_1 = $2_1;
    $20_1 = Math_fround(+Math_fround(HEAPF32[($2_1 + 16 | 0) >> 2]) * 4096.0);
    if (Math_fround(Math_abs($20_1)) < Math_fround(2147483648.0)) {
     $179_1 = ~~$20_1
    } else {
     $179_1 = -2147483648
    }
    HEAP32[($168_1 + 8 | 0) >> 2] = $179_1;
    block4 : {
     if (!((HEAP32[($2_1 + 8 | 0) >> 2] | 0 | 0) > (8191 | 0) & 1 | 0)) {
      break block4
     }
     HEAP32[($2_1 + 8 | 0) >> 2] = 8191;
    }
    HEAP32[((((HEAP32[($2_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 24 | 0) >> 2] | 0, 236) | 0) + 60 | 0) >> 2] = HEAP32[($2_1 + 12 | 0) >> 2] | 0;
    HEAP32[((((HEAP32[($2_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 24 | 0) >> 2] | 0, 236) | 0) + 64 | 0) >> 2] = HEAP32[($2_1 + 8 | 0) >> 2] | 0;
    break block5;
   }
   block6 : {
    if (!(HEAP32[((((HEAP32[($2_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 24 | 0) >> 2] | 0, 236) | 0) + 48 | 0) >> 2] | 0)) {
     break block6
    }
    HEAPF32[($2_1 + 20 | 0) >> 2] = Math_fround(Math_fround(HEAPF32[((((HEAP32[($2_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 24 | 0) >> 2] | 0, 236) | 0) + 76 | 0) >> 2]) * Math_fround(HEAPF32[($2_1 + 20 | 0) >> 2]));
   }
   block7 : {
    if (!((HEAPU8[((HEAP32[((((HEAP32[($2_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 24 | 0) >> 2] | 0, 236) | 0) + 4 | 0) >> 2] | 0) + 102 | 0) >> 0] | 0) & 64 | 0)) {
     break block7
    }
    HEAPF32[($2_1 + 20 | 0) >> 2] = Math_fround(Math_fround(+HEAPF64[((((HEAP32[(((HEAP32[($2_1 + 28 | 0) >> 2] | 0) + Math_imul(HEAP32[($2_1 + 24 | 0) >> 2] | 0, 236) | 0) + 1748 | 0) >> 2] | 0) >> 23 | 0) << 3 | 0) + 66368 | 0) >> 3]) * Math_fround(HEAPF32[($2_1 + 20 | 0) >> 2]));
   }
   $257 = $2_1;
   $21_1 = Math_fround(+Math_fround(HEAPF32[($2_1 + 20 | 0) >> 2]) * 4096.0);
   if (Math_fround(Math_abs($21_1)) < Math_fround(2147483648.0)) {
    $268 = ~~$21_1
   } else {
    $268 = -2147483648
   }
   HEAP32[($257 + 12 | 0) >> 2] = $268;
   block8 : {
    if (!((HEAP32[($2_1 + 12 | 0) >> 2] | 0 | 0) > (8191 | 0) & 1 | 0)) {
     break block8
    }
    HEAP32[($2_1 + 12 | 0) >> 2] = 8191;
   }
   HEAP32[((((HEAP32[($2_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 24 | 0) >> 2] | 0, 236) | 0) + 60 | 0) >> 2] = HEAP32[($2_1 + 12 | 0) >> 2] | 0;
  }
  return;
 }
 
 function $22($0_1, $1_1, $2_1, $3_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  var $4_1 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $4_1 = global$0 - 32 | 0;
  global$0 = $4_1;
  HEAP32[($4_1 + 28 | 0) >> 2] = $0_1;
  HEAP32[($4_1 + 24 | 0) >> 2] = $1_1;
  HEAP32[($4_1 + 20 | 0) >> 2] = $2_1;
  HEAP32[($4_1 + 16 | 0) >> 2] = $3_1;
  HEAP32[($4_1 + 12 | 0) >> 2] = ((HEAP32[($4_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($4_1 + 20 | 0) >> 2] | 0, 236) | 0;
  block3 : {
   block : {
    if (!((HEAPU8[(HEAP32[($4_1 + 12 | 0) >> 2] | 0) >> 0] | 0 | 0) == (4 | 0) & 1 | 0)) {
     break block
    }
    block1 : {
     if (!((HEAP32[($4_1 + 16 | 0) >> 2] | 0 | 0) >= (20 | 0) & 1 | 0)) {
      break block1
     }
     HEAP32[($4_1 + 16 | 0) >> 2] = 20;
    }
    (wasm2js_i32$0 = $4_1, wasm2js_i32$1 = $119(HEAP32[($4_1 + 28 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 20 | 0) >> 2] | 0 | 0, $4_1 + 16 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 8 | 0) >> 2] = wasm2js_i32$1;
    block2 : {
     if (!((HEAP32[($4_1 + 16 | 0) >> 2] | 0 | 0) > (0 | 0) & 1 | 0)) {
      break block2
     }
     $23(HEAP32[($4_1 + 28 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 8 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 24 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 20 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 16 | 0) >> 2] | 0 | 0);
    }
    HEAP8[(HEAP32[($4_1 + 12 | 0) >> 2] | 0) >> 0] = 0;
    break block3;
   }
   (wasm2js_i32$0 = $4_1, wasm2js_i32$1 = $119(HEAP32[($4_1 + 28 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 20 | 0) >> 2] | 0 | 0, $4_1 + 16 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 8 | 0) >> 2] = wasm2js_i32$1;
   block8 : {
    block4 : {
     if (!((HEAP32[((HEAP32[($4_1 + 28 | 0) >> 2] | 0) + 12 | 0) >> 2] | 0) & 1 | 0)) {
      break block4
     }
     block7 : {
      block6 : {
       block5 : {
        if (HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 32 | 0) >> 2] | 0) {
         break block5
        }
        if (!(HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 48 | 0) >> 2] | 0)) {
         break block6
        }
       }
       $24(HEAP32[($4_1 + 28 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 8 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 24 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 20 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 16 | 0) >> 2] | 0 | 0);
       break block7;
      }
      $25(HEAP32[($4_1 + 28 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 8 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 24 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 20 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 16 | 0) >> 2] | 0 | 0);
     }
     break block8;
    }
    block13 : {
     block9 : {
      if (HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 232 | 0) >> 2] | 0) {
       break block9
      }
      block12 : {
       block11 : {
        block10 : {
         if (HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 32 | 0) >> 2] | 0) {
          break block10
         }
         if (!(HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 48 | 0) >> 2] | 0)) {
          break block11
         }
        }
        $26(HEAP32[($4_1 + 28 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 8 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 24 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 20 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 16 | 0) >> 2] | 0 | 0);
        break block12;
       }
       $27(HEAP32[($4_1 + 28 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 8 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 24 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 20 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 16 | 0) >> 2] | 0 | 0);
      }
      break block13;
     }
     block18 : {
      block14 : {
       if (!((HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 232 | 0) >> 2] | 0 | 0) == (3 | 0) & 1 | 0)) {
        break block14
       }
       block17 : {
        block16 : {
         block15 : {
          if (HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 32 | 0) >> 2] | 0) {
           break block15
          }
          if (!(HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 48 | 0) >> 2] | 0)) {
           break block16
          }
         }
         $28(HEAP32[($4_1 + 28 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 8 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 24 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 20 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 16 | 0) >> 2] | 0 | 0);
         break block17;
        }
        $29(HEAP32[($4_1 + 28 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 8 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 24 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 20 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 16 | 0) >> 2] | 0 | 0);
       }
       break block18;
      }
      block19 : {
       if (!((HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 232 | 0) >> 2] | 0 | 0) == (2 | 0) & 1 | 0)) {
        break block19
       }
       HEAP32[($4_1 + 24 | 0) >> 2] = (HEAP32[($4_1 + 24 | 0) >> 2] | 0) + 4 | 0;
      }
      block22 : {
       block21 : {
        block20 : {
         if (HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 32 | 0) >> 2] | 0) {
          break block20
         }
         if (!(HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 48 | 0) >> 2] | 0)) {
          break block21
         }
        }
        $30(HEAP32[($4_1 + 28 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 8 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 24 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 20 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 16 | 0) >> 2] | 0 | 0);
        break block22;
       }
       $31(HEAP32[($4_1 + 28 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 8 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 24 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 20 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 16 | 0) >> 2] | 0 | 0);
      }
     }
    }
   }
  }
  global$0 = $4_1 + 32 | 0;
  return;
 }
 
 function $23($0_1, $1_1, $2_1, $3_1, $4_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  $4_1 = $4_1 | 0;
  var $5_1 = 0, $11_1 = 0, $13_1 = 0, $17_1 = 0, $19_1 = 0, $23_1 = 0, $27_1 = 0, $31_1 = 0, $8_1 = 0, $9_1 = 0, $14_1 = 0, $15_1 = 0, $20_1 = 0, $21_1 = 0, $24_1 = 0, $25_1 = 0, $28_1 = 0, $29_1 = 0, $10_1 = 0, $12_1 = 0, $16_1 = 0, $18_1 = 0, $22_1 = 0, $26_1 = 0, $30_1 = 0;
  $5_1 = global$0 - 48 | 0;
  HEAP32[($5_1 + 44 | 0) >> 2] = $0_1;
  HEAP32[($5_1 + 40 | 0) >> 2] = $1_1;
  HEAP32[($5_1 + 36 | 0) >> 2] = $2_1;
  HEAP32[($5_1 + 32 | 0) >> 2] = $3_1;
  HEAP32[($5_1 + 28 | 0) >> 2] = $4_1;
  HEAP16[($5_1 + 10 | 0) >> 1] = 0;
  HEAP32[($5_1 + 24 | 0) >> 2] = HEAP32[((((HEAP32[($5_1 + 44 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($5_1 + 32 | 0) >> 2] | 0, 236) | 0) + 60 | 0) >> 2] | 0;
  HEAP32[($5_1 + 16 | 0) >> 2] = 0 - ((HEAP32[($5_1 + 24 | 0) >> 2] | 0 | 0) / (HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0) | 0) | 0;
  block : {
   if (HEAP32[($5_1 + 16 | 0) >> 2] | 0) {
    break block
   }
   HEAP32[($5_1 + 16 | 0) >> 2] = -1;
  }
  block10 : {
   block1 : {
    if ((HEAP32[((HEAP32[($5_1 + 44 | 0) >> 2] | 0) + 12 | 0) >> 2] | 0) & 1 | 0) {
     break block1
    }
    block6 : {
     block2 : {
      if (HEAP32[((((HEAP32[($5_1 + 44 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($5_1 + 32 | 0) >> 2] | 0, 236) | 0) + 232 | 0) >> 2] | 0) {
       break block2
      }
      HEAP32[($5_1 + 20 | 0) >> 2] = HEAP32[((((HEAP32[($5_1 + 44 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($5_1 + 32 | 0) >> 2] | 0, 236) | 0) + 64 | 0) >> 2] | 0;
      HEAP32[($5_1 + 12 | 0) >> 2] = 0 - ((HEAP32[($5_1 + 20 | 0) >> 2] | 0 | 0) / (HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0) | 0) | 0;
      block3 : {
       label : while (1) {
        $8_1 = HEAP32[($5_1 + 28 | 0) >> 2] | 0;
        HEAP32[($5_1 + 28 | 0) >> 2] = $8_1 + -1 | 0;
        if (!$8_1) {
         break block3
        }
        HEAP32[($5_1 + 24 | 0) >> 2] = (HEAP32[($5_1 + 16 | 0) >> 2] | 0) + (HEAP32[($5_1 + 24 | 0) >> 2] | 0) | 0;
        block4 : {
         if (!((HEAP32[($5_1 + 24 | 0) >> 2] | 0 | 0) < (0 | 0) & 1 | 0)) {
          break block4
         }
         HEAP32[($5_1 + 24 | 0) >> 2] = 0;
        }
        HEAP32[($5_1 + 20 | 0) >> 2] = (HEAP32[($5_1 + 12 | 0) >> 2] | 0) + (HEAP32[($5_1 + 20 | 0) >> 2] | 0) | 0;
        block5 : {
         if (!((HEAP32[($5_1 + 20 | 0) >> 2] | 0 | 0) < (0 | 0) & 1 | 0)) {
          break block5
         }
         HEAP32[($5_1 + 20 | 0) >> 2] = 0;
        }
        $9_1 = HEAP32[($5_1 + 40 | 0) >> 2] | 0;
        HEAP32[($5_1 + 40 | 0) >> 2] = $9_1 + 2 | 0;
        HEAP16[($5_1 + 10 | 0) >> 1] = HEAPU16[$9_1 >> 1] | 0;
        $10_1 = Math_imul(HEAP32[($5_1 + 24 | 0) >> 2] | 0, HEAP16[($5_1 + 10 | 0) >> 1] | 0);
        $11_1 = HEAP32[($5_1 + 36 | 0) >> 2] | 0;
        HEAP32[($5_1 + 36 | 0) >> 2] = $11_1 + 4 | 0;
        HEAP32[$11_1 >> 2] = $10_1 + (HEAP32[$11_1 >> 2] | 0) | 0;
        $12_1 = Math_imul(HEAP32[($5_1 + 20 | 0) >> 2] | 0, HEAP16[($5_1 + 10 | 0) >> 1] | 0);
        $13_1 = HEAP32[($5_1 + 36 | 0) >> 2] | 0;
        HEAP32[($5_1 + 36 | 0) >> 2] = $13_1 + 4 | 0;
        HEAP32[$13_1 >> 2] = $12_1 + (HEAP32[$13_1 >> 2] | 0) | 0;
        continue label;
       };
      }
      break block6;
     }
     block11 : {
      block7 : {
       if (!((HEAP32[((((HEAP32[($5_1 + 44 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($5_1 + 32 | 0) >> 2] | 0, 236) | 0) + 232 | 0) >> 2] | 0 | 0) == (3 | 0) & 1 | 0)) {
        break block7
       }
       block8 : {
        label1 : while (1) {
         $14_1 = HEAP32[($5_1 + 28 | 0) >> 2] | 0;
         HEAP32[($5_1 + 28 | 0) >> 2] = $14_1 + -1 | 0;
         if (!$14_1) {
          break block8
         }
         HEAP32[($5_1 + 24 | 0) >> 2] = (HEAP32[($5_1 + 16 | 0) >> 2] | 0) + (HEAP32[($5_1 + 24 | 0) >> 2] | 0) | 0;
         block9 : {
          if (!((HEAP32[($5_1 + 24 | 0) >> 2] | 0 | 0) < (0 | 0) & 1 | 0)) {
           break block9
          }
          break block10;
         }
         $15_1 = HEAP32[($5_1 + 40 | 0) >> 2] | 0;
         HEAP32[($5_1 + 40 | 0) >> 2] = $15_1 + 2 | 0;
         HEAP16[($5_1 + 10 | 0) >> 1] = HEAPU16[$15_1 >> 1] | 0;
         $16_1 = Math_imul(HEAP32[($5_1 + 24 | 0) >> 2] | 0, HEAP16[($5_1 + 10 | 0) >> 1] | 0);
         $17_1 = HEAP32[($5_1 + 36 | 0) >> 2] | 0;
         HEAP32[($5_1 + 36 | 0) >> 2] = $17_1 + 4 | 0;
         HEAP32[$17_1 >> 2] = $16_1 + (HEAP32[$17_1 >> 2] | 0) | 0;
         $18_1 = Math_imul(HEAP32[($5_1 + 24 | 0) >> 2] | 0, HEAP16[($5_1 + 10 | 0) >> 1] | 0);
         $19_1 = HEAP32[($5_1 + 36 | 0) >> 2] | 0;
         HEAP32[($5_1 + 36 | 0) >> 2] = $19_1 + 4 | 0;
         HEAP32[$19_1 >> 2] = $18_1 + (HEAP32[$19_1 >> 2] | 0) | 0;
         continue label1;
        };
       }
       break block11;
      }
      block15 : {
       block12 : {
        if (!((HEAP32[((((HEAP32[($5_1 + 44 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($5_1 + 32 | 0) >> 2] | 0, 236) | 0) + 232 | 0) >> 2] | 0 | 0) == (1 | 0) & 1 | 0)) {
         break block12
        }
        block13 : {
         label2 : while (1) {
          $20_1 = HEAP32[($5_1 + 28 | 0) >> 2] | 0;
          HEAP32[($5_1 + 28 | 0) >> 2] = $20_1 + -1 | 0;
          if (!$20_1) {
           break block13
          }
          HEAP32[($5_1 + 24 | 0) >> 2] = (HEAP32[($5_1 + 16 | 0) >> 2] | 0) + (HEAP32[($5_1 + 24 | 0) >> 2] | 0) | 0;
          block14 : {
           if (!((HEAP32[($5_1 + 24 | 0) >> 2] | 0 | 0) < (0 | 0) & 1 | 0)) {
            break block14
           }
           break block10;
          }
          $21_1 = HEAP32[($5_1 + 40 | 0) >> 2] | 0;
          HEAP32[($5_1 + 40 | 0) >> 2] = $21_1 + 2 | 0;
          HEAP16[($5_1 + 10 | 0) >> 1] = HEAPU16[$21_1 >> 1] | 0;
          $22_1 = Math_imul(HEAP32[($5_1 + 24 | 0) >> 2] | 0, HEAP16[($5_1 + 10 | 0) >> 1] | 0);
          $23_1 = HEAP32[($5_1 + 36 | 0) >> 2] | 0;
          HEAP32[($5_1 + 36 | 0) >> 2] = $23_1 + 4 | 0;
          HEAP32[$23_1 >> 2] = $22_1 + (HEAP32[$23_1 >> 2] | 0) | 0;
          HEAP32[($5_1 + 36 | 0) >> 2] = (HEAP32[($5_1 + 36 | 0) >> 2] | 0) + 4 | 0;
          continue label2;
         };
        }
        break block15;
       }
       block16 : {
        if (!((HEAP32[((((HEAP32[($5_1 + 44 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($5_1 + 32 | 0) >> 2] | 0, 236) | 0) + 232 | 0) >> 2] | 0 | 0) == (2 | 0) & 1 | 0)) {
         break block16
        }
        block17 : {
         label3 : while (1) {
          $24_1 = HEAP32[($5_1 + 28 | 0) >> 2] | 0;
          HEAP32[($5_1 + 28 | 0) >> 2] = $24_1 + -1 | 0;
          if (!$24_1) {
           break block17
          }
          HEAP32[($5_1 + 24 | 0) >> 2] = (HEAP32[($5_1 + 16 | 0) >> 2] | 0) + (HEAP32[($5_1 + 24 | 0) >> 2] | 0) | 0;
          block18 : {
           if (!((HEAP32[($5_1 + 24 | 0) >> 2] | 0 | 0) < (0 | 0) & 1 | 0)) {
            break block18
           }
           break block10;
          }
          $25_1 = HEAP32[($5_1 + 40 | 0) >> 2] | 0;
          HEAP32[($5_1 + 40 | 0) >> 2] = $25_1 + 2 | 0;
          HEAP16[($5_1 + 10 | 0) >> 1] = HEAPU16[$25_1 >> 1] | 0;
          HEAP32[($5_1 + 36 | 0) >> 2] = (HEAP32[($5_1 + 36 | 0) >> 2] | 0) + 4 | 0;
          $26_1 = Math_imul(HEAP32[($5_1 + 24 | 0) >> 2] | 0, HEAP16[($5_1 + 10 | 0) >> 1] | 0);
          $27_1 = HEAP32[($5_1 + 36 | 0) >> 2] | 0;
          HEAP32[($5_1 + 36 | 0) >> 2] = $27_1 + 4 | 0;
          HEAP32[$27_1 >> 2] = $26_1 + (HEAP32[$27_1 >> 2] | 0) | 0;
          continue label3;
         };
        }
       }
      }
     }
    }
    break block10;
   }
   block19 : {
    label4 : while (1) {
     $28_1 = HEAP32[($5_1 + 28 | 0) >> 2] | 0;
     HEAP32[($5_1 + 28 | 0) >> 2] = $28_1 + -1 | 0;
     if (!$28_1) {
      break block19
     }
     HEAP32[($5_1 + 24 | 0) >> 2] = (HEAP32[($5_1 + 16 | 0) >> 2] | 0) + (HEAP32[($5_1 + 24 | 0) >> 2] | 0) | 0;
     block20 : {
      if (!((HEAP32[($5_1 + 24 | 0) >> 2] | 0 | 0) < (0 | 0) & 1 | 0)) {
       break block20
      }
      break block10;
     }
     $29_1 = HEAP32[($5_1 + 40 | 0) >> 2] | 0;
     HEAP32[($5_1 + 40 | 0) >> 2] = $29_1 + 2 | 0;
     HEAP16[($5_1 + 10 | 0) >> 1] = HEAPU16[$29_1 >> 1] | 0;
     $30_1 = Math_imul(HEAP32[($5_1 + 24 | 0) >> 2] | 0, HEAP16[($5_1 + 10 | 0) >> 1] | 0);
     $31_1 = HEAP32[($5_1 + 36 | 0) >> 2] | 0;
     HEAP32[($5_1 + 36 | 0) >> 2] = $31_1 + 4 | 0;
     HEAP32[$31_1 >> 2] = $30_1 + (HEAP32[$31_1 >> 2] | 0) | 0;
     continue label4;
    };
   }
  }
  return;
 }
 
 function $24($0_1, $1_1, $2_1, $3_1, $4_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  $4_1 = $4_1 | 0;
  var $5_1 = 0, $11_1 = 0, $16_1 = 0, $6_1 = 0, $8_1 = 0, $9_1 = 0, $13_1 = 0, $14_1 = 0, $10_1 = 0, $15_1 = 0;
  $5_1 = global$0 - 48 | 0;
  global$0 = $5_1;
  HEAP32[($5_1 + 44 | 0) >> 2] = $0_1;
  HEAP32[($5_1 + 40 | 0) >> 2] = $1_1;
  HEAP32[($5_1 + 36 | 0) >> 2] = $2_1;
  HEAP32[($5_1 + 32 | 0) >> 2] = $3_1;
  HEAP32[($5_1 + 28 | 0) >> 2] = $4_1;
  HEAP32[($5_1 + 24 | 0) >> 2] = ((HEAP32[($5_1 + 44 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($5_1 + 32 | 0) >> 2] | 0, 236) | 0;
  HEAP32[($5_1 + 20 | 0) >> 2] = HEAP32[((HEAP32[($5_1 + 24 | 0) >> 2] | 0) + 60 | 0) >> 2] | 0;
  $6_1 = HEAP32[((HEAP32[($5_1 + 24 | 0) >> 2] | 0) + 224 | 0) >> 2] | 0;
  HEAP32[($5_1 + 16 | 0) >> 2] = $6_1;
  block2 : {
   block : {
    if ($6_1) {
     break block
    }
    HEAP32[($5_1 + 16 | 0) >> 2] = HEAP32[((HEAP32[($5_1 + 44 | 0) >> 2] | 0) + 13060 | 0) >> 2] | 0;
    block1 : {
     if (!($32(HEAP32[($5_1 + 44 | 0) >> 2] | 0 | 0, HEAP32[($5_1 + 32 | 0) >> 2] | 0 | 0) | 0)) {
      break block1
     }
     break block2;
    }
    HEAP32[($5_1 + 20 | 0) >> 2] = HEAP32[((HEAP32[($5_1 + 24 | 0) >> 2] | 0) + 60 | 0) >> 2] | 0;
   }
   label2 : while (1) {
    if (!(HEAP32[($5_1 + 28 | 0) >> 2] | 0)) {
     break block2
    }
    block6 : {
     block3 : {
      if (!((HEAP32[($5_1 + 16 | 0) >> 2] | 0 | 0) < (HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0) & 1 | 0)) {
       break block3
      }
      HEAP32[($5_1 + 28 | 0) >> 2] = (HEAP32[($5_1 + 28 | 0) >> 2] | 0) - (HEAP32[($5_1 + 16 | 0) >> 2] | 0) | 0;
      block4 : {
       label : while (1) {
        $8_1 = HEAP32[($5_1 + 16 | 0) >> 2] | 0;
        HEAP32[($5_1 + 16 | 0) >> 2] = $8_1 + -1 | 0;
        if (!$8_1) {
         break block4
        }
        $9_1 = HEAP32[($5_1 + 40 | 0) >> 2] | 0;
        HEAP32[($5_1 + 40 | 0) >> 2] = $9_1 + 2 | 0;
        HEAP16[($5_1 + 14 | 0) >> 1] = HEAPU16[$9_1 >> 1] | 0;
        $10_1 = Math_imul(HEAP32[($5_1 + 20 | 0) >> 2] | 0, HEAP16[($5_1 + 14 | 0) >> 1] | 0);
        $11_1 = HEAP32[($5_1 + 36 | 0) >> 2] | 0;
        HEAP32[($5_1 + 36 | 0) >> 2] = $11_1 + 4 | 0;
        HEAP32[$11_1 >> 2] = $10_1 + (HEAP32[$11_1 >> 2] | 0) | 0;
        continue label;
       };
      }
      HEAP32[($5_1 + 16 | 0) >> 2] = HEAP32[((HEAP32[($5_1 + 44 | 0) >> 2] | 0) + 13060 | 0) >> 2] | 0;
      block5 : {
       if (!($32(HEAP32[($5_1 + 44 | 0) >> 2] | 0 | 0, HEAP32[($5_1 + 32 | 0) >> 2] | 0 | 0) | 0)) {
        break block5
       }
       break block2;
      }
      HEAP32[($5_1 + 20 | 0) >> 2] = HEAP32[((HEAP32[($5_1 + 24 | 0) >> 2] | 0) + 60 | 0) >> 2] | 0;
      break block6;
     }
     HEAP32[((HEAP32[($5_1 + 24 | 0) >> 2] | 0) + 224 | 0) >> 2] = (HEAP32[($5_1 + 16 | 0) >> 2] | 0) - (HEAP32[($5_1 + 28 | 0) >> 2] | 0) | 0;
     block7 : {
      label1 : while (1) {
       $13_1 = HEAP32[($5_1 + 28 | 0) >> 2] | 0;
       HEAP32[($5_1 + 28 | 0) >> 2] = $13_1 + -1 | 0;
       if (!$13_1) {
        break block7
       }
       $14_1 = HEAP32[($5_1 + 40 | 0) >> 2] | 0;
       HEAP32[($5_1 + 40 | 0) >> 2] = $14_1 + 2 | 0;
       HEAP16[($5_1 + 14 | 0) >> 1] = HEAPU16[$14_1 >> 1] | 0;
       $15_1 = Math_imul(HEAP32[($5_1 + 20 | 0) >> 2] | 0, HEAP16[($5_1 + 14 | 0) >> 1] | 0);
       $16_1 = HEAP32[($5_1 + 36 | 0) >> 2] | 0;
       HEAP32[($5_1 + 36 | 0) >> 2] = $16_1 + 4 | 0;
       HEAP32[$16_1 >> 2] = $15_1 + (HEAP32[$16_1 >> 2] | 0) | 0;
       continue label1;
      };
     }
     break block2;
    }
    continue label2;
   };
  }
  global$0 = $5_1 + 48 | 0;
  return;
 }
 
 function $25($0_1, $1_1, $2_1, $3_1, $4_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  $4_1 = $4_1 | 0;
  var $5_1 = 0, $9_1 = 0, $6_1 = 0, $7_1 = 0, $8_1 = 0;
  $5_1 = global$0 - 32 | 0;
  HEAP32[($5_1 + 28 | 0) >> 2] = $0_1;
  HEAP32[($5_1 + 24 | 0) >> 2] = $1_1;
  HEAP32[($5_1 + 20 | 0) >> 2] = $2_1;
  HEAP32[($5_1 + 16 | 0) >> 2] = $3_1;
  HEAP32[($5_1 + 12 | 0) >> 2] = $4_1;
  HEAP32[($5_1 + 8 | 0) >> 2] = HEAP32[((((HEAP32[($5_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($5_1 + 16 | 0) >> 2] | 0, 236) | 0) + 60 | 0) >> 2] | 0;
  block : {
   label : while (1) {
    $6_1 = HEAP32[($5_1 + 12 | 0) >> 2] | 0;
    HEAP32[($5_1 + 12 | 0) >> 2] = $6_1 + -1 | 0;
    if (!$6_1) {
     break block
    }
    $7_1 = HEAP32[($5_1 + 24 | 0) >> 2] | 0;
    HEAP32[($5_1 + 24 | 0) >> 2] = $7_1 + 2 | 0;
    HEAP16[($5_1 + 6 | 0) >> 1] = HEAPU16[$7_1 >> 1] | 0;
    $8_1 = Math_imul(HEAP32[($5_1 + 8 | 0) >> 2] | 0, HEAP16[($5_1 + 6 | 0) >> 1] | 0);
    $9_1 = HEAP32[($5_1 + 20 | 0) >> 2] | 0;
    HEAP32[($5_1 + 20 | 0) >> 2] = $9_1 + 4 | 0;
    HEAP32[$9_1 >> 2] = $8_1 + (HEAP32[$9_1 >> 2] | 0) | 0;
    continue label;
   };
  }
  return;
 }
 
 function $26($0_1, $1_1, $2_1, $3_1, $4_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  $4_1 = $4_1 | 0;
  var $5_1 = 0, $11_1 = 0, $13_1 = 0, $18_1 = 0, $20_1 = 0, $6_1 = 0, $8_1 = 0, $9_1 = 0, $15_1 = 0, $16_1 = 0, $10_1 = 0, $12_1 = 0, $17_1 = 0, $19_1 = 0;
  $5_1 = global$0 - 48 | 0;
  global$0 = $5_1;
  HEAP32[($5_1 + 44 | 0) >> 2] = $0_1;
  HEAP32[($5_1 + 40 | 0) >> 2] = $1_1;
  HEAP32[($5_1 + 36 | 0) >> 2] = $2_1;
  HEAP32[($5_1 + 32 | 0) >> 2] = $3_1;
  HEAP32[($5_1 + 28 | 0) >> 2] = $4_1;
  HEAP32[($5_1 + 24 | 0) >> 2] = ((HEAP32[($5_1 + 44 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($5_1 + 32 | 0) >> 2] | 0, 236) | 0;
  HEAP32[($5_1 + 20 | 0) >> 2] = HEAP32[((HEAP32[($5_1 + 24 | 0) >> 2] | 0) + 60 | 0) >> 2] | 0;
  HEAP32[($5_1 + 16 | 0) >> 2] = HEAP32[((HEAP32[($5_1 + 24 | 0) >> 2] | 0) + 64 | 0) >> 2] | 0;
  $6_1 = HEAP32[((HEAP32[($5_1 + 24 | 0) >> 2] | 0) + 224 | 0) >> 2] | 0;
  HEAP32[($5_1 + 12 | 0) >> 2] = $6_1;
  block2 : {
   block : {
    if ($6_1) {
     break block
    }
    HEAP32[($5_1 + 12 | 0) >> 2] = HEAP32[((HEAP32[($5_1 + 44 | 0) >> 2] | 0) + 13060 | 0) >> 2] | 0;
    block1 : {
     if (!($32(HEAP32[($5_1 + 44 | 0) >> 2] | 0 | 0, HEAP32[($5_1 + 32 | 0) >> 2] | 0 | 0) | 0)) {
      break block1
     }
     break block2;
    }
    HEAP32[($5_1 + 20 | 0) >> 2] = HEAP32[((HEAP32[($5_1 + 24 | 0) >> 2] | 0) + 60 | 0) >> 2] | 0;
    HEAP32[($5_1 + 16 | 0) >> 2] = HEAP32[((HEAP32[($5_1 + 24 | 0) >> 2] | 0) + 64 | 0) >> 2] | 0;
   }
   label2 : while (1) {
    if (!(HEAP32[($5_1 + 28 | 0) >> 2] | 0)) {
     break block2
    }
    block6 : {
     block3 : {
      if (!((HEAP32[($5_1 + 12 | 0) >> 2] | 0 | 0) < (HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0) & 1 | 0)) {
       break block3
      }
      HEAP32[($5_1 + 28 | 0) >> 2] = (HEAP32[($5_1 + 28 | 0) >> 2] | 0) - (HEAP32[($5_1 + 12 | 0) >> 2] | 0) | 0;
      block4 : {
       label : while (1) {
        $8_1 = HEAP32[($5_1 + 12 | 0) >> 2] | 0;
        HEAP32[($5_1 + 12 | 0) >> 2] = $8_1 + -1 | 0;
        if (!$8_1) {
         break block4
        }
        $9_1 = HEAP32[($5_1 + 40 | 0) >> 2] | 0;
        HEAP32[($5_1 + 40 | 0) >> 2] = $9_1 + 2 | 0;
        HEAP16[($5_1 + 10 | 0) >> 1] = HEAPU16[$9_1 >> 1] | 0;
        $10_1 = Math_imul(HEAP32[($5_1 + 20 | 0) >> 2] | 0, HEAP16[($5_1 + 10 | 0) >> 1] | 0);
        $11_1 = HEAP32[($5_1 + 36 | 0) >> 2] | 0;
        HEAP32[($5_1 + 36 | 0) >> 2] = $11_1 + 4 | 0;
        HEAP32[$11_1 >> 2] = $10_1 + (HEAP32[$11_1 >> 2] | 0) | 0;
        $12_1 = Math_imul(HEAP32[($5_1 + 16 | 0) >> 2] | 0, HEAP16[($5_1 + 10 | 0) >> 1] | 0);
        $13_1 = HEAP32[($5_1 + 36 | 0) >> 2] | 0;
        HEAP32[($5_1 + 36 | 0) >> 2] = $13_1 + 4 | 0;
        HEAP32[$13_1 >> 2] = $12_1 + (HEAP32[$13_1 >> 2] | 0) | 0;
        continue label;
       };
      }
      HEAP32[($5_1 + 12 | 0) >> 2] = HEAP32[((HEAP32[($5_1 + 44 | 0) >> 2] | 0) + 13060 | 0) >> 2] | 0;
      block5 : {
       if (!($32(HEAP32[($5_1 + 44 | 0) >> 2] | 0 | 0, HEAP32[($5_1 + 32 | 0) >> 2] | 0 | 0) | 0)) {
        break block5
       }
       break block2;
      }
      HEAP32[($5_1 + 20 | 0) >> 2] = HEAP32[((HEAP32[($5_1 + 24 | 0) >> 2] | 0) + 60 | 0) >> 2] | 0;
      HEAP32[($5_1 + 16 | 0) >> 2] = HEAP32[((HEAP32[($5_1 + 24 | 0) >> 2] | 0) + 64 | 0) >> 2] | 0;
      break block6;
     }
     HEAP32[((HEAP32[($5_1 + 24 | 0) >> 2] | 0) + 224 | 0) >> 2] = (HEAP32[($5_1 + 12 | 0) >> 2] | 0) - (HEAP32[($5_1 + 28 | 0) >> 2] | 0) | 0;
     block7 : {
      label1 : while (1) {
       $15_1 = HEAP32[($5_1 + 28 | 0) >> 2] | 0;
       HEAP32[($5_1 + 28 | 0) >> 2] = $15_1 + -1 | 0;
       if (!$15_1) {
        break block7
       }
       $16_1 = HEAP32[($5_1 + 40 | 0) >> 2] | 0;
       HEAP32[($5_1 + 40 | 0) >> 2] = $16_1 + 2 | 0;
       HEAP16[($5_1 + 10 | 0) >> 1] = HEAPU16[$16_1 >> 1] | 0;
       $17_1 = Math_imul(HEAP32[($5_1 + 20 | 0) >> 2] | 0, HEAP16[($5_1 + 10 | 0) >> 1] | 0);
       $18_1 = HEAP32[($5_1 + 36 | 0) >> 2] | 0;
       HEAP32[($5_1 + 36 | 0) >> 2] = $18_1 + 4 | 0;
       HEAP32[$18_1 >> 2] = $17_1 + (HEAP32[$18_1 >> 2] | 0) | 0;
       $19_1 = Math_imul(HEAP32[($5_1 + 16 | 0) >> 2] | 0, HEAP16[($5_1 + 10 | 0) >> 1] | 0);
       $20_1 = HEAP32[($5_1 + 36 | 0) >> 2] | 0;
       HEAP32[($5_1 + 36 | 0) >> 2] = $20_1 + 4 | 0;
       HEAP32[$20_1 >> 2] = $19_1 + (HEAP32[$20_1 >> 2] | 0) | 0;
       continue label1;
      };
     }
     break block2;
    }
    continue label2;
   };
  }
  global$0 = $5_1 + 48 | 0;
  return;
 }
 
 function $27($0_1, $1_1, $2_1, $3_1, $4_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  $4_1 = $4_1 | 0;
  var $5_1 = 0, $9_1 = 0, $11_1 = 0, $6_1 = 0, $7_1 = 0, $8_1 = 0, $10_1 = 0;
  $5_1 = global$0 - 32 | 0;
  HEAP32[($5_1 + 28 | 0) >> 2] = $0_1;
  HEAP32[($5_1 + 24 | 0) >> 2] = $1_1;
  HEAP32[($5_1 + 20 | 0) >> 2] = $2_1;
  HEAP32[($5_1 + 16 | 0) >> 2] = $3_1;
  HEAP32[($5_1 + 12 | 0) >> 2] = $4_1;
  HEAP32[($5_1 + 8 | 0) >> 2] = HEAP32[((((HEAP32[($5_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($5_1 + 16 | 0) >> 2] | 0, 236) | 0) + 60 | 0) >> 2] | 0;
  HEAP32[($5_1 + 4 | 0) >> 2] = HEAP32[((((HEAP32[($5_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($5_1 + 16 | 0) >> 2] | 0, 236) | 0) + 64 | 0) >> 2] | 0;
  block : {
   label : while (1) {
    $6_1 = HEAP32[($5_1 + 12 | 0) >> 2] | 0;
    HEAP32[($5_1 + 12 | 0) >> 2] = $6_1 + -1 | 0;
    if (!$6_1) {
     break block
    }
    $7_1 = HEAP32[($5_1 + 24 | 0) >> 2] | 0;
    HEAP32[($5_1 + 24 | 0) >> 2] = $7_1 + 2 | 0;
    HEAP16[($5_1 + 2 | 0) >> 1] = HEAPU16[$7_1 >> 1] | 0;
    $8_1 = Math_imul(HEAP32[($5_1 + 8 | 0) >> 2] | 0, HEAP16[($5_1 + 2 | 0) >> 1] | 0);
    $9_1 = HEAP32[($5_1 + 20 | 0) >> 2] | 0;
    HEAP32[($5_1 + 20 | 0) >> 2] = $9_1 + 4 | 0;
    HEAP32[$9_1 >> 2] = $8_1 + (HEAP32[$9_1 >> 2] | 0) | 0;
    $10_1 = Math_imul(HEAP32[($5_1 + 4 | 0) >> 2] | 0, HEAP16[($5_1 + 2 | 0) >> 1] | 0);
    $11_1 = HEAP32[($5_1 + 20 | 0) >> 2] | 0;
    HEAP32[($5_1 + 20 | 0) >> 2] = $11_1 + 4 | 0;
    HEAP32[$11_1 >> 2] = $10_1 + (HEAP32[$11_1 >> 2] | 0) | 0;
    continue label;
   };
  }
  return;
 }
 
 function $28($0_1, $1_1, $2_1, $3_1, $4_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  $4_1 = $4_1 | 0;
  var $5_1 = 0, $11_1 = 0, $13_1 = 0, $18_1 = 0, $20_1 = 0, $6_1 = 0, $8_1 = 0, $9_1 = 0, $15_1 = 0, $16_1 = 0, $10_1 = 0, $12_1 = 0, $17_1 = 0, $19_1 = 0;
  $5_1 = global$0 - 48 | 0;
  global$0 = $5_1;
  HEAP32[($5_1 + 44 | 0) >> 2] = $0_1;
  HEAP32[($5_1 + 40 | 0) >> 2] = $1_1;
  HEAP32[($5_1 + 36 | 0) >> 2] = $2_1;
  HEAP32[($5_1 + 32 | 0) >> 2] = $3_1;
  HEAP32[($5_1 + 28 | 0) >> 2] = $4_1;
  HEAP32[($5_1 + 24 | 0) >> 2] = ((HEAP32[($5_1 + 44 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($5_1 + 32 | 0) >> 2] | 0, 236) | 0;
  HEAP32[($5_1 + 20 | 0) >> 2] = HEAP32[((HEAP32[($5_1 + 24 | 0) >> 2] | 0) + 60 | 0) >> 2] | 0;
  $6_1 = HEAP32[((HEAP32[($5_1 + 24 | 0) >> 2] | 0) + 224 | 0) >> 2] | 0;
  HEAP32[($5_1 + 16 | 0) >> 2] = $6_1;
  block2 : {
   block : {
    if ($6_1) {
     break block
    }
    HEAP32[($5_1 + 16 | 0) >> 2] = HEAP32[((HEAP32[($5_1 + 44 | 0) >> 2] | 0) + 13060 | 0) >> 2] | 0;
    block1 : {
     if (!($32(HEAP32[($5_1 + 44 | 0) >> 2] | 0 | 0, HEAP32[($5_1 + 32 | 0) >> 2] | 0 | 0) | 0)) {
      break block1
     }
     break block2;
    }
    HEAP32[($5_1 + 20 | 0) >> 2] = HEAP32[((HEAP32[($5_1 + 24 | 0) >> 2] | 0) + 60 | 0) >> 2] | 0;
   }
   label2 : while (1) {
    if (!(HEAP32[($5_1 + 28 | 0) >> 2] | 0)) {
     break block2
    }
    block6 : {
     block3 : {
      if (!((HEAP32[($5_1 + 16 | 0) >> 2] | 0 | 0) < (HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0) & 1 | 0)) {
       break block3
      }
      HEAP32[($5_1 + 28 | 0) >> 2] = (HEAP32[($5_1 + 28 | 0) >> 2] | 0) - (HEAP32[($5_1 + 16 | 0) >> 2] | 0) | 0;
      block4 : {
       label : while (1) {
        $8_1 = HEAP32[($5_1 + 16 | 0) >> 2] | 0;
        HEAP32[($5_1 + 16 | 0) >> 2] = $8_1 + -1 | 0;
        if (!$8_1) {
         break block4
        }
        $9_1 = HEAP32[($5_1 + 40 | 0) >> 2] | 0;
        HEAP32[($5_1 + 40 | 0) >> 2] = $9_1 + 2 | 0;
        HEAP16[($5_1 + 14 | 0) >> 1] = HEAPU16[$9_1 >> 1] | 0;
        $10_1 = Math_imul(HEAP32[($5_1 + 20 | 0) >> 2] | 0, HEAP16[($5_1 + 14 | 0) >> 1] | 0);
        $11_1 = HEAP32[($5_1 + 36 | 0) >> 2] | 0;
        HEAP32[($5_1 + 36 | 0) >> 2] = $11_1 + 4 | 0;
        HEAP32[$11_1 >> 2] = $10_1 + (HEAP32[$11_1 >> 2] | 0) | 0;
        $12_1 = Math_imul(HEAP32[($5_1 + 20 | 0) >> 2] | 0, HEAP16[($5_1 + 14 | 0) >> 1] | 0);
        $13_1 = HEAP32[($5_1 + 36 | 0) >> 2] | 0;
        HEAP32[($5_1 + 36 | 0) >> 2] = $13_1 + 4 | 0;
        HEAP32[$13_1 >> 2] = $12_1 + (HEAP32[$13_1 >> 2] | 0) | 0;
        continue label;
       };
      }
      HEAP32[($5_1 + 16 | 0) >> 2] = HEAP32[((HEAP32[($5_1 + 44 | 0) >> 2] | 0) + 13060 | 0) >> 2] | 0;
      block5 : {
       if (!($32(HEAP32[($5_1 + 44 | 0) >> 2] | 0 | 0, HEAP32[($5_1 + 32 | 0) >> 2] | 0 | 0) | 0)) {
        break block5
       }
       break block2;
      }
      HEAP32[($5_1 + 20 | 0) >> 2] = HEAP32[((HEAP32[($5_1 + 24 | 0) >> 2] | 0) + 60 | 0) >> 2] | 0;
      break block6;
     }
     HEAP32[((HEAP32[($5_1 + 24 | 0) >> 2] | 0) + 224 | 0) >> 2] = (HEAP32[($5_1 + 16 | 0) >> 2] | 0) - (HEAP32[($5_1 + 28 | 0) >> 2] | 0) | 0;
     block7 : {
      label1 : while (1) {
       $15_1 = HEAP32[($5_1 + 28 | 0) >> 2] | 0;
       HEAP32[($5_1 + 28 | 0) >> 2] = $15_1 + -1 | 0;
       if (!$15_1) {
        break block7
       }
       $16_1 = HEAP32[($5_1 + 40 | 0) >> 2] | 0;
       HEAP32[($5_1 + 40 | 0) >> 2] = $16_1 + 2 | 0;
       HEAP16[($5_1 + 14 | 0) >> 1] = HEAPU16[$16_1 >> 1] | 0;
       $17_1 = Math_imul(HEAP32[($5_1 + 20 | 0) >> 2] | 0, HEAP16[($5_1 + 14 | 0) >> 1] | 0);
       $18_1 = HEAP32[($5_1 + 36 | 0) >> 2] | 0;
       HEAP32[($5_1 + 36 | 0) >> 2] = $18_1 + 4 | 0;
       HEAP32[$18_1 >> 2] = $17_1 + (HEAP32[$18_1 >> 2] | 0) | 0;
       $19_1 = Math_imul(HEAP32[($5_1 + 20 | 0) >> 2] | 0, HEAP16[($5_1 + 14 | 0) >> 1] | 0);
       $20_1 = HEAP32[($5_1 + 36 | 0) >> 2] | 0;
       HEAP32[($5_1 + 36 | 0) >> 2] = $20_1 + 4 | 0;
       HEAP32[$20_1 >> 2] = $19_1 + (HEAP32[$20_1 >> 2] | 0) | 0;
       continue label1;
      };
     }
     break block2;
    }
    continue label2;
   };
  }
  global$0 = $5_1 + 48 | 0;
  return;
 }
 
 function $29($0_1, $1_1, $2_1, $3_1, $4_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  $4_1 = $4_1 | 0;
  var $5_1 = 0, $9_1 = 0, $11_1 = 0, $6_1 = 0, $7_1 = 0, $8_1 = 0, $10_1 = 0;
  $5_1 = global$0 - 32 | 0;
  HEAP32[($5_1 + 28 | 0) >> 2] = $0_1;
  HEAP32[($5_1 + 24 | 0) >> 2] = $1_1;
  HEAP32[($5_1 + 20 | 0) >> 2] = $2_1;
  HEAP32[($5_1 + 16 | 0) >> 2] = $3_1;
  HEAP32[($5_1 + 12 | 0) >> 2] = $4_1;
  HEAP32[($5_1 + 8 | 0) >> 2] = HEAP32[((((HEAP32[($5_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($5_1 + 16 | 0) >> 2] | 0, 236) | 0) + 60 | 0) >> 2] | 0;
  block : {
   label : while (1) {
    $6_1 = HEAP32[($5_1 + 12 | 0) >> 2] | 0;
    HEAP32[($5_1 + 12 | 0) >> 2] = $6_1 + -1 | 0;
    if (!$6_1) {
     break block
    }
    $7_1 = HEAP32[($5_1 + 24 | 0) >> 2] | 0;
    HEAP32[($5_1 + 24 | 0) >> 2] = $7_1 + 2 | 0;
    HEAP16[($5_1 + 6 | 0) >> 1] = HEAPU16[$7_1 >> 1] | 0;
    $8_1 = Math_imul(HEAP32[($5_1 + 8 | 0) >> 2] | 0, HEAP16[($5_1 + 6 | 0) >> 1] | 0);
    $9_1 = HEAP32[($5_1 + 20 | 0) >> 2] | 0;
    HEAP32[($5_1 + 20 | 0) >> 2] = $9_1 + 4 | 0;
    HEAP32[$9_1 >> 2] = $8_1 + (HEAP32[$9_1 >> 2] | 0) | 0;
    $10_1 = Math_imul(HEAP32[($5_1 + 8 | 0) >> 2] | 0, HEAP16[($5_1 + 6 | 0) >> 1] | 0);
    $11_1 = HEAP32[($5_1 + 20 | 0) >> 2] | 0;
    HEAP32[($5_1 + 20 | 0) >> 2] = $11_1 + 4 | 0;
    HEAP32[$11_1 >> 2] = $10_1 + (HEAP32[$11_1 >> 2] | 0) | 0;
    continue label;
   };
  }
  return;
 }
 
 function $30($0_1, $1_1, $2_1, $3_1, $4_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  $4_1 = $4_1 | 0;
  var $5_1 = 0, $11_1 = 0, $16_1 = 0, $6_1 = 0, $8_1 = 0, $9_1 = 0, $13_1 = 0, $14_1 = 0, $10_1 = 0, $15_1 = 0;
  $5_1 = global$0 - 48 | 0;
  global$0 = $5_1;
  HEAP32[($5_1 + 44 | 0) >> 2] = $0_1;
  HEAP32[($5_1 + 40 | 0) >> 2] = $1_1;
  HEAP32[($5_1 + 36 | 0) >> 2] = $2_1;
  HEAP32[($5_1 + 32 | 0) >> 2] = $3_1;
  HEAP32[($5_1 + 28 | 0) >> 2] = $4_1;
  HEAP32[($5_1 + 24 | 0) >> 2] = ((HEAP32[($5_1 + 44 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($5_1 + 32 | 0) >> 2] | 0, 236) | 0;
  HEAP32[($5_1 + 20 | 0) >> 2] = HEAP32[((HEAP32[($5_1 + 24 | 0) >> 2] | 0) + 60 | 0) >> 2] | 0;
  $6_1 = HEAP32[((HEAP32[($5_1 + 24 | 0) >> 2] | 0) + 224 | 0) >> 2] | 0;
  HEAP32[($5_1 + 16 | 0) >> 2] = $6_1;
  block2 : {
   block : {
    if ($6_1) {
     break block
    }
    HEAP32[($5_1 + 16 | 0) >> 2] = HEAP32[((HEAP32[($5_1 + 44 | 0) >> 2] | 0) + 13060 | 0) >> 2] | 0;
    block1 : {
     if (!($32(HEAP32[($5_1 + 44 | 0) >> 2] | 0 | 0, HEAP32[($5_1 + 32 | 0) >> 2] | 0 | 0) | 0)) {
      break block1
     }
     break block2;
    }
    HEAP32[($5_1 + 20 | 0) >> 2] = HEAP32[((HEAP32[($5_1 + 24 | 0) >> 2] | 0) + 60 | 0) >> 2] | 0;
   }
   label2 : while (1) {
    if (!(HEAP32[($5_1 + 28 | 0) >> 2] | 0)) {
     break block2
    }
    block6 : {
     block3 : {
      if (!((HEAP32[($5_1 + 16 | 0) >> 2] | 0 | 0) < (HEAP32[($5_1 + 28 | 0) >> 2] | 0 | 0) & 1 | 0)) {
       break block3
      }
      HEAP32[($5_1 + 28 | 0) >> 2] = (HEAP32[($5_1 + 28 | 0) >> 2] | 0) - (HEAP32[($5_1 + 16 | 0) >> 2] | 0) | 0;
      block4 : {
       label : while (1) {
        $8_1 = HEAP32[($5_1 + 16 | 0) >> 2] | 0;
        HEAP32[($5_1 + 16 | 0) >> 2] = $8_1 + -1 | 0;
        if (!$8_1) {
         break block4
        }
        $9_1 = HEAP32[($5_1 + 40 | 0) >> 2] | 0;
        HEAP32[($5_1 + 40 | 0) >> 2] = $9_1 + 2 | 0;
        HEAP16[($5_1 + 14 | 0) >> 1] = HEAPU16[$9_1 >> 1] | 0;
        $10_1 = Math_imul(HEAP32[($5_1 + 20 | 0) >> 2] | 0, HEAP16[($5_1 + 14 | 0) >> 1] | 0);
        $11_1 = HEAP32[($5_1 + 36 | 0) >> 2] | 0;
        HEAP32[($5_1 + 36 | 0) >> 2] = $11_1 + 4 | 0;
        HEAP32[$11_1 >> 2] = $10_1 + (HEAP32[$11_1 >> 2] | 0) | 0;
        HEAP32[($5_1 + 36 | 0) >> 2] = (HEAP32[($5_1 + 36 | 0) >> 2] | 0) + 4 | 0;
        continue label;
       };
      }
      HEAP32[($5_1 + 16 | 0) >> 2] = HEAP32[((HEAP32[($5_1 + 44 | 0) >> 2] | 0) + 13060 | 0) >> 2] | 0;
      block5 : {
       if (!($32(HEAP32[($5_1 + 44 | 0) >> 2] | 0 | 0, HEAP32[($5_1 + 32 | 0) >> 2] | 0 | 0) | 0)) {
        break block5
       }
       break block2;
      }
      HEAP32[($5_1 + 20 | 0) >> 2] = HEAP32[((HEAP32[($5_1 + 24 | 0) >> 2] | 0) + 60 | 0) >> 2] | 0;
      break block6;
     }
     HEAP32[((HEAP32[($5_1 + 24 | 0) >> 2] | 0) + 224 | 0) >> 2] = (HEAP32[($5_1 + 16 | 0) >> 2] | 0) - (HEAP32[($5_1 + 28 | 0) >> 2] | 0) | 0;
     block7 : {
      label1 : while (1) {
       $13_1 = HEAP32[($5_1 + 28 | 0) >> 2] | 0;
       HEAP32[($5_1 + 28 | 0) >> 2] = $13_1 + -1 | 0;
       if (!$13_1) {
        break block7
       }
       $14_1 = HEAP32[($5_1 + 40 | 0) >> 2] | 0;
       HEAP32[($5_1 + 40 | 0) >> 2] = $14_1 + 2 | 0;
       HEAP16[($5_1 + 14 | 0) >> 1] = HEAPU16[$14_1 >> 1] | 0;
       $15_1 = Math_imul(HEAP32[($5_1 + 20 | 0) >> 2] | 0, HEAP16[($5_1 + 14 | 0) >> 1] | 0);
       $16_1 = HEAP32[($5_1 + 36 | 0) >> 2] | 0;
       HEAP32[($5_1 + 36 | 0) >> 2] = $16_1 + 4 | 0;
       HEAP32[$16_1 >> 2] = $15_1 + (HEAP32[$16_1 >> 2] | 0) | 0;
       HEAP32[($5_1 + 36 | 0) >> 2] = (HEAP32[($5_1 + 36 | 0) >> 2] | 0) + 4 | 0;
       continue label1;
      };
     }
     break block2;
    }
    continue label2;
   };
  }
  global$0 = $5_1 + 48 | 0;
  return;
 }
 
 function $31($0_1, $1_1, $2_1, $3_1, $4_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  $4_1 = $4_1 | 0;
  var $5_1 = 0, $9_1 = 0, $6_1 = 0, $7_1 = 0, $8_1 = 0;
  $5_1 = global$0 - 32 | 0;
  HEAP32[($5_1 + 28 | 0) >> 2] = $0_1;
  HEAP32[($5_1 + 24 | 0) >> 2] = $1_1;
  HEAP32[($5_1 + 20 | 0) >> 2] = $2_1;
  HEAP32[($5_1 + 16 | 0) >> 2] = $3_1;
  HEAP32[($5_1 + 12 | 0) >> 2] = $4_1;
  HEAP32[($5_1 + 8 | 0) >> 2] = HEAP32[((((HEAP32[($5_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($5_1 + 16 | 0) >> 2] | 0, 236) | 0) + 60 | 0) >> 2] | 0;
  block : {
   label : while (1) {
    $6_1 = HEAP32[($5_1 + 12 | 0) >> 2] | 0;
    HEAP32[($5_1 + 12 | 0) >> 2] = $6_1 + -1 | 0;
    if (!$6_1) {
     break block
    }
    $7_1 = HEAP32[($5_1 + 24 | 0) >> 2] | 0;
    HEAP32[($5_1 + 24 | 0) >> 2] = $7_1 + 2 | 0;
    HEAP16[($5_1 + 6 | 0) >> 1] = HEAPU16[$7_1 >> 1] | 0;
    $8_1 = Math_imul(HEAP32[($5_1 + 8 | 0) >> 2] | 0, HEAP16[($5_1 + 6 | 0) >> 1] | 0);
    $9_1 = HEAP32[($5_1 + 20 | 0) >> 2] | 0;
    HEAP32[($5_1 + 20 | 0) >> 2] = $9_1 + 4 | 0;
    HEAP32[$9_1 >> 2] = $8_1 + (HEAP32[$9_1 >> 2] | 0) | 0;
    HEAP32[($5_1 + 20 | 0) >> 2] = (HEAP32[($5_1 + 20 | 0) >> 2] | 0) + 4 | 0;
    continue label;
   };
  }
  return;
 }
 
 function $32($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0, $3_1 = 0, $50_1 = 0;
  $2_1 = global$0 - 16 | 0;
  global$0 = $2_1;
  HEAP32[($2_1 + 8 | 0) >> 2] = $0_1;
  HEAP32[($2_1 + 4 | 0) >> 2] = $1_1;
  block1 : {
   block : {
    if (!(HEAP32[((((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 4 | 0) >> 2] | 0, 236) | 0) + 32 | 0) >> 2] | 0)) {
     break block
    }
    if (!($33(HEAP32[($2_1 + 8 | 0) >> 2] | 0 | 0, HEAP32[($2_1 + 4 | 0) >> 2] | 0 | 0) | 0)) {
     break block
    }
    HEAP32[($2_1 + 12 | 0) >> 2] = 1;
    break block1;
   }
   block2 : {
    if (!(HEAP32[((((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 4 | 0) >> 2] | 0, 236) | 0) + 48 | 0) >> 2] | 0)) {
     break block2
    }
    $34(HEAP32[($2_1 + 8 | 0) >> 2] | 0 | 0, HEAP32[($2_1 + 4 | 0) >> 2] | 0 | 0);
   }
   $21(HEAP32[($2_1 + 8 | 0) >> 2] | 0 | 0, HEAP32[($2_1 + 4 | 0) >> 2] | 0 | 0);
   HEAP32[($2_1 + 12 | 0) >> 2] = 0;
  }
  $3_1 = HEAP32[($2_1 + 12 | 0) >> 2] | 0;
  global$0 = $2_1 + 16 | 0;
  return $3_1 | 0;
 }
 
 function $33($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0, $4_1 = 0, $6_1 = 0, $122_1 = 0;
  $2_1 = global$0 - 16 | 0;
  global$0 = $2_1;
  HEAP32[($2_1 + 8 | 0) >> 2] = $0_1;
  HEAP32[($2_1 + 4 | 0) >> 2] = $1_1;
  $4_1 = ((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 4 | 0) >> 2] | 0, 236) | 0;
  HEAP32[($4_1 + 24 | 0) >> 2] = (HEAP32[((((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 4 | 0) >> 2] | 0, 236) | 0) + 32 | 0) >> 2] | 0) + (HEAP32[($4_1 + 24 | 0) >> 2] | 0) | 0;
  block4 : {
   block2 : {
    block1 : {
     block : {
      if (!((HEAP32[((((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 4 | 0) >> 2] | 0, 236) | 0) + 32 | 0) >> 2] | 0 | 0) < (0 | 0) & 1 | 0)) {
       break block
      }
      if ((HEAP32[((((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 4 | 0) >> 2] | 0, 236) | 0) + 24 | 0) >> 2] | 0 | 0) <= (HEAP32[((((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 4 | 0) >> 2] | 0, 236) | 0) + 28 | 0) >> 2] | 0 | 0) & 1 | 0) {
       break block1
      }
     }
     if (!((HEAP32[((((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 4 | 0) >> 2] | 0, 236) | 0) + 32 | 0) >> 2] | 0 | 0) > (0 | 0) & 1 | 0)) {
      break block2
     }
     if (!((HEAP32[((((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 4 | 0) >> 2] | 0, 236) | 0) + 24 | 0) >> 2] | 0 | 0) >= (HEAP32[((((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 4 | 0) >> 2] | 0, 236) | 0) + 28 | 0) >> 2] | 0 | 0) & 1 | 0)) {
      break block2
     }
    }
    HEAP32[((((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 4 | 0) >> 2] | 0, 236) | 0) + 24 | 0) >> 2] = HEAP32[((((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 4 | 0) >> 2] | 0, 236) | 0) + 28 | 0) >> 2] | 0;
    block3 : {
     if (!($20(HEAP32[($2_1 + 8 | 0) >> 2] | 0 | 0, HEAP32[($2_1 + 4 | 0) >> 2] | 0 | 0) | 0)) {
      break block3
     }
     HEAP32[($2_1 + 12 | 0) >> 2] = 1;
     break block4;
    }
   }
   HEAP32[($2_1 + 12 | 0) >> 2] = 0;
  }
  $6_1 = HEAP32[($2_1 + 12 | 0) >> 2] | 0;
  global$0 = $2_1 + 16 | 0;
  return $6_1 | 0;
 }
 
 function $34($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0, i64toi32_i32$0 = 0, i64toi32_i32$2 = 0, i64toi32_i32$3 = 0, i64toi32_i32$1 = 0, $5_1 = 0, $8_1 = 0, $9_1 = 0, $11_1 = 0, $12_1 = 0, $14_1 = 0.0, $16$hi = 0, $17$hi = 0, $18$hi = 0, $19$hi = 0, $16_1 = 0, $21_1 = 0, $19_1 = 0, $159$hi = 0, $22_1 = 0, $20_1 = Math_fround(0);
  $2_1 = global$0 - 48 | 0;
  global$0 = $2_1;
  HEAP32[($2_1 + 44 | 0) >> 2] = $0_1;
  HEAP32[($2_1 + 40 | 0) >> 2] = $1_1;
  HEAP32[($2_1 + 36 | 0) >> 2] = (HEAPU8[((HEAP32[((((HEAP32[($2_1 + 44 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 40 | 0) >> 2] | 0, 236) | 0) + 4 | 0) >> 2] | 0) + 100 | 0) >> 0] | 0) << 7 | 0;
  block : {
   if (!(HEAP32[((((HEAP32[($2_1 + 44 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 40 | 0) >> 2] | 0, 236) | 0) + 36 | 0) >> 2] | 0)) {
    break block
   }
   $5_1 = ((HEAP32[($2_1 + 44 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 40 | 0) >> 2] | 0, 236) | 0;
   HEAP32[($5_1 + 40 | 0) >> 2] = (HEAP32[((((HEAP32[($2_1 + 44 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 40 | 0) >> 2] | 0, 236) | 0) + 36 | 0) >> 2] | 0) + (HEAP32[($5_1 + 40 | 0) >> 2] | 0) | 0;
   block2 : {
    block1 : {
     if (!((HEAP32[((((HEAP32[($2_1 + 44 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 40 | 0) >> 2] | 0, 236) | 0) + 40 | 0) >> 2] | 0 | 0) >= (65536 | 0) & 1 | 0)) {
      break block1
     }
     HEAP32[((((HEAP32[($2_1 + 44 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 40 | 0) >> 2] | 0, 236) | 0) + 36 | 0) >> 2] = 0;
     break block2;
    }
    HEAP32[($2_1 + 36 | 0) >> 2] = Math_imul(HEAP32[((((HEAP32[($2_1 + 44 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 40 | 0) >> 2] | 0, 236) | 0) + 40 | 0) >> 2] | 0, HEAP32[($2_1 + 36 | 0) >> 2] | 0);
    HEAP32[($2_1 + 36 | 0) >> 2] = (HEAP32[($2_1 + 36 | 0) >> 2] | 0) >> 16 | 0;
   }
  }
  $8_1 = 236;
  $9_1 = (HEAP32[($2_1 + 44 | 0) >> 2] | 0) + Math_imul(HEAP32[($2_1 + 40 | 0) >> 2] | 0, $8_1) | 0;
  $11_1 = 1768;
  $12_1 = $9_1 + $11_1 | 0;
  HEAP32[$12_1 >> 2] = (HEAP32[($9_1 + 1772 | 0) >> 2] | 0) + (HEAP32[$12_1 >> 2] | 0) | 0;
  $14_1 = 1.0;
  $192($2_1 + 16 | 0 | 0, +((+$165(+(+((HEAP32[($11_1 + ((HEAP32[($2_1 + 44 | 0) >> 2] | 0) + Math_imul($8_1, HEAP32[($2_1 + 40 | 0) >> 2] | 0) | 0) | 0) >> 2] | 0) >> 5 | 0 | 0) * .006135923151542565)) + $14_1) * +(HEAP32[($2_1 + 36 | 0) >> 2] | 0 | 0)));
  i64toi32_i32$2 = $2_1;
  i64toi32_i32$0 = HEAP32[($2_1 + 24 | 0) >> 2] | 0;
  i64toi32_i32$1 = HEAP32[($2_1 + 28 | 0) >> 2] | 0;
  $16_1 = i64toi32_i32$0;
  $16$hi = i64toi32_i32$1;
  i64toi32_i32$2 = $2_1;
  i64toi32_i32$1 = HEAP32[($2_1 + 16 | 0) >> 2] | 0;
  i64toi32_i32$0 = HEAP32[($2_1 + 20 | 0) >> 2] | 0;
  $17$hi = i64toi32_i32$0;
  i64toi32_i32$0 = -1074921472;
  $18$hi = i64toi32_i32$0;
  i64toi32_i32$0 = $17$hi;
  i64toi32_i32$0 = $16$hi;
  i64toi32_i32$0 = $18$hi;
  i64toi32_i32$0 = $17$hi;
  $21_1 = i64toi32_i32$1;
  i64toi32_i32$1 = $16$hi;
  i64toi32_i32$2 = 0;
  i64toi32_i32$3 = $18$hi;
  $196($2_1 | 0, $21_1 | 0, i64toi32_i32$0 | 0, $16_1 | 0, i64toi32_i32$1 | 0, 0 | 0, i64toi32_i32$2 | 0, 0 | 0, i64toi32_i32$3 | 0);
  i64toi32_i32$1 = $2_1;
  i64toi32_i32$3 = HEAP32[($2_1 + 8 | 0) >> 2] | 0;
  i64toi32_i32$2 = HEAP32[($2_1 + 12 | 0) >> 2] | 0;
  $19_1 = i64toi32_i32$3;
  $19$hi = i64toi32_i32$2;
  i64toi32_i32$1 = $2_1;
  i64toi32_i32$2 = HEAP32[$2_1 >> 2] | 0;
  i64toi32_i32$3 = HEAP32[($2_1 + 4 | 0) >> 2] | 0;
  $159$hi = i64toi32_i32$3;
  i64toi32_i32$3 = $19$hi;
  i64toi32_i32$3 = $159$hi;
  $22_1 = i64toi32_i32$2;
  i64toi32_i32$2 = $19$hi;
  $20_1 = Math_fround($14_1 + +Math_fround($201($22_1 | 0, i64toi32_i32$3 | 0, $19_1 | 0, i64toi32_i32$2 | 0)));
  HEAPF32[((((HEAP32[($2_1 + 44 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 40 | 0) >> 2] | 0, 236) | 0) + 76 | 0) >> 2] = $20_1;
  global$0 = $2_1 + 48 | 0;
  return;
 }
 
 function $35($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, $4_1 = 0, $5_1 = 0, $7_1 = 0, $6_1 = 0;
  $3_1 = global$0 - 32 | 0;
  HEAP32[($3_1 + 28 | 0) >> 2] = $0_1;
  HEAP32[($3_1 + 24 | 0) >> 2] = $1_1;
  HEAP32[($3_1 + 20 | 0) >> 2] = $2_1;
  HEAP32[($3_1 + 16 | 0) >> 2] = HEAP32[($3_1 + 28 | 0) >> 2] | 0;
  block : {
   label : while (1) {
    $4_1 = HEAP32[($3_1 + 20 | 0) >> 2] | 0;
    HEAP32[($3_1 + 20 | 0) >> 2] = $4_1 + -1 | 0;
    if (!$4_1) {
     break block
    }
    $5_1 = HEAP32[($3_1 + 24 | 0) >> 2] | 0;
    HEAP32[($3_1 + 24 | 0) >> 2] = $5_1 + 4 | 0;
    HEAP32[($3_1 + 12 | 0) >> 2] = (HEAP32[$5_1 >> 2] | 0) >> 21 | 0;
    block2 : {
     block1 : {
      if (!((HEAP32[($3_1 + 12 | 0) >> 2] | 0 | 0) > (127 | 0) & 1 | 0)) {
       break block1
      }
      HEAP32[($3_1 + 12 | 0) >> 2] = 127;
      break block2;
     }
     block3 : {
      if (!((HEAP32[($3_1 + 12 | 0) >> 2] | 0 | 0) < (-128 | 0) & 1 | 0)) {
       break block3
      }
      HEAP32[($3_1 + 12 | 0) >> 2] = -128;
     }
    }
    $6_1 = HEAP32[($3_1 + 12 | 0) >> 2] | 0;
    $7_1 = HEAP32[($3_1 + 16 | 0) >> 2] | 0;
    HEAP32[($3_1 + 16 | 0) >> 2] = $7_1 + 1 | 0;
    HEAP8[$7_1 >> 0] = $6_1;
    continue label;
   };
  }
  return;
 }
 
 function $36($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, $4_1 = 0, $5_1 = 0, $7_1 = 0, $6_1 = 0;
  $3_1 = global$0 - 32 | 0;
  HEAP32[($3_1 + 28 | 0) >> 2] = $0_1;
  HEAP32[($3_1 + 24 | 0) >> 2] = $1_1;
  HEAP32[($3_1 + 20 | 0) >> 2] = $2_1;
  HEAP32[($3_1 + 16 | 0) >> 2] = HEAP32[($3_1 + 28 | 0) >> 2] | 0;
  block : {
   label : while (1) {
    $4_1 = HEAP32[($3_1 + 20 | 0) >> 2] | 0;
    HEAP32[($3_1 + 20 | 0) >> 2] = $4_1 + -1 | 0;
    if (!$4_1) {
     break block
    }
    $5_1 = HEAP32[($3_1 + 24 | 0) >> 2] | 0;
    HEAP32[($3_1 + 24 | 0) >> 2] = $5_1 + 4 | 0;
    HEAP32[($3_1 + 12 | 0) >> 2] = (HEAP32[$5_1 >> 2] | 0) >> 21 | 0;
    block2 : {
     block1 : {
      if (!((HEAP32[($3_1 + 12 | 0) >> 2] | 0 | 0) > (127 | 0) & 1 | 0)) {
       break block1
      }
      HEAP32[($3_1 + 12 | 0) >> 2] = 127;
      break block2;
     }
     block3 : {
      if (!((HEAP32[($3_1 + 12 | 0) >> 2] | 0 | 0) < (-128 | 0) & 1 | 0)) {
       break block3
      }
      HEAP32[($3_1 + 12 | 0) >> 2] = -128;
     }
    }
    $6_1 = ((HEAP32[($3_1 + 12 | 0) >> 2] | 0) & 255 | 0) ^ 128 | 0;
    $7_1 = HEAP32[($3_1 + 16 | 0) >> 2] | 0;
    HEAP32[($3_1 + 16 | 0) >> 2] = $7_1 + 1 | 0;
    HEAP8[$7_1 >> 0] = $6_1;
    continue label;
   };
  }
  return;
 }
 
 function $37($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, $4_1 = 0, $5_1 = 0, $7_1 = 0, $6_1 = 0;
  $3_1 = global$0 - 32 | 0;
  HEAP32[($3_1 + 28 | 0) >> 2] = $0_1;
  HEAP32[($3_1 + 24 | 0) >> 2] = $1_1;
  HEAP32[($3_1 + 20 | 0) >> 2] = $2_1;
  HEAP32[($3_1 + 16 | 0) >> 2] = HEAP32[($3_1 + 28 | 0) >> 2] | 0;
  block : {
   label : while (1) {
    $4_1 = HEAP32[($3_1 + 20 | 0) >> 2] | 0;
    HEAP32[($3_1 + 20 | 0) >> 2] = $4_1 + -1 | 0;
    if (!$4_1) {
     break block
    }
    $5_1 = HEAP32[($3_1 + 24 | 0) >> 2] | 0;
    HEAP32[($3_1 + 24 | 0) >> 2] = $5_1 + 4 | 0;
    HEAP32[($3_1 + 12 | 0) >> 2] = (HEAP32[$5_1 >> 2] | 0) >> 13 | 0;
    block2 : {
     block1 : {
      if (!((HEAP32[($3_1 + 12 | 0) >> 2] | 0 | 0) > (32767 | 0) & 1 | 0)) {
       break block1
      }
      HEAP32[($3_1 + 12 | 0) >> 2] = 32767;
      break block2;
     }
     block3 : {
      if (!((HEAP32[($3_1 + 12 | 0) >> 2] | 0 | 0) < (-32768 | 0) & 1 | 0)) {
       break block3
      }
      HEAP32[($3_1 + 12 | 0) >> 2] = -32768;
     }
    }
    $6_1 = HEAP32[($3_1 + 12 | 0) >> 2] | 0;
    $7_1 = HEAP32[($3_1 + 16 | 0) >> 2] | 0;
    HEAP32[($3_1 + 16 | 0) >> 2] = $7_1 + 2 | 0;
    HEAP16[$7_1 >> 1] = $6_1;
    continue label;
   };
  }
  return;
 }
 
 function $38($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, $4_1 = 0, $5_1 = 0, $7_1 = 0, $6_1 = 0;
  $3_1 = global$0 - 32 | 0;
  HEAP32[($3_1 + 28 | 0) >> 2] = $0_1;
  HEAP32[($3_1 + 24 | 0) >> 2] = $1_1;
  HEAP32[($3_1 + 20 | 0) >> 2] = $2_1;
  HEAP32[($3_1 + 16 | 0) >> 2] = HEAP32[($3_1 + 28 | 0) >> 2] | 0;
  block : {
   label : while (1) {
    $4_1 = HEAP32[($3_1 + 20 | 0) >> 2] | 0;
    HEAP32[($3_1 + 20 | 0) >> 2] = $4_1 + -1 | 0;
    if (!$4_1) {
     break block
    }
    $5_1 = HEAP32[($3_1 + 24 | 0) >> 2] | 0;
    HEAP32[($3_1 + 24 | 0) >> 2] = $5_1 + 4 | 0;
    HEAP32[($3_1 + 12 | 0) >> 2] = (HEAP32[$5_1 >> 2] | 0) >> 13 | 0;
    block2 : {
     block1 : {
      if (!((HEAP32[($3_1 + 12 | 0) >> 2] | 0 | 0) > (32767 | 0) & 1 | 0)) {
       break block1
      }
      HEAP32[($3_1 + 12 | 0) >> 2] = 32767;
      break block2;
     }
     block3 : {
      if (!((HEAP32[($3_1 + 12 | 0) >> 2] | 0 | 0) < (-32768 | 0) & 1 | 0)) {
       break block3
      }
      HEAP32[($3_1 + 12 | 0) >> 2] = -32768;
     }
    }
    $6_1 = ((HEAP32[($3_1 + 12 | 0) >> 2] | 0) & 65535 | 0) ^ 32768 | 0;
    $7_1 = HEAP32[($3_1 + 16 | 0) >> 2] | 0;
    HEAP32[($3_1 + 16 | 0) >> 2] = $7_1 + 2 | 0;
    HEAP16[$7_1 >> 1] = $6_1;
    continue label;
   };
  }
  return;
 }
 
 function $39($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, $4_1 = 0, $5_1 = 0, $7_1 = 0, $6_1 = 0;
  $3_1 = global$0 - 32 | 0;
  HEAP32[($3_1 + 28 | 0) >> 2] = $0_1;
  HEAP32[($3_1 + 24 | 0) >> 2] = $1_1;
  HEAP32[($3_1 + 20 | 0) >> 2] = $2_1;
  HEAP32[($3_1 + 16 | 0) >> 2] = HEAP32[($3_1 + 28 | 0) >> 2] | 0;
  block : {
   label : while (1) {
    $4_1 = HEAP32[($3_1 + 20 | 0) >> 2] | 0;
    HEAP32[($3_1 + 20 | 0) >> 2] = $4_1 + -1 | 0;
    if (!$4_1) {
     break block
    }
    $5_1 = HEAP32[($3_1 + 24 | 0) >> 2] | 0;
    HEAP32[($3_1 + 24 | 0) >> 2] = $5_1 + 4 | 0;
    HEAP32[($3_1 + 12 | 0) >> 2] = (HEAP32[$5_1 >> 2] | 0) >> 13 | 0;
    block2 : {
     block1 : {
      if (!((HEAP32[($3_1 + 12 | 0) >> 2] | 0 | 0) > (32767 | 0) & 1 | 0)) {
       break block1
      }
      HEAP32[($3_1 + 12 | 0) >> 2] = 32767;
      break block2;
     }
     block3 : {
      if (!((HEAP32[($3_1 + 12 | 0) >> 2] | 0 | 0) < (-32768 | 0) & 1 | 0)) {
       break block3
      }
      HEAP32[($3_1 + 12 | 0) >> 2] = -32768;
     }
    }
    $6_1 = ((HEAP32[($3_1 + 12 | 0) >> 2] | 0) << 16 >> 16 & 255 | 0) << 8 | 0 | (((HEAP32[($3_1 + 12 | 0) >> 2] | 0) << 16 >> 16 >> 8 | 0) & 255 | 0) | 0;
    $7_1 = HEAP32[($3_1 + 16 | 0) >> 2] | 0;
    HEAP32[($3_1 + 16 | 0) >> 2] = $7_1 + 2 | 0;
    HEAP16[$7_1 >> 1] = $6_1;
    continue label;
   };
  }
  return;
 }
 
 function $40($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, $4_1 = 0, $5_1 = 0, $7_1 = 0, $6_1 = 0;
  $3_1 = global$0 - 32 | 0;
  HEAP32[($3_1 + 28 | 0) >> 2] = $0_1;
  HEAP32[($3_1 + 24 | 0) >> 2] = $1_1;
  HEAP32[($3_1 + 20 | 0) >> 2] = $2_1;
  HEAP32[($3_1 + 16 | 0) >> 2] = HEAP32[($3_1 + 28 | 0) >> 2] | 0;
  block : {
   label : while (1) {
    $4_1 = HEAP32[($3_1 + 20 | 0) >> 2] | 0;
    HEAP32[($3_1 + 20 | 0) >> 2] = $4_1 + -1 | 0;
    if (!$4_1) {
     break block
    }
    $5_1 = HEAP32[($3_1 + 24 | 0) >> 2] | 0;
    HEAP32[($3_1 + 24 | 0) >> 2] = $5_1 + 4 | 0;
    HEAP32[($3_1 + 12 | 0) >> 2] = (HEAP32[$5_1 >> 2] | 0) >> 13 | 0;
    block2 : {
     block1 : {
      if (!((HEAP32[($3_1 + 12 | 0) >> 2] | 0 | 0) > (32767 | 0) & 1 | 0)) {
       break block1
      }
      HEAP32[($3_1 + 12 | 0) >> 2] = 32767;
      break block2;
     }
     block3 : {
      if (!((HEAP32[($3_1 + 12 | 0) >> 2] | 0 | 0) < (-32768 | 0) & 1 | 0)) {
       break block3
      }
      HEAP32[($3_1 + 12 | 0) >> 2] = -32768;
     }
    }
    $6_1 = ((((HEAP32[($3_1 + 12 | 0) >> 2] | 0) & 65535 | 0) ^ 32768 | 0) & 255 | 0) << 8 | 0 | (((((HEAP32[($3_1 + 12 | 0) >> 2] | 0) & 65535 | 0) ^ 32768 | 0) >> 8 | 0) & 255 | 0) | 0;
    $7_1 = HEAP32[($3_1 + 16 | 0) >> 2] | 0;
    HEAP32[($3_1 + 16 | 0) >> 2] = $7_1 + 2 | 0;
    HEAP16[$7_1 >> 1] = $6_1;
    continue label;
   };
  }
  return;
 }
 
 function $41($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0;
  $1_1 = global$0 - 16 | 0;
  global$0 = $1_1;
  HEAP32[($1_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 4 | 0) >> 2] = 1;
  $42(HEAP32[($1_1 + 12 | 0) >> 2] | 0 | 0);
  $43(HEAP32[($1_1 + 12 | 0) >> 2] | 0 | 0, 0 | 0);
  global$0 = $1_1 + 16 | 0;
  return;
 }
 
 function $42($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0;
  $1_1 = global$0 - 16 | 0;
  HEAP32[($1_1 + 12 | 0) >> 2] = $0_1;
  HEAPF32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 20 | 0) >> 2] = Math_fround(Math_fround(HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 24 | 0) >> 2] | 0 | 0) / Math_fround(100.0));
  return;
 }
 
 function $43($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0;
  $2_1 = global$0 - 16 | 0;
  global$0 = $2_1;
  HEAP32[($2_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($2_1 + 8 | 0) >> 2] = $1_1;
  block : {
   if (!((HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 13088 | 0) >> 2] | 0 | 0) > (HEAP32[($2_1 + 8 | 0) >> 2] | 0 | 0) & 1 | 0)) {
    break block
   }
   HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 13088 | 0) >> 2] = 0;
  }
  $44(HEAP32[($2_1 + 12 | 0) >> 2] | 0 | 0);
  HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 13080 | 0) >> 2] = HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 13076 | 0) >> 2] | 0;
  block1 : {
   if (!(HEAP32[($2_1 + 8 | 0) >> 2] | 0)) {
    break block1
   }
   $45(HEAP32[($2_1 + 12 | 0) >> 2] | 0 | 0, HEAP32[($2_1 + 8 | 0) >> 2] | 0 | 0);
  }
  global$0 = $2_1 + 16 | 0;
  return;
 }
 
 function $44($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0;
  $1_1 = global$0 - 16 | 0;
  global$0 = $1_1;
  HEAP32[($1_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($1_1 + 8 | 0) >> 2] = 0;
  block : {
   label : while (1) {
    if (!((HEAP32[($1_1 + 8 | 0) >> 2] | 0 | 0) < (16 | 0) & 1 | 0)) {
     break block
    }
    $56(HEAP32[($1_1 + 12 | 0) >> 2] | 0 | 0, HEAP32[($1_1 + 8 | 0) >> 2] | 0 | 0);
    HEAP32[((((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAP32[($1_1 + 8 | 0) >> 2] | 0, 40) | 0) + 4 | 0) >> 2] = HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 1056 | 0) >> 2] | 0;
    HEAP32[((((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAP32[($1_1 + 8 | 0) >> 2] | 0, 40) | 0) + 16 | 0) >> 2] = -1;
    HEAP32[((((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAP32[($1_1 + 8 | 0) >> 2] | 0, 40) | 0) + 32 | 0) >> 2] = 2;
    HEAP32[(((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAP32[($1_1 + 8 | 0) >> 2] | 0, 40) | 0) >> 2] = 0;
    HEAP32[($1_1 + 8 | 0) >> 2] = (HEAP32[($1_1 + 8 | 0) >> 2] | 0) + 1 | 0;
    continue label;
   };
  }
  $74(HEAP32[($1_1 + 12 | 0) >> 2] | 0 | 0);
  global$0 = $1_1 + 16 | 0;
  return;
 }
 
 function $45($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0, $3_1 = 0, $41_1 = 0, $42_1 = 0;
  $2_1 = global$0 - 16 | 0;
  global$0 = $2_1;
  HEAP32[($2_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($2_1 + 8 | 0) >> 2] = $1_1;
  $74(HEAP32[($2_1 + 12 | 0) >> 2] | 0 | 0);
  block14 : {
   block : {
    label : while (1) {
     if (!((HEAP32[(HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) >> 2] | 0 | 0) < (HEAP32[($2_1 + 8 | 0) >> 2] | 0 | 0) & 1 | 0)) {
      break block
     }
     $3_1 = (HEAPU8[((HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 13 | 0) >> 0] | 0) + -4 | 0;
     block7 : {
      block11 : {
       switch ($3_1 | 0) {
       case 7:
        HEAP32[((((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAPU8[((HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0, 40) | 0) + 32 | 0) >> 2] = HEAP32[((HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
        HEAPF32[((((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAPU8[((HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0, 40) | 0) + 36 | 0) >> 2] = Math_fround(0 | 0);
        break block7;
       case 4:
        HEAP32[((((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAPU8[((HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0, 40) | 0) + 20 | 0) >> 2] = (HEAP32[((HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) + ((HEAP32[((HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0) << 7 | 0) | 0;
        HEAPF32[((((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAPU8[((HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0, 40) | 0) + 36 | 0) >> 2] = Math_fround(0 | 0);
        break block7;
       case 0:
        HEAP32[((((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAPU8[((HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0, 40) | 0) + 8 | 0) >> 2] = HEAP32[((HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
        break block7;
       case 1:
        HEAP32[((((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAPU8[((HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0, 40) | 0) + 16 | 0) >> 2] = HEAP32[((HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
        break block7;
       case 3:
        HEAP32[((((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAPU8[((HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0, 40) | 0) + 24 | 0) >> 2] = HEAP32[((HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
        break block7;
       case 5:
        block13 : {
         block12 : {
          if (!((HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 13056 | 0) >> 2] | 0) & (1 << (HEAPU8[((HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0) | 0) | 0)) {
           break block12
          }
          HEAP32[(((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAPU8[((HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0, 40) | 0) >> 2] = HEAP32[((HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
          break block13;
         }
         HEAP32[((((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAPU8[((HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0, 40) | 0) + 4 | 0) >> 2] = HEAP32[((HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
        }
        break block7;
       case 2:
        HEAP32[((((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAPU8[((HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0, 40) | 0) + 12 | 0) >> 2] = HEAP32[((HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
        break block7;
       case 9:
        $56(HEAP32[($2_1 + 12 | 0) >> 2] | 0 | 0, HEAPU8[((HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0 | 0);
        break block7;
       case 11:
        HEAP32[(((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAPU8[((HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0, 40) | 0) >> 2] = HEAP32[((HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
        break block7;
       case 95:
        break block11;
       default:
        break block7;
       };
      }
      HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 13088 | 0) >> 2] = HEAP32[(HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) >> 2] | 0;
      break block14;
     }
     $41_1 = HEAP32[($2_1 + 12 | 0) >> 2] | 0;
     HEAP32[($41_1 + 13080 | 0) >> 2] = (HEAP32[($41_1 + 13080 | 0) >> 2] | 0) + 16 | 0;
     continue label;
    };
   }
   block15 : {
    if (!((HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0 | 0) != (HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 13076 | 0) >> 2] | 0 | 0) & 1 | 0)) {
     break block15
    }
    $42_1 = HEAP32[($2_1 + 12 | 0) >> 2] | 0;
    HEAP32[($42_1 + 13080 | 0) >> 2] = (HEAP32[($42_1 + 13080 | 0) >> 2] | 0) + -16 | 0;
   }
   HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 13088 | 0) >> 2] = HEAP32[($2_1 + 8 | 0) >> 2] | 0;
  }
  global$0 = $2_1 + 16 | 0;
  return;
 }
 
 function $46($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0;
  $2_1 = global$0 - 16 | 0;
  global$0 = $2_1;
  HEAP32[($2_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($2_1 + 8 | 0) >> 2] = $1_1;
  $43(HEAP32[($2_1 + 12 | 0) >> 2] | 0 | 0, (Math_imul(HEAP32[($2_1 + 8 | 0) >> 2] | 0, (HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0 | 0) / (100 | 0) | 0) >>> 0) / (10 >>> 0) | 0 | 0);
  global$0 = $2_1 + 16 | 0;
  return;
 }
 
 function $47($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, $43_1 = 0;
  $1_1 = global$0 - 16 | 0;
  HEAP32[($1_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($1_1 + 8 | 0) >> 2] = (HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 13076 | 0) >> 2] | 0) + (((HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 13100 | 0) >> 2] | 0) - 1 | 0) << 4 | 0) | 0;
  HEAP32[($1_1 + 4 | 0) >> 2] = Math_imul((HEAP32[(HEAP32[($1_1 + 8 | 0) >> 2] | 0) >> 2] | 0 | 0) / (HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0 | 0) | 0, 1e3);
  HEAP32[($1_1 + 4 | 0) >> 2] = ((Math_imul((HEAP32[(HEAP32[($1_1 + 8 | 0) >> 2] | 0) >> 2] | 0 | 0) % (HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0 | 0) | 0, 1e3) | 0) / (HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0 | 0) | 0) + (HEAP32[($1_1 + 4 | 0) >> 2] | 0) | 0;
  return HEAP32[($1_1 + 4 | 0) >> 2] | 0 | 0;
 }
 
 function $48($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, $33_1 = 0;
  $1_1 = global$0 - 16 | 0;
  HEAP32[($1_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($1_1 + 8 | 0) >> 2] = Math_imul((HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 13088 | 0) >> 2] | 0 | 0) / (HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0 | 0) | 0, 1e3);
  HEAP32[($1_1 + 8 | 0) >> 2] = ((Math_imul((HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 13088 | 0) >> 2] | 0 | 0) % (HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0 | 0) | 0, 1e3) | 0) / (HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0 | 0) | 0) + (HEAP32[($1_1 + 8 | 0) >> 2] | 0) | 0;
  return HEAP32[($1_1 + 8 | 0) >> 2] | 0 | 0;
 }
 
 function $49($0_1, $1_1, $2_1, $3_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  var $4_1 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, i64toi32_i32$2 = 0, $16_1 = 0, $53_1 = 0, $17_1 = 0, $117_1 = 0, $117$hi = 0, $120_1 = 0, $120$hi = 0, $58_1 = 0, $500 = 0;
  $4_1 = global$0 - 48 | 0;
  global$0 = $4_1;
  HEAP32[($4_1 + 40 | 0) >> 2] = $0_1;
  HEAP32[($4_1 + 36 | 0) >> 2] = $1_1;
  HEAP32[($4_1 + 32 | 0) >> 2] = $2_1;
  HEAP32[($4_1 + 28 | 0) >> 2] = $3_1;
  block1 : {
   block : {
    if (HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) {
     break block
    }
    HEAP32[($4_1 + 44 | 0) >> 2] = 0;
    break block1;
   }
   HEAP32[($4_1 + 16 | 0) >> 2] = ((HEAP32[($4_1 + 32 | 0) >> 2] | 0) >>> 0) / ((HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 16 | 0) >> 2] | 0) >>> 0) | 0;
   HEAP32[($4_1 + 24 | 0) >> 2] = HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13088 | 0) >> 2] | 0;
   HEAP32[($4_1 + 20 | 0) >> 2] = (HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13088 | 0) >> 2] | 0) + (HEAP32[($4_1 + 16 | 0) >> 2] | 0) | 0;
   label1 : while (1) {
    block2 : {
     label : while (1) {
      if (!((HEAP32[(HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) >> 2] | 0 | 0) <= (HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13088 | 0) >> 2] | 0 | 0) & 1 | 0)) {
       break block2
      }
      block3 : {
       if (HEAP32[($4_1 + 28 | 0) >> 2] | 0) {
        break block3
       }
       if (!((HEAP32[(0 + 75776 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
        break block3
       }
       if (!(HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0)) {
        break block3
       }
       i64toi32_i32$2 = HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0;
       i64toi32_i32$0 = HEAP32[i64toi32_i32$2 >> 2] | 0;
       i64toi32_i32$1 = i64toi32_i32$0 >> 31 | 0;
       $17_1 = i64toi32_i32$0;
       i64toi32_i32$0 = 0;
       i64toi32_i32$0 = __wasm_i64_mul($17_1 | 0, i64toi32_i32$1 | 0, 1e3 | 0, i64toi32_i32$0 | 0) | 0;
       i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
       $117_1 = i64toi32_i32$0;
       $117$hi = i64toi32_i32$1;
       i64toi32_i32$2 = HEAP32[($4_1 + 40 | 0) >> 2] | 0;
       i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 8 | 0) >> 2] | 0;
       i64toi32_i32$0 = i64toi32_i32$1 >> 31 | 0;
       $120_1 = i64toi32_i32$1;
       $120$hi = i64toi32_i32$0;
       i64toi32_i32$0 = $117$hi;
       i64toi32_i32$1 = $120$hi;
       i64toi32_i32$1 = __wasm_i64_udiv($117_1 | 0, i64toi32_i32$0 | 0, $120_1 | 0, i64toi32_i32$1 | 0) | 0;
       i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
       HEAP32[($4_1 + 12 | 0) >> 2] = i64toi32_i32$1;
       HEAP8[($4_1 + 11 | 0) >> 0] = HEAPU8[((HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 14 | 0) >> 0] | 0;
       HEAP8[($4_1 + 10 | 0) >> 0] = HEAPU8[((HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0;
       HEAP32[($4_1 + 4 | 0) >> 2] = 0;
       block5 : {
        block4 : {
         if (!((HEAPU8[((HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 13 | 0) >> 0] | 0 | 0) == (10 | 0) & 1 | 0)) {
          break block4
         }
         HEAP8[($4_1 + 11 | 0) >> 0] = 255;
         HEAP8[($4_1 + 10 | 0) >> 0] = 16;
         break block5;
        }
        block6 : {
         if (!((HEAPU8[((HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 13 | 0) >> 0] | 0 | 0) == (16 | 0) & 1 | 0)) {
          break block6
         }
         HEAP8[($4_1 + 11 | 0) >> 0] = 255;
         HEAP8[($4_1 + 10 | 0) >> 0] = 16;
         HEAP32[($4_1 + 4 | 0) >> 2] = HEAP32[((HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
        }
       }
       FUNCTION_TABLE[HEAP32[(0 + 75776 | 0) >> 2] | 0 | 0](HEAP32[(HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) >> 2] | 0, HEAP32[($4_1 + 12 | 0) >> 2] | 0, (HEAPU8[($4_1 + 11 | 0) >> 0] | 0) & 255 | 0, (HEAPU8[($4_1 + 10 | 0) >> 0] | 0) & 255 | 0, (HEAPU8[((HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 13 | 0) >> 0] | 0) & 255 | 0, HEAP32[((HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0, HEAP32[((HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0, HEAP32[($4_1 + 4 | 0) >> 2] | 0);
      }
      $16_1 = (HEAPU8[((HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 13 | 0) >> 0] | 0) + -1 | 0;
      block16 : {
       block22 : {
        switch ($16_1 | 0) {
        case 0:
         block24 : {
          block23 : {
           if (HEAP32[((HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0) {
            break block23
           }
           $50(HEAP32[($4_1 + 40 | 0) >> 2] | 0 | 0);
           break block24;
          }
          $51(HEAP32[($4_1 + 40 | 0) >> 2] | 0 | 0);
         }
         break block16;
        case 1:
         $50(HEAP32[($4_1 + 40 | 0) >> 2] | 0 | 0);
         break block16;
        case 2:
         $52(HEAP32[($4_1 + 40 | 0) >> 2] | 0 | 0);
         break block16;
        case 10:
         HEAP32[((((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAPU8[((HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0, 40) | 0) + 32 | 0) >> 2] = HEAP32[((HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
         HEAPF32[((((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAPU8[((HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0, 40) | 0) + 36 | 0) >> 2] = Math_fround(0 | 0);
         break block16;
        case 7:
         HEAP32[((((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAPU8[((HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0, 40) | 0) + 20 | 0) >> 2] = (HEAP32[((HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) + ((HEAP32[((HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0) << 7 | 0) | 0;
         HEAPF32[((((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAPU8[((HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0, 40) | 0) + 36 | 0) >> 2] = Math_fround(0 | 0);
         $53(HEAP32[($4_1 + 40 | 0) >> 2] | 0 | 0);
         break block16;
        case 3:
         HEAP32[((((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAPU8[((HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0, 40) | 0) + 8 | 0) >> 2] = HEAP32[((HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
         $54(HEAP32[($4_1 + 40 | 0) >> 2] | 0 | 0);
         break block16;
        case 4:
         HEAP32[((((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAPU8[((HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0, 40) | 0) + 16 | 0) >> 2] = HEAP32[((HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
         break block16;
        case 6:
         HEAP32[((((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAPU8[((HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0, 40) | 0) + 24 | 0) >> 2] = HEAP32[((HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
         $54(HEAP32[($4_1 + 40 | 0) >> 2] | 0 | 0);
         break block16;
        case 8:
         block26 : {
          block25 : {
           if (!((HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13056 | 0) >> 2] | 0) & (1 << (HEAPU8[((HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0) | 0) | 0)) {
            break block25
           }
           HEAP32[(((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAPU8[((HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0, 40) | 0) >> 2] = HEAP32[((HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
           break block26;
          }
          HEAP32[((((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAPU8[((HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0, 40) | 0) + 4 | 0) >> 2] = HEAP32[((HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
         }
         break block16;
        case 5:
         HEAP32[((((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAPU8[((HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0, 40) | 0) + 12 | 0) >> 2] = HEAP32[((HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
         block27 : {
          if (HEAP32[((HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) {
           break block27
          }
          $55(HEAP32[($4_1 + 40 | 0) >> 2] | 0 | 0);
         }
         break block16;
        case 12:
         $56(HEAP32[($4_1 + 40 | 0) >> 2] | 0 | 0, HEAPU8[((HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0 | 0);
         break block16;
        case 13:
         $57(HEAP32[($4_1 + 40 | 0) >> 2] | 0 | 0);
         break block16;
        case 11:
         $58(HEAP32[($4_1 + 40 | 0) >> 2] | 0 | 0);
         break block16;
        case 14:
         HEAP32[(((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAPU8[((HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0, 40) | 0) >> 2] = HEAP32[((HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
         break block16;
        case 98:
         break block22;
        default:
         break block16;
        };
       }
       HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 4 | 0) >> 2] = 0;
       HEAP32[($4_1 + 44 | 0) >> 2] = Math_imul((HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13088 | 0) >> 2] | 0) - (HEAP32[($4_1 + 24 | 0) >> 2] | 0) | 0, HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 16 | 0) >> 2] | 0);
       break block1;
      }
      $53_1 = HEAP32[($4_1 + 40 | 0) >> 2] | 0;
      HEAP32[($53_1 + 13080 | 0) >> 2] = (HEAP32[($53_1 + 13080 | 0) >> 2] | 0) + 16 | 0;
      continue label;
     };
    }
    block29 : {
     block28 : {
      if (!((HEAP32[(HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) >> 2] | 0 | 0) > (HEAP32[($4_1 + 20 | 0) >> 2] | 0 | 0) & 1 | 0)) {
       break block28
      }
      $59(HEAP32[($4_1 + 40 | 0) >> 2] | 0 | 0, $4_1 + 36 | 0 | 0, (HEAP32[($4_1 + 20 | 0) >> 2] | 0) - (HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13088 | 0) >> 2] | 0) | 0 | 0);
      break block29;
     }
     $59(HEAP32[($4_1 + 40 | 0) >> 2] | 0 | 0, $4_1 + 36 | 0 | 0, (HEAP32[(HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) >> 2] | 0) - (HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13088 | 0) >> 2] | 0) | 0 | 0);
    }
    if ((HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13088 | 0) >> 2] | 0 | 0) < (HEAP32[($4_1 + 20 | 0) >> 2] | 0 | 0) & 1 | 0) {
     continue label1
    }
    break label1;
   };
   HEAP32[($4_1 + 44 | 0) >> 2] = Math_imul(HEAP32[($4_1 + 16 | 0) >> 2] | 0, HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 16 | 0) >> 2] | 0);
  }
  $58_1 = HEAP32[($4_1 + 44 | 0) >> 2] | 0;
  global$0 = $4_1 + 48 | 0;
  return $58_1 | 0;
 }
 
 function $50($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, $2_1 = 0;
  $1_1 = global$0 - 16 | 0;
  global$0 = $1_1;
  HEAP32[($1_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($1_1 + 8 | 0) >> 2] = HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 13052 | 0) >> 2] | 0;
  HEAP32[($1_1 + 4 | 0) >> 2] = HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0;
  block : {
   label : while (1) {
    $2_1 = HEAP32[($1_1 + 8 | 0) >> 2] | 0;
    HEAP32[($1_1 + 8 | 0) >> 2] = $2_1 + -1 | 0;
    if (!$2_1) {
     break block
    }
    block1 : {
     if (!((HEAPU8[(((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($1_1 + 8 | 0) >> 2] | 0, 236) | 0) >> 0] | 0 | 0) == (1 | 0) & 1 | 0)) {
      break block1
     }
     if (!((HEAPU8[((((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($1_1 + 8 | 0) >> 2] | 0, 236) | 0) + 1 | 0) >> 0] | 0 | 0) == (HEAPU8[((HEAP32[($1_1 + 4 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0 | 0) & 1 | 0)) {
      break block1
     }
     if (!((HEAPU8[((((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($1_1 + 8 | 0) >> 2] | 0, 236) | 0) + 2 | 0) >> 0] | 0 | 0) == (HEAP32[((HEAP32[($1_1 + 4 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0 | 0) & 1 | 0)) {
      break block1
     }
     block3 : {
      block2 : {
       if (!(HEAP32[((((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAPU8[((HEAP32[($1_1 + 4 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0, 40) | 0) + 12 | 0) >> 2] | 0)) {
        break block2
       }
       HEAP8[(((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($1_1 + 8 | 0) >> 2] | 0, 236) | 0) >> 0] = 2;
       break block3;
      }
      $60(HEAP32[($1_1 + 12 | 0) >> 2] | 0 | 0, HEAP32[($1_1 + 8 | 0) >> 2] | 0 | 0);
     }
     break block;
    }
    continue label;
   };
  }
  global$0 = $1_1 + 16 | 0;
  return;
 }
 
 function $51($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, $2_1 = 0, $10_1 = 0, $13_1 = 0, $14_1 = 0;
  $1_1 = global$0 - 32 | 0;
  global$0 = $1_1;
  HEAP32[($1_1 + 28 | 0) >> 2] = $0_1;
  HEAP32[($1_1 + 24 | 0) >> 2] = HEAP32[((HEAP32[($1_1 + 28 | 0) >> 2] | 0) + 13052 | 0) >> 2] | 0;
  HEAP32[($1_1 + 20 | 0) >> 2] = -1;
  HEAP32[($1_1 + 16 | 0) >> 2] = 2147483647;
  HEAP32[($1_1 + 8 | 0) >> 2] = HEAP32[((HEAP32[($1_1 + 28 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0;
  block : {
   label : while (1) {
    $2_1 = HEAP32[($1_1 + 24 | 0) >> 2] | 0;
    HEAP32[($1_1 + 24 | 0) >> 2] = $2_1 + -1 | 0;
    if (!$2_1) {
     break block
    }
    block2 : {
     block1 : {
      if (HEAPU8[(((HEAP32[($1_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($1_1 + 24 | 0) >> 2] | 0, 236) | 0) >> 0] | 0) {
       break block1
      }
      HEAP32[($1_1 + 20 | 0) >> 2] = HEAP32[($1_1 + 24 | 0) >> 2] | 0;
      break block2;
     }
     block3 : {
      if (!((HEAPU8[((((HEAP32[($1_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($1_1 + 24 | 0) >> 2] | 0, 236) | 0) + 1 | 0) >> 0] | 0 | 0) == (HEAPU8[((HEAP32[($1_1 + 8 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0 | 0) & 1 | 0)) {
       break block3
      }
      block4 : {
       if ((HEAPU8[((((HEAP32[($1_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($1_1 + 24 | 0) >> 2] | 0, 236) | 0) + 2 | 0) >> 0] | 0 | 0) == (HEAP32[((HEAP32[($1_1 + 8 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0 | 0) & 1 | 0) {
        break block4
       }
       if (!(HEAP32[((((HEAP32[($1_1 + 28 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAPU8[((((HEAP32[($1_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($1_1 + 24 | 0) >> 2] | 0, 236) | 0) + 1 | 0) >> 0] | 0, 40) | 0) + 28 | 0) >> 2] | 0)) {
        break block3
       }
      }
      $61(HEAP32[($1_1 + 28 | 0) >> 2] | 0 | 0, HEAP32[($1_1 + 24 | 0) >> 2] | 0 | 0);
     }
    }
    continue label;
   };
  }
  block6 : {
   block5 : {
    if (!((HEAP32[($1_1 + 20 | 0) >> 2] | 0 | 0) != (-1 | 0) & 1 | 0)) {
     break block5
    }
    $62(HEAP32[($1_1 + 28 | 0) >> 2] | 0 | 0, HEAP32[($1_1 + 8 | 0) >> 2] | 0 | 0, HEAP32[($1_1 + 20 | 0) >> 2] | 0 | 0);
    break block6;
   }
   HEAP32[($1_1 + 24 | 0) >> 2] = HEAP32[((HEAP32[($1_1 + 28 | 0) >> 2] | 0) + 13052 | 0) >> 2] | 0;
   block7 : {
    label1 : while (1) {
     $10_1 = HEAP32[($1_1 + 24 | 0) >> 2] | 0;
     HEAP32[($1_1 + 24 | 0) >> 2] = $10_1 + -1 | 0;
     if (!$10_1) {
      break block7
     }
     block8 : {
      if (!((HEAPU8[(((HEAP32[($1_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($1_1 + 24 | 0) >> 2] | 0, 236) | 0) >> 0] | 0 | 0) != (1 | 0) & 1 | 0)) {
       break block8
      }
      if (!((HEAPU8[(((HEAP32[($1_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($1_1 + 24 | 0) >> 2] | 0, 236) | 0) >> 0] | 0 | 0) != (4 | 0) & 1 | 0)) {
       break block8
      }
      HEAP32[($1_1 + 12 | 0) >> 2] = HEAP32[((((HEAP32[($1_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($1_1 + 24 | 0) >> 2] | 0, 236) | 0) + 60 | 0) >> 2] | 0;
      block9 : {
       if (HEAP32[((((HEAP32[($1_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($1_1 + 24 | 0) >> 2] | 0, 236) | 0) + 232 | 0) >> 2] | 0) {
        break block9
       }
       if (!((HEAP32[((((HEAP32[($1_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($1_1 + 24 | 0) >> 2] | 0, 236) | 0) + 64 | 0) >> 2] | 0 | 0) > (HEAP32[($1_1 + 12 | 0) >> 2] | 0 | 0) & 1 | 0)) {
        break block9
       }
       HEAP32[($1_1 + 12 | 0) >> 2] = HEAP32[((((HEAP32[($1_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($1_1 + 24 | 0) >> 2] | 0, 236) | 0) + 64 | 0) >> 2] | 0;
      }
      block10 : {
       if (!((HEAP32[($1_1 + 12 | 0) >> 2] | 0 | 0) < (HEAP32[($1_1 + 16 | 0) >> 2] | 0 | 0) & 1 | 0)) {
        break block10
       }
       HEAP32[($1_1 + 16 | 0) >> 2] = HEAP32[($1_1 + 12 | 0) >> 2] | 0;
       HEAP32[($1_1 + 20 | 0) >> 2] = HEAP32[($1_1 + 24 | 0) >> 2] | 0;
      }
     }
     continue label1;
    };
   }
   block11 : {
    if (!((HEAP32[($1_1 + 20 | 0) >> 2] | 0 | 0) != (-1 | 0) & 1 | 0)) {
     break block11
    }
    $13_1 = HEAP32[($1_1 + 28 | 0) >> 2] | 0;
    HEAP32[($13_1 + 13068 | 0) >> 2] = (HEAP32[($13_1 + 13068 | 0) >> 2] | 0) + 1 | 0;
    HEAP8[(((HEAP32[($1_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($1_1 + 20 | 0) >> 2] | 0, 236) | 0) >> 0] = 0;
    $62(HEAP32[($1_1 + 28 | 0) >> 2] | 0 | 0, HEAP32[($1_1 + 8 | 0) >> 2] | 0 | 0, HEAP32[($1_1 + 20 | 0) >> 2] | 0 | 0);
    break block6;
   }
   $14_1 = HEAP32[($1_1 + 28 | 0) >> 2] | 0;
   HEAP32[($14_1 + 13064 | 0) >> 2] = (HEAP32[($14_1 + 13064 | 0) >> 2] | 0) + 1 | 0;
  }
  global$0 = $1_1 + 32 | 0;
  return;
 }
 
 function $52($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, $2_1 = 0;
  $1_1 = global$0 - 16 | 0;
  global$0 = $1_1;
  HEAP32[($1_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($1_1 + 8 | 0) >> 2] = HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0;
  HEAP32[($1_1 + 4 | 0) >> 2] = HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 13052 | 0) >> 2] | 0;
  block : {
   label : while (1) {
    $2_1 = HEAP32[($1_1 + 4 | 0) >> 2] | 0;
    HEAP32[($1_1 + 4 | 0) >> 2] = $2_1 + -1 | 0;
    if (!$2_1) {
     break block
    }
    block1 : {
     if (!((HEAPU8[(((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($1_1 + 4 | 0) >> 2] | 0, 236) | 0) >> 0] | 0 | 0) == (1 | 0) & 1 | 0)) {
      break block1
     }
     if (!((HEAPU8[((((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($1_1 + 4 | 0) >> 2] | 0, 236) | 0) + 1 | 0) >> 0] | 0 | 0) == (HEAPU8[((HEAP32[($1_1 + 8 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0 | 0) & 1 | 0)) {
      break block1
     }
     if (!((HEAPU8[((((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($1_1 + 4 | 0) >> 2] | 0, 236) | 0) + 2 | 0) >> 0] | 0 | 0) == (HEAP32[((HEAP32[($1_1 + 8 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0 | 0) & 1 | 0)) {
      break block1
     }
     HEAP8[((((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($1_1 + 4 | 0) >> 2] | 0, 236) | 0) + 3 | 0) >> 0] = HEAP32[((HEAP32[($1_1 + 8 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0;
     $63(HEAP32[($1_1 + 12 | 0) >> 2] | 0 | 0, HEAP32[($1_1 + 4 | 0) >> 2] | 0 | 0);
     $21(HEAP32[($1_1 + 12 | 0) >> 2] | 0 | 0, HEAP32[($1_1 + 4 | 0) >> 2] | 0 | 0);
     break block;
    }
    continue label;
   };
  }
  global$0 = $1_1 + 16 | 0;
  return;
 }
 
 function $53($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, $3_1 = 0;
  $1_1 = global$0 - 16 | 0;
  global$0 = $1_1;
  HEAP32[($1_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($1_1 + 8 | 0) >> 2] = HEAPU8[((HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0;
  HEAP32[($1_1 + 4 | 0) >> 2] = HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 13052 | 0) >> 2] | 0;
  block : {
   label : while (1) {
    $3_1 = HEAP32[($1_1 + 4 | 0) >> 2] | 0;
    HEAP32[($1_1 + 4 | 0) >> 2] = $3_1 + -1 | 0;
    if (!$3_1) {
     break block
    }
    block1 : {
     if (!(HEAPU8[(((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($1_1 + 4 | 0) >> 2] | 0, 236) | 0) >> 0] | 0)) {
      break block1
     }
     if (!((HEAPU8[((((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($1_1 + 4 | 0) >> 2] | 0, 236) | 0) + 1 | 0) >> 0] | 0 | 0) == (HEAP32[($1_1 + 8 | 0) >> 2] | 0 | 0) & 1 | 0)) {
      break block1
     }
     $64(HEAP32[($1_1 + 12 | 0) >> 2] | 0 | 0, HEAP32[($1_1 + 4 | 0) >> 2] | 0 | 0);
    }
    continue label;
   };
  }
  global$0 = $1_1 + 16 | 0;
  return;
 }
 
 function $54($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, $3_1 = 0;
  $1_1 = global$0 - 16 | 0;
  global$0 = $1_1;
  HEAP32[($1_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($1_1 + 8 | 0) >> 2] = HEAPU8[((HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0;
  HEAP32[($1_1 + 4 | 0) >> 2] = HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 13052 | 0) >> 2] | 0;
  block : {
   label : while (1) {
    $3_1 = HEAP32[($1_1 + 4 | 0) >> 2] | 0;
    HEAP32[($1_1 + 4 | 0) >> 2] = $3_1 + -1 | 0;
    if (!$3_1) {
     break block
    }
    block1 : {
     if (!((HEAPU8[((((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($1_1 + 4 | 0) >> 2] | 0, 236) | 0) + 1 | 0) >> 0] | 0 | 0) == (HEAP32[($1_1 + 8 | 0) >> 2] | 0 | 0) & 1 | 0)) {
      break block1
     }
     block2 : {
      if ((HEAPU8[(((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($1_1 + 4 | 0) >> 2] | 0, 236) | 0) >> 0] | 0 | 0) == (1 | 0) & 1 | 0) {
       break block2
      }
      if (!((HEAPU8[(((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($1_1 + 4 | 0) >> 2] | 0, 236) | 0) >> 0] | 0 | 0) == (2 | 0) & 1 | 0)) {
       break block1
      }
     }
     $63(HEAP32[($1_1 + 12 | 0) >> 2] | 0 | 0, HEAP32[($1_1 + 4 | 0) >> 2] | 0 | 0);
     $21(HEAP32[($1_1 + 12 | 0) >> 2] | 0 | 0, HEAP32[($1_1 + 4 | 0) >> 2] | 0 | 0);
    }
    continue label;
   };
  }
  global$0 = $1_1 + 16 | 0;
  return;
 }
 
 function $55($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, $3_1 = 0;
  $1_1 = global$0 - 16 | 0;
  global$0 = $1_1;
  HEAP32[($1_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($1_1 + 8 | 0) >> 2] = HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 13052 | 0) >> 2] | 0;
  HEAP32[($1_1 + 4 | 0) >> 2] = HEAPU8[((HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0;
  block : {
   label : while (1) {
    $3_1 = HEAP32[($1_1 + 8 | 0) >> 2] | 0;
    HEAP32[($1_1 + 8 | 0) >> 2] = $3_1 + -1 | 0;
    if (!$3_1) {
     break block
    }
    block1 : {
     if (!((HEAPU8[(((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($1_1 + 8 | 0) >> 2] | 0, 236) | 0) >> 0] | 0 | 0) == (2 | 0) & 1 | 0)) {
      break block1
     }
     if (!((HEAPU8[((((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($1_1 + 8 | 0) >> 2] | 0, 236) | 0) + 1 | 0) >> 0] | 0 | 0) == (HEAP32[($1_1 + 4 | 0) >> 2] | 0 | 0) & 1 | 0)) {
      break block1
     }
     $60(HEAP32[($1_1 + 12 | 0) >> 2] | 0 | 0, HEAP32[($1_1 + 8 | 0) >> 2] | 0 | 0);
    }
    continue label;
   };
  }
  global$0 = $1_1 + 16 | 0;
  return;
 }
 
 function $56($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0;
  $2_1 = global$0 - 16 | 0;
  HEAP32[($2_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($2_1 + 8 | 0) >> 2] = $1_1;
  HEAP32[((((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAP32[($2_1 + 8 | 0) >> 2] | 0, 40) | 0) + 8 | 0) >> 2] = 90;
  HEAP32[((((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAP32[($2_1 + 8 | 0) >> 2] | 0, 40) | 0) + 24 | 0) >> 2] = 127;
  HEAP32[((((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAP32[($2_1 + 8 | 0) >> 2] | 0, 40) | 0) + 12 | 0) >> 2] = 0;
  HEAP32[((((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAP32[($2_1 + 8 | 0) >> 2] | 0, 40) | 0) + 20 | 0) >> 2] = 8192;
  HEAPF32[((((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAP32[($2_1 + 8 | 0) >> 2] | 0, 40) | 0) + 36 | 0) >> 2] = Math_fround(0 | 0);
  return;
 }
 
 function $57($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, $3_1 = 0;
  $1_1 = global$0 - 16 | 0;
  global$0 = $1_1;
  HEAP32[($1_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($1_1 + 8 | 0) >> 2] = HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 13052 | 0) >> 2] | 0;
  HEAP32[($1_1 + 4 | 0) >> 2] = HEAPU8[((HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0;
  block : {
   label : while (1) {
    $3_1 = HEAP32[($1_1 + 8 | 0) >> 2] | 0;
    HEAP32[($1_1 + 8 | 0) >> 2] = $3_1 + -1 | 0;
    if (!$3_1) {
     break block
    }
    block1 : {
     if (!((HEAPU8[(((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($1_1 + 8 | 0) >> 2] | 0, 236) | 0) >> 0] | 0 | 0) == (1 | 0) & 1 | 0)) {
      break block1
     }
     if (!((HEAPU8[((((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($1_1 + 8 | 0) >> 2] | 0, 236) | 0) + 1 | 0) >> 0] | 0 | 0) == (HEAP32[($1_1 + 4 | 0) >> 2] | 0 | 0) & 1 | 0)) {
      break block1
     }
     block3 : {
      block2 : {
       if (!(HEAP32[((((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAP32[($1_1 + 4 | 0) >> 2] | 0, 40) | 0) + 12 | 0) >> 2] | 0)) {
        break block2
       }
       HEAP8[(((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($1_1 + 8 | 0) >> 2] | 0, 236) | 0) >> 0] = 2;
       break block3;
      }
      $60(HEAP32[($1_1 + 12 | 0) >> 2] | 0 | 0, HEAP32[($1_1 + 8 | 0) >> 2] | 0 | 0);
     }
    }
    continue label;
   };
  }
  global$0 = $1_1 + 16 | 0;
  return;
 }
 
 function $58($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, $3_1 = 0;
  $1_1 = global$0 - 16 | 0;
  global$0 = $1_1;
  HEAP32[($1_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($1_1 + 8 | 0) >> 2] = HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 13052 | 0) >> 2] | 0;
  HEAP32[($1_1 + 4 | 0) >> 2] = HEAPU8[((HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0;
  block : {
   label : while (1) {
    $3_1 = HEAP32[($1_1 + 8 | 0) >> 2] | 0;
    HEAP32[($1_1 + 8 | 0) >> 2] = $3_1 + -1 | 0;
    if (!$3_1) {
     break block
    }
    block1 : {
     if (!((HEAPU8[((((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($1_1 + 8 | 0) >> 2] | 0, 236) | 0) + 1 | 0) >> 0] | 0 | 0) == (HEAP32[($1_1 + 4 | 0) >> 2] | 0 | 0) & 1 | 0)) {
      break block1
     }
     if (!(HEAPU8[(((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($1_1 + 8 | 0) >> 2] | 0, 236) | 0) >> 0] | 0)) {
      break block1
     }
     if (!((HEAPU8[(((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($1_1 + 8 | 0) >> 2] | 0, 236) | 0) >> 0] | 0 | 0) != (4 | 0) & 1 | 0)) {
      break block1
     }
     $61(HEAP32[($1_1 + 12 | 0) >> 2] | 0 | 0, HEAP32[($1_1 + 8 | 0) >> 2] | 0 | 0);
    }
    continue label;
   };
  }
  global$0 = $1_1 + 16 | 0;
  return;
 }
 
 function $59($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, $6_1 = 0;
  $3_1 = global$0 - 32 | 0;
  global$0 = $3_1;
  HEAP32[($3_1 + 28 | 0) >> 2] = $0_1;
  HEAP32[($3_1 + 24 | 0) >> 2] = $1_1;
  HEAP32[($3_1 + 20 | 0) >> 2] = $2_1;
  block1 : {
   block : {
    if (!((HEAP32[((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 12 | 0) >> 2] | 0) & 1 | 0)) {
     break block
    }
    HEAP32[($3_1 + 16 | 0) >> 2] = 1;
    break block1;
   }
   HEAP32[($3_1 + 16 | 0) >> 2] = 2;
  }
  block2 : {
   label : while (1) {
    if (!(HEAP32[($3_1 + 20 | 0) >> 2] | 0)) {
     break block2
    }
    HEAP32[($3_1 + 12 | 0) >> 2] = HEAP32[($3_1 + 20 | 0) >> 2] | 0;
    block3 : {
     if (!((HEAP32[($3_1 + 12 | 0) >> 2] | 0 | 0) > (HEAP32[((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1064 | 0) >> 2] | 0 | 0) & 1 | 0)) {
      break block3
     }
     HEAP32[($3_1 + 12 | 0) >> 2] = HEAP32[((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1064 | 0) >> 2] | 0;
    }
    $65(HEAP32[($3_1 + 28 | 0) >> 2] | 0 | 0, HEAP32[($3_1 + 12 | 0) >> 2] | 0 | 0);
    FUNCTION_TABLE[HEAP32[((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1060 | 0) >> 2] | 0 | 0](HEAP32[(HEAP32[($3_1 + 24 | 0) >> 2] | 0) >> 2] | 0, HEAP32[((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1072 | 0) >> 2] | 0, Math_imul(HEAP32[($3_1 + 16 | 0) >> 2] | 0, HEAP32[($3_1 + 12 | 0) >> 2] | 0));
    $6_1 = HEAP32[($3_1 + 24 | 0) >> 2] | 0;
    HEAP32[$6_1 >> 2] = Math_imul(HEAP32[((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 16 | 0) >> 2] | 0, HEAP32[($3_1 + 12 | 0) >> 2] | 0) + (HEAP32[$6_1 >> 2] | 0) | 0;
    HEAP32[($3_1 + 20 | 0) >> 2] = (HEAP32[($3_1 + 20 | 0) >> 2] | 0) - (HEAP32[($3_1 + 12 | 0) >> 2] | 0) | 0;
    continue label;
   };
  }
  global$0 = $3_1 + 32 | 0;
  return;
 }
 
 function $60($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0;
  $2_1 = global$0 - 16 | 0;
  global$0 = $2_1;
  HEAP32[($2_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($2_1 + 8 | 0) >> 2] = $1_1;
  block1 : {
   block : {
    if (!((HEAPU8[((HEAP32[((((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 8 | 0) >> 2] | 0, 236) | 0) + 4 | 0) >> 2] | 0) + 102 | 0) >> 0] | 0) & 64 | 0)) {
     break block
    }
    HEAP32[((((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 8 | 0) >> 2] | 0, 236) | 0) + 220 | 0) >> 2] = 3;
    HEAP8[(((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 8 | 0) >> 2] | 0, 236) | 0) >> 0] = 3;
    $20(HEAP32[($2_1 + 12 | 0) >> 2] | 0 | 0, HEAP32[($2_1 + 8 | 0) >> 2] | 0 | 0) | 0;
    $21(HEAP32[($2_1 + 12 | 0) >> 2] | 0 | 0, HEAP32[($2_1 + 8 | 0) >> 2] | 0 | 0);
    break block1;
   }
   HEAP8[(((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 8 | 0) >> 2] | 0, 236) | 0) >> 0] = 3;
  }
  global$0 = $2_1 + 16 | 0;
  return;
 }
 
 function $61($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0;
  $2_1 = global$0 - 16 | 0;
  HEAP32[($2_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($2_1 + 8 | 0) >> 2] = $1_1;
  HEAP8[(((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 8 | 0) >> 2] | 0, 236) | 0) >> 0] = 4;
  return;
 }
 
 function $62($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, $10_1 = 0, $11_1 = 0, $27_1 = 0, $31_1 = 0;
  $3_1 = global$0 - 32 | 0;
  global$0 = $3_1;
  HEAP32[($3_1 + 28 | 0) >> 2] = $0_1;
  HEAP32[($3_1 + 24 | 0) >> 2] = $1_1;
  HEAP32[($3_1 + 20 | 0) >> 2] = $2_1;
  block3 : {
   block7 : {
    block : {
     if (!((HEAP32[((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 13056 | 0) >> 2] | 0) & (1 << (HEAPU8[((HEAP32[($3_1 + 24 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0) | 0) | 0)) {
      break block
     }
     $10_1 = HEAP32[(((HEAP32[(((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 540 | 0) + ((HEAP32[(((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAPU8[((HEAP32[($3_1 + 24 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0, 40) | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0) + 4 | 0) + ((HEAP32[((HEAP32[($3_1 + 24 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0;
     HEAP32[($3_1 + 16 | 0) >> 2] = $10_1;
     block1 : {
      if (($10_1 | 0) != (0 | 0) & 1 | 0) {
       break block1
      }
      $11_1 = HEAP32[(((HEAP32[((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 540 | 0) >> 2] | 0) + 4 | 0) + ((HEAP32[((HEAP32[($3_1 + 24 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0;
      HEAP32[($3_1 + 16 | 0) >> 2] = $11_1;
      block2 : {
       if (($11_1 | 0) != (0 | 0) & 1 | 0) {
        break block2
       }
       break block3;
      }
     }
     block4 : {
      if (!((HEAP32[(HEAP32[($3_1 + 16 | 0) >> 2] | 0) >> 2] | 0 | 0) != (1 | 0) & 1 | 0)) {
       break block4
      }
     }
     block6 : {
      block5 : {
       if (!((HEAPU8[((HEAP32[((HEAP32[($3_1 + 16 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) + 104 | 0) >> 0] | 0 | 0) != (0 & 255 | 0 | 0) & 1 | 0)) {
        break block5
       }
       HEAP32[((((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($3_1 + 20 | 0) >> 2] | 0, 236) | 0) + 8 | 0) >> 2] = HEAP32[(65856 + ((HEAP8[((HEAP32[((HEAP32[($3_1 + 16 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) + 104 | 0) >> 0] | 0) << 2 | 0) | 0) >> 2] | 0;
       break block6;
      }
      HEAP32[((((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($3_1 + 20 | 0) >> 2] | 0, 236) | 0) + 8 | 0) >> 2] = HEAP32[(65856 + (((HEAP32[((HEAP32[($3_1 + 24 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) & 127 | 0) << 2 | 0) | 0) >> 2] | 0;
     }
     HEAP32[((((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($3_1 + 20 | 0) >> 2] | 0, 236) | 0) + 4 | 0) >> 2] = HEAP32[((HEAP32[($3_1 + 16 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
     break block7;
    }
    block9 : {
     block8 : {
      if (!((HEAP32[((((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAPU8[((HEAP32[($3_1 + 24 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0, 40) | 0) + 4 | 0) >> 2] | 0 | 0) == (-1 | 0) & 1 | 0)) {
       break block8
      }
      HEAP32[($3_1 + 16 | 0) >> 2] = HEAP32[((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1052 | 0) >> 2] | 0;
      break block9;
     }
     $27_1 = HEAP32[(((HEAP32[(((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 28 | 0) + ((HEAP32[(((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAPU8[((HEAP32[($3_1 + 24 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0, 40) | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0) + 4 | 0) + ((HEAP32[((((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAPU8[((HEAP32[($3_1 + 24 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0, 40) | 0) + 4 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0;
     HEAP32[($3_1 + 16 | 0) >> 2] = $27_1;
     block10 : {
      if (($27_1 | 0) != (0 | 0) & 1 | 0) {
       break block10
      }
      $31_1 = HEAP32[(((HEAP32[((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 28 | 0) >> 2] | 0) + 4 | 0) + ((HEAP32[((((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAPU8[((HEAP32[($3_1 + 24 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0, 40) | 0) + 4 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0;
      HEAP32[($3_1 + 16 | 0) >> 2] = $31_1;
      block11 : {
       if (($31_1 | 0) != (0 | 0) & 1 | 0) {
        break block11
       }
       break block3;
      }
     }
    }
    block13 : {
     block12 : {
      if (!((HEAPU8[((HEAP32[((HEAP32[($3_1 + 16 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) + 104 | 0) >> 0] | 0 | 0) != (0 & 255 | 0 | 0) & 1 | 0)) {
       break block12
      }
      HEAP32[((((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($3_1 + 20 | 0) >> 2] | 0, 236) | 0) + 8 | 0) >> 2] = HEAP32[(65856 + ((HEAP8[((HEAP32[((HEAP32[($3_1 + 16 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) + 104 | 0) >> 0] | 0) << 2 | 0) | 0) >> 2] | 0;
      break block13;
     }
     HEAP32[((((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($3_1 + 20 | 0) >> 2] | 0, 236) | 0) + 8 | 0) >> 2] = HEAP32[(65856 + (((HEAP32[((HEAP32[($3_1 + 24 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) & 127 | 0) << 2 | 0) | 0) >> 2] | 0;
    }
    $69(HEAP32[($3_1 + 28 | 0) >> 2] | 0 | 0, HEAP32[($3_1 + 20 | 0) >> 2] | 0 | 0, HEAP32[($3_1 + 16 | 0) >> 2] | 0 | 0);
   }
   HEAP8[(((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($3_1 + 20 | 0) >> 2] | 0, 236) | 0) >> 0] = 1;
   HEAP8[((((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($3_1 + 20 | 0) >> 2] | 0, 236) | 0) + 1 | 0) >> 0] = HEAPU8[((HEAP32[($3_1 + 24 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0;
   HEAP8[((((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($3_1 + 20 | 0) >> 2] | 0, 236) | 0) + 2 | 0) >> 0] = HEAP32[((HEAP32[($3_1 + 24 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
   HEAP8[((((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($3_1 + 20 | 0) >> 2] | 0, 236) | 0) + 3 | 0) >> 0] = HEAP32[((HEAP32[($3_1 + 24 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0;
   HEAP32[((((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($3_1 + 20 | 0) >> 2] | 0, 236) | 0) + 16 | 0) >> 2] = 0;
   HEAP32[((((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($3_1 + 20 | 0) >> 2] | 0, 236) | 0) + 20 | 0) >> 2] = 0;
   HEAP32[((((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($3_1 + 20 | 0) >> 2] | 0, 236) | 0) + 44 | 0) >> 2] = 0;
   HEAP32[((((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($3_1 + 20 | 0) >> 2] | 0, 236) | 0) + 48 | 0) >> 2] = HEAP32[((HEAP32[((((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($3_1 + 20 | 0) >> 2] | 0, 236) | 0) + 4 | 0) >> 2] | 0) + 88 | 0) >> 2] | 0;
   HEAP32[((((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($3_1 + 20 | 0) >> 2] | 0, 236) | 0) + 36 | 0) >> 2] = HEAP32[((HEAP32[((((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($3_1 + 20 | 0) >> 2] | 0, 236) | 0) + 4 | 0) >> 2] | 0) + 84 | 0) >> 2] | 0;
   HEAP32[((((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($3_1 + 20 | 0) >> 2] | 0, 236) | 0) + 40 | 0) >> 2] = 0;
   HEAP32[((((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($3_1 + 20 | 0) >> 2] | 0, 236) | 0) + 52 | 0) >> 2] = HEAP32[((HEAP32[((((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($3_1 + 20 | 0) >> 2] | 0, 236) | 0) + 4 | 0) >> 2] | 0) + 92 | 0) >> 2] | 0;
   HEAP32[((((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($3_1 + 20 | 0) >> 2] | 0, 236) | 0) + 56 | 0) >> 2] = 0;
   HEAP32[((((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($3_1 + 20 | 0) >> 2] | 0, 236) | 0) + 212 | 0) >> 2] = HEAP32[((HEAP32[((((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($3_1 + 20 | 0) >> 2] | 0, 236) | 0) + 4 | 0) >> 2] | 0) + 96 | 0) >> 2] | 0;
   HEAP32[((((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($3_1 + 20 | 0) >> 2] | 0, 236) | 0) + 208 | 0) >> 2] = 0;
   HEAP32[((((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($3_1 + 20 | 0) >> 2] | 0, 236) | 0) + 216 | 0) >> 2] = 0;
   HEAP32[($3_1 + 12 | 0) >> 2] = 0;
   block14 : {
    label : while (1) {
     if (!((HEAP32[($3_1 + 12 | 0) >> 2] | 0 | 0) < (32 | 0) & 1 | 0)) {
      break block14
     }
     HEAP32[(((((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($3_1 + 20 | 0) >> 2] | 0, 236) | 0) + 80 | 0) + ((HEAP32[($3_1 + 12 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] = 0;
     HEAP32[($3_1 + 12 | 0) >> 2] = (HEAP32[($3_1 + 12 | 0) >> 2] | 0) + 1 | 0;
     continue label;
    };
   }
   block16 : {
    block15 : {
     if (!((HEAP32[((((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAPU8[((HEAP32[($3_1 + 24 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0, 40) | 0) + 16 | 0) >> 2] | 0 | 0) != (-1 | 0) & 1 | 0)) {
      break block15
     }
     HEAP32[((((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($3_1 + 20 | 0) >> 2] | 0, 236) | 0) + 228 | 0) >> 2] = HEAP32[((((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAPU8[((HEAP32[($3_1 + 24 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0, 40) | 0) + 16 | 0) >> 2] | 0;
     break block16;
    }
    HEAP32[((((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($3_1 + 20 | 0) >> 2] | 0, 236) | 0) + 228 | 0) >> 2] = HEAP8[((HEAP32[((((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($3_1 + 20 | 0) >> 2] | 0, 236) | 0) + 4 | 0) >> 2] | 0) + 103 | 0) >> 0] | 0;
   }
   $64(HEAP32[($3_1 + 28 | 0) >> 2] | 0 | 0, HEAP32[($3_1 + 20 | 0) >> 2] | 0 | 0);
   $63(HEAP32[($3_1 + 28 | 0) >> 2] | 0 | 0, HEAP32[($3_1 + 20 | 0) >> 2] | 0 | 0);
   block17 : {
    if (!((HEAPU8[((HEAP32[((((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($3_1 + 20 | 0) >> 2] | 0, 236) | 0) + 4 | 0) >> 2] | 0) + 102 | 0) >> 0] | 0) & 64 | 0)) {
     break block17
    }
    HEAP32[((((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($3_1 + 20 | 0) >> 2] | 0, 236) | 0) + 220 | 0) >> 2] = 0;
    HEAP32[((((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($3_1 + 20 | 0) >> 2] | 0, 236) | 0) + 24 | 0) >> 2] = 0;
    HEAP32[((((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($3_1 + 20 | 0) >> 2] | 0, 236) | 0) + 224 | 0) >> 2] = 0;
    $20(HEAP32[($3_1 + 28 | 0) >> 2] | 0 | 0, HEAP32[($3_1 + 20 | 0) >> 2] | 0 | 0) | 0;
    $21(HEAP32[($3_1 + 28 | 0) >> 2] | 0 | 0, HEAP32[($3_1 + 20 | 0) >> 2] | 0 | 0);
    break block3;
   }
   HEAP32[((((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($3_1 + 20 | 0) >> 2] | 0, 236) | 0) + 32 | 0) >> 2] = 0;
   $21(HEAP32[($3_1 + 28 | 0) >> 2] | 0 | 0, HEAP32[($3_1 + 20 | 0) >> 2] | 0 | 0);
  }
  global$0 = $3_1 + 32 | 0;
  return;
 }
 
 function $63($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0, i64toi32_i32$0 = 0, i64toi32_i32$2 = 0, i64toi32_i32$3 = 0, i64toi32_i32$1 = 0, $12_1 = 0, $13_1 = 0, $42$hi = 0, $43$hi = 0, $44$hi = 0, $45$hi = 0, $46$hi = 0, $16_1 = 0, $17_1 = 0, $47$hi = 0, $48$hi = 0, $49$hi = 0, $50$hi = 0, $51$hi = 0, $20_1 = 0, $21_1 = 0, $52$hi = 0, $53$hi = 0, $54$hi = 0, $55$hi = 0, $56$hi = 0, $24_1 = 0, $25_1 = 0, $57$hi = 0, $58$hi = 0, $59$hi = 0, $60$hi = 0, $61$hi = 0, $27_1 = 0, $30_1 = 0, $31_1 = 0, $62$hi = 0, $63$hi = 0, $64$hi = 0, $65$hi = 0, $42_1 = 0, $63_1 = 0, $46_1 = 0, $199$hi = 0, $64_1 = 0, $66_1 = Math_fround(0), $47_1 = 0, $70_1 = 0, $51_1 = 0, $268$hi = 0, $71_1 = 0, $67_1 = Math_fround(0), $52_1 = 0, $73_1 = 0, $56_1 = 0, $337$hi = 0, $74_1 = 0, $68_1 = Math_fround(0), $57_1 = 0, $75_1 = 0, $61_1 = 0, $395$hi = 0, $76_1 = 0, $69_1 = Math_fround(0), $62_1 = 0, $77_1 = 0, $65_1 = 0, $500$hi = 0, $78_1 = 0, $72_1 = Math_fround(0);
  $2_1 = global$0 - 176 | 0;
  global$0 = $2_1;
  HEAP32[($2_1 + 172 | 0) >> 2] = $0_1;
  HEAP32[($2_1 + 168 | 0) >> 2] = $1_1;
  HEAP32[($2_1 + 164 | 0) >> 2] = Math_imul(Math_imul(HEAPU8[((((HEAP32[($2_1 + 172 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 168 | 0) >> 2] | 0, 236) | 0) + 3 | 0) >> 0] | 0, HEAP32[((((HEAP32[($2_1 + 172 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAPU8[((((HEAP32[($2_1 + 172 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 168 | 0) >> 2] | 0, 236) | 0) + 1 | 0) >> 0] | 0, 40) | 0) + 8 | 0) >> 2] | 0), HEAP32[((((HEAP32[($2_1 + 172 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAPU8[((((HEAP32[($2_1 + 172 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 168 | 0) >> 2] | 0, 236) | 0) + 1 | 0) >> 0] | 0, 40) | 0) + 24 | 0) >> 2] | 0);
  block7 : {
   block : {
    if ((HEAP32[((HEAP32[($2_1 + 172 | 0) >> 2] | 0) + 12 | 0) >> 2] | 0) & 1 | 0) {
     break block
    }
    block2 : {
     block1 : {
      if (!((HEAP32[((((HEAP32[($2_1 + 172 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 168 | 0) >> 2] | 0, 236) | 0) + 228 | 0) >> 2] | 0 | 0) > (60 | 0) & 1 | 0)) {
       break block1
      }
      if (!((HEAP32[((((HEAP32[($2_1 + 172 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 168 | 0) >> 2] | 0, 236) | 0) + 228 | 0) >> 2] | 0 | 0) < (68 | 0) & 1 | 0)) {
       break block1
      }
      $12_1 = 236;
      HEAP32[(((HEAP32[($2_1 + 172 | 0) >> 2] | 0) + Math_imul(HEAP32[($2_1 + 168 | 0) >> 2] | 0, $12_1) | 0) + 1956 | 0) >> 2] = 3;
      $13_1 = HEAP32[($2_1 + 172 | 0) >> 2] | 0;
      $192($2_1 + 48 | 0 | 0, +(+(HEAP32[($2_1 + 164 | 0) >> 2] | 0 | 0) * +Math_fround(HEAPF32[((HEAP32[(($13_1 + Math_imul($12_1, HEAP32[($2_1 + 168 | 0) >> 2] | 0) | 0) + 1728 | 0) >> 2] | 0) + 76 | 0) >> 2]) * +Math_fround(HEAPF32[($13_1 + 20 | 0) >> 2])));
      i64toi32_i32$2 = $2_1;
      i64toi32_i32$0 = HEAP32[($2_1 + 56 | 0) >> 2] | 0;
      i64toi32_i32$1 = HEAP32[($2_1 + 60 | 0) >> 2] | 0;
      $42_1 = i64toi32_i32$0;
      $42$hi = i64toi32_i32$1;
      i64toi32_i32$2 = $2_1;
      i64toi32_i32$1 = HEAP32[($2_1 + 48 | 0) >> 2] | 0;
      i64toi32_i32$0 = HEAP32[($2_1 + 52 | 0) >> 2] | 0;
      $43$hi = i64toi32_i32$0;
      i64toi32_i32$0 = 1072300032;
      $44$hi = i64toi32_i32$0;
      i64toi32_i32$0 = 0;
      $45$hi = i64toi32_i32$0;
      i64toi32_i32$0 = $43$hi;
      i64toi32_i32$0 = $42$hi;
      i64toi32_i32$0 = $45$hi;
      i64toi32_i32$0 = $44$hi;
      i64toi32_i32$0 = $43$hi;
      $63_1 = i64toi32_i32$1;
      i64toi32_i32$1 = $42$hi;
      i64toi32_i32$2 = $45$hi;
      i64toi32_i32$3 = $44$hi;
      $196($2_1 + 32 | 0 | 0, $63_1 | 0, i64toi32_i32$0 | 0, $42_1 | 0, i64toi32_i32$1 | 0, 0 | 0, i64toi32_i32$2 | 0, 0 | 0, i64toi32_i32$3 | 0);
      i64toi32_i32$1 = $2_1;
      i64toi32_i32$3 = HEAP32[($2_1 + 40 | 0) >> 2] | 0;
      i64toi32_i32$2 = HEAP32[($2_1 + 44 | 0) >> 2] | 0;
      $46_1 = i64toi32_i32$3;
      $46$hi = i64toi32_i32$2;
      i64toi32_i32$1 = $2_1;
      i64toi32_i32$2 = HEAP32[($2_1 + 32 | 0) >> 2] | 0;
      i64toi32_i32$3 = HEAP32[($2_1 + 36 | 0) >> 2] | 0;
      $199$hi = i64toi32_i32$3;
      i64toi32_i32$3 = $46$hi;
      i64toi32_i32$3 = $199$hi;
      $64_1 = i64toi32_i32$2;
      i64toi32_i32$2 = $46$hi;
      $66_1 = Math_fround($201($64_1 | 0, i64toi32_i32$3 | 0, $46_1 | 0, i64toi32_i32$2 | 0));
      HEAPF32[((((HEAP32[($2_1 + 172 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 168 | 0) >> 2] | 0, 236) | 0) + 68 | 0) >> 2] = $66_1;
      break block2;
     }
     block4 : {
      block3 : {
       if (!((HEAP32[((((HEAP32[($2_1 + 172 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 168 | 0) >> 2] | 0, 236) | 0) + 228 | 0) >> 2] | 0 | 0) < (5 | 0) & 1 | 0)) {
        break block3
       }
       $16_1 = 236;
       HEAP32[(((HEAP32[($2_1 + 172 | 0) >> 2] | 0) + Math_imul(HEAP32[($2_1 + 168 | 0) >> 2] | 0, $16_1) | 0) + 1956 | 0) >> 2] = 1;
       $17_1 = HEAP32[($2_1 + 172 | 0) >> 2] | 0;
       $192($2_1 + 80 | 0 | 0, +(+(HEAP32[($2_1 + 164 | 0) >> 2] | 0 | 0) * +Math_fround(HEAPF32[((HEAP32[(($17_1 + Math_imul($16_1, HEAP32[($2_1 + 168 | 0) >> 2] | 0) | 0) + 1728 | 0) >> 2] | 0) + 76 | 0) >> 2]) * +Math_fround(HEAPF32[($17_1 + 20 | 0) >> 2])));
       i64toi32_i32$1 = $2_1;
       i64toi32_i32$2 = HEAP32[($2_1 + 88 | 0) >> 2] | 0;
       i64toi32_i32$3 = HEAP32[($2_1 + 92 | 0) >> 2] | 0;
       $47_1 = i64toi32_i32$2;
       $47$hi = i64toi32_i32$3;
       i64toi32_i32$1 = $2_1;
       i64toi32_i32$3 = HEAP32[($2_1 + 80 | 0) >> 2] | 0;
       i64toi32_i32$2 = HEAP32[($2_1 + 84 | 0) >> 2] | 0;
       $48$hi = i64toi32_i32$2;
       i64toi32_i32$2 = 1072365568;
       $49$hi = i64toi32_i32$2;
       i64toi32_i32$2 = 0;
       $50$hi = i64toi32_i32$2;
       i64toi32_i32$2 = $48$hi;
       i64toi32_i32$2 = $47$hi;
       i64toi32_i32$2 = $50$hi;
       i64toi32_i32$2 = $49$hi;
       i64toi32_i32$2 = $48$hi;
       $70_1 = i64toi32_i32$3;
       i64toi32_i32$3 = $47$hi;
       i64toi32_i32$1 = $50$hi;
       i64toi32_i32$0 = $49$hi;
       $196($2_1 + 64 | 0 | 0, $70_1 | 0, i64toi32_i32$2 | 0, $47_1 | 0, i64toi32_i32$3 | 0, 0 | 0, i64toi32_i32$1 | 0, 0 | 0, i64toi32_i32$0 | 0);
       i64toi32_i32$3 = $2_1;
       i64toi32_i32$0 = HEAP32[($2_1 + 72 | 0) >> 2] | 0;
       i64toi32_i32$1 = HEAP32[($2_1 + 76 | 0) >> 2] | 0;
       $51_1 = i64toi32_i32$0;
       $51$hi = i64toi32_i32$1;
       i64toi32_i32$3 = $2_1;
       i64toi32_i32$1 = HEAP32[($2_1 + 64 | 0) >> 2] | 0;
       i64toi32_i32$0 = HEAP32[($2_1 + 68 | 0) >> 2] | 0;
       $268$hi = i64toi32_i32$0;
       i64toi32_i32$0 = $51$hi;
       i64toi32_i32$0 = $268$hi;
       $71_1 = i64toi32_i32$1;
       i64toi32_i32$1 = $51$hi;
       $67_1 = Math_fround($201($71_1 | 0, i64toi32_i32$0 | 0, $51_1 | 0, i64toi32_i32$1 | 0));
       HEAPF32[((((HEAP32[($2_1 + 172 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 168 | 0) >> 2] | 0, 236) | 0) + 68 | 0) >> 2] = $67_1;
       break block4;
      }
      block6 : {
       block5 : {
        if (!((HEAP32[((((HEAP32[($2_1 + 172 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 168 | 0) >> 2] | 0, 236) | 0) + 228 | 0) >> 2] | 0 | 0) > (123 | 0) & 1 | 0)) {
         break block5
        }
        $20_1 = 236;
        HEAP32[(((HEAP32[($2_1 + 172 | 0) >> 2] | 0) + Math_imul(HEAP32[($2_1 + 168 | 0) >> 2] | 0, $20_1) | 0) + 1956 | 0) >> 2] = 2;
        $21_1 = HEAP32[($2_1 + 172 | 0) >> 2] | 0;
        $192($2_1 + 112 | 0 | 0, +(+(HEAP32[($2_1 + 164 | 0) >> 2] | 0 | 0) * +Math_fround(HEAPF32[((HEAP32[(($21_1 + Math_imul($20_1, HEAP32[($2_1 + 168 | 0) >> 2] | 0) | 0) + 1728 | 0) >> 2] | 0) + 76 | 0) >> 2]) * +Math_fround(HEAPF32[($21_1 + 20 | 0) >> 2])));
        i64toi32_i32$3 = $2_1;
        i64toi32_i32$1 = HEAP32[($2_1 + 120 | 0) >> 2] | 0;
        i64toi32_i32$0 = HEAP32[($2_1 + 124 | 0) >> 2] | 0;
        $52_1 = i64toi32_i32$1;
        $52$hi = i64toi32_i32$0;
        i64toi32_i32$3 = $2_1;
        i64toi32_i32$0 = HEAP32[($2_1 + 112 | 0) >> 2] | 0;
        i64toi32_i32$1 = HEAP32[($2_1 + 116 | 0) >> 2] | 0;
        $53$hi = i64toi32_i32$1;
        i64toi32_i32$1 = 1072365568;
        $54$hi = i64toi32_i32$1;
        i64toi32_i32$1 = 0;
        $55$hi = i64toi32_i32$1;
        i64toi32_i32$1 = $53$hi;
        i64toi32_i32$1 = $52$hi;
        i64toi32_i32$1 = $55$hi;
        i64toi32_i32$1 = $54$hi;
        i64toi32_i32$1 = $53$hi;
        $73_1 = i64toi32_i32$0;
        i64toi32_i32$0 = $52$hi;
        i64toi32_i32$3 = $55$hi;
        i64toi32_i32$2 = $54$hi;
        $196($2_1 + 96 | 0 | 0, $73_1 | 0, i64toi32_i32$1 | 0, $52_1 | 0, i64toi32_i32$0 | 0, 0 | 0, i64toi32_i32$3 | 0, 0 | 0, i64toi32_i32$2 | 0);
        i64toi32_i32$0 = $2_1;
        i64toi32_i32$2 = HEAP32[($2_1 + 104 | 0) >> 2] | 0;
        i64toi32_i32$3 = HEAP32[($2_1 + 108 | 0) >> 2] | 0;
        $56_1 = i64toi32_i32$2;
        $56$hi = i64toi32_i32$3;
        i64toi32_i32$0 = $2_1;
        i64toi32_i32$3 = HEAP32[($2_1 + 96 | 0) >> 2] | 0;
        i64toi32_i32$2 = HEAP32[($2_1 + 100 | 0) >> 2] | 0;
        $337$hi = i64toi32_i32$2;
        i64toi32_i32$2 = $56$hi;
        i64toi32_i32$2 = $337$hi;
        $74_1 = i64toi32_i32$3;
        i64toi32_i32$3 = $56$hi;
        $68_1 = Math_fround($201($74_1 | 0, i64toi32_i32$2 | 0, $56_1 | 0, i64toi32_i32$3 | 0));
        HEAPF32[((((HEAP32[($2_1 + 172 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 168 | 0) >> 2] | 0, 236) | 0) + 68 | 0) >> 2] = $68_1;
        break block6;
       }
       $24_1 = 236;
       HEAP32[(((HEAP32[($2_1 + 172 | 0) >> 2] | 0) + Math_imul(HEAP32[($2_1 + 168 | 0) >> 2] | 0, $24_1) | 0) + 1956 | 0) >> 2] = 0;
       $25_1 = HEAP32[($2_1 + 172 | 0) >> 2] | 0;
       $192($2_1 + 144 | 0 | 0, +(+(HEAP32[($2_1 + 164 | 0) >> 2] | 0 | 0) * +Math_fround(HEAPF32[((HEAP32[(($25_1 + Math_imul($24_1, HEAP32[($2_1 + 168 | 0) >> 2] | 0) | 0) + 1728 | 0) >> 2] | 0) + 76 | 0) >> 2]) * +Math_fround(HEAPF32[($25_1 + 20 | 0) >> 2])));
       i64toi32_i32$0 = $2_1;
       i64toi32_i32$3 = HEAP32[($2_1 + 152 | 0) >> 2] | 0;
       i64toi32_i32$2 = HEAP32[($2_1 + 156 | 0) >> 2] | 0;
       $57_1 = i64toi32_i32$3;
       $57$hi = i64toi32_i32$2;
       i64toi32_i32$0 = $2_1;
       i64toi32_i32$2 = HEAP32[($2_1 + 144 | 0) >> 2] | 0;
       i64toi32_i32$3 = HEAP32[($2_1 + 148 | 0) >> 2] | 0;
       $58$hi = i64toi32_i32$3;
       i64toi32_i32$3 = 1071906816;
       $59$hi = i64toi32_i32$3;
       i64toi32_i32$3 = 0;
       $60$hi = i64toi32_i32$3;
       i64toi32_i32$3 = $58$hi;
       i64toi32_i32$3 = $57$hi;
       i64toi32_i32$3 = $60$hi;
       i64toi32_i32$3 = $59$hi;
       i64toi32_i32$3 = $58$hi;
       $75_1 = i64toi32_i32$2;
       i64toi32_i32$2 = $57$hi;
       i64toi32_i32$0 = $60$hi;
       i64toi32_i32$1 = $59$hi;
       $196($2_1 + 128 | 0 | 0, $75_1 | 0, i64toi32_i32$3 | 0, $57_1 | 0, i64toi32_i32$2 | 0, 0 | 0, i64toi32_i32$0 | 0, 0 | 0, i64toi32_i32$1 | 0);
       i64toi32_i32$2 = $2_1;
       i64toi32_i32$1 = HEAP32[($2_1 + 136 | 0) >> 2] | 0;
       i64toi32_i32$0 = HEAP32[($2_1 + 140 | 0) >> 2] | 0;
       $61_1 = i64toi32_i32$1;
       $61$hi = i64toi32_i32$0;
       i64toi32_i32$2 = $2_1;
       i64toi32_i32$0 = HEAP32[($2_1 + 128 | 0) >> 2] | 0;
       i64toi32_i32$1 = HEAP32[($2_1 + 132 | 0) >> 2] | 0;
       $395$hi = i64toi32_i32$1;
       i64toi32_i32$1 = $61$hi;
       i64toi32_i32$1 = $395$hi;
       $76_1 = i64toi32_i32$0;
       i64toi32_i32$0 = $61$hi;
       $69_1 = Math_fround($201($76_1 | 0, i64toi32_i32$1 | 0, $61_1 | 0, i64toi32_i32$0 | 0));
       HEAPF32[((((HEAP32[($2_1 + 172 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 168 | 0) >> 2] | 0, 236) | 0) + 68 | 0) >> 2] = $69_1;
       HEAPF32[((((HEAP32[($2_1 + 172 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 168 | 0) >> 2] | 0, 236) | 0) + 72 | 0) >> 2] = Math_fround(Math_fround(HEAPF32[((((HEAP32[($2_1 + 172 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 168 | 0) >> 2] | 0, 236) | 0) + 68 | 0) >> 2]) * Math_fround(HEAP32[((((HEAP32[($2_1 + 172 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 168 | 0) >> 2] | 0, 236) | 0) + 228 | 0) >> 2] | 0 | 0));
       $27_1 = ((HEAP32[($2_1 + 172 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 168 | 0) >> 2] | 0, 236) | 0;
       HEAPF32[($27_1 + 68 | 0) >> 2] = Math_fround(Math_fround(127 - (HEAP32[((((HEAP32[($2_1 + 172 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 168 | 0) >> 2] | 0, 236) | 0) + 228 | 0) >> 2] | 0) | 0 | 0) * Math_fround(HEAPF32[($27_1 + 68 | 0) >> 2]));
      }
     }
    }
    break block7;
   }
   $30_1 = 236;
   HEAP32[(((HEAP32[($2_1 + 172 | 0) >> 2] | 0) + Math_imul(HEAP32[($2_1 + 168 | 0) >> 2] | 0, $30_1) | 0) + 1956 | 0) >> 2] = 3;
   $31_1 = HEAP32[($2_1 + 172 | 0) >> 2] | 0;
   $192($2_1 + 16 | 0 | 0, +(+(HEAP32[($2_1 + 164 | 0) >> 2] | 0 | 0) * +Math_fround(HEAPF32[((HEAP32[(($31_1 + Math_imul($30_1, HEAP32[($2_1 + 168 | 0) >> 2] | 0) | 0) + 1728 | 0) >> 2] | 0) + 76 | 0) >> 2]) * +Math_fround(HEAPF32[($31_1 + 20 | 0) >> 2])));
   i64toi32_i32$2 = $2_1;
   i64toi32_i32$0 = HEAP32[($2_1 + 24 | 0) >> 2] | 0;
   i64toi32_i32$1 = HEAP32[($2_1 + 28 | 0) >> 2] | 0;
   $62_1 = i64toi32_i32$0;
   $62$hi = i64toi32_i32$1;
   i64toi32_i32$2 = $2_1;
   i64toi32_i32$1 = HEAP32[($2_1 + 16 | 0) >> 2] | 0;
   i64toi32_i32$0 = HEAP32[($2_1 + 20 | 0) >> 2] | 0;
   $63$hi = i64toi32_i32$0;
   i64toi32_i32$0 = 1072300032;
   $64$hi = i64toi32_i32$0;
   i64toi32_i32$0 = $63$hi;
   i64toi32_i32$0 = $62$hi;
   i64toi32_i32$0 = $64$hi;
   i64toi32_i32$0 = $63$hi;
   $77_1 = i64toi32_i32$1;
   i64toi32_i32$1 = $62$hi;
   i64toi32_i32$2 = 0;
   i64toi32_i32$3 = $64$hi;
   $196($2_1 | 0, $77_1 | 0, i64toi32_i32$0 | 0, $62_1 | 0, i64toi32_i32$1 | 0, 0 | 0, i64toi32_i32$2 | 0, 0 | 0, i64toi32_i32$3 | 0);
   i64toi32_i32$1 = $2_1;
   i64toi32_i32$3 = HEAP32[($2_1 + 8 | 0) >> 2] | 0;
   i64toi32_i32$2 = HEAP32[($2_1 + 12 | 0) >> 2] | 0;
   $65_1 = i64toi32_i32$3;
   $65$hi = i64toi32_i32$2;
   i64toi32_i32$1 = $2_1;
   i64toi32_i32$2 = HEAP32[$2_1 >> 2] | 0;
   i64toi32_i32$3 = HEAP32[($2_1 + 4 | 0) >> 2] | 0;
   $500$hi = i64toi32_i32$3;
   i64toi32_i32$3 = $65$hi;
   i64toi32_i32$3 = $500$hi;
   $78_1 = i64toi32_i32$2;
   i64toi32_i32$2 = $65$hi;
   $72_1 = Math_fround($201($78_1 | 0, i64toi32_i32$3 | 0, $65_1 | 0, i64toi32_i32$2 | 0));
   HEAPF32[((((HEAP32[($2_1 + 172 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 168 | 0) >> 2] | 0, 236) | 0) + 68 | 0) >> 2] = $72_1;
  }
  global$0 = $2_1 + 176 | 0;
  return;
 }
 
 function $64($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0, $5_1 = 0, $13_1 = 0, $16_1 = 0, $26_1 = 0.0, $248 = 0, $18_1 = 0, $19_1 = 0, $27_1 = 0.0, $283 = 0, $21_1 = 0, $22_1 = 0, $23_1 = 0, $28_1 = 0.0, $337 = 0;
  $2_1 = global$0 - 32 | 0;
  HEAP32[($2_1 + 28 | 0) >> 2] = $0_1;
  HEAP32[($2_1 + 24 | 0) >> 2] = $1_1;
  HEAP32[($2_1 + 20 | 0) >> 2] = (HEAP32[((((HEAP32[($2_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 24 | 0) >> 2] | 0, 236) | 0) + 20 | 0) >> 2] | 0 | 0) < (0 | 0) & 1 | 0;
  HEAP32[($2_1 + 16 | 0) >> 2] = HEAP32[((((HEAP32[($2_1 + 28 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAPU8[((((HEAP32[($2_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 24 | 0) >> 2] | 0, 236) | 0) + 1 | 0) >> 0] | 0, 40) | 0) + 20 | 0) >> 2] | 0;
  block1 : {
   block : {
    if (HEAP32[((HEAP32[((((HEAP32[($2_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 24 | 0) >> 2] | 0, 236) | 0) + 4 | 0) >> 2] | 0) + 12 | 0) >> 2] | 0) {
     break block
    }
    break block1;
   }
   block2 : {
    if (!(HEAP32[((((HEAP32[($2_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 24 | 0) >> 2] | 0, 236) | 0) + 212 | 0) >> 2] | 0)) {
     break block2
    }
    HEAP32[($2_1 + 4 | 0) >> 2] = 32;
    block3 : {
     label : while (1) {
      $5_1 = HEAP32[($2_1 + 4 | 0) >> 2] | 0;
      HEAP32[($2_1 + 4 | 0) >> 2] = $5_1 + -1 | 0;
      if (!$5_1) {
       break block3
      }
      HEAP32[(((((HEAP32[($2_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 24 | 0) >> 2] | 0, 236) | 0) + 80 | 0) + ((HEAP32[($2_1 + 4 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] = 0;
      continue label;
     };
    }
   }
   block6 : {
    block5 : {
     block4 : {
      if ((HEAP32[($2_1 + 16 | 0) >> 2] | 0 | 0) == (8192 | 0) & 1 | 0) {
       break block4
      }
      if ((HEAP32[($2_1 + 16 | 0) >> 2] | 0 | 0) < (0 | 0) & 1 | 0) {
       break block4
      }
      if (!((HEAP32[($2_1 + 16 | 0) >> 2] | 0 | 0) > (16383 | 0) & 1 | 0)) {
       break block5
      }
     }
     HEAP32[((((HEAP32[($2_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 24 | 0) >> 2] | 0, 236) | 0) + 12 | 0) >> 2] = HEAP32[((((HEAP32[($2_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 24 | 0) >> 2] | 0, 236) | 0) + 8 | 0) >> 2] | 0;
     break block6;
    }
    HEAP32[($2_1 + 16 | 0) >> 2] = (HEAP32[($2_1 + 16 | 0) >> 2] | 0) - 8192 | 0;
    block7 : {
     if (Math_fround(HEAPF32[((((HEAP32[($2_1 + 28 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAPU8[((((HEAP32[($2_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 24 | 0) >> 2] | 0, 236) | 0) + 1 | 0) >> 0] | 0, 40) | 0) + 36 | 0) >> 2]) != Math_fround(0 | 0) & 1 | 0) {
      break block7
     }
     HEAP32[$2_1 >> 2] = Math_imul(HEAP32[($2_1 + 16 | 0) >> 2] | 0, HEAP32[((((HEAP32[($2_1 + 28 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAPU8[((((HEAP32[($2_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 24 | 0) >> 2] | 0, 236) | 0) + 1 | 0) >> 0] | 0, 40) | 0) + 32 | 0) >> 2] | 0);
     block8 : {
      if (!((HEAP32[($2_1 + 16 | 0) >> 2] | 0 | 0) < (0 | 0) & 1 | 0)) {
       break block8
      }
      HEAP32[$2_1 >> 2] = 0 - (HEAP32[$2_1 >> 2] | 0) | 0;
     }
     $13_1 = HEAP32[$2_1 >> 2] | 0;
     HEAPF32[((((HEAP32[($2_1 + 28 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAPU8[((((HEAP32[($2_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 24 | 0) >> 2] | 0, 236) | 0) + 1 | 0) >> 0] | 0, 40) | 0) + 36 | 0) >> 2] = Math_fround(+HEAPF64[((($13_1 >>> 2 | 0) & 2040 | 0) + 67392 | 0) >> 3] * +HEAPF64[((($13_1 >> 13 | 0) << 3 | 0) + 69440 | 0) >> 3]);
    }
    block10 : {
     block9 : {
      if (!((HEAP32[($2_1 + 16 | 0) >> 2] | 0 | 0) > (0 | 0) & 1 | 0)) {
       break block9
      }
      $16_1 = HEAP32[($2_1 + 28 | 0) >> 2] | 0;
      $26_1 = +Math_fround(HEAPF32[(($16_1 + Math_imul(HEAPU8[(($16_1 + Math_imul(HEAP32[($2_1 + 24 | 0) >> 2] | 0, 236) | 0) + 1725 | 0) >> 0] | 0, 40) | 0) + 1120 | 0) >> 2]) * +(HEAP32[((((HEAP32[($2_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 24 | 0) >> 2] | 0, 236) | 0) + 8 | 0) >> 2] | 0 | 0);
      if (Math_abs($26_1) < 2147483647.0) {
       $248 = ~~$26_1
      } else {
       $248 = -2147483648
      }
      HEAP32[((((HEAP32[($2_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 24 | 0) >> 2] | 0, 236) | 0) + 12 | 0) >> 2] = $248;
      break block10;
     }
     $18_1 = HEAP32[($2_1 + 28 | 0) >> 2] | 0;
     $19_1 = $18_1 + Math_imul(HEAP32[($2_1 + 24 | 0) >> 2] | 0, 236) | 0;
     $27_1 = +(HEAP32[($19_1 + 1732 | 0) >> 2] | 0 | 0) / +Math_fround(HEAPF32[(($18_1 + Math_imul(HEAPU8[($19_1 + 1725 | 0) >> 0] | 0, 40) | 0) + 1120 | 0) >> 2]);
     if (Math_abs($27_1) < 2147483647.0) {
      $283 = ~~$27_1
     } else {
      $283 = -2147483648
     }
     HEAP32[((((HEAP32[($2_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 24 | 0) >> 2] | 0, 236) | 0) + 12 | 0) >> 2] = $283;
    }
   }
   $21_1 = HEAP32[($2_1 + 28 | 0) >> 2] | 0;
   $22_1 = $21_1 + Math_imul(HEAP32[($2_1 + 24 | 0) >> 2] | 0, 236) | 0;
   $23_1 = HEAP32[($22_1 + 1728 | 0) >> 2] | 0;
   HEAPF64[($2_1 + 8 | 0) >> 3] = +Math_fround(+(HEAP32[($23_1 + 12 | 0) >> 2] | 0 | 0) * +(HEAP32[($22_1 + 1736 | 0) >> 2] | 0 | 0) / (+(HEAP32[($23_1 + 24 | 0) >> 2] | 0 | 0) * +(HEAP32[($21_1 + 8 | 0) >> 2] | 0 | 0)) * 4096.0);
   block11 : {
    if (!(HEAP32[($2_1 + 20 | 0) >> 2] | 0)) {
     break block11
    }
    HEAPF64[($2_1 + 8 | 0) >> 3] = -+HEAPF64[($2_1 + 8 | 0) >> 3];
   }
   $28_1 = +HEAPF64[($2_1 + 8 | 0) >> 3];
   if (Math_abs($28_1) < 2147483647.0) {
    $337 = ~~$28_1
   } else {
    $337 = -2147483648
   }
   HEAP32[((((HEAP32[($2_1 + 28 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 24 | 0) >> 2] | 0, 236) | 0) + 20 | 0) >> 2] = $337;
  }
  return;
 }
 
 function $65($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0, $4_1 = 0, $5_1 = 0, $9_1 = 0, $3_1 = 0, $6_1 = 0;
  $2_1 = global$0 - 16 | 0;
  global$0 = $2_1;
  HEAP32[($2_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($2_1 + 8 | 0) >> 2] = $1_1;
  $3_1 = HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 1072 | 0) >> 2] | 0;
  block1 : {
   block : {
    if (!((HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 12 | 0) >> 2] | 0) & 1 | 0)) {
     break block
    }
    $4_1 = (HEAP32[($2_1 + 8 | 0) >> 2] | 0) << 2 | 0;
    break block1;
   }
   $4_1 = (HEAP32[($2_1 + 8 | 0) >> 2] | 0) << 3 | 0;
  }
  $5_1 = $4_1;
  $6_1 = 0;
  block2 : {
   if (!$5_1) {
    break block2
   }
   wasm2js_memory_fill($3_1, $6_1, $5_1);
  }
  HEAP32[($2_1 + 4 | 0) >> 2] = 0;
  block3 : {
   label : while (1) {
    if (!((HEAP32[($2_1 + 4 | 0) >> 2] | 0 | 0) < (HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 13052 | 0) >> 2] | 0 | 0) & 1 | 0)) {
     break block3
    }
    block4 : {
     if (!(HEAPU8[(((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 4 | 0) >> 2] | 0, 236) | 0) >> 0] | 0)) {
      break block4
     }
     $22(HEAP32[($2_1 + 12 | 0) >> 2] | 0 | 0, HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 1072 | 0) >> 2] | 0 | 0, HEAP32[($2_1 + 4 | 0) >> 2] | 0 | 0, HEAP32[($2_1 + 8 | 0) >> 2] | 0 | 0);
    }
    HEAP32[($2_1 + 4 | 0) >> 2] = (HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 1 | 0;
    continue label;
   };
  }
  $9_1 = HEAP32[($2_1 + 12 | 0) >> 2] | 0;
  HEAP32[($9_1 + 13088 | 0) >> 2] = (HEAP32[($2_1 + 8 | 0) >> 2] | 0) + (HEAP32[($9_1 + 13088 | 0) >> 2] | 0) | 0;
  global$0 = $2_1 + 16 | 0;
  return;
 }
 
 function $66($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0;
  $2_1 = global$0 - 16 | 0;
  global$0 = $2_1;
  HEAP32[($2_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($2_1 + 8 | 0) >> 2] = $1_1;
  block1 : {
   block : {
    if (!((HEAP32[($2_1 + 8 | 0) >> 2] | 0 | 0) > (800 | 0) & 1 | 0)) {
     break block
    }
    HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 24 | 0) >> 2] = 800;
    break block1;
   }
   block3 : {
    block2 : {
     if (!((HEAP32[($2_1 + 8 | 0) >> 2] | 0 | 0) < (0 | 0) & 1 | 0)) {
      break block2
     }
     HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 24 | 0) >> 2] = 0;
     break block3;
    }
    HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 24 | 0) >> 2] = HEAP32[($2_1 + 8 | 0) >> 2] | 0;
   }
  }
  $42(HEAP32[($2_1 + 12 | 0) >> 2] | 0 | 0);
  HEAP32[($2_1 + 4 | 0) >> 2] = 0;
  block4 : {
   label : while (1) {
    if (!((HEAP32[($2_1 + 4 | 0) >> 2] | 0 | 0) < (HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 13052 | 0) >> 2] | 0 | 0) & 1 | 0)) {
     break block4
    }
    block5 : {
     if (!(HEAPU8[(((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 4 | 0) >> 2] | 0, 236) | 0) >> 0] | 0)) {
      break block5
     }
     $63(HEAP32[($2_1 + 12 | 0) >> 2] | 0 | 0, HEAP32[($2_1 + 4 | 0) >> 2] | 0 | 0);
     $21(HEAP32[($2_1 + 12 | 0) >> 2] | 0 | 0, HEAP32[($2_1 + 4 | 0) >> 2] | 0 | 0);
    }
    HEAP32[($2_1 + 4 | 0) >> 2] = (HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 1 | 0;
    continue label;
   };
  }
  global$0 = $2_1 + 16 | 0;
  return;
 }
 
 function $67($0_1, $1_1, $2_1, $3_1, $4_1, $5_1, $6_1, $7_1, $8_1, $9_1, $10_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  $4_1 = $4_1 | 0;
  $5_1 = $5_1 | 0;
  $6_1 = $6_1 | 0;
  $7_1 = $7_1 | 0;
  $8_1 = $8_1 | 0;
  $9_1 = $9_1 | 0;
  $10_1 = $10_1 | 0;
  var $11_1 = 0, $12_1 = 0, $19_1 = 0, $20_1 = 0, $22_1 = 0, $23_1 = 0, $26_1 = 0, $306 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $11_1 = global$0 - 80 | 0;
  global$0 = $11_1;
  HEAP32[($11_1 + 72 | 0) >> 2] = $0_1;
  HEAP32[($11_1 + 68 | 0) >> 2] = $1_1;
  HEAP32[($11_1 + 64 | 0) >> 2] = $2_1;
  HEAP32[($11_1 + 60 | 0) >> 2] = $3_1;
  HEAP32[($11_1 + 56 | 0) >> 2] = $4_1;
  HEAP32[($11_1 + 52 | 0) >> 2] = $5_1;
  HEAP32[($11_1 + 48 | 0) >> 2] = $6_1;
  HEAP32[($11_1 + 44 | 0) >> 2] = $7_1;
  HEAP32[($11_1 + 40 | 0) >> 2] = $8_1;
  HEAP32[($11_1 + 36 | 0) >> 2] = $9_1;
  HEAP32[($11_1 + 32 | 0) >> 2] = $10_1;
  block2 : {
   block1 : {
    block : {
     if (!((HEAP32[($11_1 + 72 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
      break block
     }
     if (HEAP32[((HEAP32[($11_1 + 72 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) {
      break block1
     }
    }
    HEAP32[($11_1 + 76 | 0) >> 2] = -1;
    break block2;
   }
   block3 : {
    if (!((HEAP32[($11_1 + 68 | 0) >> 2] | 0 | 0) == (9 | 0) & 1 | 0)) {
     break block3
    }
    $12_1 = HEAP32[($11_1 + 72 | 0) >> 2] | 0;
    HEAP32[($12_1 + 13056 | 0) >> 2] = HEAP32[($12_1 + 13056 | 0) >> 2] | 0 | 512 | 0;
   }
   HEAP32[((((HEAP32[($11_1 + 72 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAP32[($11_1 + 68 | 0) >> 2] | 0, 40) | 0) + 16 | 0) >> 2] = HEAP32[($11_1 + 48 | 0) >> 2] | 0;
   HEAP32[((((HEAP32[($11_1 + 72 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAP32[($11_1 + 68 | 0) >> 2] | 0, 40) | 0) + 20 | 0) >> 2] = HEAP32[($11_1 + 44 | 0) >> 2] | 0;
   HEAP32[((((HEAP32[($11_1 + 72 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAP32[($11_1 + 68 | 0) >> 2] | 0, 40) | 0) + 12 | 0) >> 2] = HEAP32[($11_1 + 32 | 0) >> 2] | 0;
   HEAPF32[((((HEAP32[($11_1 + 72 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAP32[($11_1 + 68 | 0) >> 2] | 0, 40) | 0) + 36 | 0) >> 2] = Math_fround(0 | 0);
   HEAP32[(((HEAP32[($11_1 + 72 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAP32[($11_1 + 68 | 0) >> 2] | 0, 40) | 0) >> 2] = HEAP32[($11_1 + 64 | 0) >> 2] | 0;
   block7 : {
    block4 : {
     if (!((HEAP32[((HEAP32[($11_1 + 72 | 0) >> 2] | 0) + 13056 | 0) >> 2] | 0) & (1 << (HEAP32[($11_1 + 68 | 0) >> 2] | 0) | 0) | 0)) {
      break block4
     }
     $19_1 = HEAP32[(((HEAP32[(((HEAP32[($11_1 + 72 | 0) >> 2] | 0) + 540 | 0) + ((HEAP32[(((HEAP32[($11_1 + 72 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAP32[($11_1 + 68 | 0) >> 2] | 0, 40) | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0) + 4 | 0) + ((HEAP32[($11_1 + 56 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0;
     HEAP32[($11_1 + 12 | 0) >> 2] = $19_1;
     block5 : {
      if (($19_1 | 0) != (0 | 0) & 1 | 0) {
       break block5
      }
      $20_1 = HEAP32[(((HEAP32[((HEAP32[($11_1 + 72 | 0) >> 2] | 0) + 540 | 0) >> 2] | 0) + 4 | 0) + ((HEAP32[($11_1 + 56 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0;
      HEAP32[($11_1 + 12 | 0) >> 2] = $20_1;
      block6 : {
       if (($20_1 | 0) != (0 | 0) & 1 | 0) {
        break block6
       }
       HEAP32[($11_1 + 76 | 0) >> 2] = HEAP32[($11_1 + 56 | 0) >> 2] | 0;
       break block2;
      }
     }
     break block7;
    }
    block8 : {
     if (!((HEAP32[((((HEAP32[($11_1 + 72 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAP32[($11_1 + 68 | 0) >> 2] | 0, 40) | 0) + 4 | 0) >> 2] | 0 | 0) != (HEAP32[($11_1 + 60 | 0) >> 2] | 0 | 0) & 1 | 0)) {
      break block8
     }
     HEAP32[((((HEAP32[($11_1 + 72 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAP32[($11_1 + 68 | 0) >> 2] | 0, 40) | 0) + 4 | 0) >> 2] = HEAP32[($11_1 + 60 | 0) >> 2] | 0;
    }
    block10 : {
     block9 : {
      if (!((HEAP32[((((HEAP32[($11_1 + 72 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAP32[($11_1 + 68 | 0) >> 2] | 0, 40) | 0) + 4 | 0) >> 2] | 0 | 0) == (-1 | 0) & 1 | 0)) {
       break block9
      }
      HEAP32[($11_1 + 12 | 0) >> 2] = HEAP32[((HEAP32[($11_1 + 72 | 0) >> 2] | 0) + 1052 | 0) >> 2] | 0;
      break block10;
     }
     $22_1 = HEAP32[(((HEAP32[(((HEAP32[($11_1 + 72 | 0) >> 2] | 0) + 28 | 0) + ((HEAP32[(((HEAP32[($11_1 + 72 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAP32[($11_1 + 68 | 0) >> 2] | 0, 40) | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0) + 4 | 0) + ((HEAP32[((((HEAP32[($11_1 + 72 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAP32[($11_1 + 68 | 0) >> 2] | 0, 40) | 0) + 4 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0;
     HEAP32[($11_1 + 12 | 0) >> 2] = $22_1;
     block11 : {
      if (($22_1 | 0) != (0 | 0) & 1 | 0) {
       break block11
      }
      $23_1 = HEAP32[(((HEAP32[((HEAP32[($11_1 + 72 | 0) >> 2] | 0) + 28 | 0) >> 2] | 0) + 4 | 0) + ((HEAP32[((((HEAP32[($11_1 + 72 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAP32[($11_1 + 68 | 0) >> 2] | 0, 40) | 0) + 4 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0;
      HEAP32[($11_1 + 12 | 0) >> 2] = $23_1;
      block12 : {
       if (($23_1 | 0) != (0 | 0) & 1 | 0) {
        break block12
       }
       HEAP32[($11_1 + 76 | 0) >> 2] = HEAP32[($11_1 + 60 | 0) >> 2] | 0;
       break block2;
      }
      block13 : {
       if ((HEAP32[($11_1 + 12 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
        break block13
       }
       HEAP32[($11_1 + 76 | 0) >> 2] = HEAP32[($11_1 + 60 | 0) >> 2] | 0;
       break block2;
      }
     }
    }
   }
   HEAP8[($11_1 + 29 | 0) >> 0] = 1;
   HEAP8[($11_1 + 28 | 0) >> 0] = HEAP32[($11_1 + 68 | 0) >> 2] | 0;
   HEAP32[($11_1 + 20 | 0) >> 2] = HEAP32[($11_1 + 56 | 0) >> 2] | 0;
   HEAP32[($11_1 + 24 | 0) >> 2] = HEAP32[($11_1 + 52 | 0) >> 2] | 0;
   (wasm2js_i32$0 = $11_1, wasm2js_i32$1 = $68(HEAP32[($11_1 + 72 | 0) >> 2] | 0 | 0, $11_1 + 16 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 8 | 0) >> 2] = wasm2js_i32$1;
   block14 : {
    if (!((HEAP32[($11_1 + 8 | 0) >> 2] | 0 | 0) != (-1 | 0) & 1 | 0)) {
     break block14
    }
    $62(HEAP32[($11_1 + 72 | 0) >> 2] | 0 | 0, $11_1 + 16 | 0 | 0, HEAP32[($11_1 + 8 | 0) >> 2] | 0 | 0);
   }
   HEAP32[($11_1 + 76 | 0) >> 2] = 0;
  }
  $26_1 = HEAP32[($11_1 + 76 | 0) >> 2] | 0;
  global$0 = $11_1 + 80 | 0;
  return $26_1 | 0;
 }
 
 function $68($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0, $3_1 = 0, $11_1 = 0, $105_1 = 0;
  $2_1 = global$0 - 32 | 0;
  global$0 = $2_1;
  HEAP32[($2_1 + 24 | 0) >> 2] = $0_1;
  HEAP32[($2_1 + 20 | 0) >> 2] = $1_1;
  HEAP32[($2_1 + 16 | 0) >> 2] = HEAP32[((HEAP32[($2_1 + 24 | 0) >> 2] | 0) + 13052 | 0) >> 2] | 0;
  HEAP32[($2_1 + 12 | 0) >> 2] = -1;
  HEAP32[($2_1 + 8 | 0) >> 2] = 2147483647;
  block2 : {
   block : {
    label : while (1) {
     $3_1 = HEAP32[($2_1 + 16 | 0) >> 2] | 0;
     HEAP32[($2_1 + 16 | 0) >> 2] = $3_1 + -1 | 0;
     if (!$3_1) {
      break block
     }
     block1 : {
      if (HEAPU8[(((HEAP32[($2_1 + 24 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 16 | 0) >> 2] | 0, 236) | 0) >> 0] | 0) {
       break block1
      }
      HEAP32[($2_1 + 28 | 0) >> 2] = HEAP32[($2_1 + 16 | 0) >> 2] | 0;
      break block2;
     }
     block3 : {
      if (!((HEAPU8[((((HEAP32[($2_1 + 24 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 16 | 0) >> 2] | 0, 236) | 0) + 1 | 0) >> 0] | 0 | 0) == (HEAPU8[((HEAP32[($2_1 + 20 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0 | 0) & 1 | 0)) {
       break block3
      }
      block4 : {
       if ((HEAPU8[((((HEAP32[($2_1 + 24 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 16 | 0) >> 2] | 0, 236) | 0) + 2 | 0) >> 0] | 0 | 0) == (HEAP32[((HEAP32[($2_1 + 20 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0 | 0) & 1 | 0) {
        break block4
       }
       if (!(HEAP32[((((HEAP32[($2_1 + 24 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAPU8[((((HEAP32[($2_1 + 24 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($2_1 + 16 | 0) >> 2] | 0, 236) | 0) + 1 | 0) >> 0] | 0, 40) | 0) + 28 | 0) >> 2] | 0)) {
        break block3
       }
      }
      $61(HEAP32[($2_1 + 24 | 0) >> 2] | 0 | 0, HEAP32[($2_1 + 16 | 0) >> 2] | 0 | 0);
      HEAP32[($2_1 + 28 | 0) >> 2] = HEAP32[($2_1 + 16 | 0) >> 2] | 0;
      break block2;
     }
     continue label;
    };
   }
   HEAP32[($2_1 + 28 | 0) >> 2] = -1;
  }
  $11_1 = HEAP32[($2_1 + 28 | 0) >> 2] | 0;
  global$0 = $2_1 + 32 | 0;
  return $11_1 | 0;
 }
 
 function $69($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, $6_1 = 0;
  $3_1 = global$0 - 48 | 0;
  HEAP32[($3_1 + 44 | 0) >> 2] = $0_1;
  HEAP32[($3_1 + 40 | 0) >> 2] = $1_1;
  HEAP32[($3_1 + 36 | 0) >> 2] = $2_1;
  HEAP32[($3_1 + 20 | 0) >> 2] = HEAP32[(HEAP32[($3_1 + 36 | 0) >> 2] | 0) >> 2] | 0;
  HEAP32[($3_1 + 12 | 0) >> 2] = HEAP32[((HEAP32[($3_1 + 36 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
  block1 : {
   block : {
    if (!((HEAP32[($3_1 + 20 | 0) >> 2] | 0 | 0) == (1 | 0) & 1 | 0)) {
     break block
    }
    HEAP32[((((HEAP32[($3_1 + 44 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($3_1 + 40 | 0) >> 2] | 0, 236) | 0) + 4 | 0) >> 2] = HEAP32[($3_1 + 12 | 0) >> 2] | 0;
    break block1;
   }
   HEAP32[($3_1 + 32 | 0) >> 2] = HEAP32[((((HEAP32[($3_1 + 44 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($3_1 + 40 | 0) >> 2] | 0, 236) | 0) + 8 | 0) >> 2] | 0;
   HEAP32[($3_1 + 16 | 0) >> 2] = 0;
   block2 : {
    label : while (1) {
     if (!((HEAP32[($3_1 + 16 | 0) >> 2] | 0 | 0) < (HEAP32[($3_1 + 20 | 0) >> 2] | 0 | 0) & 1 | 0)) {
      break block2
     }
     block3 : {
      if (!((HEAP32[((HEAP32[($3_1 + 12 | 0) >> 2] | 0) + 16 | 0) >> 2] | 0 | 0) <= (HEAP32[($3_1 + 32 | 0) >> 2] | 0 | 0) & 1 | 0)) {
       break block3
      }
      if (!((HEAP32[((HEAP32[($3_1 + 12 | 0) >> 2] | 0) + 20 | 0) >> 2] | 0 | 0) >= (HEAP32[($3_1 + 32 | 0) >> 2] | 0 | 0) & 1 | 0)) {
       break block3
      }
      HEAP32[((((HEAP32[($3_1 + 44 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($3_1 + 40 | 0) >> 2] | 0, 236) | 0) + 4 | 0) >> 2] = HEAP32[($3_1 + 12 | 0) >> 2] | 0;
      break block1;
     }
     HEAP32[($3_1 + 16 | 0) >> 2] = (HEAP32[($3_1 + 16 | 0) >> 2] | 0) + 1 | 0;
     HEAP32[($3_1 + 12 | 0) >> 2] = (HEAP32[($3_1 + 12 | 0) >> 2] | 0) + 108 | 0;
     continue label;
    };
   }
   HEAP32[($3_1 + 28 | 0) >> 2] = 2147483647;
   $6_1 = HEAP32[((HEAP32[($3_1 + 36 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
   HEAP32[($3_1 + 12 | 0) >> 2] = $6_1;
   HEAP32[($3_1 + 8 | 0) >> 2] = $6_1;
   HEAP32[($3_1 + 16 | 0) >> 2] = 0;
   block4 : {
    label1 : while (1) {
     if (!((HEAP32[($3_1 + 16 | 0) >> 2] | 0 | 0) < (HEAP32[($3_1 + 20 | 0) >> 2] | 0 | 0) & 1 | 0)) {
      break block4
     }
     HEAP32[($3_1 + 24 | 0) >> 2] = (HEAP32[((HEAP32[($3_1 + 12 | 0) >> 2] | 0) + 24 | 0) >> 2] | 0) - (HEAP32[($3_1 + 32 | 0) >> 2] | 0) | 0;
     block5 : {
      if (!((HEAP32[($3_1 + 24 | 0) >> 2] | 0 | 0) < (0 | 0) & 1 | 0)) {
       break block5
      }
      HEAP32[($3_1 + 24 | 0) >> 2] = 0 - (HEAP32[($3_1 + 24 | 0) >> 2] | 0) | 0;
     }
     block6 : {
      if (!((HEAP32[($3_1 + 24 | 0) >> 2] | 0 | 0) < (HEAP32[($3_1 + 28 | 0) >> 2] | 0 | 0) & 1 | 0)) {
       break block6
      }
      HEAP32[($3_1 + 28 | 0) >> 2] = HEAP32[($3_1 + 24 | 0) >> 2] | 0;
      HEAP32[($3_1 + 8 | 0) >> 2] = HEAP32[($3_1 + 12 | 0) >> 2] | 0;
     }
     HEAP32[($3_1 + 16 | 0) >> 2] = (HEAP32[($3_1 + 16 | 0) >> 2] | 0) + 1 | 0;
     HEAP32[($3_1 + 12 | 0) >> 2] = (HEAP32[($3_1 + 12 | 0) >> 2] | 0) + 108 | 0;
     continue label1;
    };
   }
   HEAP32[((((HEAP32[($3_1 + 44 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($3_1 + 40 | 0) >> 2] | 0, 236) | 0) + 4 | 0) >> 2] = HEAP32[($3_1 + 8 | 0) >> 2] | 0;
  }
  return;
 }
 
 function $70($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0;
  $3_1 = global$0 - 32 | 0;
  global$0 = $3_1;
  HEAP32[($3_1 + 28 | 0) >> 2] = $0_1;
  HEAP32[($3_1 + 24 | 0) >> 2] = $1_1;
  HEAP32[($3_1 + 20 | 0) >> 2] = $2_1;
  block2 : {
   block1 : {
    block : {
     if (!((HEAP32[($3_1 + 28 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
      break block
     }
     if (HEAP32[((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) {
      break block1
     }
    }
    break block2;
   }
   HEAP8[($3_1 + 17 | 0) >> 0] = 2;
   HEAP8[($3_1 + 16 | 0) >> 0] = HEAP32[($3_1 + 24 | 0) >> 2] | 0;
   HEAP32[($3_1 + 8 | 0) >> 2] = HEAP32[($3_1 + 20 | 0) >> 2] | 0;
   HEAP32[($3_1 + 12 | 0) >> 2] = 0;
   HEAP32[$3_1 >> 2] = HEAP32[((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0;
   HEAP32[((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 13080 | 0) >> 2] = $3_1 + 4 | 0;
   $50(HEAP32[($3_1 + 28 | 0) >> 2] | 0 | 0);
   HEAP32[((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 13080 | 0) >> 2] = HEAP32[$3_1 >> 2] | 0;
  }
  global$0 = $3_1 + 32 | 0;
  return;
 }
 
 function $71($0_1, $1_1, $2_1, $3_1, $4_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  $4_1 = $4_1 | 0;
  var $5_1 = 0, $6_1 = 0;
  $5_1 = global$0 - 48 | 0;
  global$0 = $5_1;
  HEAP32[($5_1 + 44 | 0) >> 2] = $0_1;
  HEAP32[($5_1 + 40 | 0) >> 2] = $1_1;
  HEAP32[($5_1 + 36 | 0) >> 2] = $2_1;
  HEAP32[($5_1 + 32 | 0) >> 2] = $3_1;
  HEAP32[($5_1 + 28 | 0) >> 2] = $4_1;
  block2 : {
   block1 : {
    block : {
     if (!((HEAP32[($5_1 + 44 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
      break block
     }
     if (HEAP32[((HEAP32[($5_1 + 44 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) {
      break block1
     }
    }
    break block2;
   }
   HEAP8[($5_1 + 25 | 0) >> 0] = HEAP32[($5_1 + 40 | 0) >> 2] | 0;
   HEAP8[($5_1 + 24 | 0) >> 0] = HEAP32[($5_1 + 36 | 0) >> 2] | 0;
   HEAP32[($5_1 + 16 | 0) >> 2] = HEAP32[($5_1 + 32 | 0) >> 2] | 0;
   HEAP32[($5_1 + 20 | 0) >> 2] = HEAP32[($5_1 + 28 | 0) >> 2] | 0;
   HEAP32[($5_1 + 8 | 0) >> 2] = HEAP32[((HEAP32[($5_1 + 44 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0;
   HEAP32[((HEAP32[($5_1 + 44 | 0) >> 2] | 0) + 13080 | 0) >> 2] = $5_1 + 12 | 0;
   $6_1 = (HEAPU8[($5_1 + 25 | 0) >> 0] | 0) + -4 | 0;
   block9 : {
    block14 : {
     switch ($6_1 | 0) {
     case 7:
      HEAP32[((((HEAP32[($5_1 + 44 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAP32[($5_1 + 36 | 0) >> 2] | 0, 40) | 0) + 32 | 0) >> 2] = HEAP32[($5_1 + 32 | 0) >> 2] | 0;
      HEAPF32[((((HEAP32[($5_1 + 44 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAP32[($5_1 + 36 | 0) >> 2] | 0, 40) | 0) + 36 | 0) >> 2] = Math_fround(0 | 0);
      break block9;
     case 4:
      HEAP32[((((HEAP32[($5_1 + 44 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAP32[($5_1 + 36 | 0) >> 2] | 0, 40) | 0) + 20 | 0) >> 2] = (HEAP32[($5_1 + 32 | 0) >> 2] | 0) + ((HEAP32[($5_1 + 28 | 0) >> 2] | 0) << 7 | 0) | 0;
      HEAPF32[((((HEAP32[($5_1 + 44 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAP32[($5_1 + 36 | 0) >> 2] | 0, 40) | 0) + 36 | 0) >> 2] = Math_fround(0 | 0);
      $53(HEAP32[($5_1 + 44 | 0) >> 2] | 0 | 0);
      break block9;
     case 0:
      HEAP32[((((HEAP32[($5_1 + 44 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAP32[($5_1 + 36 | 0) >> 2] | 0, 40) | 0) + 8 | 0) >> 2] = HEAP32[($5_1 + 32 | 0) >> 2] | 0;
      $54(HEAP32[($5_1 + 44 | 0) >> 2] | 0 | 0);
      break block9;
     case 1:
      HEAP32[((((HEAP32[($5_1 + 44 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAP32[($5_1 + 36 | 0) >> 2] | 0, 40) | 0) + 16 | 0) >> 2] = HEAP32[($5_1 + 32 | 0) >> 2] | 0;
      break block9;
     case 3:
      HEAP32[((((HEAP32[($5_1 + 44 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAP32[($5_1 + 36 | 0) >> 2] | 0, 40) | 0) + 24 | 0) >> 2] = HEAP32[($5_1 + 32 | 0) >> 2] | 0;
      $54(HEAP32[($5_1 + 44 | 0) >> 2] | 0 | 0);
      break block9;
     case 2:
      HEAP32[((((HEAP32[($5_1 + 44 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAP32[($5_1 + 36 | 0) >> 2] | 0, 40) | 0) + 12 | 0) >> 2] = HEAP32[($5_1 + 32 | 0) >> 2] | 0;
      block15 : {
       if (HEAP32[($5_1 + 32 | 0) >> 2] | 0) {
        break block15
       }
       $55(HEAP32[($5_1 + 44 | 0) >> 2] | 0 | 0);
      }
      break block9;
     case 5:
      block17 : {
       block16 : {
        if (!((HEAP32[((HEAP32[($5_1 + 44 | 0) >> 2] | 0) + 13056 | 0) >> 2] | 0) & (1 << (HEAP32[($5_1 + 36 | 0) >> 2] | 0) | 0) | 0)) {
         break block16
        }
        HEAP32[(((HEAP32[($5_1 + 44 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAP32[($5_1 + 36 | 0) >> 2] | 0, 40) | 0) >> 2] = HEAP32[($5_1 + 32 | 0) >> 2] | 0;
        break block17;
       }
       HEAP32[((((HEAP32[($5_1 + 44 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAP32[($5_1 + 36 | 0) >> 2] | 0, 40) | 0) + 4 | 0) >> 2] = HEAP32[($5_1 + 32 | 0) >> 2] | 0;
      }
      break block9;
     case 9:
      $56(HEAP32[($5_1 + 44 | 0) >> 2] | 0 | 0, HEAP32[($5_1 + 36 | 0) >> 2] | 0 | 0);
      break block9;
     case 10:
      $57(HEAP32[($5_1 + 44 | 0) >> 2] | 0 | 0);
      break block9;
     case 8:
      $58(HEAP32[($5_1 + 44 | 0) >> 2] | 0 | 0);
      break block9;
     case 11:
      break block14;
     default:
      break block9;
     };
    }
    HEAP32[(((HEAP32[($5_1 + 44 | 0) >> 2] | 0) + 1084 | 0) + Math_imul(HEAP32[($5_1 + 36 | 0) >> 2] | 0, 40) | 0) >> 2] = HEAP32[($5_1 + 32 | 0) >> 2] | 0;
   }
   HEAP32[((HEAP32[($5_1 + 44 | 0) >> 2] | 0) + 13080 | 0) >> 2] = HEAP32[($5_1 + 8 | 0) >> 2] | 0;
  }
  global$0 = $5_1 + 48 | 0;
  return;
 }
 
 function $72($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, i64toi32_i32$2 = 0, $9_1 = 0, $52_1 = 0, $52$hi = 0, $55_1 = 0, $55$hi = 0;
  $1_1 = global$0 - 16 | 0;
  global$0 = $1_1;
  HEAP32[($1_1 + 12 | 0) >> 2] = $0_1;
  block2 : {
   block1 : {
    block : {
     if (!((HEAP32[($1_1 + 12 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
      break block
     }
     if ((HEAP32[(0 + 75776 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
      break block1
     }
    }
    break block2;
   }
   HEAP32[($1_1 + 8 | 0) >> 2] = 0;
   label : while (1) {
    if (!((HEAP32[($1_1 + 8 | 0) >> 2] | 0 | 0) < (HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 13052 | 0) >> 2] | 0 | 0) & 1 | 0)) {
     break block2
    }
    block3 : {
     if (!((HEAPU8[(((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($1_1 + 8 | 0) >> 2] | 0, 236) | 0) >> 0] | 0 | 0) == (1 | 0) & 1 | 0)) {
      break block3
     }
     i64toi32_i32$2 = HEAP32[($1_1 + 12 | 0) >> 2] | 0;
     i64toi32_i32$0 = HEAP32[(i64toi32_i32$2 + 13088 | 0) >> 2] | 0;
     i64toi32_i32$1 = i64toi32_i32$0 >> 31 | 0;
     $9_1 = i64toi32_i32$0;
     i64toi32_i32$0 = 0;
     i64toi32_i32$0 = __wasm_i64_mul($9_1 | 0, i64toi32_i32$1 | 0, 1e3 | 0, i64toi32_i32$0 | 0) | 0;
     i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
     $52_1 = i64toi32_i32$0;
     $52$hi = i64toi32_i32$1;
     i64toi32_i32$2 = HEAP32[($1_1 + 12 | 0) >> 2] | 0;
     i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 8 | 0) >> 2] | 0;
     i64toi32_i32$0 = i64toi32_i32$1 >> 31 | 0;
     $55_1 = i64toi32_i32$1;
     $55$hi = i64toi32_i32$0;
     i64toi32_i32$0 = $52$hi;
     i64toi32_i32$1 = $55$hi;
     i64toi32_i32$1 = __wasm_i64_udiv($52_1 | 0, i64toi32_i32$0 | 0, $55_1 | 0, i64toi32_i32$1 | 0) | 0;
     i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
     HEAP32[($1_1 + 4 | 0) >> 2] = i64toi32_i32$1;
     HEAP8[($1_1 + 3 | 0) >> 0] = 144;
     FUNCTION_TABLE[HEAP32[(0 + 75776 | 0) >> 2] | 0 | 0](HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 13088 | 0) >> 2] | 0, HEAP32[($1_1 + 4 | 0) >> 2] | 0, (HEAPU8[($1_1 + 3 | 0) >> 0] | 0) & 255 | 0, (HEAPU8[((((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($1_1 + 8 | 0) >> 2] | 0, 236) | 0) + 1 | 0) >> 0] | 0) & 255 | 0, 1 & 255 | 0, HEAPU8[((((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($1_1 + 8 | 0) >> 2] | 0, 236) | 0) + 2 | 0) >> 0] | 0, HEAPU8[((((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($1_1 + 8 | 0) >> 2] | 0, 236) | 0) + 3 | 0) >> 0] | 0, 0);
    }
    HEAP32[($1_1 + 8 | 0) >> 2] = (HEAP32[($1_1 + 8 | 0) >> 2] | 0) + 1 | 0;
    continue label;
   };
  }
  global$0 = $1_1 + 16 | 0;
  return;
 }
 
 function $73($0_1, $1_1, $2_1, $3_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  var $4_1 = 0, $12_1 = 0, $9_1 = 0, $11_1 = 0, $151_1 = 0;
  $4_1 = global$0 - 64 | 0;
  HEAP32[($4_1 + 56 | 0) >> 2] = $0_1;
  HEAP32[($4_1 + 52 | 0) >> 2] = $1_1;
  HEAP32[($4_1 + 48 | 0) >> 2] = $2_1;
  HEAP32[($4_1 + 44 | 0) >> 2] = $3_1;
  block2 : {
   block1 : {
    block : {
     if (!((HEAP32[($4_1 + 56 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
      break block
     }
     if (!((HEAP32[((HEAP32[($4_1 + 56 | 0) >> 2] | 0) + 13076 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
      break block
     }
     if ((HEAP32[($4_1 + 52 | 0) >> 2] | 0 | 0) < (0 | 0) & 1 | 0) {
      break block
     }
     if (!((HEAP32[($4_1 + 52 | 0) >> 2] | 0 | 0) > (15 | 0) & 1 | 0)) {
      break block1
     }
    }
    HEAP32[($4_1 + 60 | 0) >> 2] = -1;
    break block2;
   }
   HEAP32[($4_1 + 40 | 0) >> 2] = HEAP32[((HEAP32[($4_1 + 56 | 0) >> 2] | 0) + 13076 | 0) >> 2] | 0;
   HEAP32[($4_1 + 8 | 0) >> 2] = 90;
   HEAP32[($4_1 + 24 | 0) >> 2] = 127;
   HEAP32[($4_1 + 12 | 0) >> 2] = 0;
   HEAP32[($4_1 + 20 | 0) >> 2] = 8192;
   HEAP32[($4_1 + 16 | 0) >> 2] = 64;
   label : while (1) {
    $9_1 = 0;
    block3 : {
     if (!((HEAPU8[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13 | 0) >> 0] | 0 | 0) != (99 | 0) & 1 | 0)) {
      break block3
     }
     $9_1 = (HEAP32[(HEAP32[($4_1 + 40 | 0) >> 2] | 0) >> 2] | 0 | 0) <= (HEAP32[($4_1 + 44 | 0) >> 2] | 0 | 0);
    }
    block4 : {
     if (!($9_1 & 1 | 0)) {
      break block4
     }
     block5 : {
      if (!((HEAPU8[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0 | 0) == (HEAP32[($4_1 + 52 | 0) >> 2] | 0 | 0) & 1 | 0)) {
       break block5
      }
      $11_1 = (HEAPU8[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 13 | 0) >> 0] | 0) + -4 | 0;
      block11 : {
       block12 : {
        switch ($11_1 | 0) {
        case 0:
         HEAP32[($4_1 + 8 | 0) >> 2] = HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
         break block11;
        case 1:
         HEAP32[($4_1 + 16 | 0) >> 2] = HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
         break block11;
        case 4:
         HEAP32[($4_1 + 20 | 0) >> 2] = (HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) + ((HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0) << 7 | 0) | 0;
         break block11;
        case 3:
         HEAP32[($4_1 + 24 | 0) >> 2] = HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
         break block11;
        case 2:
         HEAP32[($4_1 + 12 | 0) >> 2] = HEAP32[((HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
         break block11;
        case 9:
         break block12;
        default:
         break block11;
        };
       }
       HEAP32[($4_1 + 8 | 0) >> 2] = 90;
       HEAP32[($4_1 + 24 | 0) >> 2] = 127;
       HEAP32[($4_1 + 12 | 0) >> 2] = 0;
       HEAP32[($4_1 + 20 | 0) >> 2] = 8192;
      }
     }
     HEAP32[($4_1 + 40 | 0) >> 2] = (HEAP32[($4_1 + 40 | 0) >> 2] | 0) + 16 | 0;
     continue label;
    }
    break label;
   };
   $12_1 = HEAP32[($4_1 + 48 | 0) >> 2] | 0;
   block18 : {
    block17 : {
     block16 : {
      block15 : {
       block14 : {
        block13 : {
         if (($12_1 | 0) == (7 | 0)) {
          break block13
         }
         if (($12_1 | 0) == (10 | 0)) {
          break block14
         }
         if (($12_1 | 0) == (11 | 0)) {
          break block15
         }
         if (($12_1 | 0) == (64 | 0)) {
          break block16
         }
         if (($12_1 | 0) == (256 | 0)) {
          break block17
         }
         break block18;
        }
        HEAP32[($4_1 + 60 | 0) >> 2] = HEAP32[($4_1 + 8 | 0) >> 2] | 0;
        break block2;
       }
       HEAP32[($4_1 + 60 | 0) >> 2] = HEAP32[($4_1 + 16 | 0) >> 2] | 0;
       break block2;
      }
      HEAP32[($4_1 + 60 | 0) >> 2] = HEAP32[($4_1 + 24 | 0) >> 2] | 0;
      break block2;
     }
     HEAP32[($4_1 + 60 | 0) >> 2] = HEAP32[($4_1 + 12 | 0) >> 2] | 0;
     break block2;
    }
    HEAP32[($4_1 + 60 | 0) >> 2] = HEAP32[($4_1 + 20 | 0) >> 2] | 0;
    break block2;
   }
   HEAP32[($4_1 + 60 | 0) >> 2] = -1;
  }
  return HEAP32[($4_1 + 60 | 0) >> 2] | 0 | 0;
 }
 
 function $74($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0;
  $1_1 = global$0 - 16 | 0;
  HEAP32[($1_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($1_1 + 8 | 0) >> 2] = 0;
  block : {
   label : while (1) {
    if (!((HEAP32[($1_1 + 8 | 0) >> 2] | 0 | 0) < (48 | 0) & 1 | 0)) {
     break block
    }
    HEAP8[(((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($1_1 + 8 | 0) >> 2] | 0, 236) | 0) >> 0] = 0;
    HEAP32[($1_1 + 8 | 0) >> 2] = (HEAP32[($1_1 + 8 | 0) >> 2] | 0) + 1 | 0;
    continue label;
   };
  }
  return;
 }
 
 function $75($0_1, $1_1, $2_1, $3_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  var $4_1 = 0, $7_1 = 0, $8_1 = 0, $6_1 = 0, $9_1 = 0, $311 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $4_1 = global$0 - 48 | 0;
  global$0 = $4_1;
  HEAP32[($4_1 + 40 | 0) >> 2] = $0_1;
  HEAP32[($4_1 + 36 | 0) >> 2] = $1_1;
  HEAP32[($4_1 + 32 | 0) >> 2] = $2_1;
  HEAP32[($4_1 + 28 | 0) >> 2] = $3_1;
  HEAP32[((HEAP32[($4_1 + 36 | 0) >> 2] | 0) + 13092 | 0) >> 2] = 0;
  HEAP32[((HEAP32[($4_1 + 36 | 0) >> 2] | 0) + 13096 | 0) >> 2] = 0;
  HEAP32[((HEAP32[($4_1 + 36 | 0) >> 2] | 0) + 13084 | 0) >> 2] = 0;
  block2 : {
   block1 : {
    block : {
     if (($114(HEAP32[($4_1 + 40 | 0) >> 2] | 0 | 0, $4_1 + 4 | 0 | 0, 1 | 0, 4 | 0) | 0 | 0) != (4 | 0) & 1 | 0) {
      break block
     }
     if (!(($114(HEAP32[($4_1 + 40 | 0) >> 2] | 0 | 0, $4_1 + 24 | 0 | 0, 4 | 0, 1 | 0) | 0 | 0) != (1 | 0) & 1 | 0)) {
      break block1
     }
    }
    HEAP32[($4_1 + 44 | 0) >> 2] = 0;
    break block2;
   }
   block3 : {
    if ($152($4_1 + 4 | 0 | 0, 65785 | 0, 4 | 0) | 0) {
     break block3
    }
    block5 : {
     block4 : {
      if (($114(HEAP32[($4_1 + 40 | 0) >> 2] | 0 | 0, $4_1 + 4 | 0 | 0, 1 | 0, 4 | 0) | 0 | 0) != (4 | 0) & 1 | 0) {
       break block4
      }
      if ($152($4_1 + 4 | 0 | 0, 65790 | 0, 4 | 0) | 0) {
       break block4
      }
      if (($114(HEAP32[($4_1 + 40 | 0) >> 2] | 0 | 0, $4_1 + 4 | 0 | 0, 1 | 0, 4 | 0) | 0 | 0) != (4 | 0) & 1 | 0) {
       break block4
      }
      if ($152($4_1 + 4 | 0 | 0, 65780 | 0, 4 | 0) | 0) {
       break block4
      }
      if (($114(HEAP32[($4_1 + 40 | 0) >> 2] | 0 | 0, $4_1 + 4 | 0 | 0, 1 | 0, 4 | 0) | 0 | 0) != (4 | 0) & 1 | 0) {
       break block4
      }
      if (($114(HEAP32[($4_1 + 40 | 0) >> 2] | 0 | 0, $4_1 + 4 | 0 | 0, 1 | 0, 4 | 0) | 0 | 0) != (4 | 0) & 1 | 0) {
       break block4
      }
      if (!(($114(HEAP32[($4_1 + 40 | 0) >> 2] | 0 | 0, $4_1 + 24 | 0 | 0, 4 | 0, 1 | 0) | 0 | 0) != (1 | 0) & 1 | 0)) {
       break block5
      }
     }
     HEAP32[($4_1 + 44 | 0) >> 2] = 0;
     break block2;
    }
   }
   HEAP32[($4_1 + 24 | 0) >> 2] = ((HEAP32[($4_1 + 24 | 0) >> 2] | 0) & 255 | 0) << 24 | 0 | (((HEAP32[($4_1 + 24 | 0) >> 2] | 0) & 65280 | 0) << 8 | 0) | 0 | (((HEAP32[($4_1 + 24 | 0) >> 2] | 0) & 16711680 | 0) >> 8 | 0) | 0 | (((HEAP32[($4_1 + 24 | 0) >> 2] | 0) >> 24 | 0) & 255 | 0) | 0;
   block7 : {
    block6 : {
     if ($152($4_1 + 4 | 0 | 0, 65768 | 0, 4 | 0) | 0) {
      break block6
     }
     if (!((HEAP32[($4_1 + 24 | 0) >> 2] | 0 | 0) < (6 | 0) & 1 | 0)) {
      break block7
     }
    }
    HEAP32[($4_1 + 44 | 0) >> 2] = 0;
    break block2;
   }
   HEAP16[($4_1 + 14 | 0) >> 1] = 65535;
   HEAP16[($4_1 + 16 | 0) >> 1] = 65535;
   HEAP16[($4_1 + 18 | 0) >> 1] = 65535;
   $114(HEAP32[($4_1 + 40 | 0) >> 2] | 0 | 0, $4_1 + 18 | 0 | 0, 2 | 0, 1 | 0) | 0;
   $114(HEAP32[($4_1 + 40 | 0) >> 2] | 0 | 0, $4_1 + 16 | 0 | 0, 2 | 0, 1 | 0) | 0;
   $114(HEAP32[($4_1 + 40 | 0) >> 2] | 0 | 0, $4_1 + 14 | 0 | 0, 2 | 0, 1 | 0) | 0;
   HEAP16[($4_1 + 18 | 0) >> 1] = ((HEAP16[($4_1 + 18 | 0) >> 1] | 0) & 255 | 0) << 8 | 0 | (((HEAP16[($4_1 + 18 | 0) >> 1] | 0) >> 8 | 0) & 255 | 0) | 0;
   HEAP16[($4_1 + 16 | 0) >> 1] = ((HEAP16[($4_1 + 16 | 0) >> 1] | 0) & 255 | 0) << 8 | 0 | (((HEAP16[($4_1 + 16 | 0) >> 1] | 0) >> 8 | 0) & 255 | 0) | 0;
   HEAP16[($4_1 + 14 | 0) >> 1] = ((HEAP16[($4_1 + 14 | 0) >> 1] | 0) & 255 | 0) << 8 | 0 | (((HEAP16[($4_1 + 14 | 0) >> 1] | 0) >> 8 | 0) & 255 | 0) | 0;
   block9 : {
    block8 : {
     if (!((HEAP16[($4_1 + 14 | 0) >> 1] | 0 | 0) < (0 | 0) & 1 | 0)) {
      break block8
     }
     HEAP32[($4_1 + 20 | 0) >> 2] = Math_imul(0 - ((HEAP16[($4_1 + 14 | 0) >> 1] | 0 | 0) / (256 | 0) | 0) | 0, (HEAP16[($4_1 + 14 | 0) >> 1] | 0) & 255 | 0);
     break block9;
    }
    HEAP32[($4_1 + 20 | 0) >> 2] = HEAP16[($4_1 + 14 | 0) >> 1] | 0;
   }
   block10 : {
    if (!((HEAP32[($4_1 + 24 | 0) >> 2] | 0 | 0) > (6 | 0) & 1 | 0)) {
     break block10
    }
    $117(HEAP32[($4_1 + 40 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 24 | 0) >> 2] | 0) - 6 | 0 | 0) | 0;
   }
   block12 : {
    block11 : {
     if ((HEAP16[($4_1 + 18 | 0) >> 1] | 0 | 0) < (0 | 0) & 1 | 0) {
      break block11
     }
     if (!((HEAP16[($4_1 + 18 | 0) >> 1] | 0 | 0) > (2 | 0) & 1 | 0)) {
      break block12
     }
    }
    HEAP32[($4_1 + 44 | 0) >> 2] = 0;
    break block2;
   }
   block13 : {
    if (!((HEAP16[($4_1 + 16 | 0) >> 1] | 0 | 0) < (1 | 0) & 1 | 0)) {
     break block13
    }
    HEAP32[($4_1 + 44 | 0) >> 2] = 0;
    break block2;
   }
   block14 : {
    if (HEAP16[($4_1 + 18 | 0) >> 1] | 0) {
     break block14
    }
    if (!((HEAP16[($4_1 + 16 | 0) >> 1] | 0 | 0) != (1 | 0) & 1 | 0)) {
     break block14
    }
    HEAP32[($4_1 + 44 | 0) >> 2] = 0;
    break block2;
   }
   $6_1 = $185(1 | 0, 20 | 0) | 0;
   HEAP32[((HEAP32[($4_1 + 36 | 0) >> 2] | 0) + 13084 | 0) >> 2] = $6_1;
   block15 : {
    if ((HEAP32[((HEAP32[($4_1 + 36 | 0) >> 2] | 0) + 13084 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
     break block15
    }
    HEAP32[(HEAP32[($4_1 + 36 | 0) >> 2] | 0) >> 2] = 1;
    HEAP32[($4_1 + 44 | 0) >> 2] = 0;
    break block2;
   }
   HEAP8[((HEAP32[((HEAP32[($4_1 + 36 | 0) >> 2] | 0) + 13084 | 0) >> 2] | 0) + 13 | 0) >> 0] = 0;
   $7_1 = HEAP32[($4_1 + 36 | 0) >> 2] | 0;
   HEAP32[($7_1 + 13092 | 0) >> 2] = (HEAP32[($7_1 + 13092 | 0) >> 2] | 0) + 1 | 0;
   $8_1 = HEAP16[($4_1 + 18 | 0) >> 1] | 0;
   block19 : {
    block18 : {
     switch ($8_1 | 0) {
     case 0:
      block20 : {
       if (!($76(HEAP32[($4_1 + 40 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 36 | 0) >> 2] | 0 | 0, 0 | 0) | 0)) {
        break block20
       }
       $77(HEAP32[($4_1 + 36 | 0) >> 2] | 0 | 0);
       HEAP32[($4_1 + 44 | 0) >> 2] = 0;
       break block2;
      }
      break block19;
     case 1:
      HEAP32[($4_1 + 8 | 0) >> 2] = 0;
      block21 : {
       label : while (1) {
        if (!((HEAP32[($4_1 + 8 | 0) >> 2] | 0 | 0) < (HEAP16[($4_1 + 16 | 0) >> 1] | 0 | 0) & 1 | 0)) {
         break block21
        }
        block22 : {
         if (!($76(HEAP32[($4_1 + 40 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 36 | 0) >> 2] | 0 | 0, 0 | 0) | 0)) {
          break block22
         }
         $77(HEAP32[($4_1 + 36 | 0) >> 2] | 0 | 0);
         HEAP32[($4_1 + 44 | 0) >> 2] = 0;
         break block2;
        }
        HEAP32[($4_1 + 8 | 0) >> 2] = (HEAP32[($4_1 + 8 | 0) >> 2] | 0) + 1 | 0;
        continue label;
       };
      }
      break block19;
     case 2:
      break block18;
     default:
      break block19;
     };
    }
    HEAP32[($4_1 + 8 | 0) >> 2] = 0;
    block23 : {
     label1 : while (1) {
      if (!((HEAP32[($4_1 + 8 | 0) >> 2] | 0 | 0) < (HEAP16[($4_1 + 16 | 0) >> 1] | 0 | 0) & 1 | 0)) {
       break block23
      }
      block24 : {
       if (!($76(HEAP32[($4_1 + 40 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 36 | 0) >> 2] | 0 | 0, 1 | 0) | 0)) {
        break block24
       }
       $77(HEAP32[($4_1 + 36 | 0) >> 2] | 0 | 0);
       HEAP32[($4_1 + 44 | 0) >> 2] = 0;
       break block2;
      }
      HEAP32[($4_1 + 8 | 0) >> 2] = (HEAP32[($4_1 + 8 | 0) >> 2] | 0) + 1 | 0;
      continue label1;
     };
    }
   }
   (wasm2js_i32$0 = $4_1, wasm2js_i32$1 = $78(HEAP32[($4_1 + 36 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 20 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 32 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 28 | 0) >> 2] | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 44 | 0) >> 2] = wasm2js_i32$1;
  }
  $9_1 = HEAP32[($4_1 + 44 | 0) >> 2] | 0;
  global$0 = $4_1 + 48 | 0;
  return $9_1 | 0;
 }
 
 function $76($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, $5_1 = 0, $9_1 = 0, $12_1 = 0, $13_1 = 0, $194_1 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $3_1 = global$0 - 48 | 0;
  global$0 = $3_1;
  HEAP32[($3_1 + 40 | 0) >> 2] = $0_1;
  HEAP32[($3_1 + 36 | 0) >> 2] = $1_1;
  HEAP32[($3_1 + 32 | 0) >> 2] = $2_1;
  HEAP32[($3_1 + 28 | 0) >> 2] = HEAP32[((HEAP32[($3_1 + 36 | 0) >> 2] | 0) + 13084 | 0) >> 2] | 0;
  HEAP32[($3_1 + 28 | 0) >> 2] = HEAP32[((HEAP32[($3_1 + 36 | 0) >> 2] | 0) + 13084 | 0) >> 2] | 0;
  block2 : {
   block : {
    if (!(HEAP32[($3_1 + 32 | 0) >> 2] | 0)) {
     break block
    }
    if (!((HEAP32[($3_1 + 28 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
     break block
    }
    block1 : {
     label : while (1) {
      if (!((HEAP32[((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 16 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
       break block1
      }
      HEAP32[($3_1 + 28 | 0) >> 2] = HEAP32[((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 16 | 0) >> 2] | 0;
      continue label;
     };
    }
    HEAP32[((HEAP32[($3_1 + 36 | 0) >> 2] | 0) + 13096 | 0) >> 2] = HEAP32[(HEAP32[($3_1 + 28 | 0) >> 2] | 0) >> 2] | 0;
    break block2;
   }
   HEAP32[((HEAP32[($3_1 + 36 | 0) >> 2] | 0) + 13096 | 0) >> 2] = 0;
  }
  block5 : {
   block4 : {
    block3 : {
     if (($114(HEAP32[($3_1 + 40 | 0) >> 2] | 0 | 0, $3_1 + 4 | 0 | 0, 1 | 0, 4 | 0) | 0 | 0) != (4 | 0) & 1 | 0) {
      break block3
     }
     if (!(($114(HEAP32[($3_1 + 40 | 0) >> 2] | 0 | 0, $3_1 + 16 | 0 | 0, 4 | 0, 1 | 0) | 0 | 0) != (1 | 0) & 1 | 0)) {
      break block4
     }
    }
    HEAP32[($3_1 + 44 | 0) >> 2] = -1;
    break block5;
   }
   HEAP32[($3_1 + 16 | 0) >> 2] = ((HEAP32[($3_1 + 16 | 0) >> 2] | 0) & 255 | 0) << 24 | 0 | (((HEAP32[($3_1 + 16 | 0) >> 2] | 0) & 65280 | 0) << 8 | 0) | 0 | (((HEAP32[($3_1 + 16 | 0) >> 2] | 0) & 16711680 | 0) >> 8 | 0) | 0 | (((HEAP32[($3_1 + 16 | 0) >> 2] | 0) >> 24 | 0) & 255 | 0) | 0;
   (wasm2js_i32$0 = $3_1, wasm2js_i32$1 = ($116(HEAP32[($3_1 + 40 | 0) >> 2] | 0 | 0) | 0) + (HEAP32[($3_1 + 16 | 0) >> 2] | 0) | 0), HEAP32[(wasm2js_i32$0 + 12 | 0) >> 2] = wasm2js_i32$1;
   block6 : {
    if (!($152($3_1 + 4 | 0 | 0, 65714 | 0, 4 | 0) | 0)) {
     break block6
    }
    HEAP32[($3_1 + 44 | 0) >> 2] = -2;
    break block5;
   }
   label2 : while (1) {
    $5_1 = $79(HEAP32[($3_1 + 40 | 0) >> 2] | 0 | 0, HEAP32[($3_1 + 36 | 0) >> 2] | 0 | 0) | 0;
    HEAP32[($3_1 + 20 | 0) >> 2] = $5_1;
    block7 : {
     if (($5_1 | 0) != (0 | 0) & 1 | 0) {
      break block7
     }
     HEAP32[($3_1 + 44 | 0) >> 2] = -2;
     break block5;
    }
    block8 : {
     if (!((HEAP32[($3_1 + 20 | 0) >> 2] | 0 | 0) == (-1 | 0) & 1 | 0)) {
      break block8
     }
     (wasm2js_i32$0 = $3_1, wasm2js_i32$1 = $116(HEAP32[($3_1 + 40 | 0) >> 2] | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 8 | 0) >> 2] = wasm2js_i32$1;
     block9 : {
      if (!((HEAP32[($3_1 + 8 | 0) >> 2] | 0 | 0) < (HEAP32[($3_1 + 12 | 0) >> 2] | 0 | 0) & 1 | 0)) {
       break block9
      }
      $115(HEAP32[($3_1 + 40 | 0) >> 2] | 0 | 0, (HEAP32[($3_1 + 12 | 0) >> 2] | 0) - (HEAP32[($3_1 + 8 | 0) >> 2] | 0) | 0 | 0, 1 | 0) | 0;
     }
     HEAP32[($3_1 + 44 | 0) >> 2] = 0;
     break block5;
    }
    HEAP32[($3_1 + 24 | 0) >> 2] = HEAP32[((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 16 | 0) >> 2] | 0;
    label1 : while (1) {
     $9_1 = 0;
     block10 : {
      if (!((HEAP32[($3_1 + 24 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
       break block10
      }
      $9_1 = (HEAP32[(HEAP32[($3_1 + 24 | 0) >> 2] | 0) >> 2] | 0 | 0) < (HEAP32[(HEAP32[($3_1 + 20 | 0) >> 2] | 0) >> 2] | 0 | 0);
     }
     block11 : {
      if (!($9_1 & 1 | 0)) {
       break block11
      }
      HEAP32[($3_1 + 28 | 0) >> 2] = HEAP32[($3_1 + 24 | 0) >> 2] | 0;
      HEAP32[($3_1 + 24 | 0) >> 2] = HEAP32[((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 16 | 0) >> 2] | 0;
      continue label1;
     }
     break label1;
    };
    HEAP32[((HEAP32[($3_1 + 20 | 0) >> 2] | 0) + 16 | 0) >> 2] = HEAP32[($3_1 + 24 | 0) >> 2] | 0;
    HEAP32[((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 16 | 0) >> 2] = HEAP32[($3_1 + 20 | 0) >> 2] | 0;
    $12_1 = HEAP32[($3_1 + 36 | 0) >> 2] | 0;
    HEAP32[($12_1 + 13092 | 0) >> 2] = (HEAP32[($12_1 + 13092 | 0) >> 2] | 0) + 1 | 0;
    HEAP32[($3_1 + 28 | 0) >> 2] = HEAP32[($3_1 + 20 | 0) >> 2] | 0;
    continue label2;
   };
  }
  $13_1 = HEAP32[($3_1 + 44 | 0) >> 2] | 0;
  global$0 = $3_1 + 48 | 0;
  return $13_1 | 0;
 }
 
 function $77($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0;
  $1_1 = global$0 - 16 | 0;
  global$0 = $1_1;
  HEAP32[($1_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($1_1 + 8 | 0) >> 2] = HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 13084 | 0) >> 2] | 0;
  block : {
   label : while (1) {
    if (!((HEAP32[($1_1 + 8 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
     break block
    }
    HEAP32[($1_1 + 4 | 0) >> 2] = HEAP32[((HEAP32[($1_1 + 8 | 0) >> 2] | 0) + 16 | 0) >> 2] | 0;
    $184(HEAP32[($1_1 + 8 | 0) >> 2] | 0 | 0);
    HEAP32[($1_1 + 8 | 0) >> 2] = HEAP32[($1_1 + 4 | 0) >> 2] | 0;
    continue label;
   };
  }
  HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 13084 | 0) >> 2] = 0;
  global$0 = $1_1 + 16 | 0;
  return;
 }
 
 function $78($0_1, $1_1, $2_1, $3_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  var $4_1 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, i64toi32_i32$2 = 0, $9_1 = 0, $11_1 = 0, $58_1 = 0, $67_1 = 0, $609 = 0, $612 = 0, $73_1 = 0, $669 = 0;
  $4_1 = global$0 - 272 | 0;
  global$0 = $4_1;
  HEAP32[($4_1 + 264 | 0) >> 2] = $0_1;
  HEAP32[($4_1 + 260 | 0) >> 2] = $1_1;
  HEAP32[($4_1 + 256 | 0) >> 2] = $2_1;
  HEAP32[($4_1 + 252 | 0) >> 2] = $3_1;
  HEAP32[($4_1 + 236 | 0) >> 2] = 0;
  block : {
   label : while (1) {
    if (!((HEAP32[($4_1 + 236 | 0) >> 2] | 0 | 0) < (16 | 0) & 1 | 0)) {
     break block
    }
    HEAP32[(($4_1 + 128 | 0) + ((HEAP32[($4_1 + 236 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] = 0;
    HEAP32[(($4_1 + 64 | 0) + ((HEAP32[($4_1 + 236 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] = 0;
    HEAP32[($4_1 + ((HEAP32[($4_1 + 236 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] = HEAP32[((HEAP32[($4_1 + 264 | 0) >> 2] | 0) + 1056 | 0) >> 2] | 0;
    HEAP32[($4_1 + 236 | 0) >> 2] = (HEAP32[($4_1 + 236 | 0) >> 2] | 0) + 1 | 0;
    continue label;
   };
  }
  HEAP32[($4_1 + 228 | 0) >> 2] = 5e5;
  $80(HEAP32[($4_1 + 264 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 228 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 260 | 0) >> 2] | 0 | 0);
  $9_1 = $182(((HEAP32[((HEAP32[($4_1 + 264 | 0) >> 2] | 0) + 13092 | 0) >> 2] | 0) + 1 | 0) << 4 | 0 | 0) | 0;
  HEAP32[($4_1 + 244 | 0) >> 2] = $9_1;
  HEAP32[($4_1 + 248 | 0) >> 2] = $9_1;
  block2 : {
   block1 : {
    if ((HEAP32[($4_1 + 248 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
     break block1
    }
    HEAP32[(HEAP32[($4_1 + 264 | 0) >> 2] | 0) >> 2] = 1;
    $77(HEAP32[($4_1 + 264 | 0) >> 2] | 0 | 0);
    HEAP32[($4_1 + 268 | 0) >> 2] = 0;
    break block2;
   }
   HEAP32[($4_1 + 240 | 0) >> 2] = HEAP32[((HEAP32[($4_1 + 264 | 0) >> 2] | 0) + 13084 | 0) >> 2] | 0;
   HEAP32[($4_1 + 232 | 0) >> 2] = 0;
   HEAP32[($4_1 + 216 | 0) >> 2] = 0;
   HEAP32[($4_1 + 208 | 0) >> 2] = 0;
   HEAP32[($4_1 + 204 | 0) >> 2] = 0;
   HEAP32[($4_1 + 196 | 0) >> 2] = 0;
   HEAP32[($4_1 + 236 | 0) >> 2] = 0;
   block3 : {
    label1 : while (1) {
     if (!((HEAP32[($4_1 + 236 | 0) >> 2] | 0 | 0) < (HEAP32[((HEAP32[($4_1 + 264 | 0) >> 2] | 0) + 13092 | 0) >> 2] | 0 | 0) & 1 | 0)) {
      break block3
     }
     HEAP32[($4_1 + 224 | 0) >> 2] = 0;
     block5 : {
      block4 : {
       if (!((HEAPU8[((HEAP32[($4_1 + 240 | 0) >> 2] | 0) + 13 | 0) >> 0] | 0 | 0) == (10 | 0) & 1 | 0)) {
        break block4
       }
       HEAP32[($4_1 + 224 | 0) >> 2] = 1;
       break block5;
      }
      $11_1 = (HEAPU8[((HEAP32[($4_1 + 240 | 0) >> 2] | 0) + 13 | 0) >> 0] | 0) + -1 | 0;
      block7 : {
       block9 : {
        switch ($11_1 | 0) {
        case 8:
         block15 : {
          block10 : {
           if (!((HEAP32[((HEAP32[($4_1 + 264 | 0) >> 2] | 0) + 13056 | 0) >> 2] | 0) & (1 << (HEAPU8[((HEAP32[($4_1 + 240 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0) | 0) | 0)) {
            break block10
           }
           block12 : {
            block11 : {
             if (!((HEAP32[(((HEAP32[($4_1 + 264 | 0) >> 2] | 0) + 540 | 0) + ((HEAP32[((HEAP32[($4_1 + 240 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
              break block11
             }
             HEAP32[($4_1 + 220 | 0) >> 2] = HEAP32[((HEAP32[($4_1 + 240 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
             break block12;
            }
            HEAP32[((HEAP32[($4_1 + 240 | 0) >> 2] | 0) + 4 | 0) >> 2] = 0;
            HEAP32[($4_1 + 220 | 0) >> 2] = 0;
           }
           block14 : {
            block13 : {
             if (!((HEAP32[(($4_1 + 64 | 0) + ((HEAPU8[((HEAP32[($4_1 + 240 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) != (HEAP32[($4_1 + 220 | 0) >> 2] | 0 | 0) & 1 | 0)) {
              break block13
             }
             HEAP32[(($4_1 + 64 | 0) + ((HEAPU8[((HEAP32[($4_1 + 240 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0) << 2 | 0) | 0) >> 2] = HEAP32[($4_1 + 220 | 0) >> 2] | 0;
             break block14;
            }
            HEAP32[($4_1 + 224 | 0) >> 2] = 1;
           }
           break block15;
          }
          HEAP32[($4_1 + 220 | 0) >> 2] = HEAP32[((HEAP32[($4_1 + 240 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
          block17 : {
           block16 : {
            if (!((HEAP32[($4_1 + ((HEAPU8[((HEAP32[($4_1 + 240 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) != (-1 | 0) & 1 | 0)) {
             break block16
            }
            if (!((HEAP32[($4_1 + ((HEAPU8[((HEAP32[($4_1 + 240 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) != (HEAP32[($4_1 + 220 | 0) >> 2] | 0 | 0) & 1 | 0)) {
             break block16
            }
            HEAP32[($4_1 + ((HEAPU8[((HEAP32[($4_1 + 240 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0) << 2 | 0) | 0) >> 2] = HEAP32[($4_1 + 220 | 0) >> 2] | 0;
            break block17;
           }
           HEAP32[($4_1 + 224 | 0) >> 2] = 1;
          }
         }
         break block7;
        case 0:
         block18 : {
          if (!(HEAP32[($4_1 + 196 | 0) >> 2] | 0)) {
           break block18
          }
          HEAP32[($4_1 + 196 | 0) >> 2] = 1;
         }
         block21 : {
          block19 : {
           if (!((HEAP32[((HEAP32[($4_1 + 264 | 0) >> 2] | 0) + 13056 | 0) >> 2] | 0) & (1 << (HEAPU8[((HEAP32[($4_1 + 240 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0) | 0) | 0)) {
            break block19
           }
           block20 : {
            if ((HEAP32[(((HEAP32[(((HEAP32[($4_1 + 264 | 0) >> 2] | 0) + 540 | 0) + ((HEAP32[(($4_1 + 64 | 0) + ((HEAPU8[((HEAP32[($4_1 + 240 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0) << 2 | 0) | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0) + 4 | 0) + ((HEAP32[((HEAP32[($4_1 + 240 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
             break block20
            }
            HEAP32[(((HEAP32[(((HEAP32[($4_1 + 264 | 0) >> 2] | 0) + 540 | 0) + ((HEAP32[(($4_1 + 64 | 0) + ((HEAPU8[((HEAP32[($4_1 + 240 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0) << 2 | 0) | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0) + 4 | 0) + ((HEAP32[((HEAP32[($4_1 + 240 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] = -1;
           }
           break block21;
          }
          block22 : {
           if (!((HEAP32[($4_1 + ((HEAPU8[((HEAP32[($4_1 + 240 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) == (-1 | 0) & 1 | 0)) {
            break block22
           }
           break block7;
          }
          block23 : {
           if ((HEAP32[(((HEAP32[(((HEAP32[($4_1 + 264 | 0) >> 2] | 0) + 28 | 0) + ((HEAP32[(($4_1 + 128 | 0) + ((HEAPU8[((HEAP32[($4_1 + 240 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0) << 2 | 0) | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0) + 4 | 0) + ((HEAP32[($4_1 + ((HEAPU8[((HEAP32[($4_1 + 240 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0) << 2 | 0) | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
            break block23
           }
           HEAP32[(((HEAP32[(((HEAP32[($4_1 + 264 | 0) >> 2] | 0) + 28 | 0) + ((HEAP32[(($4_1 + 128 | 0) + ((HEAPU8[((HEAP32[($4_1 + 240 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0) << 2 | 0) | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0) + 4 | 0) + ((HEAP32[($4_1 + ((HEAPU8[((HEAP32[($4_1 + 240 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0) << 2 | 0) | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] = -1;
          }
         }
         break block7;
        case 14:
         break block9;
        default:
         break block7;
        };
       }
       block24 : {
        if (!((HEAP32[((HEAP32[($4_1 + 264 | 0) >> 2] | 0) + 13056 | 0) >> 2] | 0) & (1 << (HEAPU8[((HEAP32[($4_1 + 240 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0) | 0) | 0)) {
         break block24
        }
        HEAP32[($4_1 + 224 | 0) >> 2] = 1;
        break block7;
       }
       block26 : {
        block25 : {
         if (!((HEAP32[(((HEAP32[($4_1 + 264 | 0) >> 2] | 0) + 28 | 0) + ((HEAP32[((HEAP32[($4_1 + 240 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
          break block25
         }
         HEAP32[($4_1 + 220 | 0) >> 2] = HEAP32[((HEAP32[($4_1 + 240 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
         break block26;
        }
        HEAP32[((HEAP32[($4_1 + 240 | 0) >> 2] | 0) + 4 | 0) >> 2] = 0;
        HEAP32[($4_1 + 220 | 0) >> 2] = 0;
       }
       block28 : {
        block27 : {
         if (!((HEAP32[(($4_1 + 128 | 0) + ((HEAPU8[((HEAP32[($4_1 + 240 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) != (HEAP32[($4_1 + 220 | 0) >> 2] | 0 | 0) & 1 | 0)) {
          break block27
         }
         HEAP32[(($4_1 + 128 | 0) + ((HEAPU8[((HEAP32[($4_1 + 240 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0) << 2 | 0) | 0) >> 2] = HEAP32[($4_1 + 220 | 0) >> 2] | 0;
         break block28;
        }
        HEAP32[($4_1 + 224 | 0) >> 2] = 1;
       }
      }
     }
     $58_1 = (HEAP32[(HEAP32[($4_1 + 240 | 0) >> 2] | 0) >> 2] | 0) - (HEAP32[($4_1 + 208 | 0) >> 2] | 0) | 0;
     HEAP32[($4_1 + 200 | 0) >> 2] = $58_1;
     block35 : {
      block29 : {
       if (!$58_1) {
        break block29
       }
       if (HEAP32[($4_1 + 196 | 0) >> 2] | 0) {
        break block29
       }
       block34 : {
        block32 : {
         block31 : {
          block30 : {
           if ((HEAP32[((HEAP32[($4_1 + 264 | 0) >> 2] | 0) + 1076 | 0) >> 2] | 0 | 0) > ((2147483647 | 0) / (HEAP32[($4_1 + 200 | 0) >> 2] | 0 | 0) | 0 | 0) & 1 | 0) {
            break block30
           }
           if (!((HEAP32[((HEAP32[($4_1 + 264 | 0) >> 2] | 0) + 1080 | 0) >> 2] | 0 | 0) > ((2147483647 | 0) / (HEAP32[($4_1 + 200 | 0) >> 2] | 0 | 0) | 0 | 0) & 1 | 0)) {
            break block31
           }
          }
          break block32;
         }
         HEAP32[($4_1 + 212 | 0) >> 2] = Math_imul(HEAP32[((HEAP32[($4_1 + 264 | 0) >> 2] | 0) + 1076 | 0) >> 2] | 0, HEAP32[($4_1 + 200 | 0) >> 2] | 0);
         HEAP32[($4_1 + 216 | 0) >> 2] = Math_imul(HEAP32[((HEAP32[($4_1 + 264 | 0) >> 2] | 0) + 1080 | 0) >> 2] | 0, HEAP32[($4_1 + 200 | 0) >> 2] | 0) + (HEAP32[($4_1 + 216 | 0) >> 2] | 0) | 0;
         block33 : {
          if (!((HEAP32[($4_1 + 216 | 0) >> 2] | 0) & -65536 | 0)) {
           break block33
          }
          HEAP32[($4_1 + 212 | 0) >> 2] = (((HEAP32[($4_1 + 216 | 0) >> 2] | 0) >> 16 | 0) & 65535 | 0) + (HEAP32[($4_1 + 212 | 0) >> 2] | 0) | 0;
          HEAP32[($4_1 + 216 | 0) >> 2] = (HEAP32[($4_1 + 216 | 0) >> 2] | 0) & 65535 | 0;
         }
         if (!((HEAP32[($4_1 + 204 | 0) >> 2] | 0 | 0) >= (2147483647 - (HEAP32[($4_1 + 212 | 0) >> 2] | 0) | 0 | 0) & 1 | 0)) {
          break block34
         }
        }
        $77(HEAP32[($4_1 + 264 | 0) >> 2] | 0 | 0);
        $184(HEAP32[($4_1 + 248 | 0) >> 2] | 0 | 0);
        HEAP32[($4_1 + 268 | 0) >> 2] = 0;
        break block2;
       }
       HEAP32[($4_1 + 204 | 0) >> 2] = (HEAP32[($4_1 + 212 | 0) >> 2] | 0) + (HEAP32[($4_1 + 204 | 0) >> 2] | 0) | 0;
       break block35;
      }
      block36 : {
       if (!((HEAP32[($4_1 + 196 | 0) >> 2] | 0 | 0) == (1 | 0) & 1 | 0)) {
        break block36
       }
       HEAP32[($4_1 + 196 | 0) >> 2] = 0;
      }
     }
     block37 : {
      if (!((HEAPU8[((HEAP32[($4_1 + 240 | 0) >> 2] | 0) + 13 | 0) >> 0] | 0 | 0) == (10 | 0) & 1 | 0)) {
       break block37
      }
      HEAP32[($4_1 + 228 | 0) >> 2] = ((HEAPU8[((HEAP32[($4_1 + 240 | 0) >> 2] | 0) + 12 | 0) >> 0] | 0) + ((HEAP32[((HEAP32[($4_1 + 240 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0) << 8 | 0) | 0) + ((HEAP32[((HEAP32[($4_1 + 240 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) << 16 | 0) | 0;
      $80(HEAP32[($4_1 + 264 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 228 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 260 | 0) >> 2] | 0 | 0);
     }
     block38 : {
      if (HEAP32[($4_1 + 224 | 0) >> 2] | 0) {
       break block38
      }
      $67_1 = HEAP32[($4_1 + 244 | 0) >> 2] | 0;
      i64toi32_i32$2 = HEAP32[($4_1 + 240 | 0) >> 2] | 0;
      i64toi32_i32$0 = HEAP32[(i64toi32_i32$2 + 8 | 0) >> 2] | 0;
      i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 12 | 0) >> 2] | 0;
      $609 = i64toi32_i32$0;
      i64toi32_i32$0 = $67_1;
      HEAP32[(i64toi32_i32$0 + 8 | 0) >> 2] = $609;
      HEAP32[(i64toi32_i32$0 + 12 | 0) >> 2] = i64toi32_i32$1;
      i64toi32_i32$1 = HEAP32[i64toi32_i32$2 >> 2] | 0;
      i64toi32_i32$0 = HEAP32[(i64toi32_i32$2 + 4 | 0) >> 2] | 0;
      $612 = i64toi32_i32$1;
      i64toi32_i32$1 = $67_1;
      HEAP32[i64toi32_i32$1 >> 2] = $612;
      HEAP32[(i64toi32_i32$1 + 4 | 0) >> 2] = i64toi32_i32$0;
      HEAP32[(HEAP32[($4_1 + 244 | 0) >> 2] | 0) >> 2] = HEAP32[($4_1 + 204 | 0) >> 2] | 0;
      HEAP32[($4_1 + 244 | 0) >> 2] = (HEAP32[($4_1 + 244 | 0) >> 2] | 0) + 16 | 0;
      HEAP32[($4_1 + 232 | 0) >> 2] = (HEAP32[($4_1 + 232 | 0) >> 2] | 0) + 1 | 0;
     }
     HEAP32[($4_1 + 208 | 0) >> 2] = HEAP32[(HEAP32[($4_1 + 240 | 0) >> 2] | 0) >> 2] | 0;
     HEAP32[($4_1 + 240 | 0) >> 2] = HEAP32[((HEAP32[($4_1 + 240 | 0) >> 2] | 0) + 16 | 0) >> 2] | 0;
     HEAP32[($4_1 + 236 | 0) >> 2] = (HEAP32[($4_1 + 236 | 0) >> 2] | 0) + 1 | 0;
     continue label1;
    };
   }
   HEAP32[(HEAP32[($4_1 + 244 | 0) >> 2] | 0) >> 2] = HEAP32[($4_1 + 204 | 0) >> 2] | 0;
   HEAP8[((HEAP32[($4_1 + 244 | 0) >> 2] | 0) + 13 | 0) >> 0] = 99;
   HEAP32[($4_1 + 232 | 0) >> 2] = (HEAP32[($4_1 + 232 | 0) >> 2] | 0) + 1 | 0;
   $77(HEAP32[($4_1 + 264 | 0) >> 2] | 0 | 0);
   HEAP32[(HEAP32[($4_1 + 256 | 0) >> 2] | 0) >> 2] = HEAP32[($4_1 + 232 | 0) >> 2] | 0;
   HEAP32[(HEAP32[($4_1 + 252 | 0) >> 2] | 0) >> 2] = HEAP32[($4_1 + 204 | 0) >> 2] | 0;
   HEAP32[($4_1 + 268 | 0) >> 2] = HEAP32[($4_1 + 248 | 0) >> 2] | 0;
  }
  $73_1 = HEAP32[($4_1 + 268 | 0) >> 2] | 0;
  global$0 = $4_1 + 272 | 0;
  return $73_1 | 0;
 }
 
 function $79($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0, $4_1 = 0, $7_1 = 0, $10_1 = 0, $14_1 = 0, $17_1 = 0, $20_1 = 0, $23_1 = 0, $33_1 = 0, $34_1 = 0, $37_1 = 0, $45_1 = 0, $53_1 = 0, $60_1 = 0, $61_1 = 0, $71_1 = 0, $72_1 = 0, $87_1 = 0, $3_1 = 0, $93_1 = 0, $696 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $2_1 = global$0 - 32 | 0;
  global$0 = $2_1;
  HEAP32[($2_1 + 24 | 0) >> 2] = $0_1;
  HEAP32[($2_1 + 20 | 0) >> 2] = $1_1;
  block1 : {
   label : while (1) {
    $3_1 = $81(HEAP32[($2_1 + 24 | 0) >> 2] | 0 | 0) | 0;
    $4_1 = HEAP32[($2_1 + 20 | 0) >> 2] | 0;
    HEAP32[($4_1 + 13096 | 0) >> 2] = $3_1 + (HEAP32[($4_1 + 13096 | 0) >> 2] | 0) | 0;
    $7_1 = 1;
    block : {
     if (!(($114(HEAP32[($2_1 + 24 | 0) >> 2] | 0 | 0, $2_1 + 19 | 0 | 0, $7_1 | 0, $7_1 | 0) | 0 | 0) != (1 | 0) & 1 | 0)) {
      break block
     }
     HEAP32[($2_1 + 28 | 0) >> 2] = 0;
     break block1;
    }
    block4 : {
     block3 : {
      block2 : {
       if ((HEAPU8[($2_1 + 19 | 0) >> 0] | 0 | 0) == (240 | 0) & 1 | 0) {
        break block2
       }
       if (!((HEAPU8[($2_1 + 19 | 0) >> 0] | 0 | 0) == (247 | 0) & 1 | 0)) {
        break block3
       }
      }
      (wasm2js_i32$0 = $2_1, wasm2js_i32$1 = $81(HEAP32[($2_1 + 24 | 0) >> 2] | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 8 | 0) >> 2] = wasm2js_i32$1;
      $117(HEAP32[($2_1 + 24 | 0) >> 2] | 0 | 0, HEAP32[($2_1 + 8 | 0) >> 2] | 0 | 0) | 0;
      break block4;
     }
     block12 : {
      block5 : {
       if (!((HEAPU8[($2_1 + 19 | 0) >> 0] | 0 | 0) == (255 | 0) & 1 | 0)) {
        break block5
       }
       $10_1 = 1;
       $114(HEAP32[($2_1 + 24 | 0) >> 2] | 0 | 0, $2_1 + 18 | 0 | 0, $10_1 | 0, $10_1 | 0) | 0;
       (wasm2js_i32$0 = $2_1, wasm2js_i32$1 = $81(HEAP32[($2_1 + 24 | 0) >> 2] | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 8 | 0) >> 2] = wasm2js_i32$1;
       block7 : {
        block6 : {
         if (!((HEAPU8[($2_1 + 18 | 0) >> 0] | 0 | 0) > (0 | 0) & 1 | 0)) {
          break block6
         }
         if (!((HEAPU8[($2_1 + 18 | 0) >> 0] | 0 | 0) < (16 | 0) & 1 | 0)) {
          break block6
         }
         $82(HEAP32[($2_1 + 24 | 0) >> 2] | 0 | 0, HEAP32[($2_1 + 20 | 0) >> 2] | 0 | 0, HEAP32[($2_1 + 8 | 0) >> 2] | 0 | 0, HEAPU8[($2_1 + 18 | 0) >> 0] | 0 | 0) | 0;
         break block7;
        }
        $14_1 = HEAPU8[($2_1 + 18 | 0) >> 0] | 0;
        block10 : {
         block9 : {
          block8 : {
           if (($14_1 | 0) == (47 | 0)) {
            break block8
           }
           if (($14_1 | 0) == (81 | 0)) {
            break block9
           }
           break block10;
          }
          HEAP32[($2_1 + 28 | 0) >> 2] = -1;
          break block1;
         }
         $17_1 = 1;
         $114(HEAP32[($2_1 + 24 | 0) >> 2] | 0 | 0, $2_1 + 17 | 0 | 0, $17_1 | 0, $17_1 | 0) | 0;
         $20_1 = 1;
         $114(HEAP32[($2_1 + 24 | 0) >> 2] | 0 | 0, $2_1 + 16 | 0 | 0, $20_1 | 0, $20_1 | 0) | 0;
         $23_1 = 1;
         $114(HEAP32[($2_1 + 24 | 0) >> 2] | 0 | 0, $2_1 + 15 | 0 | 0, $23_1 | 0, $23_1 | 0) | 0;
         (wasm2js_i32$0 = $2_1, wasm2js_i32$1 = $185(1 | 0, 20 | 0) | 0), HEAP32[(wasm2js_i32$0 + 4 | 0) >> 2] = wasm2js_i32$1;
         block11 : {
          if ((HEAP32[($2_1 + 4 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
           break block11
          }
          HEAP32[(HEAP32[($2_1 + 20 | 0) >> 2] | 0) >> 2] = 1;
          HEAP32[($2_1 + 28 | 0) >> 2] = 0;
          break block1;
         }
         HEAP32[(HEAP32[($2_1 + 4 | 0) >> 2] | 0) >> 2] = HEAP32[((HEAP32[($2_1 + 20 | 0) >> 2] | 0) + 13096 | 0) >> 2] | 0;
         HEAP8[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 13 | 0) >> 0] = 10;
         HEAP8[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 12 | 0) >> 0] = HEAPU8[($2_1 + 15 | 0) >> 0] | 0;
         HEAP32[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 4 | 0) >> 2] = HEAPU8[($2_1 + 17 | 0) >> 0] | 0;
         HEAP8[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 14 | 0) >> 0] = HEAPU8[($2_1 + 19 | 0) >> 0] | 0;
         HEAP32[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 8 | 0) >> 2] = HEAPU8[($2_1 + 16 | 0) >> 0] | 0;
         HEAP32[($2_1 + 28 | 0) >> 2] = HEAP32[($2_1 + 4 | 0) >> 2] | 0;
         break block1;
        }
        $117(HEAP32[($2_1 + 24 | 0) >> 2] | 0 | 0, HEAP32[($2_1 + 8 | 0) >> 2] | 0 | 0) | 0;
       }
       break block12;
      }
      HEAP8[($2_1 + 17 | 0) >> 0] = HEAPU8[($2_1 + 19 | 0) >> 0] | 0;
      block13 : {
       if (!((HEAPU8[($2_1 + 17 | 0) >> 0] | 0) & 128 | 0)) {
        break block13
       }
       HEAP8[(0 + 75733 | 0) >> 0] = (HEAPU8[($2_1 + 17 | 0) >> 0] | 0) & 15 | 0;
       HEAP8[(0 + 75732 | 0) >> 0] = ((HEAPU8[($2_1 + 17 | 0) >> 0] | 0) >> 4 | 0) & 7 | 0;
       $33_1 = 1;
       $114(HEAP32[($2_1 + 24 | 0) >> 2] | 0 | 0, $2_1 + 17 | 0 | 0, $33_1 | 0, $33_1 | 0) | 0;
       HEAP8[($2_1 + 17 | 0) >> 0] = (HEAPU8[($2_1 + 17 | 0) >> 0] | 0) & 127 | 0;
      }
      $34_1 = HEAPU8[(0 + 75732 | 0) >> 0] | 0;
      block50 : {
       block21 : {
        switch ($34_1 | 0) {
        case 0:
         $37_1 = 1;
         $114(HEAP32[($2_1 + 24 | 0) >> 2] | 0 | 0, $2_1 + 16 | 0 | 0, $37_1 | 0, $37_1 | 0) | 0;
         HEAP8[($2_1 + 16 | 0) >> 0] = (HEAPU8[($2_1 + 16 | 0) >> 0] | 0) & 127 | 0;
         (wasm2js_i32$0 = $2_1, wasm2js_i32$1 = $185(1 | 0, 20 | 0) | 0), HEAP32[(wasm2js_i32$0 + 4 | 0) >> 2] = wasm2js_i32$1;
         block22 : {
          if ((HEAP32[($2_1 + 4 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
           break block22
          }
          HEAP32[(HEAP32[($2_1 + 20 | 0) >> 2] | 0) >> 2] = 1;
          HEAP32[($2_1 + 28 | 0) >> 2] = 0;
          break block1;
         }
         HEAP32[(HEAP32[($2_1 + 4 | 0) >> 2] | 0) >> 2] = HEAP32[((HEAP32[($2_1 + 20 | 0) >> 2] | 0) + 13096 | 0) >> 2] | 0;
         HEAP8[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 13 | 0) >> 0] = 2;
         HEAP8[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 12 | 0) >> 0] = HEAPU8[(0 + 75733 | 0) >> 0] | 0;
         HEAP32[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 4 | 0) >> 2] = HEAPU8[($2_1 + 17 | 0) >> 0] | 0;
         HEAP8[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 14 | 0) >> 0] = HEAPU8[($2_1 + 19 | 0) >> 0] | 0;
         HEAP32[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 8 | 0) >> 2] = HEAPU8[($2_1 + 16 | 0) >> 0] | 0;
         HEAP32[($2_1 + 28 | 0) >> 2] = HEAP32[($2_1 + 4 | 0) >> 2] | 0;
         break block1;
        case 1:
         $45_1 = 1;
         $114(HEAP32[($2_1 + 24 | 0) >> 2] | 0 | 0, $2_1 + 16 | 0 | 0, $45_1 | 0, $45_1 | 0) | 0;
         HEAP8[($2_1 + 16 | 0) >> 0] = (HEAPU8[($2_1 + 16 | 0) >> 0] | 0) & 127 | 0;
         (wasm2js_i32$0 = $2_1, wasm2js_i32$1 = $185(1 | 0, 20 | 0) | 0), HEAP32[(wasm2js_i32$0 + 4 | 0) >> 2] = wasm2js_i32$1;
         block23 : {
          if ((HEAP32[($2_1 + 4 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
           break block23
          }
          HEAP32[(HEAP32[($2_1 + 20 | 0) >> 2] | 0) >> 2] = 1;
          HEAP32[($2_1 + 28 | 0) >> 2] = 0;
          break block1;
         }
         HEAP32[(HEAP32[($2_1 + 4 | 0) >> 2] | 0) >> 2] = HEAP32[((HEAP32[($2_1 + 20 | 0) >> 2] | 0) + 13096 | 0) >> 2] | 0;
         HEAP8[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 13 | 0) >> 0] = 1;
         HEAP8[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 12 | 0) >> 0] = HEAPU8[(0 + 75733 | 0) >> 0] | 0;
         HEAP32[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 4 | 0) >> 2] = HEAPU8[($2_1 + 17 | 0) >> 0] | 0;
         HEAP8[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 14 | 0) >> 0] = HEAPU8[($2_1 + 19 | 0) >> 0] | 0;
         HEAP32[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 8 | 0) >> 2] = HEAPU8[($2_1 + 16 | 0) >> 0] | 0;
         HEAP32[($2_1 + 28 | 0) >> 2] = HEAP32[($2_1 + 4 | 0) >> 2] | 0;
         break block1;
        case 2:
         $53_1 = 1;
         $114(HEAP32[($2_1 + 24 | 0) >> 2] | 0 | 0, $2_1 + 16 | 0 | 0, $53_1 | 0, $53_1 | 0) | 0;
         HEAP8[($2_1 + 16 | 0) >> 0] = (HEAPU8[($2_1 + 16 | 0) >> 0] | 0) & 127 | 0;
         (wasm2js_i32$0 = $2_1, wasm2js_i32$1 = $185(1 | 0, 20 | 0) | 0), HEAP32[(wasm2js_i32$0 + 4 | 0) >> 2] = wasm2js_i32$1;
         block24 : {
          if ((HEAP32[($2_1 + 4 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
           break block24
          }
          HEAP32[(HEAP32[($2_1 + 20 | 0) >> 2] | 0) >> 2] = 1;
          HEAP32[($2_1 + 28 | 0) >> 2] = 0;
          break block1;
         }
         HEAP32[(HEAP32[($2_1 + 4 | 0) >> 2] | 0) >> 2] = HEAP32[((HEAP32[($2_1 + 20 | 0) >> 2] | 0) + 13096 | 0) >> 2] | 0;
         HEAP8[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 13 | 0) >> 0] = 3;
         HEAP8[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 12 | 0) >> 0] = HEAPU8[(0 + 75733 | 0) >> 0] | 0;
         HEAP32[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 4 | 0) >> 2] = HEAPU8[($2_1 + 17 | 0) >> 0] | 0;
         HEAP8[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 14 | 0) >> 0] = HEAPU8[($2_1 + 19 | 0) >> 0] | 0;
         HEAP32[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 8 | 0) >> 2] = HEAPU8[($2_1 + 16 | 0) >> 0] | 0;
         HEAP32[($2_1 + 28 | 0) >> 2] = HEAP32[($2_1 + 4 | 0) >> 2] | 0;
         break block1;
        case 3:
         $60_1 = 1;
         $114(HEAP32[($2_1 + 24 | 0) >> 2] | 0 | 0, $2_1 + 16 | 0 | 0, $60_1 | 0, $60_1 | 0) | 0;
         HEAP8[($2_1 + 16 | 0) >> 0] = (HEAPU8[($2_1 + 16 | 0) >> 0] | 0) & 127 | 0;
         HEAP32[$2_1 >> 2] = 255;
         $61_1 = HEAPU8[($2_1 + 17 | 0) >> 0] | 0;
         block40 : {
          block26 : {
           switch ($61_1 | 0) {
           case 7:
            HEAP32[$2_1 >> 2] = 4;
            break block40;
           case 10:
            HEAP32[$2_1 >> 2] = 5;
            break block40;
           case 11:
            HEAP32[$2_1 >> 2] = 7;
            break block40;
           case 64:
            HEAP32[$2_1 >> 2] = 6;
            HEAP8[($2_1 + 16 | 0) >> 0] = (HEAPU8[($2_1 + 16 | 0) >> 0] | 0 | 0) >= (64 | 0) & 1 | 0;
            break block40;
           case 120:
            HEAP32[$2_1 >> 2] = 12;
            break block40;
           case 121:
            HEAP32[$2_1 >> 2] = 13;
            break block40;
           case 123:
            HEAP32[$2_1 >> 2] = 14;
            break block40;
           case 0:
            HEAP32[$2_1 >> 2] = 15;
            break block40;
           case 32:
            block41 : {
             if (!(HEAPU8[($2_1 + 16 | 0) >> 0] | 0)) {
              break block41
             }
            }
            break block40;
           case 100:
            HEAP8[(0 + 75734 | 0) >> 0] = 0;
            HEAP8[((HEAPU8[(0 + 75733 | 0) >> 0] | 0) + 75744 | 0) >> 0] = HEAPU8[($2_1 + 16 | 0) >> 0] | 0;
            break block40;
           case 101:
            HEAP8[(0 + 75734 | 0) >> 0] = 0;
            HEAP8[((HEAPU8[(0 + 75733 | 0) >> 0] | 0) + 75760 | 0) >> 0] = HEAPU8[($2_1 + 16 | 0) >> 0] | 0;
            break block40;
           case 99:
            HEAP8[(0 + 75734 | 0) >> 0] = 1;
            HEAP8[((HEAPU8[(0 + 75733 | 0) >> 0] | 0) + 75744 | 0) >> 0] = HEAPU8[($2_1 + 16 | 0) >> 0] | 0;
            break block40;
           case 98:
            HEAP8[(0 + 75734 | 0) >> 0] = 1;
            HEAP8[((HEAPU8[(0 + 75733 | 0) >> 0] | 0) + 75760 | 0) >> 0] = HEAPU8[($2_1 + 16 | 0) >> 0] | 0;
            break block40;
           case 6:
            block42 : {
             if (!((HEAPU8[(0 + 75734 | 0) >> 0] | 0 | 0) != (0 & 255 | 0 | 0) & 1 | 0)) {
              break block42
             }
             break block40;
            }
            $71_1 = HEAPU8[(0 + 75733 | 0) >> 0] | 0;
            $72_1 = (HEAPU8[($71_1 + 75744 | 0) >> 0] | 0) << 8 | 0 | (HEAPU8[($71_1 + 75760 | 0) >> 0] | 0) | 0;
            block46 : {
             block45 : {
              block44 : {
               block43 : {
                if (!$72_1) {
                 break block43
                }
                if (($72_1 | 0) == (32639 | 0)) {
                 break block44
                }
                break block45;
               }
               HEAP32[$2_1 >> 2] = 11;
               break block46;
              }
              (wasm2js_i32$0 = $2_1, wasm2js_i32$1 = $185(1 | 0, 20 | 0) | 0), HEAP32[(wasm2js_i32$0 + 4 | 0) >> 2] = wasm2js_i32$1;
              block47 : {
               if ((HEAP32[($2_1 + 4 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
                break block47
               }
               HEAP32[(HEAP32[($2_1 + 20 | 0) >> 2] | 0) >> 2] = 1;
               HEAP32[($2_1 + 28 | 0) >> 2] = 0;
               break block1;
              }
              HEAP32[(HEAP32[($2_1 + 4 | 0) >> 2] | 0) >> 2] = HEAP32[((HEAP32[($2_1 + 20 | 0) >> 2] | 0) + 13096 | 0) >> 2] | 0;
              HEAP8[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 13 | 0) >> 0] = 11;
              HEAP8[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 12 | 0) >> 0] = HEAPU8[(0 + 75733 | 0) >> 0] | 0;
              HEAP32[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 4 | 0) >> 2] = 2;
              HEAP8[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 14 | 0) >> 0] = HEAPU8[($2_1 + 19 | 0) >> 0] | 0;
              HEAP32[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 8 | 0) >> 2] = 0;
              HEAP32[($2_1 + 28 | 0) >> 2] = HEAP32[($2_1 + 4 | 0) >> 2] | 0;
              break block1;
             }
            }
            break block40;
           default:
            break block26;
           };
          }
         }
         block48 : {
          if (!((HEAP32[$2_1 >> 2] | 0 | 0) != (255 | 0) & 1 | 0)) {
           break block48
          }
          (wasm2js_i32$0 = $2_1, wasm2js_i32$1 = $185(1 | 0, 20 | 0) | 0), HEAP32[(wasm2js_i32$0 + 4 | 0) >> 2] = wasm2js_i32$1;
          block49 : {
           if ((HEAP32[($2_1 + 4 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
            break block49
           }
           HEAP32[(HEAP32[($2_1 + 20 | 0) >> 2] | 0) >> 2] = 1;
           HEAP32[($2_1 + 28 | 0) >> 2] = 0;
           break block1;
          }
          HEAP32[(HEAP32[($2_1 + 4 | 0) >> 2] | 0) >> 2] = HEAP32[((HEAP32[($2_1 + 20 | 0) >> 2] | 0) + 13096 | 0) >> 2] | 0;
          HEAP8[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 13 | 0) >> 0] = HEAP32[$2_1 >> 2] | 0;
          HEAP8[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 12 | 0) >> 0] = HEAPU8[(0 + 75733 | 0) >> 0] | 0;
          HEAP32[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 4 | 0) >> 2] = HEAPU8[($2_1 + 16 | 0) >> 0] | 0;
          HEAP8[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 14 | 0) >> 0] = HEAPU8[($2_1 + 19 | 0) >> 0] | 0;
          HEAP32[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 8 | 0) >> 2] = 0;
          HEAP32[($2_1 + 28 | 0) >> 2] = HEAP32[($2_1 + 4 | 0) >> 2] | 0;
          break block1;
         }
         break block50;
        case 4:
         HEAP8[($2_1 + 17 | 0) >> 0] = (HEAPU8[($2_1 + 17 | 0) >> 0] | 0) & 127 | 0;
         (wasm2js_i32$0 = $2_1, wasm2js_i32$1 = $185(1 | 0, 20 | 0) | 0), HEAP32[(wasm2js_i32$0 + 4 | 0) >> 2] = wasm2js_i32$1;
         block51 : {
          if ((HEAP32[($2_1 + 4 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
           break block51
          }
          HEAP32[(HEAP32[($2_1 + 20 | 0) >> 2] | 0) >> 2] = 1;
          HEAP32[($2_1 + 28 | 0) >> 2] = 0;
          break block1;
         }
         HEAP32[(HEAP32[($2_1 + 4 | 0) >> 2] | 0) >> 2] = HEAP32[((HEAP32[($2_1 + 20 | 0) >> 2] | 0) + 13096 | 0) >> 2] | 0;
         HEAP8[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 13 | 0) >> 0] = 9;
         HEAP8[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 12 | 0) >> 0] = HEAPU8[(0 + 75733 | 0) >> 0] | 0;
         HEAP32[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 4 | 0) >> 2] = HEAPU8[($2_1 + 17 | 0) >> 0] | 0;
         HEAP8[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 14 | 0) >> 0] = HEAPU8[($2_1 + 19 | 0) >> 0] | 0;
         HEAP32[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 8 | 0) >> 2] = 0;
         HEAP32[($2_1 + 28 | 0) >> 2] = HEAP32[($2_1 + 4 | 0) >> 2] | 0;
         break block1;
        case 5:
         break block50;
        case 6:
         $87_1 = 1;
         $114(HEAP32[($2_1 + 24 | 0) >> 2] | 0 | 0, $2_1 + 16 | 0 | 0, $87_1 | 0, $87_1 | 0) | 0;
         HEAP8[($2_1 + 16 | 0) >> 0] = (HEAPU8[($2_1 + 16 | 0) >> 0] | 0) & 127 | 0;
         (wasm2js_i32$0 = $2_1, wasm2js_i32$1 = $185(1 | 0, 20 | 0) | 0), HEAP32[(wasm2js_i32$0 + 4 | 0) >> 2] = wasm2js_i32$1;
         block52 : {
          if ((HEAP32[($2_1 + 4 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
           break block52
          }
          HEAP32[(HEAP32[($2_1 + 20 | 0) >> 2] | 0) >> 2] = 1;
          HEAP32[($2_1 + 28 | 0) >> 2] = 0;
          break block1;
         }
         HEAP32[(HEAP32[($2_1 + 4 | 0) >> 2] | 0) >> 2] = HEAP32[((HEAP32[($2_1 + 20 | 0) >> 2] | 0) + 13096 | 0) >> 2] | 0;
         HEAP8[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 13 | 0) >> 0] = 8;
         HEAP8[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 12 | 0) >> 0] = HEAPU8[(0 + 75733 | 0) >> 0] | 0;
         HEAP32[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 4 | 0) >> 2] = HEAPU8[($2_1 + 17 | 0) >> 0] | 0;
         HEAP8[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 14 | 0) >> 0] = HEAPU8[($2_1 + 19 | 0) >> 0] | 0;
         HEAP32[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 8 | 0) >> 2] = HEAPU8[($2_1 + 16 | 0) >> 0] | 0;
         HEAP32[($2_1 + 28 | 0) >> 2] = HEAP32[($2_1 + 4 | 0) >> 2] | 0;
         break block1;
        default:
         break block21;
        };
       }
      }
     }
    }
    continue label;
   };
  }
  $93_1 = HEAP32[($2_1 + 28 | 0) >> 2] | 0;
  global$0 = $2_1 + 32 | 0;
  return $93_1 | 0;
 }
 
 function $80($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, $6_1 = 0.0, $37_1 = 0, $7_1 = 0.0, $50_1 = 0;
  $3_1 = global$0 - 32 | 0;
  HEAP32[($3_1 + 28 | 0) >> 2] = $0_1;
  HEAP32[($3_1 + 24 | 0) >> 2] = $1_1;
  HEAP32[($3_1 + 20 | 0) >> 2] = $2_1;
  HEAPF64[($3_1 + 8 | 0) >> 3] = +(HEAP32[($3_1 + 24 | 0) >> 2] | 0 | 0) * +(HEAP32[((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0 | 0) * .065536 / +(HEAP32[($3_1 + 20 | 0) >> 2] | 0 | 0);
  $6_1 = +HEAPF64[($3_1 + 8 | 0) >> 3];
  if (Math_abs($6_1) < 2147483647.0) {
   $37_1 = ~~$6_1
  } else {
   $37_1 = -2147483648
  }
  HEAP32[((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1080 | 0) >> 2] = $37_1 & 65535 | 0;
  $7_1 = +HEAPF64[($3_1 + 8 | 0) >> 3];
  if (Math_abs($7_1) < 2147483647.0) {
   $50_1 = ~~$7_1
  } else {
   $50_1 = -2147483648
  }
  HEAP32[((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 1076 | 0) >> 2] = $50_1 >> 16 | 0;
  return;
 }
 
 function $81($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, $4_1 = 0, $5_1 = 0, $46_1 = 0;
  $1_1 = global$0 - 16 | 0;
  global$0 = $1_1;
  HEAP32[($1_1 + 8 | 0) >> 2] = $0_1;
  HEAP32[($1_1 + 4 | 0) >> 2] = 0;
  block1 : {
   label : while (1) {
    $4_1 = 1;
    block : {
     if ($114(HEAP32[($1_1 + 8 | 0) >> 2] | 0 | 0, $1_1 + 3 | 0 | 0, $4_1 | 0, $4_1 | 0) | 0) {
      break block
     }
     HEAP32[($1_1 + 12 | 0) >> 2] = HEAP32[($1_1 + 4 | 0) >> 2] | 0;
     break block1;
    }
    HEAP32[($1_1 + 4 | 0) >> 2] = ((HEAPU8[($1_1 + 3 | 0) >> 0] | 0) & 127 | 0) + (HEAP32[($1_1 + 4 | 0) >> 2] | 0) | 0;
    block2 : {
     if ((HEAPU8[($1_1 + 3 | 0) >> 0] | 0) & 128 | 0) {
      break block2
     }
     HEAP32[($1_1 + 12 | 0) >> 2] = HEAP32[($1_1 + 4 | 0) >> 2] | 0;
     break block1;
    }
    HEAP32[($1_1 + 4 | 0) >> 2] = (HEAP32[($1_1 + 4 | 0) >> 2] | 0) << 7 | 0;
    continue label;
   };
  }
  $5_1 = HEAP32[($1_1 + 12 | 0) >> 2] | 0;
  global$0 = $1_1 + 16 | 0;
  return $5_1 | 0;
 }
 
 function $82($0_1, $1_1, $2_1, $3_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  var $4_1 = 0, $9_1 = 0, $11_1 = 0, $19_1 = 0, $144_1 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $4_1 = global$0 - 32 | 0;
  global$0 = $4_1;
  HEAP32[($4_1 + 24 | 0) >> 2] = $0_1;
  HEAP32[($4_1 + 20 | 0) >> 2] = $1_1;
  HEAP32[($4_1 + 16 | 0) >> 2] = $2_1;
  HEAP8[($4_1 + 15 | 0) >> 0] = $3_1;
  (wasm2js_i32$0 = $4_1, wasm2js_i32$1 = $182((HEAP32[($4_1 + 16 | 0) >> 2] | 0) + 1 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 4 | 0) >> 2] = wasm2js_i32$1;
  block1 : {
   block : {
    if ((HEAP32[($4_1 + 4 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
     break block
    }
    $117(HEAP32[($4_1 + 24 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 16 | 0) >> 2] | 0 | 0) | 0;
    HEAP32[($4_1 + 28 | 0) >> 2] = -1;
    break block1;
   }
   block2 : {
    if (!((HEAP32[($4_1 + 16 | 0) >> 2] | 0 | 0) != ($114(HEAP32[($4_1 + 24 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 4 | 0) >> 2] | 0 | 0, 1 | 0, HEAP32[($4_1 + 16 | 0) >> 2] | 0 | 0) | 0 | 0) & 1 | 0)) {
     break block2
    }
    $184(HEAP32[($4_1 + 4 | 0) >> 2] | 0 | 0);
    HEAP32[($4_1 + 28 | 0) >> 2] = -1;
    break block1;
   }
   HEAP8[((HEAP32[($4_1 + 4 | 0) >> 2] | 0) + (HEAP32[($4_1 + 16 | 0) >> 2] | 0) | 0) >> 0] = 0;
   block3 : {
    label : while (1) {
     $9_1 = HEAP32[($4_1 + 16 | 0) >> 2] | 0;
     HEAP32[($4_1 + 16 | 0) >> 2] = $9_1 + -1 | 0;
     if (!$9_1) {
      break block3
     }
     block4 : {
      if (!((HEAPU8[((HEAP32[($4_1 + 4 | 0) >> 2] | 0) + (HEAP32[($4_1 + 16 | 0) >> 2] | 0) | 0) >> 0] | 0 | 0) < (32 | 0) & 1 | 0)) {
       break block4
      }
      HEAP8[((HEAP32[($4_1 + 4 | 0) >> 2] | 0) + (HEAP32[($4_1 + 16 | 0) >> 2] | 0) | 0) >> 0] = 46;
     }
     continue label;
    };
   }
   $11_1 = (HEAPU8[($4_1 + 15 | 0) >> 0] | 0) + -1 | 0;
   block9 : {
    block8 : {
     switch ($11_1 | 0) {
     case 0:
      HEAP32[($4_1 + 8 | 0) >> 2] = 0;
      break block9;
     case 1:
      HEAP32[($4_1 + 8 | 0) >> 2] = 1;
      break block9;
     default:
      $184(HEAP32[($4_1 + 4 | 0) >> 2] | 0 | 0);
      HEAP32[($4_1 + 28 | 0) >> 2] = 0;
      break block1;
     case 4:
      break block8;
     };
    }
    $83(HEAP32[($4_1 + 20 | 0) >> 2] | 0 | 0, 16 & 255 | 0 | 0, 0 & 255 | 0 | 0, HEAP32[($4_1 + 4 | 0) >> 2] | 0 | 0, $171(HEAP32[($4_1 + 4 | 0) >> 2] | 0 | 0) | 0 | 0, 255 & 255 | 0 | 0);
    HEAP32[($4_1 + 28 | 0) >> 2] = 0;
    break block1;
   }
   $184(HEAP32[(((HEAP32[($4_1 + 20 | 0) >> 2] | 0) + 13104 | 0) + ((HEAP32[($4_1 + 8 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0);
   HEAP32[(((HEAP32[($4_1 + 20 | 0) >> 2] | 0) + 13104 | 0) + ((HEAP32[($4_1 + 8 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] = HEAP32[($4_1 + 4 | 0) >> 2] | 0;
   HEAP32[($4_1 + 28 | 0) >> 2] = 0;
  }
  $19_1 = HEAP32[($4_1 + 28 | 0) >> 2] | 0;
  global$0 = $4_1 + 32 | 0;
  return $19_1 | 0;
 }
 
 function $83($0_1, $1_1, $2_1, $3_1, $4_1, $5_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  $4_1 = $4_1 | 0;
  $5_1 = $5_1 | 0;
  var $6_1 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $6_1 = global$0 - 32 | 0;
  global$0 = $6_1;
  HEAP32[($6_1 + 28 | 0) >> 2] = $0_1;
  HEAP8[($6_1 + 27 | 0) >> 0] = $1_1;
  HEAP8[($6_1 + 26 | 0) >> 0] = $2_1;
  HEAP32[($6_1 + 20 | 0) >> 2] = $3_1;
  HEAP32[($6_1 + 16 | 0) >> 2] = $4_1;
  HEAP8[($6_1 + 15 | 0) >> 0] = $5_1;
  (wasm2js_i32$0 = $6_1, wasm2js_i32$1 = $185(1 | 0, 20 | 0) | 0), HEAP32[(wasm2js_i32$0 + 8 | 0) >> 2] = wasm2js_i32$1;
  block1 : {
   block : {
    if ((HEAP32[($6_1 + 8 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
     break block
    }
    HEAP32[(HEAP32[($6_1 + 28 | 0) >> 2] | 0) >> 2] = 1;
    break block1;
   }
   HEAP32[(HEAP32[($6_1 + 8 | 0) >> 2] | 0) >> 2] = HEAP32[((HEAP32[($6_1 + 28 | 0) >> 2] | 0) + 13096 | 0) >> 2] | 0;
   HEAP8[((HEAP32[($6_1 + 8 | 0) >> 2] | 0) + 13 | 0) >> 0] = HEAPU8[($6_1 + 27 | 0) >> 0] | 0;
   HEAP8[((HEAP32[($6_1 + 8 | 0) >> 2] | 0) + 12 | 0) >> 0] = HEAPU8[($6_1 + 26 | 0) >> 0] | 0;
   HEAP32[((HEAP32[($6_1 + 8 | 0) >> 2] | 0) + 4 | 0) >> 2] = HEAP32[($6_1 + 20 | 0) >> 2] | 0;
   HEAP32[((HEAP32[($6_1 + 8 | 0) >> 2] | 0) + 8 | 0) >> 2] = HEAP32[($6_1 + 16 | 0) >> 2] | 0;
   HEAP8[((HEAP32[($6_1 + 8 | 0) >> 2] | 0) + 14 | 0) >> 0] = HEAPU8[($6_1 + 15 | 0) >> 0] | 0;
   $84(HEAP32[($6_1 + 28 | 0) >> 2] | 0 | 0, HEAP32[($6_1 + 8 | 0) >> 2] | 0 | 0);
  }
  global$0 = $6_1 + 32 | 0;
  return;
 }
 
 function $84($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0, $6_1 = 0, $9_1 = 0;
  $2_1 = global$0 - 16 | 0;
  HEAP32[($2_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($2_1 + 8 | 0) >> 2] = $1_1;
  HEAP32[($2_1 + 4 | 0) >> 2] = HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 13084 | 0) >> 2] | 0;
  HEAP32[$2_1 >> 2] = HEAP32[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 16 | 0) >> 2] | 0;
  label : while (1) {
   $6_1 = 0;
   block : {
    if (!((HEAP32[$2_1 >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
     break block
    }
    $6_1 = (HEAP32[(HEAP32[$2_1 >> 2] | 0) >> 2] | 0 | 0) < (HEAP32[(HEAP32[($2_1 + 8 | 0) >> 2] | 0) >> 2] | 0 | 0);
   }
   block1 : {
    if (!($6_1 & 1 | 0)) {
     break block1
    }
    HEAP32[($2_1 + 4 | 0) >> 2] = HEAP32[$2_1 >> 2] | 0;
    HEAP32[$2_1 >> 2] = HEAP32[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 16 | 0) >> 2] | 0;
    continue label;
   }
   break label;
  };
  HEAP32[((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 16 | 0) >> 2] = HEAP32[$2_1 >> 2] | 0;
  HEAP32[((HEAP32[($2_1 + 4 | 0) >> 2] | 0) + 16 | 0) >> 2] = HEAP32[($2_1 + 8 | 0) >> 2] | 0;
  $9_1 = HEAP32[($2_1 + 12 | 0) >> 2] | 0;
  HEAP32[($9_1 + 13092 | 0) >> 2] = (HEAP32[($9_1 + 13092 | 0) >> 2] | 0) + 1 | 0;
  return;
 }
 
 function $85() {
  var $5_1 = 0;
  HEAP32[(0 + 75792 | 0) >> 2] = 0;
  HEAP32[(0 + 76304 | 0) >> 2] = 0;
  return $86() | 0 | 0;
 }
 
 function $86() {
  var $0_1 = 0, $2_1 = 0, $4_1 = 0, $5_1 = 0, $40_1 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $0_1 = global$0 - 16 | 0;
  global$0 = $0_1;
  (wasm2js_i32$0 = 0, wasm2js_i32$1 = $185(1 | 0, 516 | 0) | 0), HEAP32[(wasm2js_i32$0 + 75792 | 0) >> 2] = wasm2js_i32$1;
  block5 : {
   block1 : {
    block : {
     if ((HEAP32[(0 + 75792 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
      break block
     }
     break block1;
    }
    $2_1 = $185(128 | 0, 28 | 0) | 0;
    HEAP32[(HEAP32[(0 + 75792 | 0) >> 2] | 0) >> 2] = $2_1;
    block2 : {
     if ((HEAP32[(HEAP32[(0 + 75792 | 0) >> 2] | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
      break block2
     }
     break block1;
    }
    (wasm2js_i32$0 = 0, wasm2js_i32$1 = $185(1 | 0, 516 | 0) | 0), HEAP32[(wasm2js_i32$0 + 76304 | 0) >> 2] = wasm2js_i32$1;
    block3 : {
     if ((HEAP32[(0 + 76304 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
      break block3
     }
     break block1;
    }
    $4_1 = $185(128 | 0, 28 | 0) | 0;
    HEAP32[(HEAP32[(0 + 76304 | 0) >> 2] | 0) >> 2] = $4_1;
    block4 : {
     if ((HEAP32[(HEAP32[(0 + 76304 | 0) >> 2] | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
      break block4
     }
     break block1;
    }
    HEAP32[($0_1 + 12 | 0) >> 2] = 0;
    break block5;
   }
   $87();
   HEAP32[($0_1 + 12 | 0) >> 2] = -2;
  }
  $5_1 = HEAP32[($0_1 + 12 | 0) >> 2] | 0;
  global$0 = $0_1 + 16 | 0;
  return $5_1 | 0;
 }
 
 function $87() {
  var $0_1 = 0;
  $0_1 = global$0 - 16 | 0;
  global$0 = $0_1;
  HEAP32[($0_1 + 12 | 0) >> 2] = 0;
  block : {
   label2 : while (1) {
    if (!((HEAP32[($0_1 + 12 | 0) >> 2] | 0 | 0) < (128 | 0) & 1 | 0)) {
     break block
    }
    block1 : {
     if (!((HEAP32[(75792 + ((HEAP32[($0_1 + 12 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
      break block1
     }
     HEAP32[($0_1 + 4 | 0) >> 2] = HEAP32[(HEAP32[(75792 + ((HEAP32[($0_1 + 12 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0) >> 2] | 0;
     block2 : {
      if (!((HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
       break block2
      }
      HEAP32[($0_1 + 8 | 0) >> 2] = 0;
      block3 : {
       label : while (1) {
        if (!((HEAP32[($0_1 + 8 | 0) >> 2] | 0 | 0) < (128 | 0) & 1 | 0)) {
         break block3
        }
        $184(HEAP32[((HEAP32[($0_1 + 4 | 0) >> 2] | 0) + Math_imul(HEAP32[($0_1 + 8 | 0) >> 2] | 0, 28) | 0) >> 2] | 0 | 0);
        HEAP32[($0_1 + 8 | 0) >> 2] = (HEAP32[($0_1 + 8 | 0) >> 2] | 0) + 1 | 0;
        continue label;
       };
      }
      $184(HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 0);
     }
     $184(HEAP32[(75792 + ((HEAP32[($0_1 + 12 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0);
     HEAP32[(75792 + ((HEAP32[($0_1 + 12 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] = 0;
    }
    block4 : {
     if (!((HEAP32[(76304 + ((HEAP32[($0_1 + 12 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
      break block4
     }
     HEAP32[$0_1 >> 2] = HEAP32[(HEAP32[(76304 + ((HEAP32[($0_1 + 12 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0) >> 2] | 0;
     block5 : {
      if (!((HEAP32[$0_1 >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
       break block5
      }
      HEAP32[($0_1 + 8 | 0) >> 2] = 0;
      block6 : {
       label1 : while (1) {
        if (!((HEAP32[($0_1 + 8 | 0) >> 2] | 0 | 0) < (128 | 0) & 1 | 0)) {
         break block6
        }
        $184(HEAP32[((HEAP32[$0_1 >> 2] | 0) + Math_imul(HEAP32[($0_1 + 8 | 0) >> 2] | 0, 28) | 0) >> 2] | 0 | 0);
        HEAP32[($0_1 + 8 | 0) >> 2] = (HEAP32[($0_1 + 8 | 0) >> 2] | 0) + 1 | 0;
        continue label1;
       };
      }
      $184(HEAP32[$0_1 >> 2] | 0 | 0);
     }
     $184(HEAP32[(76304 + ((HEAP32[($0_1 + 12 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0);
     HEAP32[(76304 + ((HEAP32[($0_1 + 12 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] = 0;
    }
    HEAP32[($0_1 + 12 | 0) >> 2] = (HEAP32[($0_1 + 12 | 0) >> 2] | 0) + 1 | 0;
    continue label2;
   };
  }
  $4();
  global$0 = $0_1 + 16 | 0;
  return;
 }
 
 function $88($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, $2_1 = 0, $34_1 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $1_1 = global$0 - 16 | 0;
  global$0 = $1_1;
  HEAP32[($1_1 + 8 | 0) >> 2] = $0_1;
  (wasm2js_i32$0 = $1_1, wasm2js_i32$1 = $85() | 0), HEAP32[(wasm2js_i32$0 + 4 | 0) >> 2] = wasm2js_i32$1;
  block1 : {
   block : {
    if (!(HEAP32[($1_1 + 4 | 0) >> 2] | 0)) {
     break block
    }
    HEAP32[($1_1 + 12 | 0) >> 2] = HEAP32[($1_1 + 4 | 0) >> 2] | 0;
    break block1;
   }
   block3 : {
    block2 : {
     if ((HEAP32[($1_1 + 8 | 0) >> 2] | 0 | 0) == (0 | 0) & 1 | 0) {
      break block2
     }
     if (HEAP8[(HEAP32[($1_1 + 8 | 0) >> 2] | 0) >> 0] | 0) {
      break block3
     }
    }
    (wasm2js_i32$0 = $1_1, wasm2js_i32$1 = $89(65728 | 0) | 0), HEAP32[(wasm2js_i32$0 + 12 | 0) >> 2] = wasm2js_i32$1;
    break block1;
   }
   (wasm2js_i32$0 = $1_1, wasm2js_i32$1 = $89(HEAP32[($1_1 + 8 | 0) >> 2] | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 12 | 0) >> 2] = wasm2js_i32$1;
  }
  $2_1 = HEAP32[($1_1 + 12 | 0) >> 2] | 0;
  global$0 = $1_1 + 16 | 0;
  return $2_1 | 0;
 }
 
 function $89($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, $2_1 = 0, $33_1 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $1_1 = global$0 - 16 | 0;
  global$0 = $1_1;
  HEAP32[($1_1 + 8 | 0) >> 2] = $0_1;
  (wasm2js_i32$0 = $1_1, wasm2js_i32$1 = $90(HEAP32[($1_1 + 8 | 0) >> 2] | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 4 | 0) >> 2] = wasm2js_i32$1;
  block1 : {
   block : {
    if (!(HEAP32[($1_1 + 4 | 0) >> 2] | 0)) {
     break block
    }
    $87();
    HEAP32[($1_1 + 12 | 0) >> 2] = HEAP32[($1_1 + 4 | 0) >> 2] | 0;
    break block1;
   }
   (wasm2js_i32$0 = $1_1, wasm2js_i32$1 = $91(HEAP32[($1_1 + 8 | 0) >> 2] | 0 | 0, 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 4 | 0) >> 2] = wasm2js_i32$1;
   block2 : {
    if (!(HEAP32[($1_1 + 4 | 0) >> 2] | 0)) {
     break block2
    }
    $87();
   }
   HEAP32[($1_1 + 12 | 0) >> 2] = HEAP32[($1_1 + 4 | 0) >> 2] | 0;
  }
  $2_1 = HEAP32[($1_1 + 12 | 0) >> 2] | 0;
  global$0 = $1_1 + 16 | 0;
  return $2_1 | 0;
 }
 
 function $90($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, $2_1 = 0, $33_1 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $1_1 = global$0 - 16 | 0;
  global$0 = $1_1;
  HEAP32[($1_1 + 8 | 0) >> 2] = $0_1;
  (wasm2js_i32$0 = $1_1, wasm2js_i32$1 = $107(HEAP32[($1_1 + 8 | 0) >> 2] | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 4 | 0) >> 2] = wasm2js_i32$1;
  block1 : {
   block : {
    if (!((HEAP32[($1_1 + 4 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
     break block
    }
    (wasm2js_i32$0 = $1_1, wasm2js_i32$1 = $3(HEAP32[($1_1 + 8 | 0) >> 2] | 0 | 0, ((HEAP32[($1_1 + 4 | 0) >> 2] | 0) - (HEAP32[($1_1 + 8 | 0) >> 2] | 0) | 0) + 1 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 12 | 0) >> 2] = wasm2js_i32$1;
    break block1;
   }
   HEAP32[($1_1 + 12 | 0) >> 2] = 0;
  }
  $2_1 = HEAP32[($1_1 + 12 | 0) >> 2] | 0;
  global$0 = $1_1 + 16 | 0;
  return $2_1 | 0;
 }
 
 function $91($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0, $22_1 = 0, $9_1 = 0, $3_1 = 0, $16_1 = 0, $18_1 = 0, $29_1 = 0, $54_1 = 0, $56_1 = 0, $57_1 = 0, $15_1 = 0, $17_1 = 0, $36_1 = 0, $39_1 = 0, $44_1 = 0, $47_1 = 0, $51_1 = 0, $52_1 = 0, $53_1 = 0, $66_1 = 0, $1004 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $2_1 = global$0 - 1136 | 0;
  global$0 = $2_1;
  HEAP32[($2_1 + 1128 | 0) >> 2] = $0_1;
  HEAP32[($2_1 + 1124 | 0) >> 2] = $1_1;
  block1 : {
   block : {
    if (!((HEAP32[($2_1 + 1124 | 0) >> 2] | 0 | 0) >= (50 | 0) & 1 | 0)) {
     break block
    }
    HEAP32[($2_1 + 1132 | 0) >> 2] = -1;
    break block1;
   }
   $3_1 = $1(HEAP32[($2_1 + 1128 | 0) >> 2] | 0 | 0) | 0;
   HEAP32[($2_1 + 1120 | 0) >> 2] = $3_1;
   block2 : {
    if (($3_1 | 0) != (0 | 0) & 1 | 0) {
     break block2
    }
    HEAP32[($2_1 + 1132 | 0) >> 2] = -1;
    break block1;
   }
   HEAP32[($2_1 + 36 | 0) >> 2] = 0;
   HEAP32[($2_1 + 20 | 0) >> 2] = 0;
   HEAP32[($2_1 + 16 | 0) >> 2] = -1;
   block19 : {
    block3 : {
     label : while (1) {
      if (!(($108($2_1 + 96 | 0 | 0, 1024 | 0, HEAP32[($2_1 + 1120 | 0) >> 2] | 0 | 0) | 0 | 0) != (0 | 0) & 1 | 0)) {
       break block3
      }
      HEAP32[($2_1 + 20 | 0) >> 2] = (HEAP32[($2_1 + 20 | 0) >> 2] | 0) + 1 | 0;
      HEAP32[($2_1 + 12 | 0) >> 2] = 0;
      (wasm2js_i32$0 = $2_1, wasm2js_i32$1 = $5($2_1 + 96 | 0 | 0, 65536 | 0, $2_1 + 40 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 48 | 0) >> 2] = wasm2js_i32$1;
      block4 : {
       if ((HEAP32[($2_1 + 48 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
        break block4
       }
       continue label;
      }
      block5 : {
       if ($168(HEAP32[($2_1 + 48 | 0) >> 2] | 0 | 0, 65679 | 0) | 0) {
        break block5
       }
       (wasm2js_i32$0 = $2_1, wasm2js_i32$1 = $5(0 | 0, 65536 | 0, $2_1 + 40 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 48 | 0) >> 2] = wasm2js_i32$1;
       block6 : {
        if ((HEAP32[($2_1 + 48 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
         break block6
        }
        continue label;
       }
      }
      block7 : {
       if (!((HEAP8[(HEAP32[($2_1 + 48 | 0) >> 2] | 0) >> 0] | 0 | 0) == (35 | 0) & 1 | 0)) {
        break block7
       }
       continue label;
      }
      block8 : {
       label3 : while (1) {
        if (!((HEAP32[($2_1 + 12 | 0) >> 2] | 0 | 0) < (9 | 0) & 1 | 0)) {
         break block8
        }
        label1 : while (1) {
         $9_1 = 1;
         block9 : {
          if ((HEAP8[(HEAP32[($2_1 + 40 | 0) >> 2] | 0) >> 0] | 0 | 0) == (32 | 0) & 1 | 0) {
           break block9
          }
          $9_1 = 1;
          if ((HEAP8[(HEAP32[($2_1 + 40 | 0) >> 2] | 0) >> 0] | 0 | 0) == (9 | 0) & 1 | 0) {
           break block9
          }
          $9_1 = (HEAP8[(HEAP32[($2_1 + 40 | 0) >> 2] | 0) >> 0] | 0 | 0) == (-96 | 0);
         }
         block10 : {
          if (!($9_1 & 1 | 0)) {
           break block10
          }
          HEAP32[($2_1 + 40 | 0) >> 2] = (HEAP32[($2_1 + 40 | 0) >> 2] | 0) + 1 | 0;
          continue label1;
         }
         break label1;
        };
        block12 : {
         block11 : {
          if (!(HEAP8[(HEAP32[($2_1 + 40 | 0) >> 2] | 0) >> 0] | 0)) {
           break block11
          }
          if (!((HEAP8[(HEAP32[($2_1 + 40 | 0) >> 2] | 0) >> 0] | 0 | 0) == (35 | 0) & 1 | 0)) {
           break block12
          }
         }
         break block8;
        }
        block22 : {
         block14 : {
          block13 : {
           if ((HEAP8[(HEAP32[($2_1 + 40 | 0) >> 2] | 0) >> 0] | 0 | 0) == (34 | 0) & 1 | 0) {
            break block13
           }
           if (!((HEAP8[(HEAP32[($2_1 + 40 | 0) >> 2] | 0) >> 0] | 0 | 0) == (39 | 0) & 1 | 0)) {
            break block14
           }
          }
          (wasm2js_i32$0 = $2_1, wasm2js_i32$1 = $166((HEAP32[($2_1 + 40 | 0) >> 2] | 0) + 1 | 0 | 0, HEAP8[(HEAP32[($2_1 + 40 | 0) >> 2] | 0) >> 0] | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 8 | 0) >> 2] = wasm2js_i32$1;
          block21 : {
           block15 : {
            if (!((HEAP32[($2_1 + 8 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
             break block15
            }
            block20 : {
             block17 : {
              block16 : {
               if ((HEAP8[((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 1 | 0) >> 0] | 0 | 0) == (32 | 0) & 1 | 0) {
                break block16
               }
               if ((HEAP8[((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 1 | 0) >> 0] | 0 | 0) == (9 | 0) & 1 | 0) {
                break block16
               }
               if ((HEAP8[((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 1 | 0) >> 0] | 0 | 0) == (-96 | 0) & 1 | 0) {
                break block16
               }
               if (HEAP8[((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 1 | 0) >> 0] | 0) {
                break block17
               }
              }
              (wasm2js_i32$0 = $2_1, wasm2js_i32$1 = $166((HEAP32[($2_1 + 40 | 0) >> 2] | 0) + 1 | 0 | 0, ((HEAP8[(HEAP32[($2_1 + 40 | 0) >> 2] | 0) >> 0] | 0 | 0) == (34 | 0) & 1 | 0 ? 39 : 34) | 0) | 0), HEAP32[(wasm2js_i32$0 + 4 | 0) >> 2] = wasm2js_i32$1;
              block18 : {
               if (!((HEAP32[($2_1 + 4 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
                break block18
               }
               if (!((HEAP32[($2_1 + 4 | 0) >> 2] | 0) >>> 0 < (HEAP32[($2_1 + 8 | 0) >> 2] | 0) >>> 0 & 1 | 0)) {
                break block18
               }
               break block19;
              }
              $15_1 = (HEAP32[($2_1 + 40 | 0) >> 2] | 0) + 1 | 0;
              $16_1 = (HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 1 | 0;
              HEAP32[($2_1 + 12 | 0) >> 2] = $16_1;
              HEAP32[(($2_1 + 48 | 0) + ($16_1 << 2 | 0) | 0) >> 2] = $15_1;
              HEAP32[($2_1 + 40 | 0) >> 2] = (HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 1 | 0;
              HEAP8[(HEAP32[($2_1 + 8 | 0) >> 2] | 0) >> 0] = 0;
              break block20;
             }
             break block19;
            }
            break block21;
           }
           break block19;
          }
          break block22;
         }
         $17_1 = HEAP32[($2_1 + 40 | 0) >> 2] | 0;
         $18_1 = (HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 1 | 0;
         HEAP32[($2_1 + 12 | 0) >> 2] = $18_1;
         HEAP32[(($2_1 + 48 | 0) + ($18_1 << 2 | 0) | 0) >> 2] = $17_1;
         label2 : while (1) {
          $22_1 = 1;
          block23 : {
           if ((HEAP8[(HEAP32[($2_1 + 40 | 0) >> 2] | 0) >> 0] | 0 | 0) == (32 | 0) & 1 | 0) {
            break block23
           }
           $22_1 = 1;
           if ((HEAP8[(HEAP32[($2_1 + 40 | 0) >> 2] | 0) >> 0] | 0 | 0) == (9 | 0) & 1 | 0) {
            break block23
           }
           $22_1 = 1;
           if ((HEAP8[(HEAP32[($2_1 + 40 | 0) >> 2] | 0) >> 0] | 0 | 0) == (-96 | 0) & 1 | 0) {
            break block23
           }
           $22_1 = (HEAP8[(HEAP32[($2_1 + 40 | 0) >> 2] | 0) >> 0] | 0 | 0) == (0 | 0);
          }
          block24 : {
           if (!(($22_1 ^ -1 | 0) & 1 | 0)) {
            break block24
           }
           block26 : {
            block25 : {
             if ((HEAP8[(HEAP32[($2_1 + 40 | 0) >> 2] | 0) >> 0] | 0 | 0) == (34 | 0) & 1 | 0) {
              break block25
             }
             if (!((HEAP8[(HEAP32[($2_1 + 40 | 0) >> 2] | 0) >> 0] | 0 | 0) == (39 | 0) & 1 | 0)) {
              break block26
             }
            }
            break block19;
           }
           HEAP32[($2_1 + 40 | 0) >> 2] = (HEAP32[($2_1 + 40 | 0) >> 2] | 0) + 1 | 0;
           continue label2;
          }
          break label2;
         };
         block27 : {
          if (!(HEAP8[(HEAP32[($2_1 + 40 | 0) >> 2] | 0) >> 0] | 0)) {
           break block27
          }
          HEAP8[(HEAP32[($2_1 + 40 | 0) >> 2] | 0) >> 0] = 0;
          HEAP32[($2_1 + 40 | 0) >> 2] = (HEAP32[($2_1 + 40 | 0) >> 2] | 0) + 1 | 0;
         }
        }
        continue label3;
       };
      }
      $29_1 = (HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 1 | 0;
      HEAP32[($2_1 + 12 | 0) >> 2] = $29_1;
      HEAP32[(($2_1 + 48 | 0) + ($29_1 << 2 | 0) | 0) >> 2] = 0;
      block30 : {
       block29 : {
        block28 : {
         if (!($168(HEAP32[($2_1 + 48 | 0) >> 2] | 0 | 0, 65704 | 0) | 0)) {
          break block28
         }
         if (!($168(HEAP32[($2_1 + 48 | 0) >> 2] | 0 | 0, 65540 | 0) | 0)) {
          break block28
         }
         if (!($168(HEAP32[($2_1 + 48 | 0) >> 2] | 0 | 0, 65550 | 0) | 0)) {
          break block28
         }
         if (!($168(HEAP32[($2_1 + 48 | 0) >> 2] | 0 | 0, 65646 | 0) | 0)) {
          break block28
         }
         if ($168(HEAP32[($2_1 + 48 | 0) >> 2] | 0 | 0, 65571 | 0) | 0) {
          break block29
         }
        }
        break block30;
       }
       block32 : {
        block31 : {
         if ($168(HEAP32[($2_1 + 48 | 0) >> 2] | 0 | 0, 65563 | 0) | 0) {
          break block31
         }
         break block32;
        }
        block35 : {
         block34 : {
          block33 : {
           if (!($168(HEAP32[($2_1 + 48 | 0) >> 2] | 0 | 0, 65604 | 0) | 0)) {
            break block33
           }
           if ($168(HEAP32[($2_1 + 48 | 0) >> 2] | 0 | 0, 65719 | 0) | 0) {
            break block34
           }
          }
          break block35;
         }
         block37 : {
          block36 : {
           if ($168(HEAP32[($2_1 + 48 | 0) >> 2] | 0 | 0, 65741 | 0) | 0) {
            break block36
           }
           break block37;
          }
          block39 : {
           block38 : {
            if ($168(HEAP32[($2_1 + 48 | 0) >> 2] | 0 | 0, 65690 | 0) | 0) {
             break block38
            }
            break block39;
           }
           block42 : {
            block41 : {
             block40 : {
              if (!($168(HEAP32[($2_1 + 48 | 0) >> 2] | 0 | 0, 65575 | 0) | 0)) {
               break block40
              }
              if ($168(HEAP32[($2_1 + 48 | 0) >> 2] | 0 | 0, 65580 | 0) | 0) {
               break block41
              }
             }
             break block42;
            }
            block44 : {
             block43 : {
              if ($168(HEAP32[($2_1 + 48 | 0) >> 2] | 0 | 0, 65752 | 0) | 0) {
               break block43
              }
              break block44;
             }
             block46 : {
              block45 : {
               if ($168(HEAP32[($2_1 + 48 | 0) >> 2] | 0 | 0, 65675 | 0) | 0) {
                break block45
               }
               break block46;
              }
              block51 : {
               block47 : {
                if ($168(HEAP32[($2_1 + 48 | 0) >> 2] | 0 | 0, 65635 | 0) | 0) {
                 break block47
                }
                block48 : {
                 if (!((HEAP32[($2_1 + 12 | 0) >> 2] | 0 | 0) < (2 | 0) & 1 | 0)) {
                  break block48
                 }
                 break block19;
                }
                HEAP32[($2_1 + 32 | 0) >> 2] = 1;
                block49 : {
                 label4 : while (1) {
                  if (!((HEAP32[($2_1 + 32 | 0) >> 2] | 0 | 0) < (HEAP32[($2_1 + 12 | 0) >> 2] | 0 | 0) & 1 | 0)) {
                   break block49
                  }
                  block50 : {
                   if (!(($3(HEAP32[(($2_1 + 48 | 0) + ((HEAP32[($2_1 + 32 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0, $171(HEAP32[(($2_1 + 48 | 0) + ((HEAP32[($2_1 + 32 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) | 0 | 0) | 0 | 0) < (0 | 0) & 1 | 0)) {
                    break block50
                   }
                   break block19;
                  }
                  HEAP32[($2_1 + 32 | 0) >> 2] = (HEAP32[($2_1 + 32 | 0) >> 2] | 0) + 1 | 0;
                  continue label4;
                 };
                }
                break block51;
               }
               block56 : {
                block52 : {
                 if ($168(HEAP32[($2_1 + 48 | 0) >> 2] | 0 | 0, 65761 | 0) | 0) {
                  break block52
                 }
                 block53 : {
                  if (!((HEAP32[($2_1 + 12 | 0) >> 2] | 0 | 0) < (2 | 0) & 1 | 0)) {
                   break block53
                  }
                  break block19;
                 }
                 HEAP32[($2_1 + 32 | 0) >> 2] = 1;
                 block54 : {
                  label5 : while (1) {
                   if (!((HEAP32[($2_1 + 32 | 0) >> 2] | 0 | 0) < (HEAP32[($2_1 + 12 | 0) >> 2] | 0 | 0) & 1 | 0)) {
                    break block54
                   }
                   (wasm2js_i32$0 = $2_1, wasm2js_i32$1 = $91(HEAP32[(($2_1 + 48 | 0) + ((HEAP32[($2_1 + 32 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0, (HEAP32[($2_1 + 1124 | 0) >> 2] | 0) + 1 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 16 | 0) >> 2] = wasm2js_i32$1;
                   block55 : {
                    if (!(HEAP32[($2_1 + 16 | 0) >> 2] | 0)) {
                     break block55
                    }
                    break block19;
                   }
                   HEAP32[($2_1 + 32 | 0) >> 2] = (HEAP32[($2_1 + 32 | 0) >> 2] | 0) + 1 | 0;
                   continue label5;
                  };
                 }
                 HEAP32[($2_1 + 16 | 0) >> 2] = -1;
                 break block56;
                }
                block59 : {
                 block57 : {
                  if ($168(HEAP32[($2_1 + 48 | 0) >> 2] | 0 | 0, 65585 | 0) | 0) {
                   break block57
                  }
                  block58 : {
                   if (!((HEAP32[($2_1 + 12 | 0) >> 2] | 0 | 0) != (2 | 0) & 1 | 0)) {
                    break block58
                   }
                   break block19;
                  }
                  $2(76816 | 0, HEAP32[($2_1 + 52 | 0) >> 2] | 0 | 0, 256 | 0) | 0;
                  break block59;
                 }
                 block67 : {
                  block60 : {
                   if ($168(HEAP32[($2_1 + 48 | 0) >> 2] | 0 | 0, 65608 | 0) | 0) {
                    break block60
                   }
                   block61 : {
                    if (!((HEAP32[($2_1 + 12 | 0) >> 2] | 0 | 0) < (2 | 0) & 1 | 0)) {
                     break block61
                    }
                    break block19;
                   }
                   (wasm2js_i32$0 = $2_1, wasm2js_i32$1 = $129(HEAP32[($2_1 + 52 | 0) >> 2] | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 32 | 0) >> 2] = wasm2js_i32$1;
                   block63 : {
                    block62 : {
                     if ((HEAP32[($2_1 + 32 | 0) >> 2] | 0 | 0) < (0 | 0) & 1 | 0) {
                      break block62
                     }
                     if (!((HEAP32[($2_1 + 32 | 0) >> 2] | 0 | 0) > (127 | 0) & 1 | 0)) {
                      break block63
                     }
                    }
                    break block19;
                   }
                   block64 : {
                    if ((HEAP32[(76304 + ((HEAP32[($2_1 + 32 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
                     break block64
                    }
                    $36_1 = $185(1 | 0, 516 | 0) | 0;
                    HEAP32[(76304 + ((HEAP32[($2_1 + 32 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] = $36_1;
                    block65 : {
                     if ((HEAP32[(76304 + ((HEAP32[($2_1 + 32 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
                      break block65
                     }
                     break block19;
                    }
                    $39_1 = $185(128 | 0, 28 | 0) | 0;
                    HEAP32[(HEAP32[(76304 + ((HEAP32[($2_1 + 32 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0) >> 2] = $39_1;
                    block66 : {
                     if ((HEAP32[(HEAP32[(76304 + ((HEAP32[($2_1 + 32 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
                      break block66
                     }
                     break block19;
                    }
                   }
                   HEAP32[($2_1 + 36 | 0) >> 2] = HEAP32[(76304 + ((HEAP32[($2_1 + 32 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0;
                   break block67;
                  }
                  block75 : {
                   block68 : {
                    if ($168(HEAP32[($2_1 + 48 | 0) >> 2] | 0 | 0, 65723 | 0) | 0) {
                     break block68
                    }
                    block69 : {
                     if (!((HEAP32[($2_1 + 12 | 0) >> 2] | 0 | 0) < (2 | 0) & 1 | 0)) {
                      break block69
                     }
                     break block19;
                    }
                    (wasm2js_i32$0 = $2_1, wasm2js_i32$1 = $129(HEAP32[($2_1 + 52 | 0) >> 2] | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 32 | 0) >> 2] = wasm2js_i32$1;
                    block71 : {
                     block70 : {
                      if ((HEAP32[($2_1 + 32 | 0) >> 2] | 0 | 0) < (0 | 0) & 1 | 0) {
                       break block70
                      }
                      if (!((HEAP32[($2_1 + 32 | 0) >> 2] | 0 | 0) > (127 | 0) & 1 | 0)) {
                       break block71
                      }
                     }
                     break block19;
                    }
                    block72 : {
                     if ((HEAP32[(75792 + ((HEAP32[($2_1 + 32 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
                      break block72
                     }
                     $44_1 = $185(1 | 0, 516 | 0) | 0;
                     HEAP32[(75792 + ((HEAP32[($2_1 + 32 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] = $44_1;
                     block73 : {
                      if ((HEAP32[(75792 + ((HEAP32[($2_1 + 32 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
                       break block73
                      }
                      break block19;
                     }
                     $47_1 = $185(128 | 0, 28 | 0) | 0;
                     HEAP32[(HEAP32[(75792 + ((HEAP32[($2_1 + 32 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0) >> 2] = $47_1;
                     block74 : {
                      if ((HEAP32[(HEAP32[(75792 + ((HEAP32[($2_1 + 32 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
                       break block74
                      }
                      break block19;
                     }
                    }
                    HEAP32[($2_1 + 36 | 0) >> 2] = HEAP32[(75792 + ((HEAP32[($2_1 + 32 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0;
                    break block75;
                   }
                   block77 : {
                    block76 : {
                     if ((HEAP32[($2_1 + 12 | 0) >> 2] | 0 | 0) < (2 | 0) & 1 | 0) {
                      break block76
                     }
                     if ((HEAP8[(HEAP32[($2_1 + 48 | 0) >> 2] | 0) >> 0] | 0 | 0) < (48 | 0) & 1 | 0) {
                      break block76
                     }
                     if (!((HEAP8[(HEAP32[($2_1 + 48 | 0) >> 2] | 0) >> 0] | 0 | 0) > (57 | 0) & 1 | 0)) {
                      break block77
                     }
                    }
                    break block19;
                   }
                   (wasm2js_i32$0 = $2_1, wasm2js_i32$1 = $129(HEAP32[($2_1 + 48 | 0) >> 2] | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 32 | 0) >> 2] = wasm2js_i32$1;
                   block79 : {
                    block78 : {
                     if ((HEAP32[($2_1 + 32 | 0) >> 2] | 0 | 0) < (0 | 0) & 1 | 0) {
                      break block78
                     }
                     if (!((HEAP32[($2_1 + 32 | 0) >> 2] | 0 | 0) > (127 | 0) & 1 | 0)) {
                      break block79
                     }
                    }
                    break block19;
                   }
                   block80 : {
                    if ((HEAP32[($2_1 + 36 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
                     break block80
                    }
                    break block19;
                   }
                   $184(HEAP32[((HEAP32[(HEAP32[($2_1 + 36 | 0) >> 2] | 0) >> 2] | 0) + Math_imul(HEAP32[($2_1 + 32 | 0) >> 2] | 0, 28) | 0) >> 2] | 0 | 0);
                   (wasm2js_i32$0 = $2_1, wasm2js_i32$1 = ($171(HEAP32[($2_1 + 52 | 0) >> 2] | 0 | 0) | 0) + 1 | 0), HEAP32[wasm2js_i32$0 >> 2] = wasm2js_i32$1;
                   $51_1 = $182(HEAP32[$2_1 >> 2] | 0 | 0) | 0;
                   HEAP32[((HEAP32[(HEAP32[($2_1 + 36 | 0) >> 2] | 0) >> 2] | 0) + Math_imul(HEAP32[($2_1 + 32 | 0) >> 2] | 0, 28) | 0) >> 2] = $51_1;
                   block81 : {
                    if ((HEAP32[((HEAP32[(HEAP32[($2_1 + 36 | 0) >> 2] | 0) >> 2] | 0) + Math_imul(HEAP32[($2_1 + 32 | 0) >> 2] | 0, 28) | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
                     break block81
                    }
                    break block19;
                   }
                   $52_1 = HEAP32[((HEAP32[(HEAP32[($2_1 + 36 | 0) >> 2] | 0) >> 2] | 0) + Math_imul(HEAP32[($2_1 + 32 | 0) >> 2] | 0, 28) | 0) >> 2] | 0;
                   $53_1 = HEAP32[($2_1 + 52 | 0) >> 2] | 0;
                   $54_1 = HEAP32[$2_1 >> 2] | 0;
                   block82 : {
                    if (!$54_1) {
                     break block82
                    }
                    wasm2js_memory_copy($52_1, $53_1, $54_1);
                   }
                   HEAP32[(((HEAP32[(HEAP32[($2_1 + 36 | 0) >> 2] | 0) >> 2] | 0) + Math_imul(HEAP32[($2_1 + 32 | 0) >> 2] | 0, 28) | 0) + 24 | 0) >> 2] = -1;
                   HEAP32[(((HEAP32[(HEAP32[($2_1 + 36 | 0) >> 2] | 0) >> 2] | 0) + Math_imul(HEAP32[($2_1 + 32 | 0) >> 2] | 0, 28) | 0) + 20 | 0) >> 2] = -1;
                   HEAP32[(((HEAP32[(HEAP32[($2_1 + 36 | 0) >> 2] | 0) >> 2] | 0) + Math_imul(HEAP32[($2_1 + 32 | 0) >> 2] | 0, 28) | 0) + 16 | 0) >> 2] = -1;
                   HEAP32[(((HEAP32[(HEAP32[($2_1 + 36 | 0) >> 2] | 0) >> 2] | 0) + Math_imul(HEAP32[($2_1 + 32 | 0) >> 2] | 0, 28) | 0) + 12 | 0) >> 2] = -1;
                   HEAP32[(((HEAP32[(HEAP32[($2_1 + 36 | 0) >> 2] | 0) >> 2] | 0) + Math_imul(HEAP32[($2_1 + 32 | 0) >> 2] | 0, 28) | 0) + 8 | 0) >> 2] = -1;
                   HEAP32[(((HEAP32[(HEAP32[($2_1 + 36 | 0) >> 2] | 0) >> 2] | 0) + Math_imul(HEAP32[($2_1 + 32 | 0) >> 2] | 0, 28) | 0) + 4 | 0) >> 2] = -1;
                   HEAP32[($2_1 + 28 | 0) >> 2] = 2;
                   block83 : {
                    label6 : while (1) {
                     if (!((HEAP32[($2_1 + 28 | 0) >> 2] | 0 | 0) < (HEAP32[($2_1 + 12 | 0) >> 2] | 0 | 0) & 1 | 0)) {
                      break block83
                     }
                     $56_1 = $166(HEAP32[(($2_1 + 48 | 0) + ((HEAP32[($2_1 + 28 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0, 61 | 0) | 0;
                     HEAP32[($2_1 + 44 | 0) >> 2] = $56_1;
                     block84 : {
                      if (($56_1 | 0) != (0 | 0) & 1 | 0) {
                       break block84
                      }
                      break block19;
                     }
                     $57_1 = HEAP32[($2_1 + 44 | 0) >> 2] | 0;
                     HEAP32[($2_1 + 44 | 0) >> 2] = $57_1 + 1 | 0;
                     HEAP8[$57_1 >> 0] = 0;
                     block88 : {
                      block85 : {
                       if ($168(HEAP32[(($2_1 + 48 | 0) + ((HEAP32[($2_1 + 28 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0, 65660 | 0) | 0) {
                        break block85
                       }
                       (wasm2js_i32$0 = $2_1, wasm2js_i32$1 = $129(HEAP32[($2_1 + 44 | 0) >> 2] | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 24 | 0) >> 2] = wasm2js_i32$1;
                       block87 : {
                        block86 : {
                         if ((HEAP32[($2_1 + 24 | 0) >> 2] | 0 | 0) < (0 | 0) & 1 | 0) {
                          break block86
                         }
                         if ((HEAP32[($2_1 + 24 | 0) >> 2] | 0 | 0) > (800 | 0) & 1 | 0) {
                          break block86
                         }
                         if ((HEAP8[(HEAP32[($2_1 + 44 | 0) >> 2] | 0) >> 0] | 0 | 0) < (48 | 0) & 1 | 0) {
                          break block86
                         }
                         if (!((HEAP8[(HEAP32[($2_1 + 44 | 0) >> 2] | 0) >> 0] | 0 | 0) > (57 | 0) & 1 | 0)) {
                          break block87
                         }
                        }
                        break block19;
                       }
                       HEAP32[(((HEAP32[(HEAP32[($2_1 + 36 | 0) >> 2] | 0) >> 2] | 0) + Math_imul(HEAP32[($2_1 + 32 | 0) >> 2] | 0, 28) | 0) + 8 | 0) >> 2] = HEAP32[($2_1 + 24 | 0) >> 2] | 0;
                       break block88;
                      }
                      block92 : {
                       block89 : {
                        if ($168(HEAP32[(($2_1 + 48 | 0) + ((HEAP32[($2_1 + 28 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0, 65747 | 0) | 0) {
                         break block89
                        }
                        (wasm2js_i32$0 = $2_1, wasm2js_i32$1 = $129(HEAP32[($2_1 + 44 | 0) >> 2] | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 24 | 0) >> 2] = wasm2js_i32$1;
                        block91 : {
                         block90 : {
                          if ((HEAP32[($2_1 + 24 | 0) >> 2] | 0 | 0) < (0 | 0) & 1 | 0) {
                           break block90
                          }
                          if ((HEAP32[($2_1 + 24 | 0) >> 2] | 0 | 0) > (127 | 0) & 1 | 0) {
                           break block90
                          }
                          if ((HEAP8[(HEAP32[($2_1 + 44 | 0) >> 2] | 0) >> 0] | 0 | 0) < (48 | 0) & 1 | 0) {
                           break block90
                          }
                          if (!((HEAP8[(HEAP32[($2_1 + 44 | 0) >> 2] | 0) >> 0] | 0 | 0) > (57 | 0) & 1 | 0)) {
                           break block91
                          }
                         }
                         break block19;
                        }
                        HEAP32[(((HEAP32[(HEAP32[($2_1 + 36 | 0) >> 2] | 0) >> 2] | 0) + Math_imul(HEAP32[($2_1 + 32 | 0) >> 2] | 0, 28) | 0) + 4 | 0) >> 2] = HEAP32[($2_1 + 24 | 0) >> 2] | 0;
                        break block92;
                       }
                       block102 : {
                        block93 : {
                         if ($168(HEAP32[(($2_1 + 48 | 0) + ((HEAP32[($2_1 + 28 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0, 65700 | 0) | 0) {
                          break block93
                         }
                         block95 : {
                          block94 : {
                           if ($168(HEAP32[($2_1 + 44 | 0) >> 2] | 0 | 0, 65639 | 0) | 0) {
                            break block94
                           }
                           HEAP32[($2_1 + 24 | 0) >> 2] = 64;
                           break block95;
                          }
                          block97 : {
                           block96 : {
                            if ($168(HEAP32[($2_1 + 44 | 0) >> 2] | 0 | 0, 65599 | 0) | 0) {
                             break block96
                            }
                            HEAP32[($2_1 + 24 | 0) >> 2] = 0;
                            break block97;
                           }
                           block99 : {
                            block98 : {
                             if ($168(HEAP32[($2_1 + 44 | 0) >> 2] | 0 | 0, 65593 | 0) | 0) {
                              break block98
                             }
                             HEAP32[($2_1 + 24 | 0) >> 2] = 127;
                             break block99;
                            }
                            (wasm2js_i32$0 = $2_1, wasm2js_i32$1 = (Math_imul(($129(HEAP32[($2_1 + 44 | 0) >> 2] | 0 | 0) | 0) + 100 | 0, 100) | 0) / (157 | 0) | 0), HEAP32[(wasm2js_i32$0 + 24 | 0) >> 2] = wasm2js_i32$1;
                           }
                          }
                         }
                         block101 : {
                          block100 : {
                           if ((HEAP32[($2_1 + 24 | 0) >> 2] | 0 | 0) < (0 | 0) & 1 | 0) {
                            break block100
                           }
                           if ((HEAP32[($2_1 + 24 | 0) >> 2] | 0 | 0) > (127 | 0) & 1 | 0) {
                            break block100
                           }
                           if (HEAP32[($2_1 + 24 | 0) >> 2] | 0) {
                            break block101
                           }
                           if (!((HEAP8[(HEAP32[($2_1 + 44 | 0) >> 2] | 0) >> 0] | 0 | 0) != (45 | 0) & 1 | 0)) {
                            break block101
                           }
                           if ((HEAP8[(HEAP32[($2_1 + 44 | 0) >> 2] | 0) >> 0] | 0 | 0) < (48 | 0) & 1 | 0) {
                            break block100
                           }
                           if (!((HEAP8[(HEAP32[($2_1 + 44 | 0) >> 2] | 0) >> 0] | 0 | 0) > (57 | 0) & 1 | 0)) {
                            break block101
                           }
                          }
                          break block19;
                         }
                         HEAP32[(((HEAP32[(HEAP32[($2_1 + 36 | 0) >> 2] | 0) >> 2] | 0) + Math_imul(HEAP32[($2_1 + 32 | 0) >> 2] | 0, 28) | 0) + 12 | 0) >> 2] = HEAP32[($2_1 + 24 | 0) >> 2] | 0;
                         break block102;
                        }
                        block108 : {
                         block103 : {
                          if ($168(HEAP32[(($2_1 + 48 | 0) + ((HEAP32[($2_1 + 28 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0, 65670 | 0) | 0) {
                           break block103
                          }
                          block105 : {
                           block104 : {
                            if ($168(HEAP32[($2_1 + 44 | 0) >> 2] | 0 | 0, 65559 | 0) | 0) {
                             break block104
                            }
                            HEAP32[(((HEAP32[(HEAP32[($2_1 + 36 | 0) >> 2] | 0) >> 2] | 0) + Math_imul(HEAP32[($2_1 + 32 | 0) >> 2] | 0, 28) | 0) + 20 | 0) >> 2] = 0;
                            break block105;
                           }
                           block107 : {
                            block106 : {
                             if ($168(HEAP32[($2_1 + 44 | 0) >> 2] | 0 | 0, 65655 | 0) | 0) {
                              break block106
                             }
                             HEAP32[(((HEAP32[(HEAP32[($2_1 + 36 | 0) >> 2] | 0) >> 2] | 0) + Math_imul(HEAP32[($2_1 + 32 | 0) >> 2] | 0, 28) | 0) + 16 | 0) >> 2] = 0;
                             break block107;
                            }
                            break block19;
                           }
                          }
                          break block108;
                         }
                         block116 : {
                          block109 : {
                           if ($168(HEAP32[(($2_1 + 48 | 0) + ((HEAP32[($2_1 + 28 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0, 65664 | 0) | 0) {
                            break block109
                           }
                           block111 : {
                            block110 : {
                             if ($168(HEAP32[($2_1 + 44 | 0) >> 2] | 0 | 0, 65559 | 0) | 0) {
                              break block110
                             }
                             HEAP32[(((HEAP32[(HEAP32[($2_1 + 36 | 0) >> 2] | 0) >> 2] | 0) + Math_imul(HEAP32[($2_1 + 32 | 0) >> 2] | 0, 28) | 0) + 20 | 0) >> 2] = 1;
                             break block111;
                            }
                            block113 : {
                             block112 : {
                              if ($168(HEAP32[($2_1 + 44 | 0) >> 2] | 0 | 0, 65655 | 0) | 0) {
                               break block112
                              }
                              HEAP32[(((HEAP32[(HEAP32[($2_1 + 36 | 0) >> 2] | 0) >> 2] | 0) + Math_imul(HEAP32[($2_1 + 32 | 0) >> 2] | 0, 28) | 0) + 16 | 0) >> 2] = 1;
                              break block113;
                             }
                             block115 : {
                              block114 : {
                               if ($168(HEAP32[($2_1 + 44 | 0) >> 2] | 0 | 0, 65709 | 0) | 0) {
                                break block114
                               }
                               HEAP32[(((HEAP32[(HEAP32[($2_1 + 36 | 0) >> 2] | 0) >> 2] | 0) + Math_imul(HEAP32[($2_1 + 32 | 0) >> 2] | 0, 28) | 0) + 24 | 0) >> 2] = 1;
                               break block115;
                              }
                              break block19;
                             }
                            }
                           }
                           break block116;
                          }
                          break block19;
                         }
                        }
                       }
                      }
                     }
                     HEAP32[($2_1 + 28 | 0) >> 2] = (HEAP32[($2_1 + 28 | 0) >> 2] | 0) + 1 | 0;
                     continue label6;
                    };
                   }
                  }
                 }
                }
               }
              }
             }
            }
           }
          }
         }
        }
       }
      }
      continue label;
     };
    }
    HEAP32[($2_1 + 16 | 0) >> 2] = 0;
   }
   $132(HEAP32[($2_1 + 1120 | 0) >> 2] | 0 | 0) | 0;
   HEAP32[($2_1 + 1132 | 0) >> 2] = HEAP32[($2_1 + 16 | 0) >> 2] | 0;
  }
  $66_1 = HEAP32[($2_1 + 1132 | 0) >> 2] | 0;
  global$0 = $2_1 + 1136 | 0;
  return $66_1 | 0;
 }
 
 function $92($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0, $3_1 = 0, $23_1 = 0;
  $2_1 = global$0 - 16 | 0;
  global$0 = $2_1;
  HEAP32[($2_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($2_1 + 8 | 0) >> 2] = $1_1;
  HEAP32[($2_1 + 4 | 0) >> 2] = 0;
  $93(HEAP32[($2_1 + 12 | 0) >> 2] | 0 | 0, HEAP32[($2_1 + 8 | 0) >> 2] | 0 | 0, $2_1 + 4 | 0 | 0, 0 | 0);
  $3_1 = HEAP32[($2_1 + 4 | 0) >> 2] | 0;
  global$0 = $2_1 + 16 | 0;
  return $3_1 | 0;
 }
 
 function $93($0_1, $1_1, $2_1, $3_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  var $4_1 = 0, $7_1 = 0, $23_1 = 0, $18_1 = 0, $20_1 = 0, $22_1 = 0, $30_1 = 0, $31_1 = 0, $9_1 = 0, $13_1 = 0, $27_1 = 0, $29_1 = 0, $33_1 = 0, $34_1 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $4_1 = global$0 - 32 | 0;
  global$0 = $4_1;
  HEAP32[($4_1 + 28 | 0) >> 2] = $0_1;
  HEAP32[($4_1 + 24 | 0) >> 2] = $1_1;
  HEAP32[($4_1 + 20 | 0) >> 2] = $2_1;
  HEAP32[($4_1 + 16 | 0) >> 2] = $3_1;
  HEAP32[(HEAP32[($4_1 + 20 | 0) >> 2] | 0) >> 2] = 0;
  block1 : {
   block : {
    if ((HEAP32[($4_1 + 28 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
     break block
    }
    break block1;
   }
   block3 : {
    block2 : {
     if ((HEAP32[(HEAP32[($4_1 + 24 | 0) >> 2] | 0) >> 2] | 0 | 0) < (4e3 | 0) & 1 | 0) {
      break block2
     }
     if (!((HEAP32[(HEAP32[($4_1 + 24 | 0) >> 2] | 0) >> 2] | 0 | 0) > (256e3 | 0) & 1 | 0)) {
      break block3
     }
    }
    break block1;
   }
   block4 : {
    if (!((HEAPU8[((HEAP32[($4_1 + 24 | 0) >> 2] | 0) + 6 | 0) >> 0] | 0 | 0) != (1 | 0) & 1 | 0)) {
     break block4
    }
    if (!((HEAPU8[((HEAP32[($4_1 + 24 | 0) >> 2] | 0) + 6 | 0) >> 0] | 0 | 0) != (2 | 0) & 1 | 0)) {
     break block4
    }
    break block1;
   }
   $7_1 = HEAPU16[((HEAP32[($4_1 + 24 | 0) >> 2] | 0) + 4 | 0) >> 1] | 0;
   block7 : {
    block6 : {
     block5 : {
      if (($7_1 | 0) == (8 | 0)) {
       break block5
      }
      if (($7_1 | 0) == (16 | 0)) {
       break block5
      }
      if (($7_1 | 0) == (4112 | 0)) {
       break block5
      }
      if (($7_1 | 0) == (32776 | 0)) {
       break block5
      }
      if (($7_1 | 0) == (32784 | 0)) {
       break block5
      }
      if (($7_1 | 0) != (36880 | 0)) {
       break block6
      }
     }
     break block7;
    }
    break block1;
   }
   (wasm2js_i32$0 = $4_1, wasm2js_i32$1 = $185(1 | 0, 13136 | 0) | 0), HEAP32[(wasm2js_i32$0 + 12 | 0) >> 2] = wasm2js_i32$1;
   block8 : {
    if ((HEAP32[($4_1 + 12 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
     break block8
    }
    break block1;
   }
   HEAP32[($4_1 + 8 | 0) >> 2] = 0;
   block12 : {
    block9 : {
     label : while (1) {
      if (!((HEAP32[($4_1 + 8 | 0) >> 2] | 0 | 0) < (128 | 0) & 1 | 0)) {
       break block9
      }
      block10 : {
       if (!((HEAP32[(75792 + ((HEAP32[($4_1 + 8 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
        break block10
       }
       $9_1 = $185(1 | 0, 516 | 0) | 0;
       HEAP32[(((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 28 | 0) + ((HEAP32[($4_1 + 8 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] = $9_1;
       block11 : {
        if ((HEAP32[(((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 28 | 0) + ((HEAP32[($4_1 + 8 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
         break block11
        }
        break block12;
       }
       HEAP32[(HEAP32[(((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 28 | 0) + ((HEAP32[($4_1 + 8 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0) >> 2] = HEAP32[(HEAP32[(75792 + ((HEAP32[($4_1 + 8 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0) >> 2] | 0;
      }
      block13 : {
       if (!((HEAP32[(76304 + ((HEAP32[($4_1 + 8 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
        break block13
       }
       $13_1 = $185(1 | 0, 516 | 0) | 0;
       HEAP32[(((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 540 | 0) + ((HEAP32[($4_1 + 8 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] = $13_1;
       block14 : {
        if ((HEAP32[(((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 540 | 0) + ((HEAP32[($4_1 + 8 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
         break block14
        }
        break block12;
       }
       HEAP32[(HEAP32[(((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 540 | 0) + ((HEAP32[($4_1 + 8 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0) >> 2] = HEAP32[(HEAP32[(76304 + ((HEAP32[($4_1 + 8 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0) >> 2] | 0;
      }
      HEAP32[($4_1 + 8 | 0) >> 2] = (HEAP32[($4_1 + 8 | 0) >> 2] | 0) + 1 | 0;
      continue label;
     };
    }
    HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 24 | 0) >> 2] = 70;
    HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 13052 | 0) >> 2] = 32;
    HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 13056 | 0) >> 2] = 512;
    HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 8 | 0) >> 2] = HEAP32[(HEAP32[($4_1 + 24 | 0) >> 2] | 0) >> 2] | 0;
    HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 12 | 0) >> 2] = 0;
    block15 : {
     if (!((HEAPU16[((HEAP32[($4_1 + 24 | 0) >> 2] | 0) + 4 | 0) >> 1] | 0) & 16 | 0)) {
      break block15
     }
     $18_1 = HEAP32[($4_1 + 12 | 0) >> 2] | 0;
     HEAP32[($18_1 + 12 | 0) >> 2] = HEAP32[($18_1 + 12 | 0) >> 2] | 0 | 4 | 0;
    }
    block16 : {
     if (!((HEAPU16[((HEAP32[($4_1 + 24 | 0) >> 2] | 0) + 4 | 0) >> 1] | 0) & 32768 | 0)) {
      break block16
     }
     $20_1 = HEAP32[($4_1 + 12 | 0) >> 2] | 0;
     HEAP32[($20_1 + 12 | 0) >> 2] = HEAP32[($20_1 + 12 | 0) >> 2] | 0 | 2 | 0;
    }
    block17 : {
     if (!((HEAPU8[((HEAP32[($4_1 + 24 | 0) >> 2] | 0) + 6 | 0) >> 0] | 0 | 0) == (1 | 0) & 1 | 0)) {
      break block17
     }
     $22_1 = HEAP32[($4_1 + 12 | 0) >> 2] | 0;
     HEAP32[($22_1 + 12 | 0) >> 2] = HEAP32[($22_1 + 12 | 0) >> 2] | 0 | 1 | 0;
    }
    $23_1 = HEAPU16[((HEAP32[($4_1 + 24 | 0) >> 2] | 0) + 4 | 0) >> 1] | 0;
    block24 : {
     block20 : {
      block19 : {
       block23 : {
        block22 : {
         block18 : {
          if (($23_1 | 0) == (8 | 0)) {
           break block18
          }
          if (($23_1 | 0) == (16 | 0)) {
           break block19
          }
          if (($23_1 | 0) == (4112 | 0)) {
           break block20
          }
          block21 : {
           if (($23_1 | 0) == (32776 | 0)) {
            break block21
           }
           if (($23_1 | 0) == (32784 | 0)) {
            break block22
           }
           if (($23_1 | 0) == (36880 | 0)) {
            break block23
           }
           break block24;
          }
          HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 1060 | 0) >> 2] = 1;
          break block24;
         }
         HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 1060 | 0) >> 2] = 2;
         break block24;
        }
        HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 1060 | 0) >> 2] = 3;
        break block24;
       }
       HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 1060 | 0) >> 2] = 4;
       break block24;
      }
      HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 1060 | 0) >> 2] = 5;
      break block24;
     }
     HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 1060 | 0) >> 2] = 6;
    }
    HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 1064 | 0) >> 2] = HEAPU16[((HEAP32[($4_1 + 24 | 0) >> 2] | 0) + 8 | 0) >> 1] | 0;
    $27_1 = $182((HEAPU16[((HEAP32[($4_1 + 24 | 0) >> 2] | 0) + 8 | 0) >> 1] | 0) << 1 | 0 | 0) | 0;
    HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 1068 | 0) >> 2] = $27_1;
    block25 : {
     if ((HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 1068 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
      break block25
     }
     break block12;
    }
    $29_1 = $182(((HEAPU16[((HEAP32[($4_1 + 24 | 0) >> 2] | 0) + 8 | 0) >> 1] | 0) << 1 | 0) << 2 | 0 | 0) | 0;
    HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 1072 | 0) >> 2] = $29_1;
    block26 : {
     if ((HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 1072 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
      break block26
     }
     break block12;
    }
    HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 16 | 0) >> 2] = 2;
    block27 : {
     if (!((HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 12 | 0) >> 2] | 0) & 4 | 0)) {
      break block27
     }
     $30_1 = HEAP32[($4_1 + 12 | 0) >> 2] | 0;
     HEAP32[($30_1 + 16 | 0) >> 2] = (HEAP32[($30_1 + 16 | 0) >> 2] | 0) << 1 | 0;
    }
    block28 : {
     if (!((HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 12 | 0) >> 2] | 0) & 1 | 0)) {
      break block28
     }
     $31_1 = HEAP32[($4_1 + 12 | 0) >> 2] | 0;
     HEAP32[($31_1 + 16 | 0) >> 2] = (HEAP32[($31_1 + 16 | 0) >> 2] | 0 | 0) / (2 | 0) | 0;
    }
    HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 13060 | 0) >> 2] = (HEAP32[(HEAP32[($4_1 + 24 | 0) >> 2] | 0) >> 2] | 0 | 0) / (1e3 | 0) | 0;
    block30 : {
     block29 : {
      if (!((HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 13060 | 0) >> 2] | 0 | 0) < (1 | 0) & 1 | 0)) {
       break block29
      }
      HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 13060 | 0) >> 2] = 1;
      break block30;
     }
     block31 : {
      if (!((HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 13060 | 0) >> 2] | 0 | 0) > (255 | 0) & 1 | 0)) {
       break block31
      }
      HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 13060 | 0) >> 2] = 255;
     }
    }
    HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 13064 | 0) >> 2] = 0;
    HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 13068 | 0) >> 2] = 0;
    block33 : {
     block32 : {
      if (HEAP32[($4_1 + 16 | 0) >> 2] | 0) {
       break block32
      }
      $33_1 = $75(HEAP32[($4_1 + 28 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 12 | 0) >> 2] | 0 | 0, (HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 13100 | 0 | 0, (HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 13072 | 0 | 0) | 0;
      HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 13076 | 0) >> 2] = $33_1;
      break block33;
     }
     $34_1 = $185(2 | 0, 16 | 0) | 0;
     HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 13076 | 0) >> 2] = $34_1;
     block34 : {
      if (!((HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 13076 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
       break block34
      }
      HEAP8[((HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 13076 | 0) >> 2] | 0) + 13 | 0) >> 0] = 99;
      HEAP32[(HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 13076 | 0) >> 2] | 0) >> 2] = 2147483647;
      HEAP8[((HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 13076 | 0) >> 2] | 0) + 29 | 0) >> 0] = 99;
      HEAP32[((HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 13076 | 0) >> 2] | 0) + 16 | 0) >> 2] = 2147483647;
      HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 13100 | 0) >> 2] = 2;
      HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 13072 | 0) >> 2] = 2147483647;
     }
    }
    block35 : {
     if ((HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 13076 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
      break block35
     }
     break block12;
    }
    HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 1052 | 0) >> 2] = 0;
    HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 1056 | 0) >> 2] = 0;
    block36 : {
     if (!((HEAPU8[(0 + 76816 | 0) >> 0] | 0 | 0) != (0 & 255 | 0 | 0) & 1 | 0)) {
      break block36
     }
     $19(HEAP32[($4_1 + 12 | 0) >> 2] | 0 | 0, 76816 | 0) | 0;
    }
    $15(HEAP32[($4_1 + 12 | 0) >> 2] | 0 | 0) | 0;
    block37 : {
     if (HEAP32[(HEAP32[($4_1 + 12 | 0) >> 2] | 0) >> 2] | 0) {
      break block37
     }
     HEAP32[(HEAP32[($4_1 + 20 | 0) >> 2] | 0) >> 2] = HEAP32[($4_1 + 12 | 0) >> 2] | 0;
     break block1;
    }
   }
   $94(HEAP32[($4_1 + 12 | 0) >> 2] | 0 | 0);
  }
  global$0 = $4_1 + 32 | 0;
  return;
 }
 
 function $94($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0;
  $1_1 = global$0 - 16 | 0;
  global$0 = $1_1;
  HEAP32[($1_1 + 12 | 0) >> 2] = $0_1;
  block1 : {
   block : {
    if ((HEAP32[($1_1 + 12 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
     break block
    }
    break block1;
   }
   $17(HEAP32[($1_1 + 12 | 0) >> 2] | 0 | 0);
   HEAP32[($1_1 + 8 | 0) >> 2] = 0;
   block2 : {
    label : while (1) {
     if (!((HEAP32[($1_1 + 8 | 0) >> 2] | 0 | 0) < (128 | 0) & 1 | 0)) {
      break block2
     }
     $184(HEAP32[(((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 28 | 0) + ((HEAP32[($1_1 + 8 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0);
     $184(HEAP32[(((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 540 | 0) + ((HEAP32[($1_1 + 8 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0);
     HEAP32[($1_1 + 8 | 0) >> 2] = (HEAP32[($1_1 + 8 | 0) >> 2] | 0) + 1 | 0;
     continue label;
    };
   }
   $184(HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 1072 | 0) >> 2] | 0 | 0);
   $184(HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 1068 | 0) >> 2] | 0 | 0);
   $184(HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 13076 | 0) >> 2] | 0 | 0);
   HEAP32[($1_1 + 8 | 0) >> 2] = 0;
   block3 : {
    label1 : while (1) {
     if (!((HEAP32[($1_1 + 8 | 0) >> 2] | 0 | 0) < (8 | 0) & 1 | 0)) {
      break block3
     }
     $184(HEAP32[(((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 13104 | 0) + ((HEAP32[($1_1 + 8 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0);
     HEAP32[($1_1 + 8 | 0) >> 2] = (HEAP32[($1_1 + 8 | 0) >> 2] | 0) + 1 | 0;
     continue label1;
    };
   }
   $184(HEAP32[($1_1 + 12 | 0) >> 2] | 0 | 0);
  }
  global$0 = $1_1 + 16 | 0;
  return;
 }
 
 function $95($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, $3_1 = 0, $20_1 = 0;
  $1_1 = global$0 - 16 | 0;
  global$0 = $1_1;
  HEAP32[($1_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($1_1 + 8 | 0) >> 2] = 0;
  $93(0 | 0, HEAP32[($1_1 + 12 | 0) >> 2] | 0 | 0, $1_1 + 8 | 0 | 0, 1 | 0);
  $3_1 = HEAP32[($1_1 + 8 | 0) >> 2] | 0;
  global$0 = $1_1 + 16 | 0;
  return $3_1 | 0;
 }
 
 function $96($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0;
  $2_1 = global$0 - 16 | 0;
  HEAP32[($2_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($2_1 + 8 | 0) >> 2] = $1_1;
  HEAP32[(0 + 75776 | 0) >> 2] = HEAP32[($2_1 + 8 | 0) >> 2] | 0;
  return;
 }
 
 function $97($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0;
  $1_1 = global$0 - 16 | 0;
  HEAP32[($1_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[(0 + 75780 | 0) >> 2] = HEAP32[($1_1 + 12 | 0) >> 2] | 0;
  return;
 }
 
 function $98() {
  return 519 | 0;
 }
 
 function $99($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, $4_1 = 0, $164_1 = 0;
  $1_1 = global$0 - 32 | 0;
  global$0 = $1_1;
  HEAP32[($1_1 + 24 | 0) >> 2] = $0_1;
  HEAP32[($1_1 + 12 | 0) >> 2] = 0;
  HEAP32[($1_1 + 8 | 0) >> 2] = 0;
  HEAP32[($1_1 + 4 | 0) >> 2] = 0;
  block1 : {
   block : {
    if ((HEAP32[($1_1 + 24 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
     break block
    }
    HEAP32[($1_1 + 28 | 0) >> 2] = 0;
    break block1;
   }
   HEAP32[($1_1 + 16 | 0) >> 2] = 0;
   block2 : {
    label2 : while (1) {
     if (!((HEAP32[($1_1 + 16 | 0) >> 2] | 0 | 0) < (128 | 0) & 1 | 0)) {
      break block2
     }
     block3 : {
      if (!((HEAP32[(((HEAP32[($1_1 + 24 | 0) >> 2] | 0) + 28 | 0) + ((HEAP32[($1_1 + 16 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
       break block3
      }
      HEAP32[($1_1 + 20 | 0) >> 2] = 0;
      block4 : {
       label : while (1) {
        if (!((HEAP32[($1_1 + 20 | 0) >> 2] | 0 | 0) < (128 | 0) & 1 | 0)) {
         break block4
        }
        block5 : {
         if (!((HEAP32[(((HEAP32[(((HEAP32[($1_1 + 24 | 0) >> 2] | 0) + 28 | 0) + ((HEAP32[($1_1 + 16 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0) + 4 | 0) + ((HEAP32[($1_1 + 20 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) == (-1 | 0) & 1 | 0)) {
          break block5
         }
         $100($1_1 + 12 | 0 | 0, $1_1 + 8 | 0 | 0, $1_1 + 4 | 0 | 0, HEAP32[((HEAP32[(HEAP32[(((HEAP32[($1_1 + 24 | 0) >> 2] | 0) + 28 | 0) + ((HEAP32[($1_1 + 16 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0) >> 2] | 0) + Math_imul(HEAP32[($1_1 + 20 | 0) >> 2] | 0, 28) | 0) >> 2] | 0 | 0);
        }
        HEAP32[($1_1 + 20 | 0) >> 2] = (HEAP32[($1_1 + 20 | 0) >> 2] | 0) + 1 | 0;
        continue label;
       };
      }
     }
     block6 : {
      if (!((HEAP32[(((HEAP32[($1_1 + 24 | 0) >> 2] | 0) + 540 | 0) + ((HEAP32[($1_1 + 16 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
       break block6
      }
      HEAP32[($1_1 + 20 | 0) >> 2] = 0;
      block7 : {
       label1 : while (1) {
        if (!((HEAP32[($1_1 + 20 | 0) >> 2] | 0 | 0) < (128 | 0) & 1 | 0)) {
         break block7
        }
        block8 : {
         if (!((HEAP32[(((HEAP32[(((HEAP32[($1_1 + 24 | 0) >> 2] | 0) + 540 | 0) + ((HEAP32[($1_1 + 16 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0) + 4 | 0) + ((HEAP32[($1_1 + 20 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) == (-1 | 0) & 1 | 0)) {
          break block8
         }
         $100($1_1 + 12 | 0 | 0, $1_1 + 8 | 0 | 0, $1_1 + 4 | 0 | 0, HEAP32[((HEAP32[(HEAP32[(((HEAP32[($1_1 + 24 | 0) >> 2] | 0) + 540 | 0) + ((HEAP32[($1_1 + 16 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0) >> 2] | 0) + Math_imul(HEAP32[($1_1 + 20 | 0) >> 2] | 0, 28) | 0) >> 2] | 0 | 0);
        }
        HEAP32[($1_1 + 20 | 0) >> 2] = (HEAP32[($1_1 + 20 | 0) >> 2] | 0) + 1 | 0;
        continue label1;
       };
      }
     }
     HEAP32[($1_1 + 16 | 0) >> 2] = (HEAP32[($1_1 + 16 | 0) >> 2] | 0) + 1 | 0;
     continue label2;
    };
   }
   block9 : {
    if (!((HEAP32[($1_1 + 12 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
     break block9
    }
    HEAP8[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + (HEAP32[($1_1 + 8 | 0) >> 2] | 0) | 0) >> 0] = 0;
   }
   HEAP32[($1_1 + 28 | 0) >> 2] = HEAP32[($1_1 + 12 | 0) >> 2] | 0;
  }
  $4_1 = HEAP32[($1_1 + 28 | 0) >> 2] | 0;
  global$0 = $1_1 + 32 | 0;
  return $4_1 | 0;
 }
 
 function $100($0_1, $1_1, $2_1, $3_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  var $4_1 = 0, $7_1 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $4_1 = global$0 - 32 | 0;
  global$0 = $4_1;
  HEAP32[($4_1 + 28 | 0) >> 2] = $0_1;
  HEAP32[($4_1 + 24 | 0) >> 2] = $1_1;
  HEAP32[($4_1 + 20 | 0) >> 2] = $2_1;
  HEAP32[($4_1 + 16 | 0) >> 2] = $3_1;
  block2 : {
   block1 : {
    block : {
     if (!((HEAP32[($4_1 + 16 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
      break block
     }
     if ((HEAPU8[(HEAP32[($4_1 + 16 | 0) >> 2] | 0) >> 0] | 0 | 0) != (0 & 255 | 0 | 0) & 1 | 0) {
      break block1
     }
    }
    break block2;
   }
   block3 : {
    if (!((HEAP32[(HEAP32[($4_1 + 28 | 0) >> 2] | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
     break block3
    }
    if (!(($175(HEAP32[(HEAP32[($4_1 + 28 | 0) >> 2] | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 16 | 0) >> 2] | 0 | 0) | 0 | 0) != (0 | 0) & 1 | 0)) {
     break block3
    }
    break block2;
   }
   (wasm2js_i32$0 = $4_1, wasm2js_i32$1 = $171(HEAP32[($4_1 + 16 | 0) >> 2] | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 12 | 0) >> 2] = wasm2js_i32$1;
   HEAP32[($4_1 + 8 | 0) >> 2] = ((HEAP32[(HEAP32[($4_1 + 24 | 0) >> 2] | 0) >> 2] | 0) + (HEAP32[($4_1 + 12 | 0) >> 2] | 0) | 0) + 1 | 0;
   block4 : {
    if (!((HEAP32[($4_1 + 8 | 0) >> 2] | 0) >>> 0 >= (HEAP32[(HEAP32[($4_1 + 20 | 0) >> 2] | 0) >> 2] | 0) >>> 0 & 1 | 0)) {
     break block4
    }
    block6 : {
     block5 : {
      if (HEAP32[(HEAP32[($4_1 + 20 | 0) >> 2] | 0) >> 2] | 0) {
       break block5
      }
      $7_1 = 1024;
      break block6;
     }
     $7_1 = (HEAP32[(HEAP32[($4_1 + 20 | 0) >> 2] | 0) >> 2] | 0) << 1 | 0;
    }
    HEAP32[(HEAP32[($4_1 + 20 | 0) >> 2] | 0) >> 2] = $7_1;
    block7 : {
     if (!((HEAP32[(HEAP32[($4_1 + 20 | 0) >> 2] | 0) >> 2] | 0) >>> 0 <= (HEAP32[($4_1 + 8 | 0) >> 2] | 0) >>> 0 & 1 | 0)) {
      break block7
     }
     HEAP32[(HEAP32[($4_1 + 20 | 0) >> 2] | 0) >> 2] = (HEAP32[($4_1 + 8 | 0) >> 2] | 0) + 1 | 0;
    }
    (wasm2js_i32$0 = $4_1, wasm2js_i32$1 = $186(HEAP32[(HEAP32[($4_1 + 28 | 0) >> 2] | 0) >> 2] | 0 | 0, HEAP32[(HEAP32[($4_1 + 20 | 0) >> 2] | 0) >> 2] | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 4 | 0) >> 2] = wasm2js_i32$1;
    block8 : {
     if ((HEAP32[($4_1 + 4 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
      break block8
     }
     break block2;
    }
    HEAP32[(HEAP32[($4_1 + 28 | 0) >> 2] | 0) >> 2] = HEAP32[($4_1 + 4 | 0) >> 2] | 0;
   }
   $170((HEAP32[(HEAP32[($4_1 + 28 | 0) >> 2] | 0) >> 2] | 0) + (HEAP32[(HEAP32[($4_1 + 24 | 0) >> 2] | 0) >> 2] | 0) | 0 | 0, HEAP32[($4_1 + 16 | 0) >> 2] | 0 | 0) | 0;
   HEAP8[((HEAP32[(HEAP32[($4_1 + 28 | 0) >> 2] | 0) >> 2] | 0) + ((HEAP32[(HEAP32[($4_1 + 24 | 0) >> 2] | 0) >> 2] | 0) + (HEAP32[($4_1 + 12 | 0) >> 2] | 0) | 0) | 0) >> 0] = 10;
   HEAP32[(HEAP32[($4_1 + 24 | 0) >> 2] | 0) >> 2] = HEAP32[($4_1 + 8 | 0) >> 2] | 0;
  }
  global$0 = $4_1 + 32 | 0;
  return;
 }
 
 function $101($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, $3_1 = 0, $7_1 = 0, $10_1 = 0, $11_1 = 0, $193_1 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $1_1 = global$0 - 32 | 0;
  global$0 = $1_1;
  HEAP32[($1_1 + 24 | 0) >> 2] = $0_1;
  HEAP32[($1_1 + 16 | 0) >> 2] = 0;
  block1 : {
   block : {
    if ((HEAP32[($1_1 + 24 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
     break block
    }
    HEAP32[($1_1 + 28 | 0) >> 2] = 0;
    break block1;
   }
   (wasm2js_i32$0 = $1_1, wasm2js_i32$1 = $185(1 | 0, 13136 | 0) | 0), HEAP32[(wasm2js_i32$0 + 20 | 0) >> 2] = wasm2js_i32$1;
   block2 : {
    if ((HEAP32[($1_1 + 20 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
     break block2
    }
    HEAP32[($1_1 + 28 | 0) >> 2] = 0;
    break block1;
   }
   HEAP32[((HEAP32[($1_1 + 20 | 0) >> 2] | 0) + 13056 | 0) >> 2] = 512;
   HEAP32[($1_1 + 12 | 0) >> 2] = 0;
   block6 : {
    block3 : {
     label : while (1) {
      if (!((HEAP32[($1_1 + 12 | 0) >> 2] | 0 | 0) < (128 | 0) & 1 | 0)) {
       break block3
      }
      block4 : {
       if (!((HEAP32[(75792 + ((HEAP32[($1_1 + 12 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
        break block4
       }
       $3_1 = $185(1 | 0, 516 | 0) | 0;
       HEAP32[(((HEAP32[($1_1 + 20 | 0) >> 2] | 0) + 28 | 0) + ((HEAP32[($1_1 + 12 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] = $3_1;
       block5 : {
        if ((HEAP32[(((HEAP32[($1_1 + 20 | 0) >> 2] | 0) + 28 | 0) + ((HEAP32[($1_1 + 12 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
         break block5
        }
        break block6;
       }
       HEAP32[(HEAP32[(((HEAP32[($1_1 + 20 | 0) >> 2] | 0) + 28 | 0) + ((HEAP32[($1_1 + 12 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0) >> 2] = HEAP32[(HEAP32[(75792 + ((HEAP32[($1_1 + 12 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0) >> 2] | 0;
      }
      block7 : {
       if (!((HEAP32[(76304 + ((HEAP32[($1_1 + 12 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
        break block7
       }
       $7_1 = $185(1 | 0, 516 | 0) | 0;
       HEAP32[(((HEAP32[($1_1 + 20 | 0) >> 2] | 0) + 540 | 0) + ((HEAP32[($1_1 + 12 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] = $7_1;
       block8 : {
        if ((HEAP32[(((HEAP32[($1_1 + 20 | 0) >> 2] | 0) + 540 | 0) + ((HEAP32[($1_1 + 12 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
         break block8
        }
        break block6;
       }
       HEAP32[(HEAP32[(((HEAP32[($1_1 + 20 | 0) >> 2] | 0) + 540 | 0) + ((HEAP32[($1_1 + 12 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0) >> 2] = HEAP32[(HEAP32[(76304 + ((HEAP32[($1_1 + 12 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0) >> 2] | 0;
      }
      HEAP32[($1_1 + 12 | 0) >> 2] = (HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 1 | 0;
      continue label;
     };
    }
    $10_1 = $75(HEAP32[($1_1 + 24 | 0) >> 2] | 0 | 0, HEAP32[($1_1 + 20 | 0) >> 2] | 0 | 0, (HEAP32[($1_1 + 20 | 0) >> 2] | 0) + 13100 | 0 | 0, (HEAP32[($1_1 + 20 | 0) >> 2] | 0) + 13072 | 0 | 0) | 0;
    HEAP32[((HEAP32[($1_1 + 20 | 0) >> 2] | 0) + 13076 | 0) >> 2] = $10_1;
    block9 : {
     if (!((HEAP32[((HEAP32[($1_1 + 20 | 0) >> 2] | 0) + 13076 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
      break block9
     }
     (wasm2js_i32$0 = $1_1, wasm2js_i32$1 = $99(HEAP32[($1_1 + 20 | 0) >> 2] | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 16 | 0) >> 2] = wasm2js_i32$1;
    }
   }
   HEAP32[($1_1 + 12 | 0) >> 2] = 0;
   block10 : {
    label1 : while (1) {
     if (!((HEAP32[($1_1 + 12 | 0) >> 2] | 0 | 0) < (128 | 0) & 1 | 0)) {
      break block10
     }
     $184(HEAP32[(((HEAP32[($1_1 + 20 | 0) >> 2] | 0) + 28 | 0) + ((HEAP32[($1_1 + 12 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0);
     $184(HEAP32[(((HEAP32[($1_1 + 20 | 0) >> 2] | 0) + 540 | 0) + ((HEAP32[($1_1 + 12 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0);
     HEAP32[($1_1 + 12 | 0) >> 2] = (HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 1 | 0;
     continue label1;
    };
   }
   $184(HEAP32[((HEAP32[($1_1 + 20 | 0) >> 2] | 0) + 13076 | 0) >> 2] | 0 | 0);
   $184(HEAP32[($1_1 + 20 | 0) >> 2] | 0 | 0);
   HEAP32[($1_1 + 28 | 0) >> 2] = HEAP32[($1_1 + 16 | 0) >> 2] | 0;
  }
  $11_1 = HEAP32[($1_1 + 28 | 0) >> 2] | 0;
  global$0 = $1_1 + 32 | 0;
  return $11_1 | 0;
 }
 
 function $102($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, $24_1 = 0;
  $1_1 = global$0 - 16 | 0;
  HEAP32[($1_1 + 8 | 0) >> 2] = $0_1;
  block2 : {
   block1 : {
    block : {
     if (!((HEAP32[($1_1 + 8 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0)) {
      break block
     }
     if ((HEAP32[((HEAP32[($1_1 + 8 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
      break block1
     }
    }
    HEAP32[($1_1 + 12 | 0) >> 2] = 0;
    break block2;
   }
   HEAP32[($1_1 + 12 | 0) >> 2] = HEAP32[(HEAP32[((HEAP32[($1_1 + 8 | 0) >> 2] | 0) + 13080 | 0) >> 2] | 0) >> 2] | 0;
  }
  return HEAP32[($1_1 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function $103($0_1, $1_1, $2_1, $3_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  var $4_1 = 0, $5_1 = 0, $143_1 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $4_1 = global$0 - 32 | 0;
  global$0 = $4_1;
  HEAP32[($4_1 + 24 | 0) >> 2] = $0_1;
  HEAP32[($4_1 + 20 | 0) >> 2] = $1_1;
  HEAP32[($4_1 + 16 | 0) >> 2] = $2_1;
  HEAP32[($4_1 + 12 | 0) >> 2] = $3_1;
  block1 : {
   block : {
    if ((HEAP32[($4_1 + 24 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
     break block
    }
    HEAP32[($4_1 + 28 | 0) >> 2] = -1;
    break block1;
   }
   block4 : {
    block2 : {
     if (!(HEAP32[($4_1 + 12 | 0) >> 2] | 0)) {
      break block2
     }
     block3 : {
      if ((HEAP32[(((HEAP32[($4_1 + 24 | 0) >> 2] | 0) + 540 | 0) + ((HEAP32[($4_1 + 20 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
       break block3
      }
      HEAP32[($4_1 + 28 | 0) >> 2] = -1;
      break block1;
     }
     HEAP32[($4_1 + 8 | 0) >> 2] = (HEAP32[(HEAP32[(((HEAP32[($4_1 + 24 | 0) >> 2] | 0) + 540 | 0) + ((HEAP32[($4_1 + 20 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0) >> 2] | 0) + Math_imul(HEAP32[($4_1 + 16 | 0) >> 2] | 0, 28) | 0;
     HEAP32[($4_1 + 4 | 0) >> 2] = ((HEAP32[(((HEAP32[($4_1 + 24 | 0) >> 2] | 0) + 540 | 0) + ((HEAP32[($4_1 + 20 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0) + 4 | 0) + ((HEAP32[($4_1 + 16 | 0) >> 2] | 0) << 2 | 0) | 0;
     break block4;
    }
    block5 : {
     if ((HEAP32[(((HEAP32[($4_1 + 24 | 0) >> 2] | 0) + 28 | 0) + ((HEAP32[($4_1 + 20 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
      break block5
     }
     HEAP32[($4_1 + 28 | 0) >> 2] = -1;
     break block1;
    }
    HEAP32[($4_1 + 8 | 0) >> 2] = (HEAP32[(HEAP32[(((HEAP32[($4_1 + 24 | 0) >> 2] | 0) + 28 | 0) + ((HEAP32[($4_1 + 20 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0) >> 2] | 0) + Math_imul(HEAP32[($4_1 + 16 | 0) >> 2] | 0, 28) | 0;
    HEAP32[($4_1 + 4 | 0) >> 2] = ((HEAP32[(((HEAP32[($4_1 + 24 | 0) >> 2] | 0) + 28 | 0) + ((HEAP32[($4_1 + 20 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0) + 4 | 0) + ((HEAP32[($4_1 + 16 | 0) >> 2] | 0) << 2 | 0) | 0;
   }
   block6 : {
    if ((HEAP32[(HEAP32[($4_1 + 8 | 0) >> 2] | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
     break block6
    }
    HEAP32[($4_1 + 28 | 0) >> 2] = -1;
    break block1;
   }
   (wasm2js_i32$0 = $4_1, wasm2js_i32$1 = $6(HEAP32[($4_1 + 24 | 0) >> 2] | 0 | 0, HEAP32[(HEAP32[($4_1 + 8 | 0) >> 2] | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 4 | 0) >> 2] | 0 | 0, HEAP32[($4_1 + 12 | 0) >> 2] | 0 | 0, HEAP32[((HEAP32[($4_1 + 8 | 0) >> 2] | 0) + 12 | 0) >> 2] | 0 | 0, HEAP32[((HEAP32[($4_1 + 8 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0 | 0, HEAP32[((HEAP32[($4_1 + 8 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0 | 0, HEAP32[((HEAP32[($4_1 + 8 | 0) >> 2] | 0) + 16 | 0) >> 2] | 0 | 0, HEAP32[((HEAP32[($4_1 + 8 | 0) >> 2] | 0) + 20 | 0) >> 2] | 0 | 0, HEAP32[((HEAP32[($4_1 + 8 | 0) >> 2] | 0) + 24 | 0) >> 2] | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 28 | 0) >> 2] = wasm2js_i32$1;
  }
  $5_1 = HEAP32[($4_1 + 28 | 0) >> 2] | 0;
  global$0 = $4_1 + 32 | 0;
  return $5_1 | 0;
 }
 
 function $104($0_1) {
  $0_1 = $0_1 | 0;
  var $6_1 = 0;
  HEAP32[((global$0 - 16 | 0) + 12 | 0) >> 2] = $0_1;
  return 0 | 0;
 }
 
 function $105($0_1) {
  $0_1 = $0_1 | 0;
  HEAP32[((global$0 - 16 | 0) + 12 | 0) >> 2] = $0_1;
  return;
 }
 
 function $106($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, $12_1 = 0;
  $3_1 = global$0 - 16 | 0;
  HEAP32[($3_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($3_1 + 8 | 0) >> 2] = $1_1;
  HEAP32[($3_1 + 4 | 0) >> 2] = $2_1;
  return 0 | 0;
 }
 
 function $107($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, $2_1 = 0, $14_1 = 0;
  $1_1 = global$0 - 16 | 0;
  global$0 = $1_1;
  HEAP32[($1_1 + 12 | 0) >> 2] = $0_1;
  $2_1 = $173(HEAP32[($1_1 + 12 | 0) >> 2] | 0 | 0, 47 | 0) | 0;
  global$0 = $1_1 + 16 | 0;
  return $2_1 | 0;
 }
 
 function $108($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, $6_1 = 0, $7_1 = 0, $8_1 = 0, $83_1 = 0;
  $3_1 = global$0 - 32 | 0;
  global$0 = $3_1;
  HEAP32[($3_1 + 24 | 0) >> 2] = $0_1;
  HEAP32[($3_1 + 20 | 0) >> 2] = $1_1;
  HEAP32[($3_1 + 16 | 0) >> 2] = $2_1;
  HEAP32[($3_1 + 12 | 0) >> 2] = 0;
  HEAP32[($3_1 + 8 | 0) >> 2] = HEAP32[($3_1 + 24 | 0) >> 2] | 0;
  HEAP32[($3_1 + 20 | 0) >> 2] = (HEAP32[($3_1 + 20 | 0) >> 2] | 0) + -1 | 0;
  block4 : {
   block : {
    label : while (1) {
     if (!((HEAP32[($3_1 + 12 | 0) >> 2] | 0 | 0) < (HEAP32[($3_1 + 20 | 0) >> 2] | 0 | 0) & 1 | 0)) {
      break block
     }
     $6_1 = 1;
     block1 : {
      if (!(($147(HEAP32[($3_1 + 8 | 0) >> 2] | 0 | 0, $6_1 | 0, $6_1 | 0, HEAP32[($3_1 + 16 | 0) >> 2] | 0 | 0) | 0 | 0) != (1 | 0) & 1 | 0)) {
       break block1
      }
      break block;
     }
     HEAP32[($3_1 + 12 | 0) >> 2] = (HEAP32[($3_1 + 12 | 0) >> 2] | 0) + 1 | 0;
     block3 : {
      block2 : {
       if ((HEAP8[(HEAP32[($3_1 + 8 | 0) >> 2] | 0) >> 0] | 0 | 0) == (10 | 0) & 1 | 0) {
        break block2
       }
       if (!((HEAP8[(HEAP32[($3_1 + 8 | 0) >> 2] | 0) >> 0] | 0 | 0) == (13 | 0) & 1 | 0)) {
        break block3
       }
      }
      HEAP8[(HEAP32[($3_1 + 8 | 0) >> 2] | 0) >> 0] = 0;
      HEAP32[($3_1 + 28 | 0) >> 2] = HEAP32[($3_1 + 24 | 0) >> 2] | 0;
      break block4;
     }
     HEAP32[($3_1 + 8 | 0) >> 2] = (HEAP32[($3_1 + 8 | 0) >> 2] | 0) + 1 | 0;
     continue label;
    };
   }
   HEAP8[(HEAP32[($3_1 + 8 | 0) >> 2] | 0) >> 0] = 0;
   block6 : {
    block5 : {
     if (!(HEAP32[($3_1 + 12 | 0) >> 2] | 0)) {
      break block5
     }
     $7_1 = HEAP32[($3_1 + 24 | 0) >> 2] | 0;
     break block6;
    }
    $7_1 = 0;
   }
   HEAP32[($3_1 + 28 | 0) >> 2] = $7_1;
  }
  $8_1 = HEAP32[($3_1 + 28 | 0) >> 2] | 0;
  global$0 = $3_1 + 32 | 0;
  return $8_1 | 0;
 }
 
 function $109($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0, $7_1 = 0, $72_1 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $2_1 = global$0 - 32 | 0;
  global$0 = $2_1;
  HEAP32[($2_1 + 24 | 0) >> 2] = $0_1;
  HEAP32[($2_1 + 20 | 0) >> 2] = $1_1;
  (wasm2js_i32$0 = $2_1, wasm2js_i32$1 = $182(20 | 0) | 0), HEAP32[(wasm2js_i32$0 + 12 | 0) >> 2] = wasm2js_i32$1;
  block1 : {
   block : {
    if (!((HEAP32[($2_1 + 12 | 0) >> 2] | 0 | 0) == (0 | 0) & 1 | 0)) {
     break block
    }
    HEAP32[($2_1 + 28 | 0) >> 2] = 0;
    break block1;
   }
   (wasm2js_i32$0 = $2_1, wasm2js_i32$1 = $182(12 | 0) | 0), HEAP32[(wasm2js_i32$0 + 16 | 0) >> 2] = wasm2js_i32$1;
   block2 : {
    if (!((HEAP32[($2_1 + 16 | 0) >> 2] | 0 | 0) == (0 | 0) & 1 | 0)) {
     break block2
    }
    $184(HEAP32[($2_1 + 12 | 0) >> 2] | 0 | 0);
    HEAP32[($2_1 + 28 | 0) >> 2] = 0;
    break block1;
   }
   HEAP32[(HEAP32[($2_1 + 16 | 0) >> 2] | 0) >> 2] = HEAP32[($2_1 + 24 | 0) >> 2] | 0;
   HEAP32[((HEAP32[($2_1 + 16 | 0) >> 2] | 0) + 4 | 0) >> 2] = HEAP32[($2_1 + 24 | 0) >> 2] | 0;
   HEAP32[((HEAP32[($2_1 + 16 | 0) >> 2] | 0) + 8 | 0) >> 2] = (HEAP32[($2_1 + 24 | 0) >> 2] | 0) + (HEAP32[($2_1 + 20 | 0) >> 2] | 0) | 0;
   HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 16 | 0) >> 2] = HEAP32[($2_1 + 16 | 0) >> 2] | 0;
   HEAP32[(HEAP32[($2_1 + 12 | 0) >> 2] | 0) >> 2] = 7;
   HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 4 | 0) >> 2] = 8;
   HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 8 | 0) >> 2] = 9;
   HEAP32[((HEAP32[($2_1 + 12 | 0) >> 2] | 0) + 12 | 0) >> 2] = 10;
   HEAP32[($2_1 + 28 | 0) >> 2] = HEAP32[($2_1 + 12 | 0) >> 2] | 0;
  }
  $7_1 = HEAP32[($2_1 + 28 | 0) >> 2] | 0;
  global$0 = $2_1 + 32 | 0;
  return $7_1 | 0;
 }
 
 function $110($0_1, $1_1, $2_1, $3_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  var $4_1 = 0, $7_1 = 0, $9_1 = 0, $5_1 = 0, $6_1 = 0, $87_1 = 0;
  $4_1 = global$0 - 32 | 0;
  HEAP32[($4_1 + 24 | 0) >> 2] = $0_1;
  HEAP32[($4_1 + 20 | 0) >> 2] = $1_1;
  HEAP32[($4_1 + 16 | 0) >> 2] = $2_1;
  HEAP32[($4_1 + 12 | 0) >> 2] = $3_1;
  HEAP32[($4_1 + 8 | 0) >> 2] = HEAP32[($4_1 + 24 | 0) >> 2] | 0;
  HEAP32[($4_1 + 4 | 0) >> 2] = HEAP32[($4_1 + 12 | 0) >> 2] | 0;
  block : {
   if (!(((HEAP32[((HEAP32[($4_1 + 8 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) + Math_imul(HEAP32[($4_1 + 4 | 0) >> 2] | 0, HEAP32[($4_1 + 16 | 0) >> 2] | 0) | 0) >>> 0 > (HEAP32[((HEAP32[($4_1 + 8 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0) >>> 0 & 1 | 0)) {
    break block
   }
   HEAP32[($4_1 + 4 | 0) >> 2] = (((HEAP32[((HEAP32[($4_1 + 8 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0) - (HEAP32[((HEAP32[($4_1 + 8 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) | 0) >>> 0) / ((HEAP32[($4_1 + 16 | 0) >> 2] | 0) >>> 0) | 0;
  }
  block2 : {
   block1 : {
    if (HEAP32[($4_1 + 4 | 0) >> 2] | 0) {
     break block1
    }
    HEAP32[($4_1 + 28 | 0) >> 2] = 0;
    break block2;
   }
   $5_1 = HEAP32[($4_1 + 20 | 0) >> 2] | 0;
   $6_1 = HEAP32[((HEAP32[($4_1 + 8 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
   $7_1 = Math_imul(HEAP32[($4_1 + 4 | 0) >> 2] | 0, HEAP32[($4_1 + 16 | 0) >> 2] | 0);
   block3 : {
    if (!$7_1) {
     break block3
    }
    wasm2js_memory_copy($5_1, $6_1, $7_1);
   }
   $9_1 = HEAP32[($4_1 + 8 | 0) >> 2] | 0;
   HEAP32[($9_1 + 4 | 0) >> 2] = Math_imul(HEAP32[($4_1 + 4 | 0) >> 2] | 0, HEAP32[($4_1 + 16 | 0) >> 2] | 0) + (HEAP32[($9_1 + 4 | 0) >> 2] | 0) | 0;
   HEAP32[($4_1 + 28 | 0) >> 2] = HEAP32[($4_1 + 4 | 0) >> 2] | 0;
  }
  return HEAP32[($4_1 + 28 | 0) >> 2] | 0 | 0;
 }
 
 function $111($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, $4_1 = 0, $83_1 = 0;
  $3_1 = global$0 - 32 | 0;
  HEAP32[($3_1 + 24 | 0) >> 2] = $0_1;
  HEAP32[($3_1 + 20 | 0) >> 2] = $1_1;
  HEAP32[($3_1 + 16 | 0) >> 2] = $2_1;
  HEAP32[($3_1 + 12 | 0) >> 2] = HEAP32[($3_1 + 24 | 0) >> 2] | 0;
  $4_1 = HEAP32[($3_1 + 16 | 0) >> 2] | 0;
  block5 : {
   block4 : {
    block3 : {
     switch ($4_1 | 0) {
     case 0:
      break block4;
     case 1:
      HEAP32[($3_1 + 20 | 0) >> 2] = ((HEAP32[((HEAP32[($3_1 + 12 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) - (HEAP32[(HEAP32[($3_1 + 12 | 0) >> 2] | 0) >> 2] | 0) | 0) + (HEAP32[($3_1 + 20 | 0) >> 2] | 0) | 0;
      break block4;
     case 2:
      HEAP32[($3_1 + 20 | 0) >> 2] = ((HEAP32[((HEAP32[($3_1 + 12 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0) - (HEAP32[(HEAP32[($3_1 + 12 | 0) >> 2] | 0) >> 2] | 0) | 0) + (HEAP32[($3_1 + 20 | 0) >> 2] | 0) | 0;
      break block4;
     default:
      break block3;
     };
    }
    HEAP32[($3_1 + 28 | 0) >> 2] = -1;
    break block5;
   }
   block6 : {
    if (!((HEAP32[($3_1 + 20 | 0) >> 2] | 0 | 0) < (0 | 0) & 1 | 0)) {
     break block6
    }
    HEAP32[($3_1 + 28 | 0) >> 2] = -1;
    break block5;
   }
   block7 : {
    if (!((HEAP32[($3_1 + 20 | 0) >> 2] | 0 | 0) > ((HEAP32[((HEAP32[($3_1 + 12 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0) - (HEAP32[(HEAP32[($3_1 + 12 | 0) >> 2] | 0) >> 2] | 0) | 0 | 0) & 1 | 0)) {
     break block7
    }
    HEAP32[($3_1 + 20 | 0) >> 2] = (HEAP32[((HEAP32[($3_1 + 12 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0) - (HEAP32[(HEAP32[($3_1 + 12 | 0) >> 2] | 0) >> 2] | 0) | 0;
   }
   HEAP32[((HEAP32[($3_1 + 12 | 0) >> 2] | 0) + 4 | 0) >> 2] = (HEAP32[(HEAP32[($3_1 + 12 | 0) >> 2] | 0) >> 2] | 0) + (HEAP32[($3_1 + 20 | 0) >> 2] | 0) | 0;
   HEAP32[($3_1 + 28 | 0) >> 2] = 0;
  }
  return HEAP32[($3_1 + 28 | 0) >> 2] | 0 | 0;
 }
 
 function $112($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, $16_1 = 0;
  $1_1 = global$0 - 16 | 0;
  HEAP32[($1_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($1_1 + 8 | 0) >> 2] = HEAP32[($1_1 + 12 | 0) >> 2] | 0;
  return (HEAP32[((HEAP32[($1_1 + 8 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) - (HEAP32[(HEAP32[($1_1 + 8 | 0) >> 2] | 0) >> 2] | 0) | 0 | 0;
 }
 
 function $113($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, $13_1 = 0;
  $1_1 = global$0 - 16 | 0;
  global$0 = $1_1;
  HEAP32[($1_1 + 12 | 0) >> 2] = $0_1;
  $184(HEAP32[($1_1 + 12 | 0) >> 2] | 0 | 0);
  global$0 = $1_1 + 16 | 0;
  return 0 | 0;
 }
 
 function $114($0_1, $1_1, $2_1, $3_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  var $4_1 = 0, $6_1 = 0, $35_1 = 0;
  $4_1 = global$0 - 16 | 0;
  global$0 = $4_1;
  HEAP32[($4_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($4_1 + 8 | 0) >> 2] = $1_1;
  HEAP32[($4_1 + 4 | 0) >> 2] = $2_1;
  HEAP32[$4_1 >> 2] = $3_1;
  $6_1 = FUNCTION_TABLE[HEAP32[(HEAP32[($4_1 + 12 | 0) >> 2] | 0) >> 2] | 0 | 0](HEAP32[((HEAP32[($4_1 + 12 | 0) >> 2] | 0) + 16 | 0) >> 2] | 0, HEAP32[($4_1 + 8 | 0) >> 2] | 0, HEAP32[($4_1 + 4 | 0) >> 2] | 0, HEAP32[$4_1 >> 2] | 0) | 0;
  global$0 = $4_1 + 16 | 0;
  return $6_1 | 0;
 }
 
 function $115($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, $5_1 = 0, $30_1 = 0;
  $3_1 = global$0 - 16 | 0;
  global$0 = $3_1;
  HEAP32[($3_1 + 12 | 0) >> 2] = $0_1;
  HEAP32[($3_1 + 8 | 0) >> 2] = $1_1;
  HEAP32[($3_1 + 4 | 0) >> 2] = $2_1;
  $5_1 = FUNCTION_TABLE[HEAP32[((HEAP32[($3_1 + 12 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0 | 0](HEAP32[((HEAP32[($3_1 + 12 | 0) >> 2] | 0) + 16 | 0) >> 2] | 0, HEAP32[($3_1 + 8 | 0) >> 2] | 0, HEAP32[($3_1 + 4 | 0) >> 2] | 0) | 0;
  global$0 = $3_1 + 16 | 0;
  return $5_1 | 0;
 }
 
 function $116($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, $3_1 = 0, $20_1 = 0;
  $1_1 = global$0 - 16 | 0;
  global$0 = $1_1;
  HEAP32[($1_1 + 12 | 0) >> 2] = $0_1;
  $3_1 = FUNCTION_TABLE[HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0 | 0](HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 16 | 0) >> 2] | 0) | 0;
  global$0 = $1_1 + 16 | 0;
  return $3_1 | 0;
 }
 
 function $117($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0, $4_1 = 0, $32_1 = 0;
  $2_1 = global$0 - 16 | 0;
  global$0 = $2_1;
  HEAP32[($2_1 + 8 | 0) >> 2] = $0_1;
  HEAP32[($2_1 + 4 | 0) >> 2] = $1_1;
  block1 : {
   block : {
    if (!((FUNCTION_TABLE[HEAP32[((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0 | 0](HEAP32[((HEAP32[($2_1 + 8 | 0) >> 2] | 0) + 16 | 0) >> 2] | 0, HEAP32[($2_1 + 4 | 0) >> 2] | 0, 1) | 0 | 0) < (0 | 0) & 1 | 0)) {
     break block
    }
    HEAP32[($2_1 + 12 | 0) >> 2] = -1;
    break block1;
   }
   HEAP32[($2_1 + 12 | 0) >> 2] = 0;
  }
  $4_1 = HEAP32[($2_1 + 12 | 0) >> 2] | 0;
  global$0 = $2_1 + 16 | 0;
  return $4_1 | 0;
 }
 
 function $118($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, $3_1 = 0, $25_1 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $1_1 = global$0 - 16 | 0;
  global$0 = $1_1;
  HEAP32[($1_1 + 12 | 0) >> 2] = $0_1;
  (wasm2js_i32$0 = $1_1, wasm2js_i32$1 = FUNCTION_TABLE[HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 12 | 0) >> 2] | 0 | 0](HEAP32[((HEAP32[($1_1 + 12 | 0) >> 2] | 0) + 16 | 0) >> 2] | 0) | 0), HEAP32[(wasm2js_i32$0 + 8 | 0) >> 2] = wasm2js_i32$1;
  $184(HEAP32[($1_1 + 12 | 0) >> 2] | 0 | 0);
  $3_1 = HEAP32[($1_1 + 8 | 0) >> 2] | 0;
  global$0 = $1_1 + 16 | 0;
  return $3_1 | 0;
 }
 
 function $119($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, $6_1 = 0, $11_1 = 0, $199_1 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $3_1 = global$0 - 32 | 0;
  global$0 = $3_1;
  HEAP32[($3_1 + 24 | 0) >> 2] = $0_1;
  HEAP32[($3_1 + 20 | 0) >> 2] = $1_1;
  HEAP32[($3_1 + 16 | 0) >> 2] = $2_1;
  HEAP32[($3_1 + 4 | 0) >> 2] = ((HEAP32[($3_1 + 24 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($3_1 + 20 | 0) >> 2] | 0, 236) | 0;
  block3 : {
   block : {
    if (HEAP32[((HEAP32[((HEAP32[($3_1 + 4 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) + 12 | 0) >> 2] | 0) {
     break block
    }
    HEAP32[($3_1 + 12 | 0) >> 2] = (HEAP32[((HEAP32[($3_1 + 4 | 0) >> 2] | 0) + 16 | 0) >> 2] | 0) >> 12 | 0;
    block2 : {
     block1 : {
      if (!((HEAP32[(HEAP32[($3_1 + 16 | 0) >> 2] | 0) >> 2] | 0 | 0) >= (((HEAP32[((HEAP32[((HEAP32[($3_1 + 4 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0) >> 12 | 0) - (HEAP32[($3_1 + 12 | 0) >> 2] | 0) | 0 | 0) & 1 | 0)) {
       break block1
      }
      HEAP8[(HEAP32[($3_1 + 4 | 0) >> 2] | 0) >> 0] = 0;
      HEAP32[(HEAP32[($3_1 + 16 | 0) >> 2] | 0) >> 2] = ((HEAP32[((HEAP32[((HEAP32[($3_1 + 4 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0) >> 12 | 0) - (HEAP32[($3_1 + 12 | 0) >> 2] | 0) | 0;
      break block2;
     }
     $6_1 = HEAP32[($3_1 + 4 | 0) >> 2] | 0;
     HEAP32[($6_1 + 16 | 0) >> 2] = ((HEAP32[(HEAP32[($3_1 + 16 | 0) >> 2] | 0) >> 2] | 0) << 12 | 0) + (HEAP32[($6_1 + 16 | 0) >> 2] | 0) | 0;
    }
    HEAP32[($3_1 + 28 | 0) >> 2] = (HEAP32[((HEAP32[((HEAP32[($3_1 + 4 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) + 80 | 0) >> 2] | 0) + ((HEAP32[($3_1 + 12 | 0) >> 2] | 0) << 1 | 0) | 0;
    break block3;
   }
   HEAP8[($3_1 + 11 | 0) >> 0] = HEAPU8[((HEAP32[((HEAP32[($3_1 + 4 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) + 102 | 0) >> 0] | 0;
   block4 : {
    if (!(HEAP32[((HEAP32[($3_1 + 4 | 0) >> 2] | 0) + 212 | 0) >> 2] | 0)) {
     break block4
    }
    block5 : {
     if (!((HEAPU8[($3_1 + 11 | 0) >> 0] | 0) & 4 | 0)) {
      break block5
     }
     block6 : {
      if ((HEAPU8[($3_1 + 11 | 0) >> 0] | 0) & 64 | 0) {
       break block6
      }
      if ((HEAPU8[(HEAP32[($3_1 + 4 | 0) >> 2] | 0) >> 0] | 0 | 0) == (1 | 0) & 1 | 0) {
       break block6
      }
      if (!((HEAPU8[(HEAP32[($3_1 + 4 | 0) >> 2] | 0) >> 0] | 0 | 0) == (2 | 0) & 1 | 0)) {
       break block5
      }
     }
     block7 : {
      if (!((HEAPU8[($3_1 + 11 | 0) >> 0] | 0) & 8 | 0)) {
       break block7
      }
      (wasm2js_i32$0 = $3_1, wasm2js_i32$1 = $120(HEAP32[($3_1 + 24 | 0) >> 2] | 0 | 0, HEAP32[($3_1 + 4 | 0) >> 2] | 0 | 0, HEAP32[(HEAP32[($3_1 + 16 | 0) >> 2] | 0) >> 2] | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 28 | 0) >> 2] = wasm2js_i32$1;
      break block3;
     }
     (wasm2js_i32$0 = $3_1, wasm2js_i32$1 = $121(HEAP32[($3_1 + 24 | 0) >> 2] | 0 | 0, HEAP32[($3_1 + 4 | 0) >> 2] | 0 | 0, HEAP32[(HEAP32[($3_1 + 16 | 0) >> 2] | 0) >> 2] | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 28 | 0) >> 2] = wasm2js_i32$1;
     break block3;
    }
    (wasm2js_i32$0 = $3_1, wasm2js_i32$1 = $122(HEAP32[($3_1 + 24 | 0) >> 2] | 0 | 0, HEAP32[($3_1 + 20 | 0) >> 2] | 0 | 0, HEAP32[($3_1 + 16 | 0) >> 2] | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 28 | 0) >> 2] = wasm2js_i32$1;
    break block3;
   }
   block8 : {
    if (!((HEAPU8[($3_1 + 11 | 0) >> 0] | 0) & 4 | 0)) {
     break block8
    }
    block9 : {
     if ((HEAPU8[($3_1 + 11 | 0) >> 0] | 0) & 64 | 0) {
      break block9
     }
     if ((HEAPU8[(HEAP32[($3_1 + 4 | 0) >> 2] | 0) >> 0] | 0 | 0) == (1 | 0) & 1 | 0) {
      break block9
     }
     if (!((HEAPU8[(HEAP32[($3_1 + 4 | 0) >> 2] | 0) >> 0] | 0 | 0) == (2 | 0) & 1 | 0)) {
      break block8
     }
    }
    block10 : {
     if (!((HEAPU8[($3_1 + 11 | 0) >> 0] | 0) & 8 | 0)) {
      break block10
     }
     (wasm2js_i32$0 = $3_1, wasm2js_i32$1 = $123(HEAP32[($3_1 + 24 | 0) >> 2] | 0 | 0, HEAP32[($3_1 + 4 | 0) >> 2] | 0 | 0, HEAP32[(HEAP32[($3_1 + 16 | 0) >> 2] | 0) >> 2] | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 28 | 0) >> 2] = wasm2js_i32$1;
     break block3;
    }
    (wasm2js_i32$0 = $3_1, wasm2js_i32$1 = $124(HEAP32[($3_1 + 24 | 0) >> 2] | 0 | 0, HEAP32[($3_1 + 4 | 0) >> 2] | 0 | 0, HEAP32[(HEAP32[($3_1 + 16 | 0) >> 2] | 0) >> 2] | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 28 | 0) >> 2] = wasm2js_i32$1;
    break block3;
   }
   (wasm2js_i32$0 = $3_1, wasm2js_i32$1 = $125(HEAP32[($3_1 + 24 | 0) >> 2] | 0 | 0, HEAP32[($3_1 + 20 | 0) >> 2] | 0 | 0, HEAP32[($3_1 + 16 | 0) >> 2] | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 28 | 0) >> 2] = wasm2js_i32$1;
  }
  $11_1 = HEAP32[($3_1 + 28 | 0) >> 2] | 0;
  global$0 = $3_1 + 32 | 0;
  return $11_1 | 0;
 }
 
 function $120($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, $5_1 = 0, $12_1 = 0, $13_1 = 0, $16_1 = 0, $18_1 = 0, $11_1 = 0, $17_1 = 0, $22_1 = 0, $395 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $3_1 = global$0 - 64 | 0;
  global$0 = $3_1;
  HEAP32[($3_1 + 60 | 0) >> 2] = $0_1;
  HEAP32[($3_1 + 56 | 0) >> 2] = $1_1;
  HEAP32[($3_1 + 52 | 0) >> 2] = $2_1;
  HEAP32[($3_1 + 44 | 0) >> 2] = HEAP32[((HEAP32[($3_1 + 56 | 0) >> 2] | 0) + 16 | 0) >> 2] | 0;
  HEAP32[($3_1 + 40 | 0) >> 2] = HEAP32[((HEAP32[($3_1 + 56 | 0) >> 2] | 0) + 20 | 0) >> 2] | 0;
  HEAP32[($3_1 + 36 | 0) >> 2] = HEAP32[((HEAP32[((HEAP32[($3_1 + 56 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
  HEAP32[($3_1 + 32 | 0) >> 2] = HEAP32[(HEAP32[((HEAP32[($3_1 + 56 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) >> 2] | 0;
  HEAP32[($3_1 + 28 | 0) >> 2] = HEAP32[((HEAP32[($3_1 + 60 | 0) >> 2] | 0) + 1068 | 0) >> 2] | 0;
  HEAP32[($3_1 + 24 | 0) >> 2] = HEAP32[((HEAP32[((HEAP32[($3_1 + 56 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) + 80 | 0) >> 2] | 0;
  HEAP32[($3_1 + 20 | 0) >> 2] = HEAP32[((HEAP32[($3_1 + 56 | 0) >> 2] | 0) + 216 | 0) >> 2] | 0;
  HEAP32[($3_1 + 16 | 0) >> 2] = (HEAP32[($3_1 + 36 | 0) >> 2] | 0) << 1 | 0;
  HEAP32[($3_1 + 12 | 0) >> 2] = (HEAP32[($3_1 + 32 | 0) >> 2] | 0) << 1 | 0;
  HEAP32[$3_1 >> 2] = 0;
  label1 : while (1) {
   $5_1 = 0;
   block : {
    if (!(HEAP32[($3_1 + 52 | 0) >> 2] | 0)) {
     break block
    }
    $5_1 = 0;
    if (!((HEAP32[($3_1 + 40 | 0) >> 2] | 0 | 0) > (0 | 0) & 1 | 0)) {
     break block
    }
    $5_1 = (HEAP32[($3_1 + 44 | 0) >> 2] | 0 | 0) < (HEAP32[($3_1 + 32 | 0) >> 2] | 0 | 0);
   }
   block1 : {
    if (!($5_1 & 1 | 0)) {
     break block1
    }
    HEAP32[($3_1 + 8 | 0) >> 2] = ((((HEAP32[($3_1 + 32 | 0) >> 2] | 0) - (HEAP32[($3_1 + 44 | 0) >> 2] | 0) | 0) + (HEAP32[($3_1 + 40 | 0) >> 2] | 0) | 0) - 1 | 0 | 0) / (HEAP32[($3_1 + 40 | 0) >> 2] | 0 | 0) | 0;
    block2 : {
     if (!((HEAP32[($3_1 + 8 | 0) >> 2] | 0 | 0) > (HEAP32[($3_1 + 52 | 0) >> 2] | 0 | 0) & 1 | 0)) {
      break block2
     }
     HEAP32[($3_1 + 8 | 0) >> 2] = HEAP32[($3_1 + 52 | 0) >> 2] | 0;
    }
    block4 : {
     block3 : {
      if (!((HEAP32[($3_1 + 8 | 0) >> 2] | 0 | 0) > (HEAP32[($3_1 + 20 | 0) >> 2] | 0 | 0) & 1 | 0)) {
       break block3
      }
      HEAP32[($3_1 + 8 | 0) >> 2] = HEAP32[($3_1 + 20 | 0) >> 2] | 0;
      HEAP32[$3_1 >> 2] = 1;
      break block4;
     }
     HEAP32[($3_1 + 20 | 0) >> 2] = (HEAP32[($3_1 + 20 | 0) >> 2] | 0) - (HEAP32[($3_1 + 8 | 0) >> 2] | 0) | 0;
    }
    HEAP32[($3_1 + 52 | 0) >> 2] = (HEAP32[($3_1 + 52 | 0) >> 2] | 0) - (HEAP32[($3_1 + 8 | 0) >> 2] | 0) | 0;
    HEAP32[($3_1 + 4 | 0) >> 2] = 0;
    block5 : {
     label : while (1) {
      if (!((HEAP32[($3_1 + 4 | 0) >> 2] | 0 | 0) < (HEAP32[($3_1 + 8 | 0) >> 2] | 0 | 0) & 1 | 0)) {
       break block5
      }
      HEAP16[($3_1 + 50 | 0) >> 1] = HEAPU16[((HEAP32[($3_1 + 24 | 0) >> 2] | 0) + (((HEAP32[($3_1 + 44 | 0) >> 2] | 0) >> 12 | 0) << 1 | 0) | 0) >> 1] | 0;
      HEAP16[($3_1 + 48 | 0) >> 1] = HEAPU16[((HEAP32[($3_1 + 24 | 0) >> 2] | 0) + ((((HEAP32[($3_1 + 44 | 0) >> 2] | 0) >> 12 | 0) + 1 | 0) << 1 | 0) | 0) >> 1] | 0;
      $11_1 = (HEAP16[($3_1 + 50 | 0) >> 1] | 0) + (Math_imul((HEAP16[($3_1 + 48 | 0) >> 1] | 0) - (HEAP16[($3_1 + 50 | 0) >> 1] | 0) | 0, (HEAP32[($3_1 + 44 | 0) >> 2] | 0) & 4095 | 0) >>> 12 | 0) | 0;
      $12_1 = HEAP32[($3_1 + 28 | 0) >> 2] | 0;
      HEAP32[($3_1 + 28 | 0) >> 2] = $12_1 + 2 | 0;
      HEAP16[$12_1 >> 1] = $11_1;
      HEAP32[($3_1 + 44 | 0) >> 2] = (HEAP32[($3_1 + 40 | 0) >> 2] | 0) + (HEAP32[($3_1 + 44 | 0) >> 2] | 0) | 0;
      HEAP32[($3_1 + 4 | 0) >> 2] = (HEAP32[($3_1 + 4 | 0) >> 2] | 0) + 1 | 0;
      continue label;
     };
    }
    block6 : {
     if (!(HEAP32[$3_1 >> 2] | 0)) {
      break block6
     }
     HEAP32[($3_1 + 20 | 0) >> 2] = HEAP32[((HEAP32[($3_1 + 56 | 0) >> 2] | 0) + 212 | 0) >> 2] | 0;
     (wasm2js_i32$0 = $3_1, wasm2js_i32$1 = $126(HEAP32[($3_1 + 60 | 0) >> 2] | 0 | 0, HEAP32[($3_1 + 56 | 0) >> 2] | 0 | 0, 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 40 | 0) >> 2] = wasm2js_i32$1;
     HEAP32[$3_1 >> 2] = 0;
    }
    continue label1;
   }
   break label1;
  };
  block7 : {
   label3 : while (1) {
    if (!(HEAP32[($3_1 + 52 | 0) >> 2] | 0)) {
     break block7
    }
    block9 : {
     block8 : {
      if (!((HEAP32[($3_1 + 40 | 0) >> 2] | 0 | 0) > (0 | 0) & 1 | 0)) {
       break block8
      }
      $13_1 = HEAP32[($3_1 + 36 | 0) >> 2] | 0;
      break block9;
     }
     $13_1 = HEAP32[($3_1 + 32 | 0) >> 2] | 0;
    }
    HEAP32[($3_1 + 8 | 0) >> 2] = ((($13_1 - (HEAP32[($3_1 + 44 | 0) >> 2] | 0) | 0) + (HEAP32[($3_1 + 40 | 0) >> 2] | 0) | 0) - 1 | 0 | 0) / (HEAP32[($3_1 + 40 | 0) >> 2] | 0 | 0) | 0;
    block10 : {
     if (!((HEAP32[($3_1 + 8 | 0) >> 2] | 0 | 0) > (HEAP32[($3_1 + 52 | 0) >> 2] | 0 | 0) & 1 | 0)) {
      break block10
     }
     HEAP32[($3_1 + 8 | 0) >> 2] = HEAP32[($3_1 + 52 | 0) >> 2] | 0;
    }
    block12 : {
     block11 : {
      if (!((HEAP32[($3_1 + 8 | 0) >> 2] | 0 | 0) > (HEAP32[($3_1 + 20 | 0) >> 2] | 0 | 0) & 1 | 0)) {
       break block11
      }
      HEAP32[($3_1 + 8 | 0) >> 2] = HEAP32[($3_1 + 20 | 0) >> 2] | 0;
      HEAP32[$3_1 >> 2] = 1;
      break block12;
     }
     HEAP32[($3_1 + 20 | 0) >> 2] = (HEAP32[($3_1 + 20 | 0) >> 2] | 0) - (HEAP32[($3_1 + 8 | 0) >> 2] | 0) | 0;
    }
    HEAP32[($3_1 + 52 | 0) >> 2] = (HEAP32[($3_1 + 52 | 0) >> 2] | 0) - (HEAP32[($3_1 + 8 | 0) >> 2] | 0) | 0;
    block13 : {
     label2 : while (1) {
      $16_1 = HEAP32[($3_1 + 8 | 0) >> 2] | 0;
      HEAP32[($3_1 + 8 | 0) >> 2] = $16_1 + -1 | 0;
      if (!$16_1) {
       break block13
      }
      HEAP16[($3_1 + 50 | 0) >> 1] = HEAPU16[((HEAP32[($3_1 + 24 | 0) >> 2] | 0) + (((HEAP32[($3_1 + 44 | 0) >> 2] | 0) >> 12 | 0) << 1 | 0) | 0) >> 1] | 0;
      HEAP16[($3_1 + 48 | 0) >> 1] = HEAPU16[((HEAP32[($3_1 + 24 | 0) >> 2] | 0) + ((((HEAP32[($3_1 + 44 | 0) >> 2] | 0) >> 12 | 0) + 1 | 0) << 1 | 0) | 0) >> 1] | 0;
      $17_1 = (HEAP16[($3_1 + 50 | 0) >> 1] | 0) + (Math_imul((HEAP16[($3_1 + 48 | 0) >> 1] | 0) - (HEAP16[($3_1 + 50 | 0) >> 1] | 0) | 0, (HEAP32[($3_1 + 44 | 0) >> 2] | 0) & 4095 | 0) >>> 12 | 0) | 0;
      $18_1 = HEAP32[($3_1 + 28 | 0) >> 2] | 0;
      HEAP32[($3_1 + 28 | 0) >> 2] = $18_1 + 2 | 0;
      HEAP16[$18_1 >> 1] = $17_1;
      HEAP32[($3_1 + 44 | 0) >> 2] = (HEAP32[($3_1 + 40 | 0) >> 2] | 0) + (HEAP32[($3_1 + 44 | 0) >> 2] | 0) | 0;
      continue label2;
     };
    }
    block14 : {
     if (!(HEAP32[$3_1 >> 2] | 0)) {
      break block14
     }
     HEAP32[($3_1 + 20 | 0) >> 2] = HEAP32[((HEAP32[($3_1 + 56 | 0) >> 2] | 0) + 212 | 0) >> 2] | 0;
     (wasm2js_i32$0 = $3_1, wasm2js_i32$1 = $126(HEAP32[($3_1 + 60 | 0) >> 2] | 0 | 0, HEAP32[($3_1 + 56 | 0) >> 2] | 0 | 0, (HEAP32[($3_1 + 40 | 0) >> 2] | 0 | 0) < (0 | 0) & 1 | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 40 | 0) >> 2] = wasm2js_i32$1;
     HEAP32[$3_1 >> 2] = 0;
    }
    block16 : {
     block15 : {
      if (!((HEAP32[($3_1 + 44 | 0) >> 2] | 0 | 0) >= (HEAP32[($3_1 + 36 | 0) >> 2] | 0 | 0) & 1 | 0)) {
       break block15
      }
      HEAP32[($3_1 + 44 | 0) >> 2] = (HEAP32[($3_1 + 16 | 0) >> 2] | 0) - (HEAP32[($3_1 + 44 | 0) >> 2] | 0) | 0;
      HEAP32[($3_1 + 40 | 0) >> 2] = Math_imul(HEAP32[($3_1 + 40 | 0) >> 2] | 0, -1);
      break block16;
     }
     block17 : {
      if (!((HEAP32[($3_1 + 44 | 0) >> 2] | 0 | 0) <= (HEAP32[($3_1 + 32 | 0) >> 2] | 0 | 0) & 1 | 0)) {
       break block17
      }
      HEAP32[($3_1 + 44 | 0) >> 2] = (HEAP32[($3_1 + 12 | 0) >> 2] | 0) - (HEAP32[($3_1 + 44 | 0) >> 2] | 0) | 0;
      HEAP32[($3_1 + 40 | 0) >> 2] = Math_imul(HEAP32[($3_1 + 40 | 0) >> 2] | 0, -1);
     }
    }
    continue label3;
   };
  }
  HEAP32[((HEAP32[($3_1 + 56 | 0) >> 2] | 0) + 216 | 0) >> 2] = HEAP32[($3_1 + 20 | 0) >> 2] | 0;
  HEAP32[((HEAP32[($3_1 + 56 | 0) >> 2] | 0) + 20 | 0) >> 2] = HEAP32[($3_1 + 40 | 0) >> 2] | 0;
  HEAP32[((HEAP32[($3_1 + 56 | 0) >> 2] | 0) + 16 | 0) >> 2] = HEAP32[($3_1 + 44 | 0) >> 2] | 0;
  $22_1 = HEAP32[((HEAP32[($3_1 + 60 | 0) >> 2] | 0) + 1068 | 0) >> 2] | 0;
  global$0 = $3_1 + 64 | 0;
  return $22_1 | 0;
 }
 
 function $121($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, $8_1 = 0, $7_1 = 0, $12_1 = 0, $214 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $3_1 = global$0 - 64 | 0;
  global$0 = $3_1;
  HEAP32[($3_1 + 60 | 0) >> 2] = $0_1;
  HEAP32[($3_1 + 56 | 0) >> 2] = $1_1;
  HEAP32[($3_1 + 52 | 0) >> 2] = $2_1;
  HEAP32[($3_1 + 44 | 0) >> 2] = HEAP32[((HEAP32[($3_1 + 56 | 0) >> 2] | 0) + 16 | 0) >> 2] | 0;
  HEAP32[($3_1 + 40 | 0) >> 2] = HEAP32[((HEAP32[($3_1 + 56 | 0) >> 2] | 0) + 20 | 0) >> 2] | 0;
  HEAP32[($3_1 + 36 | 0) >> 2] = HEAP32[((HEAP32[((HEAP32[($3_1 + 56 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
  HEAP32[($3_1 + 32 | 0) >> 2] = (HEAP32[($3_1 + 36 | 0) >> 2] | 0) - (HEAP32[(HEAP32[((HEAP32[($3_1 + 56 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) >> 2] | 0) | 0;
  HEAP32[($3_1 + 28 | 0) >> 2] = HEAP32[((HEAP32[($3_1 + 60 | 0) >> 2] | 0) + 1068 | 0) >> 2] | 0;
  HEAP32[($3_1 + 24 | 0) >> 2] = HEAP32[((HEAP32[((HEAP32[($3_1 + 56 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) + 80 | 0) >> 2] | 0;
  HEAP32[($3_1 + 20 | 0) >> 2] = HEAP32[((HEAP32[($3_1 + 56 | 0) >> 2] | 0) + 216 | 0) >> 2] | 0;
  HEAP32[($3_1 + 8 | 0) >> 2] = 0;
  block : {
   label2 : while (1) {
    if (!(HEAP32[($3_1 + 52 | 0) >> 2] | 0)) {
     break block
    }
    block1 : {
     label : while (1) {
      if (!((HEAP32[($3_1 + 44 | 0) >> 2] | 0 | 0) >= (HEAP32[($3_1 + 36 | 0) >> 2] | 0 | 0) & 1 | 0)) {
       break block1
      }
      HEAP32[($3_1 + 44 | 0) >> 2] = (HEAP32[($3_1 + 44 | 0) >> 2] | 0) - (HEAP32[($3_1 + 32 | 0) >> 2] | 0) | 0;
      continue label;
     };
    }
    HEAP32[($3_1 + 16 | 0) >> 2] = ((((HEAP32[($3_1 + 36 | 0) >> 2] | 0) - (HEAP32[($3_1 + 44 | 0) >> 2] | 0) | 0) + (HEAP32[($3_1 + 40 | 0) >> 2] | 0) | 0) - 1 | 0 | 0) / (HEAP32[($3_1 + 40 | 0) >> 2] | 0 | 0) | 0;
    block2 : {
     if (!((HEAP32[($3_1 + 16 | 0) >> 2] | 0 | 0) > (HEAP32[($3_1 + 52 | 0) >> 2] | 0 | 0) & 1 | 0)) {
      break block2
     }
     HEAP32[($3_1 + 16 | 0) >> 2] = HEAP32[($3_1 + 52 | 0) >> 2] | 0;
    }
    block4 : {
     block3 : {
      if (!((HEAP32[($3_1 + 16 | 0) >> 2] | 0 | 0) > (HEAP32[($3_1 + 20 | 0) >> 2] | 0 | 0) & 1 | 0)) {
       break block3
      }
      HEAP32[($3_1 + 16 | 0) >> 2] = HEAP32[($3_1 + 20 | 0) >> 2] | 0;
      HEAP32[($3_1 + 8 | 0) >> 2] = 1;
      break block4;
     }
     HEAP32[($3_1 + 20 | 0) >> 2] = (HEAP32[($3_1 + 20 | 0) >> 2] | 0) - (HEAP32[($3_1 + 16 | 0) >> 2] | 0) | 0;
    }
    HEAP32[($3_1 + 52 | 0) >> 2] = (HEAP32[($3_1 + 52 | 0) >> 2] | 0) - (HEAP32[($3_1 + 16 | 0) >> 2] | 0) | 0;
    HEAP32[($3_1 + 12 | 0) >> 2] = 0;
    block5 : {
     label1 : while (1) {
      if (!((HEAP32[($3_1 + 12 | 0) >> 2] | 0 | 0) < (HEAP32[($3_1 + 16 | 0) >> 2] | 0 | 0) & 1 | 0)) {
       break block5
      }
      HEAP16[($3_1 + 50 | 0) >> 1] = HEAPU16[((HEAP32[($3_1 + 24 | 0) >> 2] | 0) + (((HEAP32[($3_1 + 44 | 0) >> 2] | 0) >> 12 | 0) << 1 | 0) | 0) >> 1] | 0;
      HEAP16[($3_1 + 48 | 0) >> 1] = HEAPU16[((HEAP32[($3_1 + 24 | 0) >> 2] | 0) + ((((HEAP32[($3_1 + 44 | 0) >> 2] | 0) >> 12 | 0) + 1 | 0) << 1 | 0) | 0) >> 1] | 0;
      $7_1 = (HEAP16[($3_1 + 50 | 0) >> 1] | 0) + (Math_imul((HEAP16[($3_1 + 48 | 0) >> 1] | 0) - (HEAP16[($3_1 + 50 | 0) >> 1] | 0) | 0, (HEAP32[($3_1 + 44 | 0) >> 2] | 0) & 4095 | 0) >>> 12 | 0) | 0;
      $8_1 = HEAP32[($3_1 + 28 | 0) >> 2] | 0;
      HEAP32[($3_1 + 28 | 0) >> 2] = $8_1 + 2 | 0;
      HEAP16[$8_1 >> 1] = $7_1;
      HEAP32[($3_1 + 44 | 0) >> 2] = (HEAP32[($3_1 + 40 | 0) >> 2] | 0) + (HEAP32[($3_1 + 44 | 0) >> 2] | 0) | 0;
      HEAP32[($3_1 + 12 | 0) >> 2] = (HEAP32[($3_1 + 12 | 0) >> 2] | 0) + 1 | 0;
      continue label1;
     };
    }
    block6 : {
     if (!(HEAP32[($3_1 + 8 | 0) >> 2] | 0)) {
      break block6
     }
     HEAP32[($3_1 + 20 | 0) >> 2] = HEAP32[((HEAP32[($3_1 + 56 | 0) >> 2] | 0) + 212 | 0) >> 2] | 0;
     (wasm2js_i32$0 = $3_1, wasm2js_i32$1 = $126(HEAP32[($3_1 + 60 | 0) >> 2] | 0 | 0, HEAP32[($3_1 + 56 | 0) >> 2] | 0 | 0, 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 40 | 0) >> 2] = wasm2js_i32$1;
     HEAP32[($3_1 + 8 | 0) >> 2] = 0;
    }
    continue label2;
   };
  }
  HEAP32[((HEAP32[($3_1 + 56 | 0) >> 2] | 0) + 216 | 0) >> 2] = HEAP32[($3_1 + 20 | 0) >> 2] | 0;
  HEAP32[((HEAP32[($3_1 + 56 | 0) >> 2] | 0) + 20 | 0) >> 2] = HEAP32[($3_1 + 40 | 0) >> 2] | 0;
  HEAP32[((HEAP32[($3_1 + 56 | 0) >> 2] | 0) + 16 | 0) >> 2] = HEAP32[($3_1 + 44 | 0) >> 2] | 0;
  $12_1 = HEAP32[((HEAP32[($3_1 + 60 | 0) >> 2] | 0) + 1068 | 0) >> 2] | 0;
  global$0 = $3_1 + 64 | 0;
  return $12_1 | 0;
 }
 
 function $122($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, $5_1 = 0, $6_1 = 0, $8_1 = 0, $10_1 = 0, $12_1 = 0, $7_1 = 0, $9_1 = 0, $16_1 = 0, $206_1 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $3_1 = global$0 - 48 | 0;
  global$0 = $3_1;
  HEAP32[($3_1 + 44 | 0) >> 2] = $0_1;
  HEAP32[($3_1 + 40 | 0) >> 2] = $1_1;
  HEAP32[($3_1 + 36 | 0) >> 2] = $2_1;
  HEAP32[($3_1 + 28 | 0) >> 2] = ((HEAP32[($3_1 + 44 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($3_1 + 40 | 0) >> 2] | 0, 236) | 0;
  HEAP32[($3_1 + 24 | 0) >> 2] = HEAP32[((HEAP32[($3_1 + 44 | 0) >> 2] | 0) + 1068 | 0) >> 2] | 0;
  HEAP32[($3_1 + 20 | 0) >> 2] = HEAP32[((HEAP32[((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) + 80 | 0) >> 2] | 0;
  HEAP32[($3_1 + 16 | 0) >> 2] = HEAP32[((HEAP32[((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0;
  HEAP32[($3_1 + 12 | 0) >> 2] = HEAP32[((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 16 | 0) >> 2] | 0;
  HEAP32[($3_1 + 8 | 0) >> 2] = HEAP32[((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 20 | 0) >> 2] | 0;
  HEAP32[($3_1 + 4 | 0) >> 2] = HEAP32[(HEAP32[($3_1 + 36 | 0) >> 2] | 0) >> 2] | 0;
  HEAP32[$3_1 >> 2] = HEAP32[((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 216 | 0) >> 2] | 0;
  block : {
   if (!((HEAP32[($3_1 + 8 | 0) >> 2] | 0 | 0) < (0 | 0) & 1 | 0)) {
    break block
   }
   HEAP32[($3_1 + 8 | 0) >> 2] = 0 - (HEAP32[($3_1 + 8 | 0) >> 2] | 0) | 0;
  }
  block1 : {
   label : while (1) {
    $5_1 = HEAP32[($3_1 + 4 | 0) >> 2] | 0;
    HEAP32[($3_1 + 4 | 0) >> 2] = $5_1 + -1 | 0;
    if (!$5_1) {
     break block1
    }
    $6_1 = HEAP32[$3_1 >> 2] | 0;
    HEAP32[$3_1 >> 2] = $6_1 + -1 | 0;
    block2 : {
     if ($6_1) {
      break block2
     }
     HEAP32[$3_1 >> 2] = HEAP32[((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 212 | 0) >> 2] | 0;
     (wasm2js_i32$0 = $3_1, wasm2js_i32$1 = $126(HEAP32[($3_1 + 44 | 0) >> 2] | 0 | 0, HEAP32[($3_1 + 28 | 0) >> 2] | 0 | 0, 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 8 | 0) >> 2] = wasm2js_i32$1;
    }
    HEAP16[($3_1 + 34 | 0) >> 1] = HEAPU16[((HEAP32[($3_1 + 20 | 0) >> 2] | 0) + (((HEAP32[($3_1 + 12 | 0) >> 2] | 0) >> 12 | 0) << 1 | 0) | 0) >> 1] | 0;
    HEAP16[($3_1 + 32 | 0) >> 1] = HEAPU16[((HEAP32[($3_1 + 20 | 0) >> 2] | 0) + ((((HEAP32[($3_1 + 12 | 0) >> 2] | 0) >> 12 | 0) + 1 | 0) << 1 | 0) | 0) >> 1] | 0;
    $7_1 = (HEAP16[($3_1 + 34 | 0) >> 1] | 0) + (Math_imul((HEAP16[($3_1 + 32 | 0) >> 1] | 0) - (HEAP16[($3_1 + 34 | 0) >> 1] | 0) | 0, (HEAP32[($3_1 + 12 | 0) >> 2] | 0) & 4095 | 0) >>> 12 | 0) | 0;
    $8_1 = HEAP32[($3_1 + 24 | 0) >> 2] | 0;
    HEAP32[($3_1 + 24 | 0) >> 2] = $8_1 + 2 | 0;
    HEAP16[$8_1 >> 1] = $7_1;
    HEAP32[($3_1 + 12 | 0) >> 2] = (HEAP32[($3_1 + 8 | 0) >> 2] | 0) + (HEAP32[($3_1 + 12 | 0) >> 2] | 0) | 0;
    block3 : {
     if (!((HEAP32[($3_1 + 12 | 0) >> 2] | 0 | 0) >= (HEAP32[($3_1 + 16 | 0) >> 2] | 0 | 0) & 1 | 0)) {
      break block3
     }
     block4 : {
      if (!((HEAP32[($3_1 + 12 | 0) >> 2] | 0 | 0) == (HEAP32[($3_1 + 16 | 0) >> 2] | 0 | 0) & 1 | 0)) {
       break block4
      }
      $9_1 = (HEAP16[((HEAP32[($3_1 + 20 | 0) >> 2] | 0) + ((((HEAP32[($3_1 + 12 | 0) >> 2] | 0) >> 12 | 0) - 1 | 0) << 1 | 0) | 0) >> 1] | 0 | 0) / (2 | 0) | 0;
      $10_1 = HEAP32[($3_1 + 24 | 0) >> 2] | 0;
      HEAP32[($3_1 + 24 | 0) >> 2] = $10_1 + 2 | 0;
      HEAP16[$10_1 >> 1] = $9_1;
     }
     HEAP8[(HEAP32[($3_1 + 28 | 0) >> 2] | 0) >> 0] = 0;
     $12_1 = HEAP32[($3_1 + 36 | 0) >> 2] | 0;
     HEAP32[$12_1 >> 2] = (HEAP32[$12_1 >> 2] | 0) - ((HEAP32[($3_1 + 4 | 0) >> 2] | 0) + 1 | 0) | 0;
     break block1;
    }
    continue label;
   };
  }
  HEAP32[((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 216 | 0) >> 2] = HEAP32[$3_1 >> 2] | 0;
  HEAP32[((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 20 | 0) >> 2] = HEAP32[($3_1 + 8 | 0) >> 2] | 0;
  HEAP32[((HEAP32[($3_1 + 28 | 0) >> 2] | 0) + 16 | 0) >> 2] = HEAP32[($3_1 + 12 | 0) >> 2] | 0;
  $16_1 = HEAP32[((HEAP32[($3_1 + 44 | 0) >> 2] | 0) + 1068 | 0) >> 2] | 0;
  global$0 = $3_1 + 48 | 0;
  return $16_1 | 0;
 }
 
 function $123($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, $6_1 = 0, $7_1 = 0, $10_1 = 0, $5_1 = 0, $9_1 = 0, $302 = 0;
  $3_1 = global$0 - 64 | 0;
  HEAP32[($3_1 + 60 | 0) >> 2] = $0_1;
  HEAP32[($3_1 + 56 | 0) >> 2] = $1_1;
  HEAP32[($3_1 + 52 | 0) >> 2] = $2_1;
  HEAP32[($3_1 + 44 | 0) >> 2] = HEAP32[((HEAP32[($3_1 + 56 | 0) >> 2] | 0) + 16 | 0) >> 2] | 0;
  HEAP32[($3_1 + 40 | 0) >> 2] = HEAP32[((HEAP32[($3_1 + 56 | 0) >> 2] | 0) + 20 | 0) >> 2] | 0;
  HEAP32[($3_1 + 36 | 0) >> 2] = HEAP32[((HEAP32[((HEAP32[($3_1 + 56 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
  HEAP32[($3_1 + 32 | 0) >> 2] = HEAP32[(HEAP32[((HEAP32[($3_1 + 56 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) >> 2] | 0;
  HEAP32[($3_1 + 28 | 0) >> 2] = HEAP32[((HEAP32[($3_1 + 60 | 0) >> 2] | 0) + 1068 | 0) >> 2] | 0;
  HEAP32[($3_1 + 24 | 0) >> 2] = HEAP32[((HEAP32[((HEAP32[($3_1 + 56 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) + 80 | 0) >> 2] | 0;
  HEAP32[($3_1 + 20 | 0) >> 2] = (HEAP32[($3_1 + 36 | 0) >> 2] | 0) << 1 | 0;
  HEAP32[($3_1 + 16 | 0) >> 2] = (HEAP32[($3_1 + 32 | 0) >> 2] | 0) << 1 | 0;
  block : {
   if (!((HEAP32[($3_1 + 40 | 0) >> 2] | 0 | 0) > (0 | 0) & 1 | 0)) {
    break block
   }
   if (!((HEAP32[($3_1 + 44 | 0) >> 2] | 0 | 0) < (HEAP32[($3_1 + 32 | 0) >> 2] | 0 | 0) & 1 | 0)) {
    break block
   }
   HEAP32[($3_1 + 12 | 0) >> 2] = ((((HEAP32[($3_1 + 32 | 0) >> 2] | 0) - (HEAP32[($3_1 + 44 | 0) >> 2] | 0) | 0) + (HEAP32[($3_1 + 40 | 0) >> 2] | 0) | 0) - 1 | 0 | 0) / (HEAP32[($3_1 + 40 | 0) >> 2] | 0 | 0) | 0;
   block2 : {
    block1 : {
     if (!((HEAP32[($3_1 + 12 | 0) >> 2] | 0 | 0) > (HEAP32[($3_1 + 52 | 0) >> 2] | 0 | 0) & 1 | 0)) {
      break block1
     }
     HEAP32[($3_1 + 12 | 0) >> 2] = HEAP32[($3_1 + 52 | 0) >> 2] | 0;
     HEAP32[($3_1 + 52 | 0) >> 2] = 0;
     break block2;
    }
    HEAP32[($3_1 + 52 | 0) >> 2] = (HEAP32[($3_1 + 52 | 0) >> 2] | 0) - (HEAP32[($3_1 + 12 | 0) >> 2] | 0) | 0;
   }
   HEAP32[($3_1 + 8 | 0) >> 2] = 0;
   block3 : {
    label : while (1) {
     if (!((HEAP32[($3_1 + 8 | 0) >> 2] | 0 | 0) < (HEAP32[($3_1 + 12 | 0) >> 2] | 0 | 0) & 1 | 0)) {
      break block3
     }
     HEAP16[($3_1 + 50 | 0) >> 1] = HEAPU16[((HEAP32[($3_1 + 24 | 0) >> 2] | 0) + (((HEAP32[($3_1 + 44 | 0) >> 2] | 0) >> 12 | 0) << 1 | 0) | 0) >> 1] | 0;
     HEAP16[($3_1 + 48 | 0) >> 1] = HEAPU16[((HEAP32[($3_1 + 24 | 0) >> 2] | 0) + ((((HEAP32[($3_1 + 44 | 0) >> 2] | 0) >> 12 | 0) + 1 | 0) << 1 | 0) | 0) >> 1] | 0;
     $5_1 = (HEAP16[($3_1 + 50 | 0) >> 1] | 0) + (Math_imul((HEAP16[($3_1 + 48 | 0) >> 1] | 0) - (HEAP16[($3_1 + 50 | 0) >> 1] | 0) | 0, (HEAP32[($3_1 + 44 | 0) >> 2] | 0) & 4095 | 0) >>> 12 | 0) | 0;
     $6_1 = HEAP32[($3_1 + 28 | 0) >> 2] | 0;
     HEAP32[($3_1 + 28 | 0) >> 2] = $6_1 + 2 | 0;
     HEAP16[$6_1 >> 1] = $5_1;
     HEAP32[($3_1 + 44 | 0) >> 2] = (HEAP32[($3_1 + 40 | 0) >> 2] | 0) + (HEAP32[($3_1 + 44 | 0) >> 2] | 0) | 0;
     HEAP32[($3_1 + 8 | 0) >> 2] = (HEAP32[($3_1 + 8 | 0) >> 2] | 0) + 1 | 0;
     continue label;
    };
   }
  }
  block4 : {
   label2 : while (1) {
    if (!(HEAP32[($3_1 + 52 | 0) >> 2] | 0)) {
     break block4
    }
    block6 : {
     block5 : {
      if (!((HEAP32[($3_1 + 40 | 0) >> 2] | 0 | 0) > (0 | 0) & 1 | 0)) {
       break block5
      }
      $7_1 = HEAP32[($3_1 + 36 | 0) >> 2] | 0;
      break block6;
     }
     $7_1 = HEAP32[($3_1 + 32 | 0) >> 2] | 0;
    }
    HEAP32[($3_1 + 12 | 0) >> 2] = ((($7_1 - (HEAP32[($3_1 + 44 | 0) >> 2] | 0) | 0) + (HEAP32[($3_1 + 40 | 0) >> 2] | 0) | 0) - 1 | 0 | 0) / (HEAP32[($3_1 + 40 | 0) >> 2] | 0 | 0) | 0;
    block8 : {
     block7 : {
      if (!((HEAP32[($3_1 + 12 | 0) >> 2] | 0 | 0) > (HEAP32[($3_1 + 52 | 0) >> 2] | 0 | 0) & 1 | 0)) {
       break block7
      }
      HEAP32[($3_1 + 12 | 0) >> 2] = HEAP32[($3_1 + 52 | 0) >> 2] | 0;
      HEAP32[($3_1 + 52 | 0) >> 2] = 0;
      break block8;
     }
     HEAP32[($3_1 + 52 | 0) >> 2] = (HEAP32[($3_1 + 52 | 0) >> 2] | 0) - (HEAP32[($3_1 + 12 | 0) >> 2] | 0) | 0;
    }
    HEAP32[($3_1 + 8 | 0) >> 2] = 0;
    block9 : {
     label1 : while (1) {
      if (!((HEAP32[($3_1 + 8 | 0) >> 2] | 0 | 0) < (HEAP32[($3_1 + 12 | 0) >> 2] | 0 | 0) & 1 | 0)) {
       break block9
      }
      HEAP16[($3_1 + 50 | 0) >> 1] = HEAPU16[((HEAP32[($3_1 + 24 | 0) >> 2] | 0) + (((HEAP32[($3_1 + 44 | 0) >> 2] | 0) >> 12 | 0) << 1 | 0) | 0) >> 1] | 0;
      HEAP16[($3_1 + 48 | 0) >> 1] = HEAPU16[((HEAP32[($3_1 + 24 | 0) >> 2] | 0) + ((((HEAP32[($3_1 + 44 | 0) >> 2] | 0) >> 12 | 0) + 1 | 0) << 1 | 0) | 0) >> 1] | 0;
      $9_1 = (HEAP16[($3_1 + 50 | 0) >> 1] | 0) + (Math_imul((HEAP16[($3_1 + 48 | 0) >> 1] | 0) - (HEAP16[($3_1 + 50 | 0) >> 1] | 0) | 0, (HEAP32[($3_1 + 44 | 0) >> 2] | 0) & 4095 | 0) >>> 12 | 0) | 0;
      $10_1 = HEAP32[($3_1 + 28 | 0) >> 2] | 0;
      HEAP32[($3_1 + 28 | 0) >> 2] = $10_1 + 2 | 0;
      HEAP16[$10_1 >> 1] = $9_1;
      HEAP32[($3_1 + 44 | 0) >> 2] = (HEAP32[($3_1 + 40 | 0) >> 2] | 0) + (HEAP32[($3_1 + 44 | 0) >> 2] | 0) | 0;
      HEAP32[($3_1 + 8 | 0) >> 2] = (HEAP32[($3_1 + 8 | 0) >> 2] | 0) + 1 | 0;
      continue label1;
     };
    }
    block11 : {
     block10 : {
      if (!((HEAP32[($3_1 + 44 | 0) >> 2] | 0 | 0) >= (HEAP32[($3_1 + 36 | 0) >> 2] | 0 | 0) & 1 | 0)) {
       break block10
      }
      HEAP32[($3_1 + 44 | 0) >> 2] = (HEAP32[($3_1 + 20 | 0) >> 2] | 0) - (HEAP32[($3_1 + 44 | 0) >> 2] | 0) | 0;
      HEAP32[($3_1 + 40 | 0) >> 2] = Math_imul(HEAP32[($3_1 + 40 | 0) >> 2] | 0, -1);
      break block11;
     }
     block12 : {
      if (!((HEAP32[($3_1 + 44 | 0) >> 2] | 0 | 0) <= (HEAP32[($3_1 + 32 | 0) >> 2] | 0 | 0) & 1 | 0)) {
       break block12
      }
      HEAP32[($3_1 + 44 | 0) >> 2] = (HEAP32[($3_1 + 16 | 0) >> 2] | 0) - (HEAP32[($3_1 + 44 | 0) >> 2] | 0) | 0;
      HEAP32[($3_1 + 40 | 0) >> 2] = Math_imul(HEAP32[($3_1 + 40 | 0) >> 2] | 0, -1);
     }
    }
    continue label2;
   };
  }
  HEAP32[((HEAP32[($3_1 + 56 | 0) >> 2] | 0) + 20 | 0) >> 2] = HEAP32[($3_1 + 40 | 0) >> 2] | 0;
  HEAP32[((HEAP32[($3_1 + 56 | 0) >> 2] | 0) + 16 | 0) >> 2] = HEAP32[($3_1 + 44 | 0) >> 2] | 0;
  return HEAP32[((HEAP32[($3_1 + 60 | 0) >> 2] | 0) + 1068 | 0) >> 2] | 0 | 0;
 }
 
 function $124($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, $7_1 = 0, $6_1 = 0, $160_1 = 0;
  $3_1 = global$0 - 48 | 0;
  HEAP32[($3_1 + 44 | 0) >> 2] = $0_1;
  HEAP32[($3_1 + 40 | 0) >> 2] = $1_1;
  HEAP32[($3_1 + 36 | 0) >> 2] = $2_1;
  HEAP32[($3_1 + 28 | 0) >> 2] = HEAP32[((HEAP32[($3_1 + 40 | 0) >> 2] | 0) + 16 | 0) >> 2] | 0;
  HEAP32[($3_1 + 24 | 0) >> 2] = HEAP32[((HEAP32[($3_1 + 40 | 0) >> 2] | 0) + 20 | 0) >> 2] | 0;
  HEAP32[($3_1 + 20 | 0) >> 2] = HEAP32[((HEAP32[((HEAP32[($3_1 + 40 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0;
  HEAP32[($3_1 + 16 | 0) >> 2] = (HEAP32[($3_1 + 20 | 0) >> 2] | 0) - (HEAP32[(HEAP32[((HEAP32[($3_1 + 40 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) >> 2] | 0) | 0;
  HEAP32[($3_1 + 12 | 0) >> 2] = HEAP32[((HEAP32[($3_1 + 44 | 0) >> 2] | 0) + 1068 | 0) >> 2] | 0;
  HEAP32[($3_1 + 8 | 0) >> 2] = HEAP32[((HEAP32[((HEAP32[($3_1 + 40 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) + 80 | 0) >> 2] | 0;
  block : {
   label2 : while (1) {
    if (!(HEAP32[($3_1 + 36 | 0) >> 2] | 0)) {
     break block
    }
    block1 : {
     label : while (1) {
      if (!((HEAP32[($3_1 + 28 | 0) >> 2] | 0 | 0) >= (HEAP32[($3_1 + 20 | 0) >> 2] | 0 | 0) & 1 | 0)) {
       break block1
      }
      HEAP32[($3_1 + 28 | 0) >> 2] = (HEAP32[($3_1 + 28 | 0) >> 2] | 0) - (HEAP32[($3_1 + 16 | 0) >> 2] | 0) | 0;
      continue label;
     };
    }
    HEAP32[($3_1 + 4 | 0) >> 2] = ((((HEAP32[($3_1 + 20 | 0) >> 2] | 0) - (HEAP32[($3_1 + 28 | 0) >> 2] | 0) | 0) + (HEAP32[($3_1 + 24 | 0) >> 2] | 0) | 0) - 1 | 0 | 0) / (HEAP32[($3_1 + 24 | 0) >> 2] | 0 | 0) | 0;
    block3 : {
     block2 : {
      if (!((HEAP32[($3_1 + 4 | 0) >> 2] | 0 | 0) > (HEAP32[($3_1 + 36 | 0) >> 2] | 0 | 0) & 1 | 0)) {
       break block2
      }
      HEAP32[($3_1 + 4 | 0) >> 2] = HEAP32[($3_1 + 36 | 0) >> 2] | 0;
      HEAP32[($3_1 + 36 | 0) >> 2] = 0;
      break block3;
     }
     HEAP32[($3_1 + 36 | 0) >> 2] = (HEAP32[($3_1 + 36 | 0) >> 2] | 0) - (HEAP32[($3_1 + 4 | 0) >> 2] | 0) | 0;
    }
    HEAP32[$3_1 >> 2] = 0;
    block4 : {
     label1 : while (1) {
      if (!((HEAP32[$3_1 >> 2] | 0 | 0) < (HEAP32[($3_1 + 4 | 0) >> 2] | 0 | 0) & 1 | 0)) {
       break block4
      }
      HEAP16[($3_1 + 34 | 0) >> 1] = HEAPU16[((HEAP32[($3_1 + 8 | 0) >> 2] | 0) + (((HEAP32[($3_1 + 28 | 0) >> 2] | 0) >> 12 | 0) << 1 | 0) | 0) >> 1] | 0;
      HEAP16[($3_1 + 32 | 0) >> 1] = HEAPU16[((HEAP32[($3_1 + 8 | 0) >> 2] | 0) + ((((HEAP32[($3_1 + 28 | 0) >> 2] | 0) >> 12 | 0) + 1 | 0) << 1 | 0) | 0) >> 1] | 0;
      $6_1 = (HEAP16[($3_1 + 34 | 0) >> 1] | 0) + (Math_imul((HEAP16[($3_1 + 32 | 0) >> 1] | 0) - (HEAP16[($3_1 + 34 | 0) >> 1] | 0) | 0, (HEAP32[($3_1 + 28 | 0) >> 2] | 0) & 4095 | 0) >>> 12 | 0) | 0;
      $7_1 = HEAP32[($3_1 + 12 | 0) >> 2] | 0;
      HEAP32[($3_1 + 12 | 0) >> 2] = $7_1 + 2 | 0;
      HEAP16[$7_1 >> 1] = $6_1;
      HEAP32[($3_1 + 28 | 0) >> 2] = (HEAP32[($3_1 + 24 | 0) >> 2] | 0) + (HEAP32[($3_1 + 28 | 0) >> 2] | 0) | 0;
      HEAP32[$3_1 >> 2] = (HEAP32[$3_1 >> 2] | 0) + 1 | 0;
      continue label1;
     };
    }
    continue label2;
   };
  }
  HEAP32[((HEAP32[($3_1 + 40 | 0) >> 2] | 0) + 16 | 0) >> 2] = HEAP32[($3_1 + 28 | 0) >> 2] | 0;
  return HEAP32[((HEAP32[($3_1 + 44 | 0) >> 2] | 0) + 1068 | 0) >> 2] | 0 | 0;
 }
 
 function $125($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, $7_1 = 0, $9_1 = 0, $11_1 = 0, $6_1 = 0, $8_1 = 0, $204_1 = 0;
  $3_1 = global$0 - 64 | 0;
  HEAP32[($3_1 + 60 | 0) >> 2] = $0_1;
  HEAP32[($3_1 + 56 | 0) >> 2] = $1_1;
  HEAP32[($3_1 + 52 | 0) >> 2] = $2_1;
  HEAP32[($3_1 + 44 | 0) >> 2] = ((HEAP32[($3_1 + 60 | 0) >> 2] | 0) + 1724 | 0) + Math_imul(HEAP32[($3_1 + 56 | 0) >> 2] | 0, 236) | 0;
  HEAP32[($3_1 + 40 | 0) >> 2] = HEAP32[((HEAP32[($3_1 + 60 | 0) >> 2] | 0) + 1068 | 0) >> 2] | 0;
  HEAP32[($3_1 + 36 | 0) >> 2] = HEAP32[((HEAP32[((HEAP32[($3_1 + 44 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) + 80 | 0) >> 2] | 0;
  HEAP32[($3_1 + 32 | 0) >> 2] = HEAP32[((HEAP32[($3_1 + 44 | 0) >> 2] | 0) + 16 | 0) >> 2] | 0;
  HEAP32[($3_1 + 28 | 0) >> 2] = HEAP32[((HEAP32[($3_1 + 44 | 0) >> 2] | 0) + 20 | 0) >> 2] | 0;
  HEAP32[($3_1 + 24 | 0) >> 2] = HEAP32[((HEAP32[((HEAP32[($3_1 + 44 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0;
  HEAP32[($3_1 + 20 | 0) >> 2] = HEAP32[(HEAP32[($3_1 + 52 | 0) >> 2] | 0) >> 2] | 0;
  block : {
   if (!((HEAP32[($3_1 + 28 | 0) >> 2] | 0 | 0) < (0 | 0) & 1 | 0)) {
    break block
   }
   HEAP32[($3_1 + 28 | 0) >> 2] = 0 - (HEAP32[($3_1 + 28 | 0) >> 2] | 0) | 0;
  }
  HEAP32[($3_1 + 16 | 0) >> 2] = ((((HEAP32[($3_1 + 24 | 0) >> 2] | 0) - (HEAP32[($3_1 + 32 | 0) >> 2] | 0) | 0) + (HEAP32[($3_1 + 28 | 0) >> 2] | 0) | 0) - 1 | 0 | 0) / (HEAP32[($3_1 + 28 | 0) >> 2] | 0 | 0) | 0;
  block2 : {
   block1 : {
    if (!((HEAP32[($3_1 + 16 | 0) >> 2] | 0 | 0) > (HEAP32[($3_1 + 20 | 0) >> 2] | 0 | 0) & 1 | 0)) {
     break block1
    }
    HEAP32[($3_1 + 16 | 0) >> 2] = HEAP32[($3_1 + 20 | 0) >> 2] | 0;
    HEAP32[($3_1 + 20 | 0) >> 2] = 0;
    break block2;
   }
   HEAP32[($3_1 + 20 | 0) >> 2] = (HEAP32[($3_1 + 20 | 0) >> 2] | 0) - (HEAP32[($3_1 + 16 | 0) >> 2] | 0) | 0;
  }
  HEAP32[($3_1 + 12 | 0) >> 2] = 0;
  block3 : {
   label : while (1) {
    if (!((HEAP32[($3_1 + 12 | 0) >> 2] | 0 | 0) < (HEAP32[($3_1 + 16 | 0) >> 2] | 0 | 0) & 1 | 0)) {
     break block3
    }
    HEAP16[($3_1 + 50 | 0) >> 1] = HEAPU16[((HEAP32[($3_1 + 36 | 0) >> 2] | 0) + (((HEAP32[($3_1 + 32 | 0) >> 2] | 0) >> 12 | 0) << 1 | 0) | 0) >> 1] | 0;
    HEAP16[($3_1 + 48 | 0) >> 1] = HEAPU16[((HEAP32[($3_1 + 36 | 0) >> 2] | 0) + ((((HEAP32[($3_1 + 32 | 0) >> 2] | 0) >> 12 | 0) + 1 | 0) << 1 | 0) | 0) >> 1] | 0;
    $6_1 = (HEAP16[($3_1 + 50 | 0) >> 1] | 0) + (Math_imul((HEAP16[($3_1 + 48 | 0) >> 1] | 0) - (HEAP16[($3_1 + 50 | 0) >> 1] | 0) | 0, (HEAP32[($3_1 + 32 | 0) >> 2] | 0) & 4095 | 0) >>> 12 | 0) | 0;
    $7_1 = HEAP32[($3_1 + 40 | 0) >> 2] | 0;
    HEAP32[($3_1 + 40 | 0) >> 2] = $7_1 + 2 | 0;
    HEAP16[$7_1 >> 1] = $6_1;
    HEAP32[($3_1 + 32 | 0) >> 2] = (HEAP32[($3_1 + 28 | 0) >> 2] | 0) + (HEAP32[($3_1 + 32 | 0) >> 2] | 0) | 0;
    HEAP32[($3_1 + 12 | 0) >> 2] = (HEAP32[($3_1 + 12 | 0) >> 2] | 0) + 1 | 0;
    continue label;
   };
  }
  block4 : {
   if (!((HEAP32[($3_1 + 32 | 0) >> 2] | 0 | 0) >= (HEAP32[($3_1 + 24 | 0) >> 2] | 0 | 0) & 1 | 0)) {
    break block4
   }
   block5 : {
    if (!((HEAP32[($3_1 + 32 | 0) >> 2] | 0 | 0) == (HEAP32[($3_1 + 24 | 0) >> 2] | 0 | 0) & 1 | 0)) {
     break block5
    }
    $8_1 = (HEAP16[((HEAP32[($3_1 + 36 | 0) >> 2] | 0) + ((((HEAP32[($3_1 + 32 | 0) >> 2] | 0) >> 12 | 0) - 1 | 0) << 1 | 0) | 0) >> 1] | 0 | 0) / (2 | 0) | 0;
    $9_1 = HEAP32[($3_1 + 40 | 0) >> 2] | 0;
    HEAP32[($3_1 + 40 | 0) >> 2] = $9_1 + 2 | 0;
    HEAP16[$9_1 >> 1] = $8_1;
   }
   HEAP8[(HEAP32[($3_1 + 44 | 0) >> 2] | 0) >> 0] = 0;
   $11_1 = HEAP32[($3_1 + 52 | 0) >> 2] | 0;
   HEAP32[$11_1 >> 2] = (HEAP32[$11_1 >> 2] | 0) - ((HEAP32[($3_1 + 20 | 0) >> 2] | 0) + 1 | 0) | 0;
  }
  HEAP32[((HEAP32[($3_1 + 44 | 0) >> 2] | 0) + 16 | 0) >> 2] = HEAP32[($3_1 + 32 | 0) >> 2] | 0;
  return HEAP32[((HEAP32[($3_1 + 60 | 0) >> 2] | 0) + 1068 | 0) >> 2] | 0 | 0;
 }
 
 function $126($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, $4_1 = 0, $5_1 = 0, $9_1 = 0, $10_1 = 0, $11_1 = 0, $19$hi = 0, $23_1 = 0.0, $230 = 0, $24_1 = 0.0, $255 = 0, $19_1 = 0, $164$hi = 0, $21_1 = 0, $247 = 0, $18_1 = 0, $262 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $3_1 = global$0 - 64 | 0;
  global$0 = $3_1;
  HEAP32[($3_1 + 56 | 0) >> 2] = $0_1;
  HEAP32[($3_1 + 52 | 0) >> 2] = $1_1;
  HEAP32[($3_1 + 48 | 0) >> 2] = $2_1;
  $4_1 = HEAP32[($3_1 + 52 | 0) >> 2] | 0;
  $5_1 = HEAP32[($4_1 + 208 | 0) >> 2] | 0;
  HEAP32[($4_1 + 208 | 0) >> 2] = $5_1 + 1 | 0;
  block : {
   if (!(($5_1 | 0) >= (63 | 0) & 1 | 0)) {
    break block
   }
   HEAP32[((HEAP32[($3_1 + 52 | 0) >> 2] | 0) + 208 | 0) >> 2] = 0;
  }
  (wasm2js_i32$0 = $3_1, wasm2js_i32$1 = $128(HEAP32[((HEAP32[($3_1 + 52 | 0) >> 2] | 0) + 208 | 0) >> 2] | 0 | 0) | 0), HEAP32[(wasm2js_i32$0 + 40 | 0) >> 2] = wasm2js_i32$1;
  block3 : {
   block1 : {
    if (!(HEAP32[(((HEAP32[($3_1 + 52 | 0) >> 2] | 0) + 80 | 0) + ((HEAP32[($3_1 + 40 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0)) {
     break block1
    }
    block2 : {
     if (!(HEAP32[($3_1 + 48 | 0) >> 2] | 0)) {
      break block2
     }
     HEAP32[($3_1 + 60 | 0) >> 2] = 0 - (HEAP32[(((HEAP32[($3_1 + 52 | 0) >> 2] | 0) + 80 | 0) + ((HEAP32[($3_1 + 40 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0) | 0;
     break block3;
    }
    HEAP32[($3_1 + 60 | 0) >> 2] = HEAP32[(((HEAP32[($3_1 + 52 | 0) >> 2] | 0) + 80 | 0) + ((HEAP32[($3_1 + 40 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] | 0;
    break block3;
   }
   HEAP32[($3_1 + 44 | 0) >> 2] = (HEAPU8[((HEAP32[((HEAP32[($3_1 + 52 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0) + 101 | 0) >> 0] | 0) << 7 | 0;
   block4 : {
    if (!(HEAP32[((HEAP32[($3_1 + 52 | 0) >> 2] | 0) + 52 | 0) >> 2] | 0)) {
     break block4
    }
    $9_1 = HEAP32[($3_1 + 52 | 0) >> 2] | 0;
    HEAP32[($9_1 + 56 | 0) >> 2] = (HEAP32[((HEAP32[($3_1 + 52 | 0) >> 2] | 0) + 52 | 0) >> 2] | 0) + (HEAP32[($9_1 + 56 | 0) >> 2] | 0) | 0;
    block6 : {
     block5 : {
      if (!((HEAP32[((HEAP32[($3_1 + 52 | 0) >> 2] | 0) + 56 | 0) >> 2] | 0 | 0) >= (65536 | 0) & 1 | 0)) {
       break block5
      }
      HEAP32[((HEAP32[($3_1 + 52 | 0) >> 2] | 0) + 52 | 0) >> 2] = 0;
      break block6;
     }
     HEAP32[($3_1 + 44 | 0) >> 2] = Math_imul(HEAP32[((HEAP32[($3_1 + 52 | 0) >> 2] | 0) + 56 | 0) >> 2] | 0, HEAP32[($3_1 + 44 | 0) >> 2] | 0);
     HEAP32[($3_1 + 44 | 0) >> 2] = (HEAP32[($3_1 + 44 | 0) >> 2] | 0) >> 16 | 0;
    }
   }
   $10_1 = HEAP32[($3_1 + 52 | 0) >> 2] | 0;
   $11_1 = HEAP32[($10_1 + 4 | 0) >> 2] | 0;
   HEAPF64[($3_1 + 24 | 0) >> 3] = +Math_fround(+(HEAP32[($11_1 + 12 | 0) >> 2] | 0 | 0) * +(HEAP32[($10_1 + 12 | 0) >> 2] | 0 | 0) / (+(HEAP32[($11_1 + 24 | 0) >> 2] | 0 | 0) * +(HEAP32[((HEAP32[($3_1 + 56 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0 | 0)) * 4096.0);
   $192($3_1 | 0, +(+$165(+(+((HEAP32[((HEAP32[($3_1 + 52 | 0) >> 2] | 0) + 208 | 0) >> 2] | 0) << 4 | 0 | 0) * .006135923151542565)) * +(HEAP32[($3_1 + 44 | 0) >> 2] | 0 | 0)));
   i64toi32_i32$0 = HEAP32[($3_1 + 8 | 0) >> 2] | 0;
   i64toi32_i32$1 = HEAP32[($3_1 + 12 | 0) >> 2] | 0;
   $19_1 = i64toi32_i32$0;
   $19$hi = i64toi32_i32$1;
   i64toi32_i32$1 = HEAP32[$3_1 >> 2] | 0;
   i64toi32_i32$0 = HEAP32[($3_1 + 4 | 0) >> 2] | 0;
   $164$hi = i64toi32_i32$0;
   i64toi32_i32$0 = $19$hi;
   i64toi32_i32$0 = $164$hi;
   $21_1 = i64toi32_i32$1;
   i64toi32_i32$1 = $19$hi;
   (wasm2js_i32$0 = $3_1, wasm2js_i32$1 = $193($21_1 | 0, i64toi32_i32$0 | 0, $19_1 | 0, i64toi32_i32$1 | 0) | 0), HEAP32[(wasm2js_i32$0 + 36 | 0) >> 2] = wasm2js_i32$1;
   block8 : {
    block7 : {
     if (!((HEAP32[($3_1 + 36 | 0) >> 2] | 0 | 0) < (0 | 0) & 1 | 0)) {
      break block7
     }
     HEAP32[($3_1 + 36 | 0) >> 2] = 0 - (HEAP32[($3_1 + 36 | 0) >> 2] | 0) | 0;
     HEAPF64[($3_1 + 24 | 0) >> 3] = +HEAPF64[($3_1 + 24 | 0) >> 3] / (+HEAPF64[(67392 + ((((HEAP32[($3_1 + 36 | 0) >> 2] | 0) >> 5 | 0) & 255 | 0) << 3 | 0) | 0) >> 3] * +HEAPF64[(69440 + (((HEAP32[($3_1 + 36 | 0) >> 2] | 0) >> 13 | 0) << 3 | 0) | 0) >> 3]);
     break block8;
    }
    HEAPF64[($3_1 + 24 | 0) >> 3] = +HEAPF64[(67392 + ((((HEAP32[($3_1 + 36 | 0) >> 2] | 0) >> 5 | 0) & 255 | 0) << 3 | 0) | 0) >> 3] * +HEAPF64[(69440 + (((HEAP32[($3_1 + 36 | 0) >> 2] | 0) >> 13 | 0) << 3 | 0) | 0) >> 3] * +HEAPF64[($3_1 + 24 | 0) >> 3];
   }
   block9 : {
    if (HEAP32[((HEAP32[($3_1 + 52 | 0) >> 2] | 0) + 52 | 0) >> 2] | 0) {
     break block9
    }
    $23_1 = +HEAPF64[($3_1 + 24 | 0) >> 3];
    if (Math_abs($23_1) < 2147483647.0) {
     $230 = ~~$23_1
    } else {
     $230 = -2147483648
    }
    HEAP32[(((HEAP32[($3_1 + 52 | 0) >> 2] | 0) + 80 | 0) + ((HEAP32[($3_1 + 40 | 0) >> 2] | 0) << 2 | 0) | 0) >> 2] = $230;
   }
   block10 : {
    if (!(HEAP32[($3_1 + 48 | 0) >> 2] | 0)) {
     break block10
    }
    HEAPF64[($3_1 + 24 | 0) >> 3] = -+HEAPF64[($3_1 + 24 | 0) >> 3];
   }
   $247 = $3_1;
   $24_1 = +HEAPF64[($3_1 + 24 | 0) >> 3];
   if (Math_abs($24_1) < 2147483647.0) {
    $255 = ~~$24_1
   } else {
    $255 = -2147483648
   }
   HEAP32[($247 + 60 | 0) >> 2] = $255;
  }
  $18_1 = HEAP32[($3_1 + 60 | 0) >> 2] | 0;
  global$0 = $3_1 + 64 | 0;
  return $18_1 | 0;
 }
 
 function $127($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0, i64toi32_i32$0 = 0, i64toi32_i32$2 = 0, i64toi32_i32$3 = 0, i64toi32_i32$1 = 0, $31_1 = 0.0, $95_1 = 0, $4_1 = 0, $5_1 = 0, $6_1 = 0, $8_1 = 0, $9_1 = 0, $27$hi = 0, $28$hi = 0, $29$hi = 0, $30$hi = 0, $32_1 = 0.0, $285 = 0, $11_1 = 0, $12_1 = 0, $14_1 = 0, $16_1 = 0, $18_1 = 0, $33_1 = 0.0, $413 = 0, $34_1 = 0.0, $430 = 0, $82_1 = 0, $7_1 = 0, $27_1 = 0, $37_1 = 0, $30_1 = 0, $225$hi = 0, $38_1 = 0, $229 = 0, $15_1 = 0, $17_1 = 0, wasm2js_i32$0 = 0, wasm2js_f64$0 = 0.0;
  $2_1 = global$0 - 128 | 0;
  global$0 = $2_1;
  HEAP32[($2_1 + 124 | 0) >> 2] = $0_1;
  HEAP32[($2_1 + 120 | 0) >> 2] = $1_1;
  HEAP32[($2_1 + 76 | 0) >> 2] = HEAP32[((HEAP32[($2_1 + 120 | 0) >> 2] | 0) + 80 | 0) >> 2] | 0;
  HEAPF64[($2_1 + 112 | 0) >> 3] = +(HEAP32[((HEAP32[($2_1 + 120 | 0) >> 2] | 0) + 24 | 0) >> 2] | 0 | 0) * +(HEAP32[((HEAP32[($2_1 + 124 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0 | 0) / (+(HEAP32[((HEAP32[($2_1 + 120 | 0) >> 2] | 0) + 12 | 0) >> 2] | 0 | 0) * +(HEAP32[(65856 + ((HEAP8[((HEAP32[($2_1 + 120 | 0) >> 2] | 0) + 104 | 0) >> 0] | 0) << 2 | 0) | 0) >> 2] | 0 | 0));
  block1 : {
   block : {
    if (!(+(HEAP32[((HEAP32[($2_1 + 120 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0 | 0) * +HEAPF64[($2_1 + 112 | 0) >> 3] >= 2147483647.0 & 1 | 0)) {
     break block
    }
    break block1;
   }
   $82_1 = $2_1;
   $31_1 = +(HEAP32[((HEAP32[($2_1 + 120 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0 | 0) * +HEAPF64[($2_1 + 112 | 0) >> 3];
   if (Math_abs($31_1) < 2147483647.0) {
    $95_1 = ~~$31_1
   } else {
    $95_1 = -2147483648
   }
   HEAP32[($82_1 + 92 | 0) >> 2] = $95_1;
   HEAP32[($2_1 + 88 | 0) >> 2] = ((HEAP32[($2_1 + 92 | 0) >> 2] | 0) >> 12 | 0) - 1 | 0;
   $4_1 = ((HEAP32[((HEAP32[($2_1 + 120 | 0) >> 2] | 0) + 8 | 0) >> 2] | 0) - 4096 | 0 | 0) / (HEAP32[($2_1 + 88 | 0) >> 2] | 0 | 0) | 0;
   HEAP32[($2_1 + 100 | 0) >> 2] = $4_1;
   HEAP32[($2_1 + 96 | 0) >> 2] = $4_1;
   block2 : {
    if (!(+(HEAP32[($2_1 + 92 | 0) >> 2] | 0 | 0) + +(HEAP32[($2_1 + 100 | 0) >> 2] | 0 | 0) >= 2147483647.0 & 1 | 0)) {
     break block2
    }
    break block1;
   }
   $5_1 = $182(((HEAP32[($2_1 + 92 | 0) >> 2] | 0) >> 11 | 0) + 2 | 0 | 0) | 0;
   HEAP32[($2_1 + 84 | 0) >> 2] = $5_1;
   HEAP32[($2_1 + 80 | 0) >> 2] = $5_1;
   block3 : {
    if ((HEAP32[($2_1 + 80 | 0) >> 2] | 0 | 0) != (0 | 0) & 1 | 0) {
     break block3
    }
    HEAP32[(HEAP32[($2_1 + 124 | 0) >> 2] | 0) >> 2] = 1;
    break block1;
   }
   $6_1 = (HEAP32[($2_1 + 88 | 0) >> 2] | 0) + -1 | 0;
   HEAP32[($2_1 + 88 | 0) >> 2] = $6_1;
   block4 : {
    if (!$6_1) {
     break block4
    }
    $7_1 = HEAPU16[(HEAP32[($2_1 + 76 | 0) >> 2] | 0) >> 1] | 0;
    $8_1 = HEAP32[($2_1 + 80 | 0) >> 2] | 0;
    HEAP32[($2_1 + 80 | 0) >> 2] = $8_1 + 2 | 0;
    HEAP16[$8_1 >> 1] = $7_1;
   }
   HEAP32[($2_1 + 88 | 0) >> 2] = (HEAP32[($2_1 + 88 | 0) >> 2] | 0) + -1 | 0;
   HEAP32[($2_1 + 44 | 0) >> 2] = 0;
   block5 : {
    label : while (1) {
     if (!((HEAP32[($2_1 + 44 | 0) >> 2] | 0 | 0) < (HEAP32[($2_1 + 88 | 0) >> 2] | 0 | 0) & 1 | 0)) {
      break block5
     }
     HEAP32[($2_1 + 72 | 0) >> 2] = (HEAP32[($2_1 + 76 | 0) >> 2] | 0) + (((HEAP32[($2_1 + 96 | 0) >> 2] | 0) >> 12 | 0) << 1 | 0) | 0;
     block7 : {
      block6 : {
       if (!((HEAP32[($2_1 + 72 | 0) >> 2] | 0) >>> 0 >= ((HEAP32[($2_1 + 76 | 0) >> 2] | 0) + 2 | 0) >>> 0 & 1 | 0)) {
        break block6
       }
       $9_1 = HEAP16[((HEAP32[($2_1 + 72 | 0) >> 2] | 0) + -2 | 0) >> 1] | 0;
       break block7;
      }
      $9_1 = 0;
     }
     HEAP32[($2_1 + 64 | 0) >> 2] = $9_1;
     HEAP32[($2_1 + 60 | 0) >> 2] = HEAP16[(HEAP32[($2_1 + 72 | 0) >> 2] | 0) >> 1] | 0;
     HEAP32[($2_1 + 56 | 0) >> 2] = HEAP16[((HEAP32[($2_1 + 72 | 0) >> 2] | 0) + 2 | 0) >> 1] | 0;
     HEAP32[($2_1 + 52 | 0) >> 2] = HEAP16[((HEAP32[($2_1 + 72 | 0) >> 2] | 0) + 4 | 0) >> 1] | 0;
     HEAP32[($2_1 + 48 | 0) >> 2] = (HEAP32[($2_1 + 60 | 0) >> 2] | 0) - (HEAP32[($2_1 + 56 | 0) >> 2] | 0) | 0;
     $194($2_1 + 16 | 0 | 0, (HEAP32[($2_1 + 96 | 0) >> 2] | 0) & 4095 | 0 | 0);
     i64toi32_i32$2 = $2_1;
     i64toi32_i32$0 = HEAP32[($2_1 + 24 | 0) >> 2] | 0;
     i64toi32_i32$1 = HEAP32[($2_1 + 28 | 0) >> 2] | 0;
     $27_1 = i64toi32_i32$0;
     $27$hi = i64toi32_i32$1;
     i64toi32_i32$2 = $2_1;
     i64toi32_i32$1 = HEAP32[($2_1 + 16 | 0) >> 2] | 0;
     i64toi32_i32$0 = HEAP32[($2_1 + 20 | 0) >> 2] | 0;
     $28$hi = i64toi32_i32$0;
     i64toi32_i32$0 = 1072889856;
     $29$hi = i64toi32_i32$0;
     i64toi32_i32$0 = $28$hi;
     i64toi32_i32$0 = $27$hi;
     i64toi32_i32$0 = $29$hi;
     i64toi32_i32$0 = $28$hi;
     $37_1 = i64toi32_i32$1;
     i64toi32_i32$1 = $27$hi;
     i64toi32_i32$2 = 0;
     i64toi32_i32$3 = $29$hi;
     $196($2_1 | 0, $37_1 | 0, i64toi32_i32$0 | 0, $27_1 | 0, i64toi32_i32$1 | 0, 0 | 0, i64toi32_i32$2 | 0, 0 | 0, i64toi32_i32$3 | 0);
     i64toi32_i32$1 = $2_1;
     i64toi32_i32$3 = HEAP32[($2_1 + 8 | 0) >> 2] | 0;
     i64toi32_i32$2 = HEAP32[($2_1 + 12 | 0) >> 2] | 0;
     $30_1 = i64toi32_i32$3;
     $30$hi = i64toi32_i32$2;
     i64toi32_i32$1 = $2_1;
     i64toi32_i32$2 = HEAP32[$2_1 >> 2] | 0;
     i64toi32_i32$3 = HEAP32[($2_1 + 4 | 0) >> 2] | 0;
     $225$hi = i64toi32_i32$3;
     i64toi32_i32$3 = $30$hi;
     i64toi32_i32$3 = $225$hi;
     $38_1 = i64toi32_i32$2;
     i64toi32_i32$2 = $30$hi;
     (wasm2js_i32$0 = $2_1, wasm2js_f64$0 = +Math_fround($201($38_1 | 0, i64toi32_i32$3 | 0, $30_1 | 0, i64toi32_i32$2 | 0))), HEAPF64[(wasm2js_i32$0 + 104 | 0) >> 3] = wasm2js_f64$0;
     $229 = $2_1;
     $32_1 = +(HEAP32[($2_1 + 60 | 0) >> 2] | 0 | 0) + +HEAPF64[($2_1 + 104 | 0) >> 3] * .16666666666666666 * (+((Math_imul((HEAP32[($2_1 + 56 | 0) >> 2] | 0) - (HEAP32[($2_1 + 48 | 0) >> 2] | 0) | 0, 3) - ((HEAP32[($2_1 + 64 | 0) >> 2] | 0) << 1 | 0) | 0) - (HEAP32[($2_1 + 52 | 0) >> 2] | 0) | 0 | 0) + +HEAPF64[($2_1 + 104 | 0) >> 3] * (+(Math_imul(((HEAP32[($2_1 + 64 | 0) >> 2] | 0) - (HEAP32[($2_1 + 60 | 0) >> 2] | 0) | 0) - (HEAP32[($2_1 + 48 | 0) >> 2] | 0) | 0, 3) | 0) + +HEAPF64[($2_1 + 104 | 0) >> 3] * +((Math_imul(HEAP32[($2_1 + 48 | 0) >> 2] | 0, 3) + (HEAP32[($2_1 + 52 | 0) >> 2] | 0) | 0) - (HEAP32[($2_1 + 64 | 0) >> 2] | 0) | 0 | 0)));
     if (Math_abs($32_1) < 2147483647.0) {
      $285 = ~~$32_1
     } else {
      $285 = -2147483648
     }
     HEAP32[($229 + 68 | 0) >> 2] = $285;
     block9 : {
      block8 : {
       if (!((HEAP32[($2_1 + 68 | 0) >> 2] | 0 | 0) > (32767 | 0) & 1 | 0)) {
        break block8
       }
       $11_1 = 32767;
       break block9;
      }
      block11 : {
       block10 : {
        if (!((HEAP32[($2_1 + 68 | 0) >> 2] | 0 | 0) < (-32768 | 0) & 1 | 0)) {
         break block10
        }
        $12_1 = -32768;
        break block11;
       }
       $12_1 = HEAP32[($2_1 + 68 | 0) >> 2] | 0;
      }
      $11_1 = $12_1;
     }
     $14_1 = HEAP32[($2_1 + 80 | 0) >> 2] | 0;
     HEAP32[($2_1 + 80 | 0) >> 2] = $14_1 + 2 | 0;
     HEAP16[$14_1 >> 1] = $11_1;
     HEAP32[($2_1 + 96 | 0) >> 2] = (HEAP32[($2_1 + 100 | 0) >> 2] | 0) + (HEAP32[($2_1 + 96 | 0) >> 2] | 0) | 0;
     HEAP32[($2_1 + 44 | 0) >> 2] = (HEAP32[($2_1 + 44 | 0) >> 2] | 0) + 1 | 0;
     continue label;
    };
   }
   block13 : {
    block12 : {
     if (!((HEAP32[($2_1 + 96 | 0) >> 2] | 0) & 4095 | 0)) {
      break block12
     }
     HEAP32[($2_1 + 64 | 0) >> 2] = HEAP16[((HEAP32[($2_1 + 76 | 0) >> 2] | 0) + (((HEAP32[($2_1 + 96 | 0) >> 2] | 0) >> 12 | 0) << 1 | 0) | 0) >> 1] | 0;
     HEAP32[($2_1 + 60 | 0) >> 2] = HEAP16[((HEAP32[($2_1 + 76 | 0) >> 2] | 0) + ((((HEAP32[($2_1 + 96 | 0) >> 2] | 0) >> 12 | 0) + 1 | 0) << 1 | 0) | 0) >> 1] | 0;
     $15_1 = (HEAP32[($2_1 + 64 | 0) >> 2] | 0) + (Math_imul((HEAP32[($2_1 + 60 | 0) >> 2] | 0) - (HEAP32[($2_1 + 64 | 0) >> 2] | 0) | 0, (HEAP32[($2_1 + 96 | 0) >> 2] | 0) & 4095 | 0) >>> 12 | 0) | 0;
     $16_1 = HEAP32[($2_1 + 80 | 0) >> 2] | 0;
     HEAP32[($2_1 + 80 | 0) >> 2] = $16_1 + 2 | 0;
     HEAP16[$16_1 >> 1] = $15_1;
     break block13;
    }
    $17_1 = HEAPU16[((HEAP32[($2_1 + 76 | 0) >> 2] | 0) + (((HEAP32[($2_1 + 96 | 0) >> 2] | 0) >> 12 | 0) << 1 | 0) | 0) >> 1] | 0;
    $18_1 = HEAP32[($2_1 + 80 | 0) >> 2] | 0;
    HEAP32[($2_1 + 80 | 0) >> 2] = $18_1 + 2 | 0;
    HEAP16[$18_1 >> 1] = $17_1;
   }
   HEAP16[(HEAP32[($2_1 + 80 | 0) >> 2] | 0) >> 1] = (HEAP16[((HEAP32[($2_1 + 80 | 0) >> 2] | 0) + -2 | 0) >> 1] | 0 | 0) / (2 | 0) | 0;
   HEAP32[($2_1 + 80 | 0) >> 2] = (HEAP32[($2_1 + 80 | 0) >> 2] | 0) + 2 | 0;
   HEAP16[(HEAP32[($2_1 + 80 | 0) >> 2] | 0) >> 1] = (HEAP16[((HEAP32[($2_1 + 80 | 0) >> 2] | 0) + -2 | 0) >> 1] | 0 | 0) / (2 | 0) | 0;
   HEAP32[((HEAP32[($2_1 + 120 | 0) >> 2] | 0) + 8 | 0) >> 2] = HEAP32[($2_1 + 92 | 0) >> 2] | 0;
   $33_1 = +(HEAP32[(HEAP32[($2_1 + 120 | 0) >> 2] | 0) >> 2] | 0 | 0) * +HEAPF64[($2_1 + 112 | 0) >> 3];
   if (Math_abs($33_1) < 2147483647.0) {
    $413 = ~~$33_1
   } else {
    $413 = -2147483648
   }
   HEAP32[(HEAP32[($2_1 + 120 | 0) >> 2] | 0) >> 2] = $413;
   $34_1 = +(HEAP32[((HEAP32[($2_1 + 120 | 0) >> 2] | 0) + 4 | 0) >> 2] | 0 | 0) * +HEAPF64[($2_1 + 112 | 0) >> 3];
   if (Math_abs($34_1) < 2147483647.0) {
    $430 = ~~$34_1
   } else {
    $430 = -2147483648
   }
   HEAP32[((HEAP32[($2_1 + 120 | 0) >> 2] | 0) + 4 | 0) >> 2] = $430;
   $184(HEAP32[((HEAP32[($2_1 + 120 | 0) >> 2] | 0) + 80 | 0) >> 2] | 0 | 0);
   HEAP32[((HEAP32[($2_1 + 120 | 0) >> 2] | 0) + 80 | 0) >> 2] = HEAP32[($2_1 + 84 | 0) >> 2] | 0;
   HEAP32[((HEAP32[($2_1 + 120 | 0) >> 2] | 0) + 12 | 0) >> 2] = 0;
  }
  global$0 = $2_1 + 128 | 0;
  return;
 }
 
 function $128($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, $34_1 = 0;
  $1_1 = global$0 - 16 | 0;
  HEAP32[($1_1 + 8 | 0) >> 2] = $0_1;
  block1 : {
   block : {
    if (!((HEAP32[($1_1 + 8 | 0) >> 2] | 0 | 0) < (16 | 0) & 1 | 0)) {
     break block
    }
    HEAP32[($1_1 + 12 | 0) >> 2] = 15 - (HEAP32[($1_1 + 8 | 0) >> 2] | 0) | 0;
    break block1;
   }
   block2 : {
    if (!((HEAP32[($1_1 + 8 | 0) >> 2] | 0 | 0) >= (48 | 0) & 1 | 0)) {
     break block2
    }
    HEAP32[($1_1 + 12 | 0) >> 2] = 79 - (HEAP32[($1_1 + 8 | 0) >> 2] | 0) | 0;
    break block1;
   }
   HEAP32[($1_1 + 12 | 0) >> 2] = (HEAP32[($1_1 + 8 | 0) >> 2] | 0) - 16 | 0;
  }
  return HEAP32[($1_1 + 12 | 0) >> 2] | 0 | 0;
 }
 
 function $129($0_1) {
  $0_1 = $0_1 | 0;
  var $2_1 = 0, $1_1 = 0, $3_1 = 0;
  label : while (1) {
   $1_1 = $0_1;
   $0_1 = $0_1 + 1 | 0;
   $2_1 = HEAP8[$1_1 >> 0] | 0;
   if ($130($2_1 | 0) | 0) {
    continue label
   }
   break label;
  };
  $3_1 = 1;
  block1 : {
   switch (($2_1 & 255 | 0) + -43 | 0 | 0) {
   case 2:
    $3_1 = 0;
   case 0:
    $2_1 = HEAP8[$0_1 >> 0] | 0;
    $1_1 = $0_1;
    break;
   default:
    break block1;
   };
  }
  $0_1 = 0;
  block3 : {
   $2_1 = $2_1 + -48 | 0;
   if ($2_1 >>> 0 > 9 >>> 0) {
    break block3
   }
   $0_1 = 0;
   label1 : while (1) {
    $0_1 = Math_imul($0_1, 10) - $2_1 | 0;
    $2_1 = HEAP8[($1_1 + 1 | 0) >> 0] | 0;
    $1_1 = $1_1 + 1 | 0;
    $2_1 = $2_1 + -48 | 0;
    if ($2_1 >>> 0 < 10 >>> 0) {
     continue label1
    }
    break label1;
   };
  }
  return ($3_1 ? 0 - $0_1 | 0 : $0_1) | 0;
 }
 
 function $130($0_1) {
  $0_1 = $0_1 | 0;
  return ($0_1 | 0) == (32 | 0) | ($0_1 + -9 | 0) >>> 0 < 5 >>> 0 | 0 | 0;
 }
 
 function $131($0_1) {
  $0_1 = $0_1 | 0;
 }
 
 function $132($0_1) {
  $0_1 = $0_1 | 0;
  var $4_1 = 0, $5_1 = 0, $3_1 = 0, $1_1 = 0, $2_1 = 0;
  $1_1 = $133($0_1 | 0) | 0;
  $2_1 = FUNCTION_TABLE[HEAP32[($0_1 + 12 | 0) >> 2] | 0 | 0]($0_1) | 0;
  block : {
   if ((HEAPU8[$0_1 >> 0] | 0) & 1 | 0) {
    break block
   }
   $131($0_1 | 0);
   $3_1 = $155() | 0;
   $4_1 = HEAP32[($0_1 + 56 | 0) >> 2] | 0;
   block1 : {
    $5_1 = HEAP32[($0_1 + 52 | 0) >> 2] | 0;
    if (!$5_1) {
     break block1
    }
    HEAP32[($5_1 + 56 | 0) >> 2] = $4_1;
   }
   block2 : {
    if (!$4_1) {
     break block2
    }
    HEAP32[($4_1 + 52 | 0) >> 2] = $5_1;
   }
   block3 : {
    if ((HEAP32[$3_1 >> 2] | 0 | 0) != ($0_1 | 0)) {
     break block3
    }
    HEAP32[$3_1 >> 2] = $4_1;
   }
   $156();
   $184(HEAP32[($0_1 + 96 | 0) >> 2] | 0 | 0);
   $184($0_1 | 0);
  }
  return $2_1 | $1_1 | 0 | 0;
 }
 
 function $133($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, i64toi32_i32$1 = 0, i64toi32_i32$0 = 0, $2_1 = 0;
  block : {
   if ($0_1) {
    break block
   }
   $1_1 = 0;
   block1 : {
    if (!(HEAP32[(0 + 77072 | 0) >> 2] | 0)) {
     break block1
    }
    $1_1 = $133(HEAP32[(0 + 77072 | 0) >> 2] | 0 | 0) | 0;
   }
   block2 : {
    if (!(HEAP32[(0 + 75720 | 0) >> 2] | 0)) {
     break block2
    }
    $1_1 = $133(HEAP32[(0 + 75720 | 0) >> 2] | 0 | 0) | 0 | $1_1 | 0;
   }
   block3 : {
    $0_1 = HEAP32[($155() | 0) >> 2] | 0;
    if (!$0_1) {
     break block3
    }
    label : while (1) {
     block4 : {
      if ((HEAP32[($0_1 + 20 | 0) >> 2] | 0 | 0) == (HEAP32[($0_1 + 28 | 0) >> 2] | 0 | 0)) {
       break block4
      }
      $1_1 = $133($0_1 | 0) | 0 | $1_1 | 0;
     }
     $0_1 = HEAP32[($0_1 + 56 | 0) >> 2] | 0;
     if ($0_1) {
      continue label
     }
     break label;
    };
   }
   $156();
   return $1_1 | 0;
  }
  block5 : {
   if ((HEAP32[($0_1 + 20 | 0) >> 2] | 0 | 0) == (HEAP32[($0_1 + 28 | 0) >> 2] | 0 | 0)) {
    break block5
   }
   FUNCTION_TABLE[HEAP32[($0_1 + 36 | 0) >> 2] | 0 | 0]($0_1, 0, 0) | 0;
   if (HEAP32[($0_1 + 20 | 0) >> 2] | 0) {
    break block5
   }
   return -1 | 0;
  }
  block6 : {
   $1_1 = HEAP32[($0_1 + 4 | 0) >> 2] | 0;
   $2_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
   if (($1_1 | 0) == ($2_1 | 0)) {
    break block6
   }
   i64toi32_i32$1 = $1_1 - $2_1 | 0;
   i64toi32_i32$0 = i64toi32_i32$1 >> 31 | 0;
   i64toi32_i32$0 = FUNCTION_TABLE[HEAP32[($0_1 + 40 | 0) >> 2] | 0 | 0]($0_1, i64toi32_i32$1, i64toi32_i32$0, 1) | 0;
   i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
  }
  HEAP32[($0_1 + 28 | 0) >> 2] = 0;
  i64toi32_i32$0 = $0_1;
  i64toi32_i32$1 = 0;
  HEAP32[($0_1 + 16 | 0) >> 2] = 0;
  HEAP32[($0_1 + 20 | 0) >> 2] = i64toi32_i32$1;
  i64toi32_i32$0 = $0_1;
  i64toi32_i32$1 = 0;
  HEAP32[($0_1 + 4 | 0) >> 2] = 0;
  HEAP32[($0_1 + 8 | 0) >> 2] = i64toi32_i32$1;
  return 0 | 0;
 }
 
 function $134() {
  return 77076 | 0;
 }
 
 function $135($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0;
  $1_1 = 2;
  block : {
   if ($166($0_1 | 0, 43 | 0) | 0) {
    break block
   }
   $1_1 = (HEAPU8[$0_1 >> 0] | 0 | 0) != (114 | 0);
  }
  $1_1 = $166($0_1 | 0, 120 | 0) | 0 ? $1_1 | 128 | 0 : $1_1;
  $1_1 = $166($0_1 | 0, 101 | 0) | 0 ? $1_1 | 524288 | 0 : $1_1;
  $0_1 = HEAPU8[$0_1 >> 0] | 0;
  $1_1 = ($0_1 | 0) == (114 | 0) ? $1_1 : $1_1 | 64 | 0;
  $1_1 = ($0_1 | 0) == (119 | 0) ? $1_1 | 512 | 0 : $1_1;
  return (($0_1 | 0) == (97 | 0) ? $1_1 | 1024 | 0 : $1_1) | 0;
 }
 
 function $136($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, i64toi32_i32$0 = 0, $4_1 = 0, i64toi32_i32$1 = 0, $6_1 = 0, $5_1 = 0, $6$hi = 0;
  block : {
   if (!$2_1) {
    break block
   }
   HEAP8[$0_1 >> 0] = $1_1;
   $3_1 = $0_1 + $2_1 | 0;
   HEAP8[($3_1 + -1 | 0) >> 0] = $1_1;
   if ($2_1 >>> 0 < 3 >>> 0) {
    break block
   }
   HEAP8[($0_1 + 2 | 0) >> 0] = $1_1;
   HEAP8[($0_1 + 1 | 0) >> 0] = $1_1;
   HEAP8[($3_1 + -3 | 0) >> 0] = $1_1;
   HEAP8[($3_1 + -2 | 0) >> 0] = $1_1;
   if ($2_1 >>> 0 < 7 >>> 0) {
    break block
   }
   HEAP8[($0_1 + 3 | 0) >> 0] = $1_1;
   HEAP8[($3_1 + -4 | 0) >> 0] = $1_1;
   if ($2_1 >>> 0 < 9 >>> 0) {
    break block
   }
   $4_1 = (0 - $0_1 | 0) & 3 | 0;
   $3_1 = $0_1 + $4_1 | 0;
   $1_1 = Math_imul($1_1 & 255 | 0, 16843009);
   HEAP32[$3_1 >> 2] = $1_1;
   $4_1 = ($2_1 - $4_1 | 0) & -4 | 0;
   $2_1 = $3_1 + $4_1 | 0;
   HEAP32[($2_1 + -4 | 0) >> 2] = $1_1;
   if ($4_1 >>> 0 < 9 >>> 0) {
    break block
   }
   HEAP32[($3_1 + 8 | 0) >> 2] = $1_1;
   HEAP32[($3_1 + 4 | 0) >> 2] = $1_1;
   HEAP32[($2_1 + -8 | 0) >> 2] = $1_1;
   HEAP32[($2_1 + -12 | 0) >> 2] = $1_1;
   if ($4_1 >>> 0 < 25 >>> 0) {
    break block
   }
   HEAP32[($3_1 + 24 | 0) >> 2] = $1_1;
   HEAP32[($3_1 + 20 | 0) >> 2] = $1_1;
   HEAP32[($3_1 + 16 | 0) >> 2] = $1_1;
   HEAP32[($3_1 + 12 | 0) >> 2] = $1_1;
   HEAP32[($2_1 + -16 | 0) >> 2] = $1_1;
   HEAP32[($2_1 + -20 | 0) >> 2] = $1_1;
   HEAP32[($2_1 + -24 | 0) >> 2] = $1_1;
   HEAP32[($2_1 + -28 | 0) >> 2] = $1_1;
   $5_1 = $3_1 & 4 | 0 | 24 | 0;
   $2_1 = $4_1 - $5_1 | 0;
   if ($2_1 >>> 0 < 32 >>> 0) {
    break block
   }
   i64toi32_i32$0 = 0;
   i64toi32_i32$1 = 1;
   i64toi32_i32$1 = __wasm_i64_mul($1_1 | 0, i64toi32_i32$0 | 0, 1 | 0, i64toi32_i32$1 | 0) | 0;
   i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
   $6_1 = i64toi32_i32$1;
   $6$hi = i64toi32_i32$0;
   $1_1 = $3_1 + $5_1 | 0;
   label : while (1) {
    i64toi32_i32$0 = $6$hi;
    i64toi32_i32$1 = $1_1;
    HEAP32[($1_1 + 24 | 0) >> 2] = $6_1;
    HEAP32[($1_1 + 28 | 0) >> 2] = i64toi32_i32$0;
    i64toi32_i32$1 = $1_1;
    HEAP32[($1_1 + 16 | 0) >> 2] = $6_1;
    HEAP32[($1_1 + 20 | 0) >> 2] = i64toi32_i32$0;
    i64toi32_i32$1 = $1_1;
    HEAP32[($1_1 + 8 | 0) >> 2] = $6_1;
    HEAP32[($1_1 + 12 | 0) >> 2] = i64toi32_i32$0;
    i64toi32_i32$1 = $1_1;
    HEAP32[$1_1 >> 2] = $6_1;
    HEAP32[($1_1 + 4 | 0) >> 2] = i64toi32_i32$0;
    $1_1 = $1_1 + 32 | 0;
    $2_1 = $2_1 + -32 | 0;
    if ($2_1 >>> 0 > 31 >>> 0) {
     continue label
    }
    break label;
   };
  }
  return $0_1 | 0;
 }
 
 function $137($0_1, $1_1, $1$hi, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $1$hi = $1$hi | 0;
  $2_1 = $2_1 | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$1 = 0;
  i64toi32_i32$0 = $1$hi;
  i64toi32_i32$0 = $151(HEAP32[($0_1 + 60 | 0) >> 2] | 0 | 0, $1_1 | 0, i64toi32_i32$0 | 0, $2_1 | 0) | 0;
  i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$1;
  return i64toi32_i32$0 | 0;
 }
 
 function $138($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $4_1 = 0, $5_1 = 0, $3_1 = 0, $7_1 = 0, $8_1 = 0, $6_1 = 0, $9_1 = 0;
  $3_1 = global$0 - 32 | 0;
  global$0 = $3_1;
  $4_1 = HEAP32[($0_1 + 28 | 0) >> 2] | 0;
  HEAP32[($3_1 + 16 | 0) >> 2] = $4_1;
  $5_1 = HEAP32[($0_1 + 20 | 0) >> 2] | 0;
  HEAP32[($3_1 + 28 | 0) >> 2] = $2_1;
  HEAP32[($3_1 + 24 | 0) >> 2] = $1_1;
  $1_1 = $5_1 - $4_1 | 0;
  HEAP32[($3_1 + 20 | 0) >> 2] = $1_1;
  $6_1 = $1_1 + $2_1 | 0;
  block5 : {
   block4 : {
    block2 : {
     block1 : {
      block : {
       $4_1 = ($5_1 | 0) == ($4_1 | 0);
       $5_1 = $4_1 ? $3_1 + 16 | 0 | 8 | 0 : $3_1 + 16 | 0;
       $7_1 = $4_1 ? 1 : 2;
       if (!($181(fimport$3(HEAP32[($0_1 + 60 | 0) >> 2] | 0 | 0, $5_1 | 0, $7_1 | 0, $3_1 + 12 | 0 | 0) | 0 | 0) | 0)) {
        break block
       }
       $1_1 = $5_1;
       break block1;
      }
      label : while (1) {
       $4_1 = HEAP32[($3_1 + 12 | 0) >> 2] | 0;
       if (($6_1 | 0) == ($4_1 | 0)) {
        break block2
       }
       block3 : {
        if (($4_1 | 0) > (-1 | 0)) {
         break block3
        }
        $1_1 = $5_1;
        break block4;
       }
       $8_1 = HEAP32[($5_1 + 4 | 0) >> 2] | 0;
       $9_1 = $4_1 >>> 0 > $8_1 >>> 0;
       $1_1 = $5_1 + ($9_1 ? 8 : 0) | 0;
       $8_1 = $4_1 - ($9_1 ? $8_1 : 0) | 0;
       HEAP32[$1_1 >> 2] = (HEAP32[$1_1 >> 2] | 0) + $8_1 | 0;
       $5_1 = $5_1 + ($9_1 ? 12 : 4) | 0;
       HEAP32[$5_1 >> 2] = (HEAP32[$5_1 >> 2] | 0) - $8_1 | 0;
       $6_1 = $6_1 - $4_1 | 0;
       $5_1 = $1_1;
       $7_1 = $7_1 - $9_1 | 0;
       if (!($181(fimport$3(HEAP32[($0_1 + 60 | 0) >> 2] | 0 | 0, $5_1 | 0, $7_1 | 0, $3_1 + 12 | 0 | 0) | 0 | 0) | 0)) {
        continue label
       }
       break label;
      };
     }
     if (($6_1 | 0) != (-1 | 0)) {
      break block4
     }
    }
    $4_1 = HEAP32[($0_1 + 44 | 0) >> 2] | 0;
    HEAP32[($0_1 + 28 | 0) >> 2] = $4_1;
    HEAP32[($0_1 + 20 | 0) >> 2] = $4_1;
    HEAP32[($0_1 + 16 | 0) >> 2] = $4_1 + (HEAP32[($0_1 + 48 | 0) >> 2] | 0) | 0;
    $4_1 = $2_1;
    break block5;
   }
   $4_1 = 0;
   HEAP32[($0_1 + 28 | 0) >> 2] = 0;
   HEAP32[($0_1 + 16 | 0) >> 2] = 0;
   HEAP32[($0_1 + 20 | 0) >> 2] = 0;
   HEAP32[$0_1 >> 2] = HEAP32[$0_1 >> 2] | 0 | 32 | 0;
   if (($7_1 | 0) == (2 | 0)) {
    break block5
   }
   $4_1 = $2_1 - (HEAP32[($1_1 + 4 | 0) >> 2] | 0) | 0;
  }
  global$0 = $3_1 + 32 | 0;
  return $4_1 | 0;
 }
 
 function $139($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $5_1 = 0, $3_1 = 0, $4_1 = 0, $6_1 = 0;
  $3_1 = global$0 - 32 | 0;
  global$0 = $3_1;
  HEAP32[($3_1 + 16 | 0) >> 2] = $1_1;
  $4_1 = 0;
  $5_1 = HEAP32[($0_1 + 48 | 0) >> 2] | 0;
  HEAP32[($3_1 + 20 | 0) >> 2] = $2_1 - (($5_1 | 0) != (0 | 0)) | 0;
  $6_1 = HEAP32[($0_1 + 44 | 0) >> 2] | 0;
  HEAP32[($3_1 + 28 | 0) >> 2] = $5_1;
  HEAP32[($3_1 + 24 | 0) >> 2] = $6_1;
  $5_1 = 32;
  block2 : {
   block1 : {
    block : {
     if ($181(fimport$4(HEAP32[($0_1 + 60 | 0) >> 2] | 0 | 0, $3_1 + 16 | 0 | 0, 2 | 0, $3_1 + 12 | 0 | 0) | 0 | 0) | 0) {
      break block
     }
     $5_1 = HEAP32[($3_1 + 12 | 0) >> 2] | 0;
     if (($5_1 | 0) > (0 | 0)) {
      break block1
     }
     $5_1 = $5_1 ? 32 : 16;
    }
    HEAP32[$0_1 >> 2] = HEAP32[$0_1 >> 2] | 0 | $5_1 | 0;
    break block2;
   }
   $4_1 = $5_1;
   $6_1 = HEAP32[($3_1 + 20 | 0) >> 2] | 0;
   if ($5_1 >>> 0 <= $6_1 >>> 0) {
    break block2
   }
   $4_1 = HEAP32[($0_1 + 44 | 0) >> 2] | 0;
   HEAP32[($0_1 + 4 | 0) >> 2] = $4_1;
   HEAP32[($0_1 + 8 | 0) >> 2] = $4_1 + ($5_1 - $6_1 | 0) | 0;
   block3 : {
    if (!(HEAP32[($0_1 + 48 | 0) >> 2] | 0)) {
     break block3
    }
    HEAP32[($0_1 + 4 | 0) >> 2] = $4_1 + 1 | 0;
    HEAP8[(($1_1 + $2_1 | 0) + -1 | 0) >> 0] = HEAPU8[$4_1 >> 0] | 0;
   }
   $4_1 = $2_1;
  }
  global$0 = $3_1 + 32 | 0;
  return $4_1 | 0;
 }
 
 function $140($0_1) {
  $0_1 = $0_1 | 0;
  return $0_1 | 0;
 }
 
 function $141($0_1) {
  $0_1 = $0_1 | 0;
  return $181(fimport$5($140(HEAP32[($0_1 + 60 | 0) >> 2] | 0 | 0) | 0 | 0) | 0 | 0) | 0 | 0;
 }
 
 function $142($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $3_1 = 0, $2_1 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $2_1 = global$0 - 32 | 0;
  global$0 = $2_1;
  block3 : {
   block2 : {
    block1 : {
     block : {
      if ($166(65776 | 0, HEAP8[$1_1 >> 0] | 0 | 0) | 0) {
       break block
      }
      (wasm2js_i32$0 = $134() | 0, wasm2js_i32$1 = 28), HEAP32[wasm2js_i32$0 >> 2] = wasm2js_i32$1;
      break block1;
     }
     $3_1 = $182(1176 | 0) | 0;
     if ($3_1) {
      break block2
     }
    }
    $3_1 = 0;
    break block3;
   }
   $136($3_1 | 0, 0 | 0, 144 | 0) | 0;
   block4 : {
    if ($166($1_1 | 0, 43 | 0) | 0) {
     break block4
    }
    HEAP32[$3_1 >> 2] = (HEAPU8[$1_1 >> 0] | 0 | 0) == (114 | 0) ? 8 : 4;
   }
   block6 : {
    block5 : {
     if ((HEAPU8[$1_1 >> 0] | 0 | 0) == (97 | 0)) {
      break block5
     }
     $1_1 = HEAP32[$3_1 >> 2] | 0;
     break block6;
    }
    block7 : {
     $1_1 = fimport$1($0_1 | 0, 3 | 0, 0 | 0) | 0;
     if ($1_1 & 1024 | 0) {
      break block7
     }
     HEAP32[($2_1 + 16 | 0) >> 2] = $1_1 | 1024 | 0;
     fimport$1($0_1 | 0, 4 | 0, $2_1 + 16 | 0 | 0) | 0;
    }
    $1_1 = HEAP32[$3_1 >> 2] | 0 | 128 | 0;
    HEAP32[$3_1 >> 2] = $1_1;
   }
   HEAP32[($3_1 + 80 | 0) >> 2] = -1;
   HEAP32[($3_1 + 48 | 0) >> 2] = 1024;
   HEAP32[($3_1 + 60 | 0) >> 2] = $0_1;
   HEAP32[($3_1 + 44 | 0) >> 2] = $3_1 + 152 | 0;
   block8 : {
    if ($1_1 & 8 | 0) {
     break block8
    }
    HEAP32[$2_1 >> 2] = $2_1 + 24 | 0;
    if (fimport$2($0_1 | 0, 21523 | 0, $2_1 | 0) | 0) {
     break block8
    }
    HEAP32[($3_1 + 80 | 0) >> 2] = 10;
   }
   HEAP32[($3_1 + 40 | 0) >> 2] = 11;
   HEAP32[($3_1 + 36 | 0) >> 2] = 12;
   HEAP32[($3_1 + 32 | 0) >> 2] = 13;
   HEAP32[($3_1 + 12 | 0) >> 2] = 14;
   block9 : {
    if (HEAPU8[(0 + 77081 | 0) >> 0] | 0) {
     break block9
    }
    HEAP32[($3_1 + 76 | 0) >> 2] = -1;
   }
   $3_1 = $157($3_1 | 0) | 0;
  }
  global$0 = $2_1 + 32 | 0;
  return $3_1 | 0;
 }
 
 function $143($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0, $4_1 = 0, $3_1 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $2_1 = global$0 - 16 | 0;
  global$0 = $2_1;
  block2 : {
   block1 : {
    block : {
     if ($166(65776 | 0, HEAP8[$1_1 >> 0] | 0 | 0) | 0) {
      break block
     }
     (wasm2js_i32$0 = $134() | 0, wasm2js_i32$1 = 28), HEAP32[wasm2js_i32$0 >> 2] = wasm2js_i32$1;
     break block1;
    }
    $3_1 = $135($1_1 | 0) | 0;
    HEAP32[$2_1 >> 2] = 438;
    $4_1 = 0;
    $0_1 = $180(fimport$0(-100 | 0, $0_1 | 0, $3_1 | 32768 | 0 | 0, $2_1 | 0) | 0 | 0) | 0;
    if (($0_1 | 0) < (0 | 0)) {
     break block2
    }
    $4_1 = $142($0_1 | 0, $1_1 | 0) | 0;
    if ($4_1) {
     break block2
    }
    fimport$5($0_1 | 0) | 0;
   }
   $4_1 = 0;
  }
  global$0 = $2_1 + 16 | 0;
  return $4_1 | 0;
 }
 
 function $144($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  if ($2_1) {
   wasm2js_memory_copy($0_1, $1_1, $2_1)
  }
  return $0_1 | 0;
 }
 
 function $145($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, $4_1 = 0, $5_1 = 0;
  block : {
   if ($2_1 >>> 0 < 512 >>> 0) {
    break block
   }
   return $144($0_1 | 0, $1_1 | 0, $2_1 | 0) | 0 | 0;
  }
  $3_1 = $0_1 + $2_1 | 0;
  block6 : {
   block1 : {
    if (($1_1 ^ $0_1 | 0) & 3 | 0) {
     break block1
    }
    block3 : {
     block2 : {
      if ($0_1 & 3 | 0) {
       break block2
      }
      $2_1 = $0_1;
      break block3;
     }
     block4 : {
      if ($2_1) {
       break block4
      }
      $2_1 = $0_1;
      break block3;
     }
     $2_1 = $0_1;
     label : while (1) {
      HEAP8[$2_1 >> 0] = HEAPU8[$1_1 >> 0] | 0;
      $1_1 = $1_1 + 1 | 0;
      $2_1 = $2_1 + 1 | 0;
      if (!($2_1 & 3 | 0)) {
       break block3
      }
      if ($2_1 >>> 0 < $3_1 >>> 0) {
       continue label
      }
      break label;
     };
    }
    $4_1 = $3_1 & -4 | 0;
    block5 : {
     if ($3_1 >>> 0 < 64 >>> 0) {
      break block5
     }
     $5_1 = $4_1 + -64 | 0;
     if ($2_1 >>> 0 > $5_1 >>> 0) {
      break block5
     }
     label1 : while (1) {
      HEAP32[$2_1 >> 2] = HEAP32[$1_1 >> 2] | 0;
      HEAP32[($2_1 + 4 | 0) >> 2] = HEAP32[($1_1 + 4 | 0) >> 2] | 0;
      HEAP32[($2_1 + 8 | 0) >> 2] = HEAP32[($1_1 + 8 | 0) >> 2] | 0;
      HEAP32[($2_1 + 12 | 0) >> 2] = HEAP32[($1_1 + 12 | 0) >> 2] | 0;
      HEAP32[($2_1 + 16 | 0) >> 2] = HEAP32[($1_1 + 16 | 0) >> 2] | 0;
      HEAP32[($2_1 + 20 | 0) >> 2] = HEAP32[($1_1 + 20 | 0) >> 2] | 0;
      HEAP32[($2_1 + 24 | 0) >> 2] = HEAP32[($1_1 + 24 | 0) >> 2] | 0;
      HEAP32[($2_1 + 28 | 0) >> 2] = HEAP32[($1_1 + 28 | 0) >> 2] | 0;
      HEAP32[($2_1 + 32 | 0) >> 2] = HEAP32[($1_1 + 32 | 0) >> 2] | 0;
      HEAP32[($2_1 + 36 | 0) >> 2] = HEAP32[($1_1 + 36 | 0) >> 2] | 0;
      HEAP32[($2_1 + 40 | 0) >> 2] = HEAP32[($1_1 + 40 | 0) >> 2] | 0;
      HEAP32[($2_1 + 44 | 0) >> 2] = HEAP32[($1_1 + 44 | 0) >> 2] | 0;
      HEAP32[($2_1 + 48 | 0) >> 2] = HEAP32[($1_1 + 48 | 0) >> 2] | 0;
      HEAP32[($2_1 + 52 | 0) >> 2] = HEAP32[($1_1 + 52 | 0) >> 2] | 0;
      HEAP32[($2_1 + 56 | 0) >> 2] = HEAP32[($1_1 + 56 | 0) >> 2] | 0;
      HEAP32[($2_1 + 60 | 0) >> 2] = HEAP32[($1_1 + 60 | 0) >> 2] | 0;
      $1_1 = $1_1 + 64 | 0;
      $2_1 = $2_1 + 64 | 0;
      if ($2_1 >>> 0 <= $5_1 >>> 0) {
       continue label1
      }
      break label1;
     };
    }
    if ($2_1 >>> 0 >= $4_1 >>> 0) {
     break block6
    }
    label2 : while (1) {
     HEAP32[$2_1 >> 2] = HEAP32[$1_1 >> 2] | 0;
     $1_1 = $1_1 + 4 | 0;
     $2_1 = $2_1 + 4 | 0;
     if ($2_1 >>> 0 < $4_1 >>> 0) {
      continue label2
     }
     break block6;
    };
   }
   block7 : {
    if ($3_1 >>> 0 >= 4 >>> 0) {
     break block7
    }
    $2_1 = $0_1;
    break block6;
   }
   block8 : {
    if ($2_1 >>> 0 >= 4 >>> 0) {
     break block8
    }
    $2_1 = $0_1;
    break block6;
   }
   $4_1 = $3_1 + -4 | 0;
   $2_1 = $0_1;
   label3 : while (1) {
    HEAP8[$2_1 >> 0] = HEAPU8[$1_1 >> 0] | 0;
    HEAP8[($2_1 + 1 | 0) >> 0] = HEAPU8[($1_1 + 1 | 0) >> 0] | 0;
    HEAP8[($2_1 + 2 | 0) >> 0] = HEAPU8[($1_1 + 2 | 0) >> 0] | 0;
    HEAP8[($2_1 + 3 | 0) >> 0] = HEAPU8[($1_1 + 3 | 0) >> 0] | 0;
    $1_1 = $1_1 + 4 | 0;
    $2_1 = $2_1 + 4 | 0;
    if ($2_1 >>> 0 <= $4_1 >>> 0) {
     continue label3
    }
    break label3;
   };
  }
  block9 : {
   if ($2_1 >>> 0 >= $3_1 >>> 0) {
    break block9
   }
   label4 : while (1) {
    HEAP8[$2_1 >> 0] = HEAPU8[$1_1 >> 0] | 0;
    $1_1 = $1_1 + 1 | 0;
    $2_1 = $2_1 + 1 | 0;
    if (($2_1 | 0) != ($3_1 | 0)) {
     continue label4
    }
    break label4;
   };
  }
  return $0_1 | 0;
 }
 
 function $146($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, $2_1 = 0;
  $1_1 = HEAP32[($0_1 + 72 | 0) >> 2] | 0;
  HEAP32[($0_1 + 72 | 0) >> 2] = $1_1 + -1 | 0 | $1_1 | 0;
  block : {
   if ((HEAP32[($0_1 + 20 | 0) >> 2] | 0 | 0) == (HEAP32[($0_1 + 28 | 0) >> 2] | 0 | 0)) {
    break block
   }
   FUNCTION_TABLE[HEAP32[($0_1 + 36 | 0) >> 2] | 0 | 0]($0_1, 0, 0) | 0;
  }
  HEAP32[($0_1 + 28 | 0) >> 2] = 0;
  HEAP32[($0_1 + 16 | 0) >> 2] = 0;
  HEAP32[($0_1 + 20 | 0) >> 2] = 0;
  block1 : {
   $1_1 = HEAP32[$0_1 >> 2] | 0;
   if (!($1_1 & 4 | 0)) {
    break block1
   }
   HEAP32[$0_1 >> 2] = $1_1 | 32 | 0;
   return -1 | 0;
  }
  $2_1 = (HEAP32[($0_1 + 44 | 0) >> 2] | 0) + (HEAP32[($0_1 + 48 | 0) >> 2] | 0) | 0;
  HEAP32[($0_1 + 8 | 0) >> 2] = $2_1;
  HEAP32[($0_1 + 4 | 0) >> 2] = $2_1;
  return ($1_1 << 27 | 0) >> 31 | 0 | 0;
 }
 
 function $147($0_1, $1_1, $2_1, $3_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  var $4_1 = 0, $6_1 = 0, $5_1 = 0;
  $4_1 = HEAP32[($3_1 + 72 | 0) >> 2] | 0;
  HEAP32[($3_1 + 72 | 0) >> 2] = $4_1 + -1 | 0 | $4_1 | 0;
  $5_1 = Math_imul($2_1, $1_1);
  block1 : {
   block : {
    $4_1 = HEAP32[($3_1 + 4 | 0) >> 2] | 0;
    $6_1 = HEAP32[($3_1 + 8 | 0) >> 2] | 0;
    if (($4_1 | 0) != ($6_1 | 0)) {
     break block
    }
    $4_1 = $5_1;
    break block1;
   }
   $6_1 = $6_1 - $4_1 | 0;
   $6_1 = $6_1 >>> 0 < $5_1 >>> 0 ? $6_1 : $5_1;
   $145($0_1 | 0, $4_1 | 0, $6_1 | 0) | 0;
   HEAP32[($3_1 + 4 | 0) >> 2] = $4_1 + $6_1 | 0;
   $4_1 = $5_1 - $6_1 | 0;
   $0_1 = $0_1 + $6_1 | 0;
  }
  $6_1 = $1_1 ? $2_1 : 0;
  block2 : {
   if (!$4_1) {
    break block2
   }
   label : while (1) {
    block4 : {
     block3 : {
      if ($146($3_1 | 0) | 0) {
       break block3
      }
      $2_1 = FUNCTION_TABLE[HEAP32[($3_1 + 32 | 0) >> 2] | 0 | 0]($3_1, $0_1, $4_1) | 0;
      if ($2_1) {
       break block4
      }
     }
     return (($5_1 - $4_1 | 0) >>> 0) / ($1_1 >>> 0) | 0 | 0;
    }
    $0_1 = $0_1 + $2_1 | 0;
    $4_1 = $4_1 - $2_1 | 0;
    if ($4_1) {
     continue label
    }
    break label;
   };
  }
  return $6_1 | 0;
 }
 
 function $148($0_1, $1_1, $1$hi, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $1$hi = $1$hi | 0;
  $2_1 = $2_1 | 0;
  var i64toi32_i32$5 = 0, i64toi32_i32$0 = 0, i64toi32_i32$2 = 0, i64toi32_i32$1 = 0, i64toi32_i32$3 = 0, $3_1 = 0, $12_1 = 0, $13_1 = 0, $14_1 = 0, $18_1 = 0, $18$hi = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  block1 : {
   block : {
    if ($2_1 >>> 0 < 3 >>> 0) {
     break block
    }
    (wasm2js_i32$0 = $134() | 0, wasm2js_i32$1 = 28), HEAP32[wasm2js_i32$0 >> 2] = wasm2js_i32$1;
    break block1;
   }
   block2 : {
    if (($2_1 | 0) != (1 | 0)) {
     break block2
    }
    $3_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
    if (!$3_1) {
     break block2
    }
    i64toi32_i32$0 = $1$hi;
    i64toi32_i32$1 = $3_1 - (HEAP32[($0_1 + 4 | 0) >> 2] | 0) | 0;
    i64toi32_i32$0 = i64toi32_i32$1 >> 31 | 0;
    $18_1 = i64toi32_i32$1;
    $18$hi = i64toi32_i32$0;
    i64toi32_i32$0 = $1$hi;
    i64toi32_i32$2 = $1_1;
    i64toi32_i32$1 = $18$hi;
    i64toi32_i32$3 = $18_1;
    i64toi32_i32$5 = (i64toi32_i32$2 >>> 0 < i64toi32_i32$3 >>> 0) + i64toi32_i32$1 | 0;
    i64toi32_i32$5 = i64toi32_i32$0 - i64toi32_i32$5 | 0;
    $1_1 = i64toi32_i32$2 - i64toi32_i32$3 | 0;
    $1$hi = i64toi32_i32$5;
   }
   block3 : {
    if ((HEAP32[($0_1 + 20 | 0) >> 2] | 0 | 0) == (HEAP32[($0_1 + 28 | 0) >> 2] | 0 | 0)) {
     break block3
    }
    FUNCTION_TABLE[HEAP32[($0_1 + 36 | 0) >> 2] | 0 | 0]($0_1, 0, 0) | 0;
    if (!(HEAP32[($0_1 + 20 | 0) >> 2] | 0)) {
     break block1
    }
   }
   HEAP32[($0_1 + 28 | 0) >> 2] = 0;
   i64toi32_i32$2 = $0_1;
   i64toi32_i32$5 = 0;
   HEAP32[($0_1 + 16 | 0) >> 2] = 0;
   HEAP32[($0_1 + 20 | 0) >> 2] = i64toi32_i32$5;
   i64toi32_i32$5 = $1$hi;
   i64toi32_i32$5 = FUNCTION_TABLE[HEAP32[($0_1 + 40 | 0) >> 2] | 0 | 0]($0_1, $1_1, i64toi32_i32$5, $2_1) | 0;
   i64toi32_i32$2 = i64toi32_i32$HIGH_BITS;
   i64toi32_i32$0 = i64toi32_i32$5;
   i64toi32_i32$5 = 0;
   i64toi32_i32$3 = 0;
   if ((i64toi32_i32$2 | 0) < (i64toi32_i32$5 | 0)) {
    $12_1 = 1
   } else {
    if ((i64toi32_i32$2 | 0) <= (i64toi32_i32$5 | 0)) {
     if (i64toi32_i32$0 >>> 0 >= i64toi32_i32$3 >>> 0) {
      $13_1 = 0
     } else {
      $13_1 = 1
     }
     $14_1 = $13_1;
    } else {
     $14_1 = 0
    }
    $12_1 = $14_1;
   }
   if ($12_1) {
    break block1
   }
   i64toi32_i32$2 = $0_1;
   i64toi32_i32$0 = 0;
   HEAP32[($0_1 + 4 | 0) >> 2] = 0;
   HEAP32[($0_1 + 8 | 0) >> 2] = i64toi32_i32$0;
   HEAP32[$0_1 >> 2] = (HEAP32[$0_1 >> 2] | 0) & -17 | 0;
   return 0 | 0;
  }
  return -1 | 0;
 }
 
 function $149($0_1, $1_1, $1$hi, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $1$hi = $1$hi | 0;
  $2_1 = $2_1 | 0;
  var i64toi32_i32$0 = 0;
  i64toi32_i32$0 = $1$hi;
  return $148($0_1 | 0, $1_1 | 0, i64toi32_i32$0 | 0, $2_1 | 0) | 0 | 0;
 }
 
 function $150($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var i64toi32_i32$1 = 0, i64toi32_i32$0 = 0;
  i64toi32_i32$1 = $1_1;
  i64toi32_i32$0 = i64toi32_i32$1 >> 31 | 0;
  return $149($0_1 | 0, i64toi32_i32$1 | 0, i64toi32_i32$0 | 0, $2_1 | 0) | 0 | 0;
 }
 
 function $151($0_1, $1_1, $1$hi, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $1$hi = $1$hi | 0;
  $2_1 = $2_1 | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$2 = 0, $3_1 = 0, i64toi32_i32$1 = 0, i64toi32_i32$3 = 0;
  $3_1 = global$0 - 16 | 0;
  global$0 = $3_1;
  i64toi32_i32$0 = $1$hi;
  $2_1 = $181($211($0_1 | 0, $1_1 | 0, i64toi32_i32$0 | 0, $2_1 & 255 | 0 | 0, $3_1 + 8 | 0 | 0) | 0 | 0) | 0;
  i64toi32_i32$2 = $3_1;
  i64toi32_i32$0 = HEAP32[(i64toi32_i32$2 + 8 | 0) >> 2] | 0;
  i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 12 | 0) >> 2] | 0;
  $1_1 = i64toi32_i32$0;
  $1$hi = i64toi32_i32$1;
  global$0 = i64toi32_i32$2 + 16 | 0;
  i64toi32_i32$1 = -1;
  i64toi32_i32$0 = $1$hi;
  i64toi32_i32$3 = $2_1 ? -1 : $1_1;
  i64toi32_i32$2 = $2_1 ? i64toi32_i32$1 : i64toi32_i32$0;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$2;
  return i64toi32_i32$3 | 0;
 }
 
 function $152($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, $4_1 = 0;
  block2 : {
   block1 : {
    block : {
     if ($2_1 >>> 0 < 4 >>> 0) {
      break block
     }
     if (($1_1 | $0_1 | 0) & 3 | 0) {
      break block1
     }
     label : while (1) {
      if ((HEAP32[$0_1 >> 2] | 0 | 0) != (HEAP32[$1_1 >> 2] | 0 | 0)) {
       break block1
      }
      $1_1 = $1_1 + 4 | 0;
      $0_1 = $0_1 + 4 | 0;
      $2_1 = $2_1 + -4 | 0;
      if ($2_1 >>> 0 > 3 >>> 0) {
       continue label
      }
      break label;
     };
    }
    if (!$2_1) {
     break block2
    }
   }
   block3 : {
    label1 : while (1) {
     $3_1 = HEAPU8[$0_1 >> 0] | 0;
     $4_1 = HEAPU8[$1_1 >> 0] | 0;
     if (($3_1 | 0) != ($4_1 | 0)) {
      break block3
     }
     $1_1 = $1_1 + 1 | 0;
     $0_1 = $0_1 + 1 | 0;
     $2_1 = $2_1 + -1 | 0;
     if (!$2_1) {
      break block2
     }
     continue label1;
    };
   }
   return $3_1 - $4_1 | 0 | 0;
  }
  return 0 | 0;
 }
 
 function $153($0_1) {
  $0_1 = $0_1 | 0;
 }
 
 function $154($0_1) {
  $0_1 = $0_1 | 0;
 }
 
 function $155() {
  $153(77136 | 0);
  return 77140 | 0;
 }
 
 function $156() {
  $154(77136 | 0);
 }
 
 function $157($0_1) {
  $0_1 = $0_1 | 0;
  var $2_1 = 0, $1_1 = 0;
  $1_1 = $155() | 0;
  $2_1 = HEAP32[$1_1 >> 2] | 0;
  HEAP32[($0_1 + 56 | 0) >> 2] = $2_1;
  block : {
   if (!$2_1) {
    break block
   }
   HEAP32[($2_1 + 52 | 0) >> 2] = $0_1;
  }
  HEAP32[$1_1 >> 2] = $0_1;
  $156();
  return $0_1 | 0;
 }
 
 function $158() {
  fimport$6();
  wasm2js_trap();
 }
 
 function $159($0_1, $1_1, $2_1) {
  $0_1 = +$0_1;
  $1_1 = +$1_1;
  $2_1 = $2_1 | 0;
  var $3_1 = 0.0, $5_1 = 0.0, $4_1 = 0.0;
  $3_1 = $0_1 * $0_1;
  $4_1 = $3_1 * ($3_1 * $3_1) * ($3_1 * 1.58969099521155e-10 + -2.5050760253406863e-08) + ($3_1 * ($3_1 * 2.7557313707070068e-06 + -1.984126982985795e-04) + .00833333333332249);
  $5_1 = $0_1 * $3_1;
  block : {
   if ($2_1) {
    break block
   }
   return +($5_1 * ($3_1 * $4_1 + -.16666666666666632) + $0_1);
  }
  return +($0_1 - ($3_1 * ($1_1 * .5 - $5_1 * $4_1) - $1_1 + $5_1 * .16666666666666632));
 }
 
 function $160($0_1, $1_1) {
  $0_1 = +$0_1;
  $1_1 = $1_1 | 0;
  var i64toi32_i32$4 = 0, i64toi32_i32$2 = 0, i64toi32_i32$1 = 0, i64toi32_i32$3 = 0, $8_1 = 0, $32_1 = 0.0, i64toi32_i32$0 = 0;
  block2 : {
   block : {
    if (($1_1 | 0) < (1024 | 0)) {
     break block
    }
    $0_1 = $0_1 * 8988465674311579538646525.0e283;
    block1 : {
     if ($1_1 >>> 0 >= 2047 >>> 0) {
      break block1
     }
     $1_1 = $1_1 + -1023 | 0;
     break block2;
    }
    $0_1 = $0_1 * 8988465674311579538646525.0e283;
    $1_1 = ($1_1 >>> 0 < 3069 >>> 0 ? $1_1 : 3069) + -2046 | 0;
    break block2;
   }
   if (($1_1 | 0) > (-1023 | 0)) {
    break block2
   }
   $0_1 = $0_1 * 2.004168360008973e-292;
   block3 : {
    if ($1_1 >>> 0 <= -1992 >>> 0) {
     break block3
    }
    $1_1 = $1_1 + 969 | 0;
    break block2;
   }
   $0_1 = $0_1 * 2.004168360008973e-292;
   $1_1 = ($1_1 >>> 0 > -2960 >>> 0 ? $1_1 : -2960) + 1938 | 0;
  }
  $32_1 = $0_1;
  i64toi32_i32$0 = 0;
  i64toi32_i32$2 = $1_1 + 1023 | 0;
  i64toi32_i32$1 = 0;
  i64toi32_i32$3 = 52;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
   $8_1 = 0;
  } else {
   i64toi32_i32$1 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$0 << i64toi32_i32$4 | 0) | 0;
   $8_1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
  }
  wasm2js_scratch_store_i32(0 | 0, $8_1 | 0);
  wasm2js_scratch_store_i32(1 | 0, i64toi32_i32$1 | 0);
  return +($32_1 * +wasm2js_scratch_load_f64());
 }
 
 function $161($0_1) {
  $0_1 = +$0_1;
  return +Math_floor($0_1);
 }
 
 function $162($0_1, $1_1, $2_1, $3_1, $4_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  $4_1 = $4_1 | 0;
  var $19_1 = 0.0, $11_1 = 0, $6_1 = 0, $5_1 = 0, $13_1 = 0, $7_1 = 0, $9_1 = 0, $18_1 = 0, $12_1 = 0, $20_1 = 0.0, $14_1 = 0, $10_1 = 0, $8_1 = 0, $21_1 = 0.0, $22_1 = 0.0, $16_1 = 0, $23_1 = 0.0, $152_1 = 0, $24_1 = 0.0, $164_1 = 0, $197_1 = 0, $17_1 = 0, $26_1 = 0.0, $403 = 0, $27_1 = 0.0, $415 = 0, $426 = 0, $15_1 = 0, $144_1 = 0, $190_1 = 0.0, $211_1 = 0, $214 = 0, $395 = 0;
  $5_1 = global$0 - 560 | 0;
  global$0 = $5_1;
  $6_1 = ($2_1 + -3 | 0 | 0) / (24 | 0) | 0;
  $7_1 = ($6_1 | 0) > (0 | 0) ? $6_1 : 0;
  $8_1 = Math_imul($7_1, -24) + $2_1 | 0;
  block : {
   $9_1 = HEAP32[(($4_1 << 2 | 0) + 70464 | 0) >> 2] | 0;
   $10_1 = $3_1 + -1 | 0;
   if (($9_1 + $10_1 | 0 | 0) < (0 | 0)) {
    break block
   }
   $11_1 = $9_1 + $3_1 | 0;
   $2_1 = $7_1 - $10_1 | 0;
   $6_1 = 0;
   label : while (1) {
    block2 : {
     block1 : {
      if (($2_1 | 0) >= (0 | 0)) {
       break block1
      }
      $19_1 = 0.0;
      break block2;
     }
     $19_1 = +(HEAP32[(($2_1 << 2 | 0) + 70480 | 0) >> 2] | 0 | 0);
    }
    HEAPF64[(($5_1 + 320 | 0) + ($6_1 << 3 | 0) | 0) >> 3] = $19_1;
    $2_1 = $2_1 + 1 | 0;
    $6_1 = $6_1 + 1 | 0;
    if (($6_1 | 0) != ($11_1 | 0)) {
     continue label
    }
    break label;
   };
  }
  $12_1 = $8_1 + -24 | 0;
  $11_1 = 0;
  $13_1 = ($9_1 | 0) > (0 | 0) ? $9_1 : 0;
  $14_1 = ($3_1 | 0) < (1 | 0);
  label2 : while (1) {
   block4 : {
    block3 : {
     if (!$14_1) {
      break block3
     }
     $19_1 = 0.0;
     break block4;
    }
    $6_1 = $11_1 + $10_1 | 0;
    $2_1 = 0;
    $19_1 = 0.0;
    label1 : while (1) {
     $19_1 = +HEAPF64[($0_1 + ($2_1 << 3 | 0) | 0) >> 3] * +HEAPF64[(($5_1 + 320 | 0) + (($6_1 - $2_1 | 0) << 3 | 0) | 0) >> 3] + $19_1;
     $2_1 = $2_1 + 1 | 0;
     if (($2_1 | 0) != ($3_1 | 0)) {
      continue label1
     }
     break label1;
    };
   }
   HEAPF64[($5_1 + ($11_1 << 3 | 0) | 0) >> 3] = $19_1;
   $2_1 = ($11_1 | 0) == ($13_1 | 0);
   $11_1 = $11_1 + 1 | 0;
   if (!$2_1) {
    continue label2
   }
   break label2;
  };
  $15_1 = 47 - $8_1 | 0;
  $16_1 = 48 - $8_1 | 0;
  $14_1 = ($7_1 << 2 | 0) + 70480 | 0;
  $11_1 = $9_1;
  block21 : {
   label10 : while (1) {
    $19_1 = +HEAPF64[($5_1 + ($11_1 << 3 | 0) | 0) >> 3];
    $2_1 = 0;
    $6_1 = $11_1;
    block5 : {
     if (($11_1 | 0) < (1 | 0)) {
      break block5
     }
     label3 : while (1) {
      $144_1 = ($5_1 + 480 | 0) + ($2_1 << 2 | 0) | 0;
      $23_1 = $19_1 * 5.9604644775390625e-08;
      if (Math_abs($23_1) < 2147483647.0) {
       $152_1 = ~~$23_1
      } else {
       $152_1 = -2147483648
      }
      $20_1 = +($152_1 | 0);
      $24_1 = $20_1 * -16777216.0 + $19_1;
      if (Math_abs($24_1) < 2147483647.0) {
       $164_1 = ~~$24_1
      } else {
       $164_1 = -2147483648
      }
      HEAP32[$144_1 >> 2] = $164_1;
      $19_1 = +HEAPF64[(($5_1 + ($6_1 << 3 | 0) | 0) + -8 | 0) >> 3] + $20_1;
      $6_1 = $6_1 + -1 | 0;
      $2_1 = $2_1 + 1 | 0;
      if (($2_1 | 0) != ($11_1 | 0)) {
       continue label3
      }
      break label3;
     };
    }
    $19_1 = +$160(+$19_1, $12_1 | 0);
    $19_1 = $19_1 + +$161(+($19_1 * .125)) * -8.0;
    $190_1 = $19_1;
    if (Math_abs($19_1) < 2147483647.0) {
     $197_1 = ~~$19_1
    } else {
     $197_1 = -2147483648
    }
    $7_1 = $197_1;
    $19_1 = $190_1 - +($7_1 | 0);
    block9 : {
     block10 : {
      block8 : {
       block7 : {
        block6 : {
         $17_1 = ($12_1 | 0) < (1 | 0);
         if ($17_1) {
          break block6
         }
         $2_1 = (($5_1 + 480 | 0) + ($11_1 << 2 | 0) | 0) + -4 | 0;
         $211_1 = $2_1;
         $2_1 = HEAP32[$2_1 >> 2] | 0;
         $214 = $2_1;
         $2_1 = $2_1 >> $16_1 | 0;
         $6_1 = $214 - ($2_1 << $16_1 | 0) | 0;
         HEAP32[$211_1 >> 2] = $6_1;
         $18_1 = $6_1 >> $15_1 | 0;
         $7_1 = $2_1 + $7_1 | 0;
         break block7;
        }
        if ($12_1) {
         break block8
        }
        $18_1 = (HEAP32[((($5_1 + 480 | 0) + ($11_1 << 2 | 0) | 0) + -4 | 0) >> 2] | 0) >> 23 | 0;
       }
       if (($18_1 | 0) < (1 | 0)) {
        break block9
       }
       break block10;
      }
      $18_1 = 2;
      if ($19_1 >= .5) {
       break block10
      }
      $18_1 = 0;
      break block9;
     }
     $2_1 = 0;
     $13_1 = 0;
     $6_1 = 1;
     block11 : {
      if (($11_1 | 0) < (1 | 0)) {
       break block11
      }
      label4 : while (1) {
       $10_1 = ($5_1 + 480 | 0) + ($2_1 << 2 | 0) | 0;
       $6_1 = HEAP32[$10_1 >> 2] | 0;
       block15 : {
        block14 : {
         block13 : {
          block12 : {
           if (!$13_1) {
            break block12
           }
           $13_1 = 16777215;
           break block13;
          }
          if (!$6_1) {
           break block14
          }
          $13_1 = 16777216;
         }
         HEAP32[$10_1 >> 2] = $13_1 - $6_1 | 0;
         $13_1 = 1;
         $6_1 = 0;
         break block15;
        }
        $13_1 = 0;
        $6_1 = 1;
       }
       $2_1 = $2_1 + 1 | 0;
       if (($2_1 | 0) != ($11_1 | 0)) {
        continue label4
       }
       break label4;
      };
     }
     block16 : {
      if ($17_1) {
       break block16
      }
      $2_1 = 8388607;
      block17 : {
       switch ($12_1 + -1 | 0 | 0) {
       case 1:
        $2_1 = 4194303;
        break;
       case 0:
        break block17;
       default:
        break block16;
       };
      }
      $13_1 = (($5_1 + 480 | 0) + ($11_1 << 2 | 0) | 0) + -4 | 0;
      HEAP32[$13_1 >> 2] = (HEAP32[$13_1 >> 2] | 0) & $2_1 | 0;
     }
     $7_1 = $7_1 + 1 | 0;
     if (($18_1 | 0) != (2 | 0)) {
      break block9
     }
     $19_1 = 1.0 - $19_1;
     $18_1 = 2;
     if ($6_1) {
      break block9
     }
     $19_1 = $19_1 - +$160(+(1.0), $12_1 | 0);
    }
    block19 : {
     if ($19_1 != 0.0) {
      break block19
     }
     $6_1 = 0;
     $2_1 = $11_1;
     block20 : {
      if (($2_1 | 0) <= ($9_1 | 0)) {
       break block20
      }
      label5 : while (1) {
       $2_1 = $2_1 + -1 | 0;
       $6_1 = HEAP32[(($5_1 + 480 | 0) + ($2_1 << 2 | 0) | 0) >> 2] | 0 | $6_1 | 0;
       if (($2_1 | 0) > ($9_1 | 0)) {
        continue label5
       }
       break label5;
      };
      if (!$6_1) {
       break block20
      }
      label6 : while (1) {
       $12_1 = $12_1 + -24 | 0;
       $11_1 = $11_1 + -1 | 0;
       if (!(HEAP32[(($5_1 + 480 | 0) + ($11_1 << 2 | 0) | 0) >> 2] | 0)) {
        continue label6
       }
       break block21;
      };
     }
     $2_1 = 1;
     label7 : while (1) {
      $6_1 = $2_1;
      $2_1 = $2_1 + 1 | 0;
      if (!(HEAP32[(($5_1 + 480 | 0) + (($9_1 - $6_1 | 0) << 2 | 0) | 0) >> 2] | 0)) {
       continue label7
      }
      break label7;
     };
     $13_1 = $6_1 + $11_1 | 0;
     label9 : while (1) {
      $6_1 = $11_1 + $3_1 | 0;
      $11_1 = $11_1 + 1 | 0;
      HEAPF64[(($5_1 + 320 | 0) + ($6_1 << 3 | 0) | 0) >> 3] = +(HEAP32[($14_1 + ($11_1 << 2 | 0) | 0) >> 2] | 0 | 0);
      $2_1 = 0;
      $19_1 = 0.0;
      block22 : {
       if (($3_1 | 0) < (1 | 0)) {
        break block22
       }
       label8 : while (1) {
        $19_1 = +HEAPF64[($0_1 + ($2_1 << 3 | 0) | 0) >> 3] * +HEAPF64[(($5_1 + 320 | 0) + (($6_1 - $2_1 | 0) << 3 | 0) | 0) >> 3] + $19_1;
        $2_1 = $2_1 + 1 | 0;
        if (($2_1 | 0) != ($3_1 | 0)) {
         continue label8
        }
        break label8;
       };
      }
      HEAPF64[($5_1 + ($11_1 << 3 | 0) | 0) >> 3] = $19_1;
      if (($11_1 | 0) < ($13_1 | 0)) {
       continue label9
      }
      break label9;
     };
     $11_1 = $13_1;
     continue label10;
    }
    break label10;
   };
   block24 : {
    block23 : {
     $19_1 = +$160(+$19_1, 24 - $8_1 | 0 | 0);
     if (!($19_1 >= 16777216.0)) {
      break block23
     }
     $395 = ($5_1 + 480 | 0) + ($11_1 << 2 | 0) | 0;
     $26_1 = $19_1 * 5.9604644775390625e-08;
     if (Math_abs($26_1) < 2147483647.0) {
      $403 = ~~$26_1
     } else {
      $403 = -2147483648
     }
     $2_1 = $403;
     $27_1 = +($2_1 | 0) * -16777216.0 + $19_1;
     if (Math_abs($27_1) < 2147483647.0) {
      $415 = ~~$27_1
     } else {
      $415 = -2147483648
     }
     HEAP32[$395 >> 2] = $415;
     $11_1 = $11_1 + 1 | 0;
     $12_1 = $8_1;
     break block24;
    }
    if (Math_abs($19_1) < 2147483647.0) {
     $426 = ~~$19_1
    } else {
     $426 = -2147483648
    }
    $2_1 = $426;
   }
   HEAP32[(($5_1 + 480 | 0) + ($11_1 << 2 | 0) | 0) >> 2] = $2_1;
  }
  $19_1 = +$160(+(1.0), $12_1 | 0);
  block25 : {
   if (($11_1 | 0) < (0 | 0)) {
    break block25
   }
   $3_1 = $11_1;
   label11 : while (1) {
    $2_1 = $3_1;
    HEAPF64[($5_1 + ($2_1 << 3 | 0) | 0) >> 3] = $19_1 * +(HEAP32[(($5_1 + 480 | 0) + ($2_1 << 2 | 0) | 0) >> 2] | 0 | 0);
    $3_1 = $2_1 + -1 | 0;
    $19_1 = $19_1 * 5.9604644775390625e-08;
    if ($2_1) {
     continue label11
    }
    break label11;
   };
   $13_1 = $11_1;
   label13 : while (1) {
    block27 : {
     block26 : {
      $14_1 = $11_1 - $13_1 | 0;
      $6_1 = ($9_1 | 0) < ($14_1 | 0) ? $9_1 : $14_1;
      if (($6_1 | 0) >= (0 | 0)) {
       break block26
      }
      $19_1 = 0.0;
      break block27;
     }
     $0_1 = $5_1 + ($13_1 << 3 | 0) | 0;
     $2_1 = 0;
     $19_1 = 0.0;
     label12 : while (1) {
      $3_1 = $2_1 << 3 | 0;
      $19_1 = +HEAPF64[($3_1 + 73248 | 0) >> 3] * +HEAPF64[($0_1 + $3_1 | 0) >> 3] + $19_1;
      $3_1 = ($2_1 | 0) != ($6_1 | 0);
      $2_1 = $2_1 + 1 | 0;
      if ($3_1) {
       continue label12
      }
      break label12;
     };
    }
    HEAPF64[(($5_1 + 160 | 0) + ($14_1 << 3 | 0) | 0) >> 3] = $19_1;
    $2_1 = ($13_1 | 0) > (0 | 0);
    $13_1 = $13_1 + -1 | 0;
    if ($2_1) {
     continue label13
    }
    break label13;
   };
  }
  block31 : {
   block33 : {
    block29 : {
     switch ($4_1 | 0) {
     case 3:
      $21_1 = 0.0;
      block32 : {
       if (($11_1 | 0) <= (0 | 0)) {
        break block32
       }
       $2_1 = $11_1;
       label14 : while (1) {
        $3_1 = ($5_1 + 160 | 0) + ($2_1 << 3 | 0) | 0;
        $6_1 = $3_1 + -8 | 0;
        $19_1 = +HEAPF64[$6_1 >> 3];
        $20_1 = +HEAPF64[$3_1 >> 3];
        $22_1 = $19_1 + $20_1;
        HEAPF64[$6_1 >> 3] = $22_1;
        HEAPF64[$3_1 >> 3] = $20_1 + ($19_1 - $22_1);
        $3_1 = $2_1 >>> 0 > 1 >>> 0;
        $2_1 = $2_1 + -1 | 0;
        if ($3_1) {
         continue label14
        }
        break label14;
       };
       if (($11_1 | 0) == (1 | 0)) {
        break block32
       }
       $2_1 = $11_1;
       label15 : while (1) {
        $3_1 = ($5_1 + 160 | 0) + ($2_1 << 3 | 0) | 0;
        $6_1 = $3_1 + -8 | 0;
        $19_1 = +HEAPF64[$6_1 >> 3];
        $20_1 = +HEAPF64[$3_1 >> 3];
        $22_1 = $19_1 + $20_1;
        HEAPF64[$6_1 >> 3] = $22_1;
        HEAPF64[$3_1 >> 3] = $20_1 + ($19_1 - $22_1);
        $3_1 = $2_1 >>> 0 > 2 >>> 0;
        $2_1 = $2_1 + -1 | 0;
        if ($3_1) {
         continue label15
        }
        break label15;
       };
       $21_1 = 0.0;
       label16 : while (1) {
        $21_1 = $21_1 + +HEAPF64[(($5_1 + 160 | 0) + ($11_1 << 3 | 0) | 0) >> 3];
        $2_1 = $11_1 >>> 0 > 2 >>> 0;
        $11_1 = $11_1 + -1 | 0;
        if ($2_1) {
         continue label16
        }
        break label16;
       };
      }
      $19_1 = +HEAPF64[($5_1 + 160 | 0) >> 3];
      if ($18_1) {
       break block33
      }
      HEAPF64[$1_1 >> 3] = $19_1;
      $19_1 = +HEAPF64[($5_1 + 168 | 0) >> 3];
      HEAPF64[($1_1 + 16 | 0) >> 3] = $21_1;
      HEAPF64[($1_1 + 8 | 0) >> 3] = $19_1;
      break block31;
     case 0:
      $19_1 = 0.0;
      block34 : {
       if (($11_1 | 0) < (0 | 0)) {
        break block34
       }
       label17 : while (1) {
        $2_1 = $11_1;
        $11_1 = $2_1 + -1 | 0;
        $19_1 = $19_1 + +HEAPF64[(($5_1 + 160 | 0) + ($2_1 << 3 | 0) | 0) >> 3];
        if ($2_1) {
         continue label17
        }
        break label17;
       };
      }
      HEAPF64[$1_1 >> 3] = $18_1 ? -$19_1 : $19_1;
      break block31;
     case 1:
     case 2:
      break block29;
     default:
      break block31;
     };
    }
    $19_1 = 0.0;
    block35 : {
     if (($11_1 | 0) < (0 | 0)) {
      break block35
     }
     $3_1 = $11_1;
     label18 : while (1) {
      $2_1 = $3_1;
      $3_1 = $2_1 + -1 | 0;
      $19_1 = $19_1 + +HEAPF64[(($5_1 + 160 | 0) + ($2_1 << 3 | 0) | 0) >> 3];
      if ($2_1) {
       continue label18
      }
      break label18;
     };
    }
    HEAPF64[$1_1 >> 3] = $18_1 ? -$19_1 : $19_1;
    $19_1 = +HEAPF64[($5_1 + 160 | 0) >> 3] - $19_1;
    $2_1 = 1;
    block36 : {
     if (($11_1 | 0) < (1 | 0)) {
      break block36
     }
     label19 : while (1) {
      $19_1 = $19_1 + +HEAPF64[(($5_1 + 160 | 0) + ($2_1 << 3 | 0) | 0) >> 3];
      $3_1 = ($2_1 | 0) != ($11_1 | 0);
      $2_1 = $2_1 + 1 | 0;
      if ($3_1) {
       continue label19
      }
      break label19;
     };
    }
    HEAPF64[($1_1 + 8 | 0) >> 3] = $18_1 ? -$19_1 : $19_1;
    break block31;
   }
   HEAPF64[$1_1 >> 3] = -$19_1;
   $19_1 = +HEAPF64[($5_1 + 168 | 0) >> 3];
   HEAPF64[($1_1 + 16 | 0) >> 3] = -$21_1;
   HEAPF64[($1_1 + 8 | 0) >> 3] = -$19_1;
  }
  global$0 = $5_1 + 560 | 0;
  return $7_1 & 7 | 0 | 0;
 }
 
 function $163($0_1, $1_1) {
  $0_1 = +$0_1;
  $1_1 = $1_1 | 0;
  var $9_1 = 0.0, i64toi32_i32$2 = 0, $3_1 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, i64toi32_i32$3 = 0, i64toi32_i32$4 = 0, $10_1 = 0.0, $2_1 = 0, $4_1 = 0, $11_1 = 0.0, $12_1 = 0.0, $5_1 = 0, $8_1 = 0, $8$hi = 0, $24_1 = 0, $25_1 = 0, $26_1 = 0, $27_1 = 0, $28_1 = 0, $29_1 = 0, $30_1 = 0, $31_1 = 0, $32_1 = 0, $33_1 = 0, $34_1 = 0, $35_1 = 0, $36_1 = 0, $148_1 = 0, $37_1 = 0, $38_1 = 0, $276 = 0, $39_1 = 0, $40_1 = 0, $41_1 = 0, $192_1 = 0, $218 = 0, $6_1 = 0, $269 = 0, $7_1 = 0;
  $2_1 = global$0 - 48 | 0;
  global$0 = $2_1;
  block4 : {
   block10 : {
    block1 : {
     block : {
      wasm2js_scratch_store_f64(+$0_1);
      i64toi32_i32$0 = wasm2js_scratch_load_i32(1 | 0) | 0;
      $8_1 = wasm2js_scratch_load_i32(0 | 0) | 0;
      $8$hi = i64toi32_i32$0;
      i64toi32_i32$2 = $8_1;
      i64toi32_i32$1 = 0;
      i64toi32_i32$3 = 32;
      i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
      if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
       i64toi32_i32$1 = 0;
       $24_1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
      } else {
       i64toi32_i32$1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
       $24_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$2 >>> i64toi32_i32$4 | 0) | 0;
      }
      $3_1 = $24_1;
      $4_1 = $3_1 & 2147483647 | 0;
      if ($4_1 >>> 0 > 1074752122 >>> 0) {
       break block
      }
      if (($3_1 & 1048575 | 0 | 0) == (598523 | 0)) {
       break block1
      }
      block2 : {
       if ($4_1 >>> 0 > 1073928572 >>> 0) {
        break block2
       }
       block3 : {
        i64toi32_i32$1 = $8$hi;
        i64toi32_i32$0 = $8_1;
        i64toi32_i32$2 = 0;
        i64toi32_i32$3 = 0;
        if ((i64toi32_i32$1 | 0) < (i64toi32_i32$2 | 0)) {
         $25_1 = 1
        } else {
         if ((i64toi32_i32$1 | 0) <= (i64toi32_i32$2 | 0)) {
          if (i64toi32_i32$0 >>> 0 >= i64toi32_i32$3 >>> 0) {
           $26_1 = 0
          } else {
           $26_1 = 1
          }
          $27_1 = $26_1;
         } else {
          $27_1 = 0
         }
         $25_1 = $27_1;
        }
        if ($25_1) {
         break block3
        }
        $0_1 = $0_1 + -1.5707963267341256;
        $9_1 = $0_1 + -6.077100506506192e-11;
        HEAPF64[$1_1 >> 3] = $9_1;
        HEAPF64[($1_1 + 8 | 0) >> 3] = $0_1 - $9_1 + -6.077100506506192e-11;
        $3_1 = 1;
        break block4;
       }
       $0_1 = $0_1 + 1.5707963267341256;
       $9_1 = $0_1 + 6.077100506506192e-11;
       HEAPF64[$1_1 >> 3] = $9_1;
       HEAPF64[($1_1 + 8 | 0) >> 3] = $0_1 - $9_1 + 6.077100506506192e-11;
       $3_1 = -1;
       break block4;
      }
      block5 : {
       i64toi32_i32$0 = $8$hi;
       i64toi32_i32$3 = $8_1;
       i64toi32_i32$1 = 0;
       i64toi32_i32$2 = 0;
       if ((i64toi32_i32$0 | 0) < (i64toi32_i32$1 | 0)) {
        $28_1 = 1
       } else {
        if ((i64toi32_i32$0 | 0) <= (i64toi32_i32$1 | 0)) {
         if (i64toi32_i32$3 >>> 0 >= i64toi32_i32$2 >>> 0) {
          $29_1 = 0
         } else {
          $29_1 = 1
         }
         $30_1 = $29_1;
        } else {
         $30_1 = 0
        }
        $28_1 = $30_1;
       }
       if ($28_1) {
        break block5
       }
       $0_1 = $0_1 + -3.1415926534682512;
       $9_1 = $0_1 + -1.2154201013012384e-10;
       HEAPF64[$1_1 >> 3] = $9_1;
       HEAPF64[($1_1 + 8 | 0) >> 3] = $0_1 - $9_1 + -1.2154201013012384e-10;
       $3_1 = 2;
       break block4;
      }
      $0_1 = $0_1 + 3.1415926534682512;
      $9_1 = $0_1 + 1.2154201013012384e-10;
      HEAPF64[$1_1 >> 3] = $9_1;
      HEAPF64[($1_1 + 8 | 0) >> 3] = $0_1 - $9_1 + 1.2154201013012384e-10;
      $3_1 = -2;
      break block4;
     }
     block6 : {
      if ($4_1 >>> 0 > 1075594811 >>> 0) {
       break block6
      }
      block7 : {
       if ($4_1 >>> 0 > 1075183036 >>> 0) {
        break block7
       }
       if (($4_1 | 0) == (1074977148 | 0)) {
        break block1
       }
       block8 : {
        i64toi32_i32$3 = $8$hi;
        i64toi32_i32$2 = $8_1;
        i64toi32_i32$0 = 0;
        i64toi32_i32$1 = 0;
        if ((i64toi32_i32$3 | 0) < (i64toi32_i32$0 | 0)) {
         $31_1 = 1
        } else {
         if ((i64toi32_i32$3 | 0) <= (i64toi32_i32$0 | 0)) {
          if (i64toi32_i32$2 >>> 0 >= i64toi32_i32$1 >>> 0) {
           $32_1 = 0
          } else {
           $32_1 = 1
          }
          $33_1 = $32_1;
         } else {
          $33_1 = 0
         }
         $31_1 = $33_1;
        }
        if ($31_1) {
         break block8
        }
        $0_1 = $0_1 + -4.712388980202377;
        $9_1 = $0_1 + -1.8231301519518578e-10;
        HEAPF64[$1_1 >> 3] = $9_1;
        HEAPF64[($1_1 + 8 | 0) >> 3] = $0_1 - $9_1 + -1.8231301519518578e-10;
        $3_1 = 3;
        break block4;
       }
       $0_1 = $0_1 + 4.712388980202377;
       $9_1 = $0_1 + 1.8231301519518578e-10;
       HEAPF64[$1_1 >> 3] = $9_1;
       HEAPF64[($1_1 + 8 | 0) >> 3] = $0_1 - $9_1 + 1.8231301519518578e-10;
       $3_1 = -3;
       break block4;
      }
      if (($4_1 | 0) == (1075388923 | 0)) {
       break block1
      }
      block9 : {
       i64toi32_i32$2 = $8$hi;
       i64toi32_i32$1 = $8_1;
       i64toi32_i32$3 = 0;
       i64toi32_i32$0 = 0;
       if ((i64toi32_i32$2 | 0) < (i64toi32_i32$3 | 0)) {
        $34_1 = 1
       } else {
        if ((i64toi32_i32$2 | 0) <= (i64toi32_i32$3 | 0)) {
         if (i64toi32_i32$1 >>> 0 >= i64toi32_i32$0 >>> 0) {
          $35_1 = 0
         } else {
          $35_1 = 1
         }
         $36_1 = $35_1;
        } else {
         $36_1 = 0
        }
        $34_1 = $36_1;
       }
       if ($34_1) {
        break block9
       }
       $0_1 = $0_1 + -6.2831853069365025;
       $9_1 = $0_1 + -2.430840202602477e-10;
       HEAPF64[$1_1 >> 3] = $9_1;
       HEAPF64[($1_1 + 8 | 0) >> 3] = $0_1 - $9_1 + -2.430840202602477e-10;
       $3_1 = 4;
       break block4;
      }
      $0_1 = $0_1 + 6.2831853069365025;
      $9_1 = $0_1 + 2.430840202602477e-10;
      HEAPF64[$1_1 >> 3] = $9_1;
      HEAPF64[($1_1 + 8 | 0) >> 3] = $0_1 - $9_1 + 2.430840202602477e-10;
      $3_1 = -4;
      break block4;
     }
     if ($4_1 >>> 0 > 1094263290 >>> 0) {
      break block10
     }
    }
    $10_1 = $0_1 * .6366197723675814 + 6755399441055744.0 + -6755399441055744.0;
    if (Math_abs($10_1) < 2147483647.0) {
     $148_1 = ~~$10_1
    } else {
     $148_1 = -2147483648
    }
    $3_1 = $148_1;
    block12 : {
     block11 : {
      $9_1 = $0_1 + $10_1 * -1.5707963267341256;
      $11_1 = $10_1 * 6.077100506506192e-11;
      $12_1 = $9_1 - $11_1;
      if (!($12_1 < -.7853981633974483)) {
       break block11
      }
      $3_1 = $3_1 + -1 | 0;
      $10_1 = $10_1 + -1.0;
      $11_1 = $10_1 * 6.077100506506192e-11;
      $9_1 = $0_1 + $10_1 * -1.5707963267341256;
      break block12;
     }
     if (!($12_1 > .7853981633974483)) {
      break block12
     }
     $3_1 = $3_1 + 1 | 0;
     $10_1 = $10_1 + 1.0;
     $11_1 = $10_1 * 6.077100506506192e-11;
     $9_1 = $0_1 + $10_1 * -1.5707963267341256;
    }
    $0_1 = $9_1 - $11_1;
    HEAPF64[$1_1 >> 3] = $0_1;
    block13 : {
     $5_1 = $4_1 >>> 20 | 0;
     $192_1 = $5_1;
     wasm2js_scratch_store_f64(+$0_1);
     i64toi32_i32$1 = wasm2js_scratch_load_i32(1 | 0) | 0;
     i64toi32_i32$0 = wasm2js_scratch_load_i32(0 | 0) | 0;
     i64toi32_i32$2 = 0;
     i64toi32_i32$3 = 52;
     i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
     if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
      i64toi32_i32$2 = 0;
      $37_1 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
     } else {
      i64toi32_i32$2 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
      $37_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$1 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$0 >>> i64toi32_i32$4 | 0) | 0;
     }
     if (($192_1 - ($37_1 & 2047 | 0) | 0 | 0) < (17 | 0)) {
      break block13
     }
     $0_1 = $10_1 * 6.077100506303966e-11;
     $12_1 = $9_1 - $0_1;
     $11_1 = $10_1 * 2.0222662487959506e-21 - ($9_1 - $12_1 - $0_1);
     $0_1 = $12_1 - $11_1;
     HEAPF64[$1_1 >> 3] = $0_1;
     block14 : {
      $218 = $5_1;
      wasm2js_scratch_store_f64(+$0_1);
      i64toi32_i32$2 = wasm2js_scratch_load_i32(1 | 0) | 0;
      i64toi32_i32$1 = wasm2js_scratch_load_i32(0 | 0) | 0;
      i64toi32_i32$0 = 0;
      i64toi32_i32$3 = 52;
      i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
      if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
       i64toi32_i32$0 = 0;
       $38_1 = i64toi32_i32$2 >>> i64toi32_i32$4 | 0;
      } else {
       i64toi32_i32$0 = i64toi32_i32$2 >>> i64toi32_i32$4 | 0;
       $38_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$2 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$1 >>> i64toi32_i32$4 | 0) | 0;
      }
      if (($218 - ($38_1 & 2047 | 0) | 0 | 0) >= (50 | 0)) {
       break block14
      }
      $9_1 = $12_1;
      break block13;
     }
     $0_1 = $10_1 * 2.0222662487111665e-21;
     $9_1 = $12_1 - $0_1;
     $11_1 = $10_1 * 8.4784276603689e-32 - ($12_1 - $9_1 - $0_1);
     $0_1 = $9_1 - $11_1;
     HEAPF64[$1_1 >> 3] = $0_1;
    }
    HEAPF64[($1_1 + 8 | 0) >> 3] = $9_1 - $0_1 - $11_1;
    break block4;
   }
   block15 : {
    if ($4_1 >>> 0 < 2146435072 >>> 0) {
     break block15
    }
    $0_1 = $0_1 - $0_1;
    HEAPF64[$1_1 >> 3] = $0_1;
    HEAPF64[($1_1 + 8 | 0) >> 3] = $0_1;
    $3_1 = 0;
    break block4;
   }
   $6_1 = $2_1 + 16 | 0 | 8 | 0;
   i64toi32_i32$0 = $8$hi;
   i64toi32_i32$2 = $8_1;
   i64toi32_i32$1 = 1048575;
   i64toi32_i32$3 = -1;
   i64toi32_i32$1 = i64toi32_i32$0 & i64toi32_i32$1 | 0;
   i64toi32_i32$0 = i64toi32_i32$2 & i64toi32_i32$3 | 0;
   i64toi32_i32$2 = 1096810496;
   i64toi32_i32$3 = 0;
   i64toi32_i32$2 = i64toi32_i32$1 | i64toi32_i32$2 | 0;
   wasm2js_scratch_store_i32(0 | 0, i64toi32_i32$0 | i64toi32_i32$3 | 0 | 0);
   wasm2js_scratch_store_i32(1 | 0, i64toi32_i32$2 | 0);
   $0_1 = +wasm2js_scratch_load_f64();
   $3_1 = $2_1 + 16 | 0;
   $5_1 = 1;
   label : while (1) {
    $269 = $3_1;
    if (Math_abs($0_1) < 2147483647.0) {
     $276 = ~~$0_1
    } else {
     $276 = -2147483648
    }
    $9_1 = +($276 | 0);
    HEAPF64[$269 >> 3] = $9_1;
    $0_1 = ($0_1 - $9_1) * 16777216.0;
    $7_1 = $5_1 & 1 | 0;
    $5_1 = 0;
    $3_1 = $6_1;
    if ($7_1) {
     continue label
    }
    break label;
   };
   HEAPF64[($2_1 + 32 | 0) >> 3] = $0_1;
   $3_1 = 2;
   label1 : while (1) {
    $5_1 = $3_1;
    $3_1 = $3_1 + -1 | 0;
    if (+HEAPF64[(($2_1 + 16 | 0) + ($5_1 << 3 | 0) | 0) >> 3] == 0.0) {
     continue label1
    }
    break label1;
   };
   $3_1 = $162($2_1 + 16 | 0 | 0, $2_1 | 0, ($4_1 >>> 20 | 0) + -1046 | 0 | 0, $5_1 + 1 | 0 | 0, 1 | 0) | 0;
   $0_1 = +HEAPF64[$2_1 >> 3];
   block16 : {
    i64toi32_i32$2 = $8$hi;
    i64toi32_i32$1 = $8_1;
    i64toi32_i32$0 = -1;
    i64toi32_i32$3 = -1;
    if ((i64toi32_i32$2 | 0) > (i64toi32_i32$0 | 0)) {
     $39_1 = 1
    } else {
     if ((i64toi32_i32$2 | 0) >= (i64toi32_i32$0 | 0)) {
      if (i64toi32_i32$1 >>> 0 <= i64toi32_i32$3 >>> 0) {
       $40_1 = 0
      } else {
       $40_1 = 1
      }
      $41_1 = $40_1;
     } else {
      $41_1 = 0
     }
     $39_1 = $41_1;
    }
    if ($39_1) {
     break block16
    }
    HEAPF64[$1_1 >> 3] = -$0_1;
    HEAPF64[($1_1 + 8 | 0) >> 3] = -+HEAPF64[($2_1 + 8 | 0) >> 3];
    $3_1 = 0 - $3_1 | 0;
    break block4;
   }
   HEAPF64[$1_1 >> 3] = $0_1;
   HEAPF64[($1_1 + 8 | 0) >> 3] = +HEAPF64[($2_1 + 8 | 0) >> 3];
  }
  global$0 = $2_1 + 48 | 0;
  return $3_1 | 0;
 }
 
 function $164($0_1, $1_1) {
  $0_1 = +$0_1;
  $1_1 = +$1_1;
  var $2_1 = 0.0, $3_1 = 0.0, $4_1 = 0.0, $16_1 = 0.0;
  $2_1 = $0_1 * $0_1;
  $3_1 = $2_1 * .5;
  $4_1 = 1.0 - $3_1;
  $16_1 = 1.0 - $4_1 - $3_1;
  $3_1 = $2_1 * $2_1;
  return +($4_1 + ($16_1 + ($2_1 * ($2_1 * ($2_1 * ($2_1 * 2.480158728947673e-05 + -.001388888888887411) + .0416666666666666) + $3_1 * $3_1 * ($2_1 * ($2_1 * -1.1359647557788195e-11 + 2.087572321298175e-09) + -2.7557314351390663e-07)) - $0_1 * $1_1)));
 }
 
 function $165($0_1) {
  $0_1 = +$0_1;
  var $1_1 = 0, i64toi32_i32$4 = 0, $2_1 = 0, $3_1 = 0.0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, i64toi32_i32$3 = 0, $9_1 = 0, i64toi32_i32$2 = 0;
  $1_1 = global$0 - 16 | 0;
  global$0 = $1_1;
  block1 : {
   block : {
    wasm2js_scratch_store_f64(+$0_1);
    i64toi32_i32$0 = wasm2js_scratch_load_i32(1 | 0) | 0;
    i64toi32_i32$2 = wasm2js_scratch_load_i32(0 | 0) | 0;
    i64toi32_i32$1 = 0;
    i64toi32_i32$3 = 32;
    i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
     i64toi32_i32$1 = 0;
     $9_1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
    } else {
     i64toi32_i32$1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
     $9_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$2 >>> i64toi32_i32$4 | 0) | 0;
    }
    $2_1 = $9_1 & 2147483647 | 0;
    if ($2_1 >>> 0 > 1072243195 >>> 0) {
     break block
    }
    if ($2_1 >>> 0 < 1045430272 >>> 0) {
     break block1
    }
    $0_1 = +$159(+$0_1, +(0.0), 0 | 0);
    break block1;
   }
   block2 : {
    if ($2_1 >>> 0 < 2146435072 >>> 0) {
     break block2
    }
    $0_1 = $0_1 - $0_1;
    break block1;
   }
   $2_1 = $163(+$0_1, $1_1 | 0) | 0;
   $0_1 = +HEAPF64[($1_1 + 8 | 0) >> 3];
   $3_1 = +HEAPF64[$1_1 >> 3];
   block6 : {
    switch ($2_1 & 3 | 0 | 0) {
    default:
     $0_1 = +$159(+$3_1, +$0_1, 1 | 0);
     break block1;
    case 1:
     $0_1 = +$164(+$3_1, +$0_1);
     break block1;
    case 2:
     $0_1 = -+$159(+$3_1, +$0_1, 1 | 0);
     break block1;
    case 3:
     break block6;
    };
   }
   $0_1 = -+$164(+$3_1, +$0_1);
  }
  global$0 = $1_1 + 16 | 0;
  return +$0_1;
 }
 
 function $166($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $0_1 = $167($0_1 | 0, $1_1 | 0) | 0;
  return ((HEAPU8[$0_1 >> 0] | 0 | 0) == ($1_1 & 255 | 0 | 0) ? $0_1 : 0) | 0;
 }
 
 function $167($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $3_1 = 0, $4_1 = 0, $2_1 = 0;
  block2 : {
   block4 : {
    block3 : {
     block : {
      $2_1 = $1_1 & 255 | 0;
      if (!$2_1) {
       break block
      }
      block1 : {
       if (!($0_1 & 3 | 0)) {
        break block1
       }
       $3_1 = $1_1 & 255 | 0;
       label : while (1) {
        $4_1 = HEAPU8[$0_1 >> 0] | 0;
        if (!$4_1) {
         break block2
        }
        if (($4_1 | 0) == ($3_1 | 0)) {
         break block2
        }
        $0_1 = $0_1 + 1 | 0;
        if ($0_1 & 3 | 0) {
         continue label
        }
        break label;
       };
      }
      $3_1 = HEAP32[$0_1 >> 2] | 0;
      if (((16843008 - $3_1 | 0 | $3_1 | 0) & -2139062144 | 0 | 0) != (-2139062144 | 0)) {
       break block3
      }
      $2_1 = Math_imul($2_1, 16843009);
      label1 : while (1) {
       $4_1 = $3_1 ^ $2_1 | 0;
       if (((16843008 - $4_1 | 0 | $4_1 | 0) & -2139062144 | 0 | 0) != (-2139062144 | 0)) {
        break block3
       }
       $3_1 = HEAP32[($0_1 + 4 | 0) >> 2] | 0;
       $4_1 = $0_1 + 4 | 0;
       $0_1 = $4_1;
       if ((($3_1 | (16843008 - $3_1 | 0) | 0) & -2139062144 | 0 | 0) == (-2139062144 | 0)) {
        continue label1
       }
       break block4;
      };
     }
     return $0_1 + ($171($0_1 | 0) | 0) | 0 | 0;
    }
    $4_1 = $0_1;
   }
   label2 : while (1) {
    $0_1 = $4_1;
    $3_1 = HEAPU8[$0_1 >> 0] | 0;
    if (!$3_1) {
     break block2
    }
    $4_1 = $0_1 + 1 | 0;
    if (($3_1 | 0) != ($1_1 & 255 | 0 | 0)) {
     continue label2
    }
    break label2;
   };
  }
  return $0_1 | 0;
 }
 
 function $168($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $3_1 = 0, $2_1 = 0;
  $2_1 = HEAPU8[$1_1 >> 0] | 0;
  block : {
   $3_1 = HEAPU8[$0_1 >> 0] | 0;
   if (!$3_1) {
    break block
   }
   if (($3_1 | 0) != ($2_1 & 255 | 0 | 0)) {
    break block
   }
   label : while (1) {
    $2_1 = HEAPU8[($1_1 + 1 | 0) >> 0] | 0;
    $3_1 = HEAPU8[($0_1 + 1 | 0) >> 0] | 0;
    if (!$3_1) {
     break block
    }
    $1_1 = $1_1 + 1 | 0;
    $0_1 = $0_1 + 1 | 0;
    if (($3_1 | 0) == ($2_1 & 255 | 0 | 0)) {
     continue label
    }
    break label;
   };
  }
  return $3_1 - ($2_1 & 255 | 0) | 0 | 0;
 }
 
 function $169($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0;
  block3 : {
   block1 : {
    block : {
     if (!(($1_1 ^ $0_1 | 0) & 3 | 0)) {
      break block
     }
     $2_1 = HEAPU8[$1_1 >> 0] | 0;
     break block1;
    }
    block2 : {
     if (!($1_1 & 3 | 0)) {
      break block2
     }
     label : while (1) {
      $2_1 = HEAPU8[$1_1 >> 0] | 0;
      HEAP8[$0_1 >> 0] = $2_1;
      if (!$2_1) {
       break block3
      }
      $0_1 = $0_1 + 1 | 0;
      $1_1 = $1_1 + 1 | 0;
      if ($1_1 & 3 | 0) {
       continue label
      }
      break label;
     };
    }
    $2_1 = HEAP32[$1_1 >> 2] | 0;
    if (((16843008 - $2_1 | 0 | $2_1 | 0) & -2139062144 | 0 | 0) != (-2139062144 | 0)) {
     break block1
    }
    label1 : while (1) {
     HEAP32[$0_1 >> 2] = $2_1;
     $0_1 = $0_1 + 4 | 0;
     $2_1 = $1_1;
     $1_1 = $2_1 + 4 | 0;
     $2_1 = HEAP32[($2_1 + 4 | 0) >> 2] | 0;
     if (((16843008 - $2_1 | 0 | $2_1 | 0) & -2139062144 | 0 | 0) == (-2139062144 | 0)) {
      continue label1
     }
     break label1;
    };
   }
   HEAP8[$0_1 >> 0] = $2_1;
   if (!($2_1 & 255 | 0)) {
    break block3
   }
   label2 : while (1) {
    $2_1 = HEAPU8[($1_1 + 1 | 0) >> 0] | 0;
    HEAP8[($0_1 + 1 | 0) >> 0] = $2_1;
    $0_1 = $0_1 + 1 | 0;
    $1_1 = $1_1 + 1 | 0;
    if ($2_1) {
     continue label2
    }
    break label2;
   };
  }
  return $0_1 | 0;
 }
 
 function $170($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $169($0_1 | 0, $1_1 | 0) | 0;
  return $0_1 | 0;
 }
 
 function $171($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, $2_1 = 0, $3_1 = 0;
  $1_1 = $0_1;
  block2 : {
   block : {
    if (!($1_1 & 3 | 0)) {
     break block
    }
    block1 : {
     if (HEAPU8[$1_1 >> 0] | 0) {
      break block1
     }
     return $1_1 - $1_1 | 0 | 0;
    }
    $1_1 = $0_1;
    label : while (1) {
     $1_1 = $1_1 + 1 | 0;
     if (!($1_1 & 3 | 0)) {
      break block
     }
     if (HEAPU8[$1_1 >> 0] | 0) {
      continue label
     }
     break block2;
    };
   }
   label1 : while (1) {
    $2_1 = $1_1;
    $1_1 = $1_1 + 4 | 0;
    $3_1 = HEAP32[$2_1 >> 2] | 0;
    if (((16843008 - $3_1 | 0 | $3_1 | 0) & -2139062144 | 0 | 0) == (-2139062144 | 0)) {
     continue label1
    }
    break label1;
   };
   label2 : while (1) {
    $1_1 = $2_1;
    $2_1 = $1_1 + 1 | 0;
    if (HEAPU8[$1_1 >> 0] | 0) {
     continue label2
    }
    break label2;
   };
  }
  return $1_1 - $0_1 | 0 | 0;
 }
 
 function $172($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0;
  block : {
   if (!$2_1) {
    break block
   }
   $1_1 = $1_1 & 255 | 0;
   block1 : {
    label : while (1) {
     $2_1 = $2_1 + -1 | 0;
     $3_1 = $0_1 + $2_1 | 0;
     if ((HEAPU8[$3_1 >> 0] | 0 | 0) == ($1_1 | 0)) {
      break block1
     }
     if (!$2_1) {
      break block
     }
     continue label;
    };
   }
   return $3_1 | 0;
  }
  return 0 | 0;
 }
 
 function $173($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  return $172($0_1 | 0, $1_1 | 0, ($171($0_1 | 0) | 0) + 1 | 0 | 0) | 0 | 0;
 }
 
 function $174($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, $4_1 = 0;
  $3_1 = ($2_1 | 0) != (0 | 0);
  block2 : {
   block1 : {
    block : {
     if (!($0_1 & 3 | 0)) {
      break block
     }
     if (!$2_1) {
      break block
     }
     $4_1 = $1_1 & 255 | 0;
     label : while (1) {
      if ((HEAPU8[$0_1 >> 0] | 0 | 0) == ($4_1 | 0)) {
       break block1
      }
      $2_1 = $2_1 + -1 | 0;
      $3_1 = ($2_1 | 0) != (0 | 0);
      $0_1 = $0_1 + 1 | 0;
      if (!($0_1 & 3 | 0)) {
       break block
      }
      if ($2_1) {
       continue label
      }
      break label;
     };
    }
    if (!$3_1) {
     break block2
    }
    block3 : {
     if ((HEAPU8[$0_1 >> 0] | 0 | 0) == ($1_1 & 255 | 0 | 0)) {
      break block3
     }
     if ($2_1 >>> 0 < 4 >>> 0) {
      break block3
     }
     $4_1 = Math_imul($1_1 & 255 | 0, 16843009);
     label1 : while (1) {
      $3_1 = (HEAP32[$0_1 >> 2] | 0) ^ $4_1 | 0;
      if (((16843008 - $3_1 | 0 | $3_1 | 0) & -2139062144 | 0 | 0) != (-2139062144 | 0)) {
       break block1
      }
      $0_1 = $0_1 + 4 | 0;
      $2_1 = $2_1 + -4 | 0;
      if ($2_1 >>> 0 > 3 >>> 0) {
       continue label1
      }
      break label1;
     };
    }
    if (!$2_1) {
     break block2
    }
   }
   $3_1 = $1_1 & 255 | 0;
   label2 : while (1) {
    block4 : {
     if ((HEAPU8[$0_1 >> 0] | 0 | 0) != ($3_1 | 0)) {
      break block4
     }
     return $0_1 | 0;
    }
    $0_1 = $0_1 + 1 | 0;
    $2_1 = $2_1 + -1 | 0;
    if ($2_1) {
     continue label2
    }
    break label2;
   };
  }
  return 0 | 0;
 }
 
 function $175($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0, $3_1 = 0;
  block : {
   $2_1 = HEAP8[$1_1 >> 0] | 0;
   if ($2_1) {
    break block
   }
   return $0_1 | 0;
  }
  $3_1 = 0;
  block1 : {
   $0_1 = $166($0_1 | 0, $2_1 | 0) | 0;
   if (!$0_1) {
    break block1
   }
   block2 : {
    if (HEAPU8[($1_1 + 1 | 0) >> 0] | 0) {
     break block2
    }
    return $0_1 | 0;
   }
   if (!(HEAPU8[($0_1 + 1 | 0) >> 0] | 0)) {
    break block1
   }
   block3 : {
    if (HEAPU8[($1_1 + 2 | 0) >> 0] | 0) {
     break block3
    }
    return $176($0_1 | 0, $1_1 | 0) | 0 | 0;
   }
   if (!(HEAPU8[($0_1 + 2 | 0) >> 0] | 0)) {
    break block1
   }
   block4 : {
    if (HEAPU8[($1_1 + 3 | 0) >> 0] | 0) {
     break block4
    }
    return $177($0_1 | 0, $1_1 | 0) | 0 | 0;
   }
   if (!(HEAPU8[($0_1 + 3 | 0) >> 0] | 0)) {
    break block1
   }
   block5 : {
    if (HEAPU8[($1_1 + 4 | 0) >> 0] | 0) {
     break block5
    }
    return $178($0_1 | 0, $1_1 | 0) | 0 | 0;
   }
   $3_1 = $179($0_1 | 0, $1_1 | 0) | 0;
  }
  return $3_1 | 0;
 }
 
 function $176($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0, $4_1 = 0, $3_1 = 0, $5_1 = 0;
  $2_1 = HEAPU8[($0_1 + 1 | 0) >> 0] | 0;
  $3_1 = ($2_1 | 0) != (0 | 0);
  block : {
   if (!$2_1) {
    break block
   }
   $4_1 = (HEAPU8[$0_1 >> 0] | 0) << 8 | 0 | $2_1 | 0;
   $5_1 = (HEAPU8[$1_1 >> 0] | 0) << 8 | 0 | (HEAPU8[($1_1 + 1 | 0) >> 0] | 0) | 0;
   if (($4_1 | 0) == ($5_1 | 0)) {
    break block
   }
   $1_1 = $0_1 + 1 | 0;
   label : while (1) {
    $0_1 = $1_1;
    $2_1 = HEAPU8[($0_1 + 1 | 0) >> 0] | 0;
    $3_1 = ($2_1 | 0) != (0 | 0);
    if (!$2_1) {
     break block
    }
    $1_1 = $0_1 + 1 | 0;
    $4_1 = ($4_1 << 8 | 0) & 65280 | 0 | $2_1 | 0;
    if (($4_1 | 0) != ($5_1 | 0)) {
     continue label
    }
    break label;
   };
  }
  return ($3_1 ? $0_1 : 0) | 0;
 }
 
 function $177($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $3_1 = 0, $2_1 = 0, $4_1 = 0, $5_1 = 0;
  $2_1 = $0_1 + 2 | 0;
  $3_1 = HEAPU8[($0_1 + 2 | 0) >> 0] | 0;
  $4_1 = ($3_1 | 0) != (0 | 0);
  block1 : {
   block : {
    if (!$3_1) {
     break block
    }
    $3_1 = (HEAPU8[($0_1 + 1 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[$0_1 >> 0] | 0) << 24 | 0) | 0 | ($3_1 << 8 | 0) | 0;
    $5_1 = (HEAPU8[($1_1 + 1 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[$1_1 >> 0] | 0) << 24 | 0) | 0 | ((HEAPU8[($1_1 + 2 | 0) >> 0] | 0) << 8 | 0) | 0;
    if (($3_1 | 0) == ($5_1 | 0)) {
     break block
    }
    label : while (1) {
     $1_1 = $2_1 + 1 | 0;
     $0_1 = HEAPU8[($2_1 + 1 | 0) >> 0] | 0;
     $4_1 = ($0_1 | 0) != (0 | 0);
     if (!$0_1) {
      break block1
     }
     $2_1 = $1_1;
     $3_1 = ($3_1 | $0_1 | 0) << 8 | 0;
     if (($3_1 | 0) != ($5_1 | 0)) {
      continue label
     }
     break block1;
    };
   }
   $1_1 = $2_1;
  }
  return ($4_1 ? $1_1 + -2 | 0 : 0) | 0;
 }
 
 function $178($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $3_1 = 0, $2_1 = 0, $5_1 = 0, $6_1 = 0, $4_1 = 0;
  $2_1 = $0_1 + 3 | 0;
  $3_1 = HEAPU8[($0_1 + 3 | 0) >> 0] | 0;
  $4_1 = ($3_1 | 0) != (0 | 0);
  block1 : {
   block : {
    if (!$3_1) {
     break block
    }
    $5_1 = (HEAPU8[($0_1 + 1 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[$0_1 >> 0] | 0) << 24 | 0) | 0 | ((HEAPU8[($0_1 + 2 | 0) >> 0] | 0) << 8 | 0) | 0 | $3_1 | 0;
    $6_1 = $1_1;
    $0_1 = HEAPU8[$6_1 >> 0] | 0 | ((HEAPU8[($6_1 + 1 | 0) >> 0] | 0) << 8 | 0) | 0 | ((HEAPU8[($6_1 + 2 | 0) >> 0] | 0) << 16 | 0 | ((HEAPU8[($6_1 + 3 | 0) >> 0] | 0) << 24 | 0) | 0) | 0;
    $1_1 = ((($0_1 ^ (__wasm_rotr_i32($0_1 | 0, 16 | 0) | 0) | 0) & -16711936 | 0) >>> 8 | 0) ^ (__wasm_rotr_i32($0_1 | 0, 8 | 0) | 0) | 0;
    if (($5_1 | 0) == ($1_1 | 0)) {
     break block
    }
    label : while (1) {
     $3_1 = $2_1 + 1 | 0;
     $0_1 = HEAPU8[($2_1 + 1 | 0) >> 0] | 0;
     $4_1 = ($0_1 | 0) != (0 | 0);
     if (!$0_1) {
      break block1
     }
     $2_1 = $3_1;
     $5_1 = $5_1 << 8 | 0 | $0_1 | 0;
     if (($5_1 | 0) != ($1_1 | 0)) {
      continue label
     }
     break block1;
    };
   }
   $3_1 = $2_1;
  }
  return ($4_1 ? $3_1 + -3 | 0 : 0) | 0;
 }
 
 function $179($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $4_1 = 0, $6_1 = 0, $9_1 = 0, $3_1 = 0, $7_1 = 0, $2_1 = 0, $8_1 = 0, $5_1 = 0, $10_1 = 0, $12_1 = 0, i64toi32_i32$0 = 0, $11_1 = 0, $13_1 = 0;
  $2_1 = global$0 - 1056 | 0;
  global$0 = $2_1;
  i64toi32_i32$0 = 0;
  HEAP32[($2_1 + 1048 | 0) >> 2] = 0;
  HEAP32[($2_1 + 1052 | 0) >> 2] = i64toi32_i32$0;
  i64toi32_i32$0 = 0;
  HEAP32[($2_1 + 1040 | 0) >> 2] = 0;
  HEAP32[($2_1 + 1044 | 0) >> 2] = i64toi32_i32$0;
  i64toi32_i32$0 = 0;
  HEAP32[($2_1 + 1032 | 0) >> 2] = 0;
  HEAP32[($2_1 + 1036 | 0) >> 2] = i64toi32_i32$0;
  i64toi32_i32$0 = 0;
  HEAP32[($2_1 + 1024 | 0) >> 2] = 0;
  HEAP32[($2_1 + 1028 | 0) >> 2] = i64toi32_i32$0;
  $3_1 = 0;
  block5 : {
   block4 : {
    block3 : {
     block2 : {
      block1 : {
       block : {
        $4_1 = HEAPU8[$1_1 >> 0] | 0;
        if ($4_1) {
         break block
        }
        $5_1 = -1;
        $6_1 = 1;
        break block1;
       }
       label : while (1) {
        if (!(HEAPU8[($0_1 + $3_1 | 0) >> 0] | 0)) {
         break block2
        }
        $3_1 = $3_1 + 1 | 0;
        HEAP32[($2_1 + (($4_1 & 255 | 0) << 2 | 0) | 0) >> 2] = $3_1;
        $6_1 = ($2_1 + 1024 | 0) + (($4_1 >>> 3 | 0) & 28 | 0) | 0;
        HEAP32[$6_1 >> 2] = HEAP32[$6_1 >> 2] | 0 | (1 << $4_1 | 0) | 0;
        $4_1 = HEAPU8[($1_1 + $3_1 | 0) >> 0] | 0;
        if ($4_1) {
         continue label
        }
        break label;
       };
       $6_1 = 1;
       $5_1 = -1;
       if ($3_1 >>> 0 > 1 >>> 0) {
        break block3
       }
      }
      $7_1 = -1;
      $8_1 = 1;
      break block4;
     }
     $0_1 = 0;
     break block5;
    }
    $9_1 = 0;
    $10_1 = 1;
    $4_1 = 1;
    label1 : while (1) {
     block8 : {
      block6 : {
       $7_1 = HEAPU8[(($1_1 + $5_1 | 0) + $4_1 | 0) >> 0] | 0;
       $8_1 = HEAPU8[($1_1 + $6_1 | 0) >> 0] | 0;
       if (($7_1 | 0) != ($8_1 | 0)) {
        break block6
       }
       block7 : {
        if (($4_1 | 0) != ($10_1 | 0)) {
         break block7
        }
        $9_1 = $10_1 + $9_1 | 0;
        $4_1 = 1;
        break block8;
       }
       $4_1 = $4_1 + 1 | 0;
       break block8;
      }
      block9 : {
       if ($7_1 >>> 0 <= $8_1 >>> 0) {
        break block9
       }
       $10_1 = $6_1 - $5_1 | 0;
       $4_1 = 1;
       $9_1 = $6_1;
       break block8;
      }
      $4_1 = 1;
      $5_1 = $9_1;
      $9_1 = $9_1 + 1 | 0;
      $10_1 = 1;
     }
     $6_1 = $4_1 + $9_1 | 0;
     if ($6_1 >>> 0 < $3_1 >>> 0) {
      continue label1
     }
     break label1;
    };
    $7_1 = -1;
    $6_1 = 0;
    $9_1 = 1;
    $8_1 = 1;
    $4_1 = 1;
    label2 : while (1) {
     block12 : {
      block10 : {
       $11_1 = HEAPU8[(($1_1 + $7_1 | 0) + $4_1 | 0) >> 0] | 0;
       $12_1 = HEAPU8[($1_1 + $9_1 | 0) >> 0] | 0;
       if (($11_1 | 0) != ($12_1 | 0)) {
        break block10
       }
       block11 : {
        if (($4_1 | 0) != ($8_1 | 0)) {
         break block11
        }
        $6_1 = $8_1 + $6_1 | 0;
        $4_1 = 1;
        break block12;
       }
       $4_1 = $4_1 + 1 | 0;
       break block12;
      }
      block13 : {
       if ($11_1 >>> 0 >= $12_1 >>> 0) {
        break block13
       }
       $8_1 = $9_1 - $7_1 | 0;
       $4_1 = 1;
       $6_1 = $9_1;
       break block12;
      }
      $4_1 = 1;
      $7_1 = $6_1;
      $6_1 = $6_1 + 1 | 0;
      $8_1 = 1;
     }
     $9_1 = $4_1 + $6_1 | 0;
     if ($9_1 >>> 0 < $3_1 >>> 0) {
      continue label2
     }
     break label2;
    };
    $6_1 = $10_1;
   }
   block15 : {
    block14 : {
     $4_1 = ($7_1 + 1 | 0) >>> 0 > ($5_1 + 1 | 0) >>> 0;
     $10_1 = $4_1 ? $8_1 : $6_1;
     $12_1 = $4_1 ? $7_1 : $5_1;
     $11_1 = $12_1 + 1 | 0;
     if (!($152($1_1 | 0, $1_1 + $10_1 | 0 | 0, $11_1 | 0) | 0)) {
      break block14
     }
     $4_1 = $3_1 + ($12_1 ^ -1 | 0) | 0;
     $10_1 = ($12_1 >>> 0 > $4_1 >>> 0 ? $12_1 : $4_1) + 1 | 0;
     $13_1 = 0;
     break block15;
    }
    $13_1 = $3_1 - $10_1 | 0;
   }
   $8_1 = $3_1 | 63 | 0;
   $4_1 = 0;
   $5_1 = $0_1;
   label3 : while (1) {
    $9_1 = $4_1;
    block16 : {
     $6_1 = $0_1;
     if (($5_1 - $6_1 | 0) >>> 0 >= $3_1 >>> 0) {
      break block16
     }
     $0_1 = 0;
     $4_1 = $174($5_1 | 0, 0 | 0, $8_1 | 0) | 0;
     $5_1 = $4_1 ? $4_1 : $5_1 + $8_1 | 0;
     if (!$4_1) {
      break block16
     }
     if (($4_1 - $6_1 | 0) >>> 0 < $3_1 >>> 0) {
      break block5
     }
    }
    $4_1 = 0;
    $0_1 = $6_1 + $3_1 | 0;
    $7_1 = HEAPU8[($0_1 + -1 | 0) >> 0] | 0;
    if (!(((HEAP32[(($2_1 + 1024 | 0) + (($7_1 >>> 3 | 0) & 28 | 0) | 0) >> 2] | 0) >>> $7_1 | 0) & 1 | 0)) {
     continue label3
    }
    block17 : {
     $4_1 = HEAP32[($2_1 + ($7_1 << 2 | 0) | 0) >> 2] | 0;
     if (($3_1 | 0) == ($4_1 | 0)) {
      break block17
     }
     $4_1 = $3_1 - $4_1 | 0;
     $0_1 = $6_1 + ($4_1 >>> 0 > $9_1 >>> 0 ? $4_1 : $9_1) | 0;
     $4_1 = 0;
     continue label3;
    }
    block18 : {
     $7_1 = $11_1 >>> 0 > $9_1 >>> 0;
     $4_1 = $7_1 ? $11_1 : $9_1;
     $0_1 = HEAPU8[($1_1 + $4_1 | 0) >> 0] | 0;
     if (!$0_1) {
      break block18
     }
     block19 : {
      label4 : while (1) {
       if (($0_1 & 255 | 0 | 0) != (HEAPU8[($6_1 + $4_1 | 0) >> 0] | 0 | 0)) {
        break block19
       }
       $4_1 = $4_1 + 1 | 0;
       $0_1 = HEAPU8[($1_1 + $4_1 | 0) >> 0] | 0;
       if (!$0_1) {
        break block18
       }
       continue label4;
      };
     }
     $0_1 = $6_1 + ($4_1 - $12_1 | 0) | 0;
     $4_1 = 0;
     continue label3;
    }
    $4_1 = $11_1;
    block20 : {
     if (!$7_1) {
      break block20
     }
     block21 : {
      label5 : while (1) {
       $4_1 = $4_1 + -1 | 0;
       if ((HEAPU8[($1_1 + $4_1 | 0) >> 0] | 0 | 0) != (HEAPU8[($6_1 + $4_1 | 0) >> 0] | 0 | 0)) {
        break block21
       }
       if ($4_1 >>> 0 <= $9_1 >>> 0) {
        break block20
       }
       continue label5;
      };
     }
     $0_1 = $6_1 + $10_1 | 0;
     $4_1 = $13_1;
     continue label3;
    }
    break label3;
   };
   $0_1 = $6_1;
  }
  global$0 = $2_1 + 1056 | 0;
  return $0_1 | 0;
 }
 
 function $180($0_1) {
  $0_1 = $0_1 | 0;
  var wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  block : {
   if ($0_1 >>> 0 < -4095 >>> 0) {
    break block
   }
   (wasm2js_i32$0 = $134() | 0, wasm2js_i32$1 = 0 - $0_1 | 0), HEAP32[wasm2js_i32$0 >> 2] = wasm2js_i32$1;
   $0_1 = -1;
  }
  return $0_1 | 0;
 }
 
 function $181($0_1) {
  $0_1 = $0_1 | 0;
  var wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  block : {
   if ($0_1) {
    break block
   }
   return 0 | 0;
  }
  (wasm2js_i32$0 = $134() | 0, wasm2js_i32$1 = $0_1), HEAP32[wasm2js_i32$0 >> 2] = wasm2js_i32$1;
  return -1 | 0;
 }
 
 function $182($0_1) {
  $0_1 = $0_1 | 0;
  var $6_1 = 0, $4_1 = 0, $5_1 = 0, $8_1 = 0, $3_1 = 0, $2_1 = 0, $7_1 = 0, $12_1 = 0, $11_1 = 0, i64toi32_i32$1 = 0, i64toi32_i32$0 = 0, $10_1 = 0, i64toi32_i32$2 = 0, $1_1 = 0, $9_1 = 0, $84_1 = 0, $194_1 = 0, $1142 = 0, $1144 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $1_1 = global$0 - 16 | 0;
  global$0 = $1_1;
  block5 : {
   block88 : {
    block4 : {
     block6 : {
      block : {
       if ($0_1 >>> 0 > 244 >>> 0) {
        break block
       }
       block1 : {
        $2_1 = HEAP32[(0 + 77152 | 0) >> 2] | 0;
        $3_1 = $0_1 >>> 0 < 11 >>> 0 ? 16 : ($0_1 + 11 | 0) & 504 | 0;
        $4_1 = $3_1 >>> 3 | 0;
        $0_1 = $2_1 >>> $4_1 | 0;
        if (!($0_1 & 3 | 0)) {
         break block1
        }
        block3 : {
         block2 : {
          $5_1 = (($0_1 ^ -1 | 0) & 1 | 0) + $4_1 | 0;
          $3_1 = $5_1 << 3 | 0;
          $6_1 = $3_1 + 77192 | 0;
          $4_1 = HEAP32[($3_1 + 77200 | 0) >> 2] | 0;
          $0_1 = HEAP32[($4_1 + 8 | 0) >> 2] | 0;
          if (($6_1 | 0) != ($0_1 | 0)) {
           break block2
          }
          (wasm2js_i32$0 = 0, wasm2js_i32$1 = $2_1 & (__wasm_rotl_i32(-2 | 0, $5_1 | 0) | 0) | 0), HEAP32[(wasm2js_i32$0 + 77152 | 0) >> 2] = wasm2js_i32$1;
          break block3;
         }
         if ($0_1 >>> 0 < (HEAP32[(0 + 77168 | 0) >> 2] | 0) >>> 0) {
          break block4
         }
         if ((HEAP32[($0_1 + 12 | 0) >> 2] | 0 | 0) != ($4_1 | 0)) {
          break block4
         }
         HEAP32[($0_1 + 12 | 0) >> 2] = $6_1;
         HEAP32[($6_1 + 8 | 0) >> 2] = $0_1;
        }
        $0_1 = $4_1 + 8 | 0;
        HEAP32[($4_1 + 4 | 0) >> 2] = $3_1 | 3 | 0;
        $4_1 = $4_1 + $3_1 | 0;
        HEAP32[($4_1 + 4 | 0) >> 2] = HEAP32[($4_1 + 4 | 0) >> 2] | 0 | 1 | 0;
        break block5;
       }
       $7_1 = HEAP32[(0 + 77160 | 0) >> 2] | 0;
       if ($3_1 >>> 0 <= $7_1 >>> 0) {
        break block6
       }
       block7 : {
        if (!$0_1) {
         break block7
        }
        block9 : {
         block8 : {
          $84_1 = $0_1 << $4_1 | 0;
          $0_1 = 2 << $4_1 | 0;
          $8_1 = __wasm_ctz_i32($84_1 & ($0_1 | (0 - $0_1 | 0) | 0) | 0 | 0) | 0;
          $4_1 = $8_1 << 3 | 0;
          $5_1 = $4_1 + 77192 | 0;
          $0_1 = HEAP32[($4_1 + 77200 | 0) >> 2] | 0;
          $6_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
          if (($5_1 | 0) != ($6_1 | 0)) {
           break block8
          }
          $2_1 = $2_1 & (__wasm_rotl_i32(-2 | 0, $8_1 | 0) | 0) | 0;
          HEAP32[(0 + 77152 | 0) >> 2] = $2_1;
          break block9;
         }
         if ($6_1 >>> 0 < (HEAP32[(0 + 77168 | 0) >> 2] | 0) >>> 0) {
          break block4
         }
         if ((HEAP32[($6_1 + 12 | 0) >> 2] | 0 | 0) != ($0_1 | 0)) {
          break block4
         }
         HEAP32[($6_1 + 12 | 0) >> 2] = $5_1;
         HEAP32[($5_1 + 8 | 0) >> 2] = $6_1;
        }
        HEAP32[($0_1 + 4 | 0) >> 2] = $3_1 | 3 | 0;
        $5_1 = $0_1 + $3_1 | 0;
        $3_1 = $4_1 - $3_1 | 0;
        HEAP32[($5_1 + 4 | 0) >> 2] = $3_1 | 1 | 0;
        HEAP32[($0_1 + $4_1 | 0) >> 2] = $3_1;
        block10 : {
         if (!$7_1) {
          break block10
         }
         $6_1 = ($7_1 & -8 | 0) + 77192 | 0;
         $4_1 = HEAP32[(0 + 77172 | 0) >> 2] | 0;
         block12 : {
          block11 : {
           $8_1 = 1 << ($7_1 >>> 3 | 0) | 0;
           if ($2_1 & $8_1 | 0) {
            break block11
           }
           HEAP32[(0 + 77152 | 0) >> 2] = $2_1 | $8_1 | 0;
           $8_1 = $6_1;
           break block12;
          }
          $8_1 = HEAP32[($6_1 + 8 | 0) >> 2] | 0;
          if ($8_1 >>> 0 < (HEAP32[(0 + 77168 | 0) >> 2] | 0) >>> 0) {
           break block4
          }
         }
         HEAP32[($6_1 + 8 | 0) >> 2] = $4_1;
         HEAP32[($8_1 + 12 | 0) >> 2] = $4_1;
         HEAP32[($4_1 + 12 | 0) >> 2] = $6_1;
         HEAP32[($4_1 + 8 | 0) >> 2] = $8_1;
        }
        $0_1 = $0_1 + 8 | 0;
        HEAP32[(0 + 77172 | 0) >> 2] = $5_1;
        HEAP32[(0 + 77160 | 0) >> 2] = $3_1;
        break block5;
       }
       $9_1 = HEAP32[(0 + 77156 | 0) >> 2] | 0;
       if (!$9_1) {
        break block6
       }
       $6_1 = HEAP32[(((__wasm_ctz_i32($9_1 | 0) | 0) << 2 | 0) + 77456 | 0) >> 2] | 0;
       $4_1 = ((HEAP32[($6_1 + 4 | 0) >> 2] | 0) & -8 | 0) - $3_1 | 0;
       $5_1 = $6_1;
       block14 : {
        label : while (1) {
         block13 : {
          $0_1 = HEAP32[($6_1 + 16 | 0) >> 2] | 0;
          if ($0_1) {
           break block13
          }
          $0_1 = HEAP32[($6_1 + 20 | 0) >> 2] | 0;
          if (!$0_1) {
           break block14
          }
         }
         $6_1 = ((HEAP32[($0_1 + 4 | 0) >> 2] | 0) & -8 | 0) - $3_1 | 0;
         $194_1 = $6_1;
         $6_1 = $6_1 >>> 0 < $4_1 >>> 0;
         $4_1 = $6_1 ? $194_1 : $4_1;
         $5_1 = $6_1 ? $0_1 : $5_1;
         $6_1 = $0_1;
         continue label;
        };
       }
       $10_1 = HEAP32[(0 + 77168 | 0) >> 2] | 0;
       if ($5_1 >>> 0 < $10_1 >>> 0) {
        break block4
       }
       $11_1 = HEAP32[($5_1 + 24 | 0) >> 2] | 0;
       block16 : {
        block15 : {
         $0_1 = HEAP32[($5_1 + 12 | 0) >> 2] | 0;
         if (($0_1 | 0) == ($5_1 | 0)) {
          break block15
         }
         $6_1 = HEAP32[($5_1 + 8 | 0) >> 2] | 0;
         if ($6_1 >>> 0 < $10_1 >>> 0) {
          break block4
         }
         if ((HEAP32[($6_1 + 12 | 0) >> 2] | 0 | 0) != ($5_1 | 0)) {
          break block4
         }
         if ((HEAP32[($0_1 + 8 | 0) >> 2] | 0 | 0) != ($5_1 | 0)) {
          break block4
         }
         HEAP32[($6_1 + 12 | 0) >> 2] = $0_1;
         HEAP32[($0_1 + 8 | 0) >> 2] = $6_1;
         break block16;
        }
        block19 : {
         block18 : {
          block17 : {
           $6_1 = HEAP32[($5_1 + 20 | 0) >> 2] | 0;
           if (!$6_1) {
            break block17
           }
           $8_1 = $5_1 + 20 | 0;
           break block18;
          }
          $6_1 = HEAP32[($5_1 + 16 | 0) >> 2] | 0;
          if (!$6_1) {
           break block19
          }
          $8_1 = $5_1 + 16 | 0;
         }
         label1 : while (1) {
          $12_1 = $8_1;
          $0_1 = $6_1;
          $8_1 = $0_1 + 20 | 0;
          $6_1 = HEAP32[($0_1 + 20 | 0) >> 2] | 0;
          if ($6_1) {
           continue label1
          }
          $8_1 = $0_1 + 16 | 0;
          $6_1 = HEAP32[($0_1 + 16 | 0) >> 2] | 0;
          if ($6_1) {
           continue label1
          }
          break label1;
         };
         if ($12_1 >>> 0 < $10_1 >>> 0) {
          break block4
         }
         HEAP32[$12_1 >> 2] = 0;
         break block16;
        }
        $0_1 = 0;
       }
       block20 : {
        if (!$11_1) {
         break block20
        }
        block22 : {
         block21 : {
          $8_1 = HEAP32[($5_1 + 28 | 0) >> 2] | 0;
          $6_1 = $8_1 << 2 | 0;
          if (($5_1 | 0) != (HEAP32[($6_1 + 77456 | 0) >> 2] | 0 | 0)) {
           break block21
          }
          HEAP32[($6_1 + 77456 | 0) >> 2] = $0_1;
          if ($0_1) {
           break block22
          }
          (wasm2js_i32$0 = 0, wasm2js_i32$1 = $9_1 & (__wasm_rotl_i32(-2 | 0, $8_1 | 0) | 0) | 0), HEAP32[(wasm2js_i32$0 + 77156 | 0) >> 2] = wasm2js_i32$1;
          break block20;
         }
         if ($11_1 >>> 0 < $10_1 >>> 0) {
          break block4
         }
         block24 : {
          block23 : {
           if ((HEAP32[($11_1 + 16 | 0) >> 2] | 0 | 0) != ($5_1 | 0)) {
            break block23
           }
           HEAP32[($11_1 + 16 | 0) >> 2] = $0_1;
           break block24;
          }
          HEAP32[($11_1 + 20 | 0) >> 2] = $0_1;
         }
         if (!$0_1) {
          break block20
         }
        }
        if ($0_1 >>> 0 < $10_1 >>> 0) {
         break block4
        }
        HEAP32[($0_1 + 24 | 0) >> 2] = $11_1;
        block25 : {
         $6_1 = HEAP32[($5_1 + 16 | 0) >> 2] | 0;
         if (!$6_1) {
          break block25
         }
         if ($6_1 >>> 0 < $10_1 >>> 0) {
          break block4
         }
         HEAP32[($0_1 + 16 | 0) >> 2] = $6_1;
         HEAP32[($6_1 + 24 | 0) >> 2] = $0_1;
        }
        $6_1 = HEAP32[($5_1 + 20 | 0) >> 2] | 0;
        if (!$6_1) {
         break block20
        }
        if ($6_1 >>> 0 < $10_1 >>> 0) {
         break block4
        }
        HEAP32[($0_1 + 20 | 0) >> 2] = $6_1;
        HEAP32[($6_1 + 24 | 0) >> 2] = $0_1;
       }
       block27 : {
        block26 : {
         if ($4_1 >>> 0 > 15 >>> 0) {
          break block26
         }
         $0_1 = $4_1 + $3_1 | 0;
         HEAP32[($5_1 + 4 | 0) >> 2] = $0_1 | 3 | 0;
         $0_1 = $5_1 + $0_1 | 0;
         HEAP32[($0_1 + 4 | 0) >> 2] = HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 1 | 0;
         break block27;
        }
        HEAP32[($5_1 + 4 | 0) >> 2] = $3_1 | 3 | 0;
        $3_1 = $5_1 + $3_1 | 0;
        HEAP32[($3_1 + 4 | 0) >> 2] = $4_1 | 1 | 0;
        HEAP32[($3_1 + $4_1 | 0) >> 2] = $4_1;
        block28 : {
         if (!$7_1) {
          break block28
         }
         $6_1 = ($7_1 & -8 | 0) + 77192 | 0;
         $0_1 = HEAP32[(0 + 77172 | 0) >> 2] | 0;
         block30 : {
          block29 : {
           $8_1 = 1 << ($7_1 >>> 3 | 0) | 0;
           if ($8_1 & $2_1 | 0) {
            break block29
           }
           HEAP32[(0 + 77152 | 0) >> 2] = $8_1 | $2_1 | 0;
           $8_1 = $6_1;
           break block30;
          }
          $8_1 = HEAP32[($6_1 + 8 | 0) >> 2] | 0;
          if ($8_1 >>> 0 < $10_1 >>> 0) {
           break block4
          }
         }
         HEAP32[($6_1 + 8 | 0) >> 2] = $0_1;
         HEAP32[($8_1 + 12 | 0) >> 2] = $0_1;
         HEAP32[($0_1 + 12 | 0) >> 2] = $6_1;
         HEAP32[($0_1 + 8 | 0) >> 2] = $8_1;
        }
        HEAP32[(0 + 77172 | 0) >> 2] = $3_1;
        HEAP32[(0 + 77160 | 0) >> 2] = $4_1;
       }
       $0_1 = $5_1 + 8 | 0;
       break block5;
      }
      $3_1 = -1;
      if ($0_1 >>> 0 > -65 >>> 0) {
       break block6
      }
      $4_1 = $0_1 + 11 | 0;
      $3_1 = $4_1 & -8 | 0;
      $11_1 = HEAP32[(0 + 77156 | 0) >> 2] | 0;
      if (!$11_1) {
       break block6
      }
      $7_1 = 31;
      block31 : {
       if ($0_1 >>> 0 > 16777204 >>> 0) {
        break block31
       }
       $0_1 = Math_clz32($4_1 >>> 8 | 0);
       $7_1 = ((($3_1 >>> (38 - $0_1 | 0) | 0) & 1 | 0) - ($0_1 << 1 | 0) | 0) + 62 | 0;
      }
      $4_1 = 0 - $3_1 | 0;
      block37 : {
       block35 : {
        block33 : {
         block32 : {
          $6_1 = HEAP32[(($7_1 << 2 | 0) + 77456 | 0) >> 2] | 0;
          if ($6_1) {
           break block32
          }
          $0_1 = 0;
          $8_1 = 0;
          break block33;
         }
         $0_1 = 0;
         $5_1 = $3_1 << (($7_1 | 0) == (31 | 0) ? 0 : 25 - ($7_1 >>> 1 | 0) | 0) | 0;
         $8_1 = 0;
         label2 : while (1) {
          block34 : {
           $2_1 = ((HEAP32[($6_1 + 4 | 0) >> 2] | 0) & -8 | 0) - $3_1 | 0;
           if ($2_1 >>> 0 >= $4_1 >>> 0) {
            break block34
           }
           $4_1 = $2_1;
           $8_1 = $6_1;
           if ($4_1) {
            break block34
           }
           $4_1 = 0;
           $8_1 = $6_1;
           $0_1 = $6_1;
           break block35;
          }
          $2_1 = HEAP32[($6_1 + 20 | 0) >> 2] | 0;
          $12_1 = HEAP32[(($6_1 + (($5_1 >>> 29 | 0) & 4 | 0) | 0) + 16 | 0) >> 2] | 0;
          $0_1 = $2_1 ? (($2_1 | 0) == ($12_1 | 0) ? $0_1 : $2_1) : $0_1;
          $5_1 = $5_1 << 1 | 0;
          $6_1 = $12_1;
          if ($6_1) {
           continue label2
          }
          break label2;
         };
        }
        block36 : {
         if ($0_1 | $8_1 | 0) {
          break block36
         }
         $8_1 = 0;
         $0_1 = 2 << $7_1 | 0;
         $0_1 = ($0_1 | (0 - $0_1 | 0) | 0) & $11_1 | 0;
         if (!$0_1) {
          break block6
         }
         $0_1 = HEAP32[(((__wasm_ctz_i32($0_1 | 0) | 0) << 2 | 0) + 77456 | 0) >> 2] | 0;
        }
        if (!$0_1) {
         break block37
        }
       }
       label3 : while (1) {
        $2_1 = ((HEAP32[($0_1 + 4 | 0) >> 2] | 0) & -8 | 0) - $3_1 | 0;
        $5_1 = $2_1 >>> 0 < $4_1 >>> 0;
        block38 : {
         $6_1 = HEAP32[($0_1 + 16 | 0) >> 2] | 0;
         if ($6_1) {
          break block38
         }
         $6_1 = HEAP32[($0_1 + 20 | 0) >> 2] | 0;
        }
        $4_1 = $5_1 ? $2_1 : $4_1;
        $8_1 = $5_1 ? $0_1 : $8_1;
        $0_1 = $6_1;
        if ($0_1) {
         continue label3
        }
        break label3;
       };
      }
      if (!$8_1) {
       break block6
      }
      if ($4_1 >>> 0 >= ((HEAP32[(0 + 77160 | 0) >> 2] | 0) - $3_1 | 0) >>> 0) {
       break block6
      }
      $12_1 = HEAP32[(0 + 77168 | 0) >> 2] | 0;
      if ($8_1 >>> 0 < $12_1 >>> 0) {
       break block4
      }
      $7_1 = HEAP32[($8_1 + 24 | 0) >> 2] | 0;
      block40 : {
       block39 : {
        $0_1 = HEAP32[($8_1 + 12 | 0) >> 2] | 0;
        if (($0_1 | 0) == ($8_1 | 0)) {
         break block39
        }
        $6_1 = HEAP32[($8_1 + 8 | 0) >> 2] | 0;
        if ($6_1 >>> 0 < $12_1 >>> 0) {
         break block4
        }
        if ((HEAP32[($6_1 + 12 | 0) >> 2] | 0 | 0) != ($8_1 | 0)) {
         break block4
        }
        if ((HEAP32[($0_1 + 8 | 0) >> 2] | 0 | 0) != ($8_1 | 0)) {
         break block4
        }
        HEAP32[($6_1 + 12 | 0) >> 2] = $0_1;
        HEAP32[($0_1 + 8 | 0) >> 2] = $6_1;
        break block40;
       }
       block43 : {
        block42 : {
         block41 : {
          $6_1 = HEAP32[($8_1 + 20 | 0) >> 2] | 0;
          if (!$6_1) {
           break block41
          }
          $5_1 = $8_1 + 20 | 0;
          break block42;
         }
         $6_1 = HEAP32[($8_1 + 16 | 0) >> 2] | 0;
         if (!$6_1) {
          break block43
         }
         $5_1 = $8_1 + 16 | 0;
        }
        label4 : while (1) {
         $2_1 = $5_1;
         $0_1 = $6_1;
         $5_1 = $0_1 + 20 | 0;
         $6_1 = HEAP32[($0_1 + 20 | 0) >> 2] | 0;
         if ($6_1) {
          continue label4
         }
         $5_1 = $0_1 + 16 | 0;
         $6_1 = HEAP32[($0_1 + 16 | 0) >> 2] | 0;
         if ($6_1) {
          continue label4
         }
         break label4;
        };
        if ($2_1 >>> 0 < $12_1 >>> 0) {
         break block4
        }
        HEAP32[$2_1 >> 2] = 0;
        break block40;
       }
       $0_1 = 0;
      }
      block44 : {
       if (!$7_1) {
        break block44
       }
       block46 : {
        block45 : {
         $5_1 = HEAP32[($8_1 + 28 | 0) >> 2] | 0;
         $6_1 = $5_1 << 2 | 0;
         if (($8_1 | 0) != (HEAP32[($6_1 + 77456 | 0) >> 2] | 0 | 0)) {
          break block45
         }
         HEAP32[($6_1 + 77456 | 0) >> 2] = $0_1;
         if ($0_1) {
          break block46
         }
         $11_1 = $11_1 & (__wasm_rotl_i32(-2 | 0, $5_1 | 0) | 0) | 0;
         HEAP32[(0 + 77156 | 0) >> 2] = $11_1;
         break block44;
        }
        if ($7_1 >>> 0 < $12_1 >>> 0) {
         break block4
        }
        block48 : {
         block47 : {
          if ((HEAP32[($7_1 + 16 | 0) >> 2] | 0 | 0) != ($8_1 | 0)) {
           break block47
          }
          HEAP32[($7_1 + 16 | 0) >> 2] = $0_1;
          break block48;
         }
         HEAP32[($7_1 + 20 | 0) >> 2] = $0_1;
        }
        if (!$0_1) {
         break block44
        }
       }
       if ($0_1 >>> 0 < $12_1 >>> 0) {
        break block4
       }
       HEAP32[($0_1 + 24 | 0) >> 2] = $7_1;
       block49 : {
        $6_1 = HEAP32[($8_1 + 16 | 0) >> 2] | 0;
        if (!$6_1) {
         break block49
        }
        if ($6_1 >>> 0 < $12_1 >>> 0) {
         break block4
        }
        HEAP32[($0_1 + 16 | 0) >> 2] = $6_1;
        HEAP32[($6_1 + 24 | 0) >> 2] = $0_1;
       }
       $6_1 = HEAP32[($8_1 + 20 | 0) >> 2] | 0;
       if (!$6_1) {
        break block44
       }
       if ($6_1 >>> 0 < $12_1 >>> 0) {
        break block4
       }
       HEAP32[($0_1 + 20 | 0) >> 2] = $6_1;
       HEAP32[($6_1 + 24 | 0) >> 2] = $0_1;
      }
      block51 : {
       block50 : {
        if ($4_1 >>> 0 > 15 >>> 0) {
         break block50
        }
        $0_1 = $4_1 + $3_1 | 0;
        HEAP32[($8_1 + 4 | 0) >> 2] = $0_1 | 3 | 0;
        $0_1 = $8_1 + $0_1 | 0;
        HEAP32[($0_1 + 4 | 0) >> 2] = HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 1 | 0;
        break block51;
       }
       HEAP32[($8_1 + 4 | 0) >> 2] = $3_1 | 3 | 0;
       $5_1 = $8_1 + $3_1 | 0;
       HEAP32[($5_1 + 4 | 0) >> 2] = $4_1 | 1 | 0;
       HEAP32[($5_1 + $4_1 | 0) >> 2] = $4_1;
       block52 : {
        if ($4_1 >>> 0 > 255 >>> 0) {
         break block52
        }
        $0_1 = ($4_1 & 248 | 0) + 77192 | 0;
        block54 : {
         block53 : {
          $3_1 = HEAP32[(0 + 77152 | 0) >> 2] | 0;
          $4_1 = 1 << ($4_1 >>> 3 | 0) | 0;
          if ($3_1 & $4_1 | 0) {
           break block53
          }
          HEAP32[(0 + 77152 | 0) >> 2] = $3_1 | $4_1 | 0;
          $4_1 = $0_1;
          break block54;
         }
         $4_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
         if ($4_1 >>> 0 < $12_1 >>> 0) {
          break block4
         }
        }
        HEAP32[($0_1 + 8 | 0) >> 2] = $5_1;
        HEAP32[($4_1 + 12 | 0) >> 2] = $5_1;
        HEAP32[($5_1 + 12 | 0) >> 2] = $0_1;
        HEAP32[($5_1 + 8 | 0) >> 2] = $4_1;
        break block51;
       }
       $0_1 = 31;
       block55 : {
        if ($4_1 >>> 0 > 16777215 >>> 0) {
         break block55
        }
        $0_1 = Math_clz32($4_1 >>> 8 | 0);
        $0_1 = (($4_1 >>> (38 - $0_1 | 0) | 0) & 1 | 0 | ($0_1 << 1 | 0) | 0) ^ 62 | 0;
       }
       HEAP32[($5_1 + 28 | 0) >> 2] = $0_1;
       i64toi32_i32$1 = $5_1;
       i64toi32_i32$0 = 0;
       HEAP32[($5_1 + 16 | 0) >> 2] = 0;
       HEAP32[($5_1 + 20 | 0) >> 2] = i64toi32_i32$0;
       $3_1 = ($0_1 << 2 | 0) + 77456 | 0;
       block58 : {
        block57 : {
         block56 : {
          $6_1 = 1 << $0_1 | 0;
          if ($11_1 & $6_1 | 0) {
           break block56
          }
          HEAP32[(0 + 77156 | 0) >> 2] = $11_1 | $6_1 | 0;
          HEAP32[$3_1 >> 2] = $5_1;
          HEAP32[($5_1 + 24 | 0) >> 2] = $3_1;
          break block57;
         }
         $0_1 = $4_1 << (($0_1 | 0) == (31 | 0) ? 0 : 25 - ($0_1 >>> 1 | 0) | 0) | 0;
         $6_1 = HEAP32[$3_1 >> 2] | 0;
         label5 : while (1) {
          $3_1 = $6_1;
          if (((HEAP32[($6_1 + 4 | 0) >> 2] | 0) & -8 | 0 | 0) == ($4_1 | 0)) {
           break block58
          }
          $6_1 = $0_1 >>> 29 | 0;
          $0_1 = $0_1 << 1 | 0;
          $2_1 = $3_1 + ($6_1 & 4 | 0) | 0;
          $6_1 = HEAP32[($2_1 + 16 | 0) >> 2] | 0;
          if ($6_1) {
           continue label5
          }
          break label5;
         };
         $0_1 = $2_1 + 16 | 0;
         if ($0_1 >>> 0 < $12_1 >>> 0) {
          break block4
         }
         HEAP32[$0_1 >> 2] = $5_1;
         HEAP32[($5_1 + 24 | 0) >> 2] = $3_1;
        }
        HEAP32[($5_1 + 12 | 0) >> 2] = $5_1;
        HEAP32[($5_1 + 8 | 0) >> 2] = $5_1;
        break block51;
       }
       if ($3_1 >>> 0 < $12_1 >>> 0) {
        break block4
       }
       $0_1 = HEAP32[($3_1 + 8 | 0) >> 2] | 0;
       if ($0_1 >>> 0 < $12_1 >>> 0) {
        break block4
       }
       HEAP32[($0_1 + 12 | 0) >> 2] = $5_1;
       HEAP32[($3_1 + 8 | 0) >> 2] = $5_1;
       HEAP32[($5_1 + 24 | 0) >> 2] = 0;
       HEAP32[($5_1 + 12 | 0) >> 2] = $3_1;
       HEAP32[($5_1 + 8 | 0) >> 2] = $0_1;
      }
      $0_1 = $8_1 + 8 | 0;
      break block5;
     }
     block59 : {
      $0_1 = HEAP32[(0 + 77160 | 0) >> 2] | 0;
      if ($0_1 >>> 0 < $3_1 >>> 0) {
       break block59
      }
      $4_1 = HEAP32[(0 + 77172 | 0) >> 2] | 0;
      block61 : {
       block60 : {
        $6_1 = $0_1 - $3_1 | 0;
        if ($6_1 >>> 0 < 16 >>> 0) {
         break block60
        }
        $5_1 = $4_1 + $3_1 | 0;
        HEAP32[($5_1 + 4 | 0) >> 2] = $6_1 | 1 | 0;
        HEAP32[($4_1 + $0_1 | 0) >> 2] = $6_1;
        HEAP32[($4_1 + 4 | 0) >> 2] = $3_1 | 3 | 0;
        break block61;
       }
       HEAP32[($4_1 + 4 | 0) >> 2] = $0_1 | 3 | 0;
       $0_1 = $4_1 + $0_1 | 0;
       HEAP32[($0_1 + 4 | 0) >> 2] = HEAP32[($0_1 + 4 | 0) >> 2] | 0 | 1 | 0;
       $6_1 = 0;
       $5_1 = 0;
      }
      HEAP32[(0 + 77160 | 0) >> 2] = $6_1;
      HEAP32[(0 + 77172 | 0) >> 2] = $5_1;
      $0_1 = $4_1 + 8 | 0;
      break block5;
     }
     block62 : {
      $5_1 = HEAP32[(0 + 77164 | 0) >> 2] | 0;
      if ($5_1 >>> 0 <= $3_1 >>> 0) {
       break block62
      }
      $4_1 = $5_1 - $3_1 | 0;
      HEAP32[(0 + 77164 | 0) >> 2] = $4_1;
      $0_1 = HEAP32[(0 + 77176 | 0) >> 2] | 0;
      $6_1 = $0_1 + $3_1 | 0;
      HEAP32[(0 + 77176 | 0) >> 2] = $6_1;
      HEAP32[($6_1 + 4 | 0) >> 2] = $4_1 | 1 | 0;
      HEAP32[($0_1 + 4 | 0) >> 2] = $3_1 | 3 | 0;
      $0_1 = $0_1 + 8 | 0;
      break block5;
     }
     block64 : {
      block63 : {
       if (!(HEAP32[(0 + 77624 | 0) >> 2] | 0)) {
        break block63
       }
       $4_1 = HEAP32[(0 + 77632 | 0) >> 2] | 0;
       break block64;
      }
      i64toi32_i32$1 = 0;
      i64toi32_i32$0 = -1;
      HEAP32[(i64toi32_i32$1 + 77636 | 0) >> 2] = -1;
      HEAP32[(i64toi32_i32$1 + 77640 | 0) >> 2] = i64toi32_i32$0;
      i64toi32_i32$1 = 0;
      i64toi32_i32$0 = 4096;
      HEAP32[(i64toi32_i32$1 + 77628 | 0) >> 2] = 4096;
      HEAP32[(i64toi32_i32$1 + 77632 | 0) >> 2] = i64toi32_i32$0;
      HEAP32[(0 + 77624 | 0) >> 2] = (($1_1 + 12 | 0) & -16 | 0) ^ 1431655768 | 0;
      HEAP32[(0 + 77644 | 0) >> 2] = 0;
      HEAP32[(0 + 77596 | 0) >> 2] = 0;
      $4_1 = 4096;
     }
     $0_1 = 0;
     $7_1 = $3_1 + 47 | 0;
     $2_1 = $4_1 + $7_1 | 0;
     $12_1 = 0 - $4_1 | 0;
     $8_1 = $2_1 & $12_1 | 0;
     if ($8_1 >>> 0 <= $3_1 >>> 0) {
      break block5
     }
     $0_1 = 0;
     block65 : {
      $4_1 = HEAP32[(0 + 77592 | 0) >> 2] | 0;
      if (!$4_1) {
       break block65
      }
      $6_1 = HEAP32[(0 + 77584 | 0) >> 2] | 0;
      $11_1 = $6_1 + $8_1 | 0;
      if ($11_1 >>> 0 <= $6_1 >>> 0) {
       break block5
      }
      if ($11_1 >>> 0 > $4_1 >>> 0) {
       break block5
      }
     }
     block77 : {
      block74 : {
       block66 : {
        if ((HEAPU8[(0 + 77596 | 0) >> 0] | 0) & 4 | 0) {
         break block66
        }
        block70 : {
         block75 : {
          block73 : {
           block69 : {
            block67 : {
             $4_1 = HEAP32[(0 + 77176 | 0) >> 2] | 0;
             if (!$4_1) {
              break block67
             }
             $0_1 = 77600;
             label6 : while (1) {
              block68 : {
               $6_1 = HEAP32[$0_1 >> 2] | 0;
               if ($4_1 >>> 0 < $6_1 >>> 0) {
                break block68
               }
               if ($4_1 >>> 0 < ($6_1 + (HEAP32[($0_1 + 4 | 0) >> 2] | 0) | 0) >>> 0) {
                break block69
               }
              }
              $0_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
              if ($0_1) {
               continue label6
              }
              break label6;
             };
            }
            $5_1 = $190(0 | 0) | 0;
            if (($5_1 | 0) == (-1 | 0)) {
             break block70
            }
            $2_1 = $8_1;
            block71 : {
             $0_1 = HEAP32[(0 + 77628 | 0) >> 2] | 0;
             $4_1 = $0_1 + -1 | 0;
             if (!($4_1 & $5_1 | 0)) {
              break block71
             }
             $2_1 = ($8_1 - $5_1 | 0) + (($4_1 + $5_1 | 0) & (0 - $0_1 | 0) | 0) | 0;
            }
            if ($2_1 >>> 0 <= $3_1 >>> 0) {
             break block70
            }
            block72 : {
             $0_1 = HEAP32[(0 + 77592 | 0) >> 2] | 0;
             if (!$0_1) {
              break block72
             }
             $4_1 = HEAP32[(0 + 77584 | 0) >> 2] | 0;
             $6_1 = $4_1 + $2_1 | 0;
             if ($6_1 >>> 0 <= $4_1 >>> 0) {
              break block70
             }
             if ($6_1 >>> 0 > $0_1 >>> 0) {
              break block70
             }
            }
            $0_1 = $190($2_1 | 0) | 0;
            if (($0_1 | 0) != ($5_1 | 0)) {
             break block73
            }
            break block74;
           }
           $2_1 = ($2_1 - $5_1 | 0) & $12_1 | 0;
           $5_1 = $190($2_1 | 0) | 0;
           if (($5_1 | 0) == ((HEAP32[$0_1 >> 2] | 0) + (HEAP32[($0_1 + 4 | 0) >> 2] | 0) | 0 | 0)) {
            break block75
           }
           $0_1 = $5_1;
          }
          if (($0_1 | 0) == (-1 | 0)) {
           break block70
          }
          block76 : {
           if ($2_1 >>> 0 < ($3_1 + 48 | 0) >>> 0) {
            break block76
           }
           $5_1 = $0_1;
           break block74;
          }
          $4_1 = HEAP32[(0 + 77632 | 0) >> 2] | 0;
          $4_1 = (($7_1 - $2_1 | 0) + $4_1 | 0) & (0 - $4_1 | 0) | 0;
          if (($190($4_1 | 0) | 0 | 0) == (-1 | 0)) {
           break block70
          }
          $2_1 = $4_1 + $2_1 | 0;
          $5_1 = $0_1;
          break block74;
         }
         if (($5_1 | 0) != (-1 | 0)) {
          break block74
         }
        }
        HEAP32[(0 + 77596 | 0) >> 2] = HEAP32[(0 + 77596 | 0) >> 2] | 0 | 4 | 0;
       }
       $5_1 = $190($8_1 | 0) | 0;
       $0_1 = $190(0 | 0) | 0;
       if (($5_1 | 0) == (-1 | 0)) {
        break block77
       }
       if (($0_1 | 0) == (-1 | 0)) {
        break block77
       }
       if ($5_1 >>> 0 >= $0_1 >>> 0) {
        break block77
       }
       $2_1 = $0_1 - $5_1 | 0;
       if ($2_1 >>> 0 <= ($3_1 + 40 | 0) >>> 0) {
        break block77
       }
      }
      $0_1 = (HEAP32[(0 + 77584 | 0) >> 2] | 0) + $2_1 | 0;
      HEAP32[(0 + 77584 | 0) >> 2] = $0_1;
      block78 : {
       if ($0_1 >>> 0 <= (HEAP32[(0 + 77588 | 0) >> 2] | 0) >>> 0) {
        break block78
       }
       HEAP32[(0 + 77588 | 0) >> 2] = $0_1;
      }
      block84 : {
       block81 : {
        block80 : {
         block79 : {
          $4_1 = HEAP32[(0 + 77176 | 0) >> 2] | 0;
          if (!$4_1) {
           break block79
          }
          $0_1 = 77600;
          label7 : while (1) {
           $6_1 = HEAP32[$0_1 >> 2] | 0;
           $8_1 = HEAP32[($0_1 + 4 | 0) >> 2] | 0;
           if (($5_1 | 0) == ($6_1 + $8_1 | 0 | 0)) {
            break block80
           }
           $0_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
           if ($0_1) {
            continue label7
           }
           break block81;
          };
         }
         block83 : {
          block82 : {
           $0_1 = HEAP32[(0 + 77168 | 0) >> 2] | 0;
           if (!$0_1) {
            break block82
           }
           if ($5_1 >>> 0 >= $0_1 >>> 0) {
            break block83
           }
          }
          HEAP32[(0 + 77168 | 0) >> 2] = $5_1;
         }
         $0_1 = 0;
         HEAP32[(0 + 77604 | 0) >> 2] = $2_1;
         HEAP32[(0 + 77600 | 0) >> 2] = $5_1;
         HEAP32[(0 + 77184 | 0) >> 2] = -1;
         HEAP32[(0 + 77188 | 0) >> 2] = HEAP32[(0 + 77624 | 0) >> 2] | 0;
         HEAP32[(0 + 77612 | 0) >> 2] = 0;
         label8 : while (1) {
          $4_1 = $0_1 << 3 | 0;
          $6_1 = $4_1 + 77192 | 0;
          HEAP32[($4_1 + 77200 | 0) >> 2] = $6_1;
          HEAP32[($4_1 + 77204 | 0) >> 2] = $6_1;
          $0_1 = $0_1 + 1 | 0;
          if (($0_1 | 0) != (32 | 0)) {
           continue label8
          }
          break label8;
         };
         $0_1 = $2_1 + -40 | 0;
         $4_1 = (-8 - $5_1 | 0) & 7 | 0;
         $6_1 = $0_1 - $4_1 | 0;
         HEAP32[(0 + 77164 | 0) >> 2] = $6_1;
         $4_1 = $5_1 + $4_1 | 0;
         HEAP32[(0 + 77176 | 0) >> 2] = $4_1;
         HEAP32[($4_1 + 4 | 0) >> 2] = $6_1 | 1 | 0;
         HEAP32[(($5_1 + $0_1 | 0) + 4 | 0) >> 2] = 40;
         HEAP32[(0 + 77180 | 0) >> 2] = HEAP32[(0 + 77640 | 0) >> 2] | 0;
         break block84;
        }
        if ($4_1 >>> 0 >= $5_1 >>> 0) {
         break block81
        }
        if ($4_1 >>> 0 < $6_1 >>> 0) {
         break block81
        }
        if ((HEAP32[($0_1 + 12 | 0) >> 2] | 0) & 8 | 0) {
         break block81
        }
        HEAP32[($0_1 + 4 | 0) >> 2] = $8_1 + $2_1 | 0;
        $0_1 = (-8 - $4_1 | 0) & 7 | 0;
        $6_1 = $4_1 + $0_1 | 0;
        HEAP32[(0 + 77176 | 0) >> 2] = $6_1;
        $5_1 = (HEAP32[(0 + 77164 | 0) >> 2] | 0) + $2_1 | 0;
        $0_1 = $5_1 - $0_1 | 0;
        HEAP32[(0 + 77164 | 0) >> 2] = $0_1;
        HEAP32[($6_1 + 4 | 0) >> 2] = $0_1 | 1 | 0;
        HEAP32[(($4_1 + $5_1 | 0) + 4 | 0) >> 2] = 40;
        HEAP32[(0 + 77180 | 0) >> 2] = HEAP32[(0 + 77640 | 0) >> 2] | 0;
        break block84;
       }
       block85 : {
        if ($5_1 >>> 0 >= (HEAP32[(0 + 77168 | 0) >> 2] | 0) >>> 0) {
         break block85
        }
        HEAP32[(0 + 77168 | 0) >> 2] = $5_1;
       }
       $6_1 = $5_1 + $2_1 | 0;
       $0_1 = 77600;
       block87 : {
        block86 : {
         label9 : while (1) {
          $8_1 = HEAP32[$0_1 >> 2] | 0;
          if (($8_1 | 0) == ($6_1 | 0)) {
           break block86
          }
          $0_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
          if ($0_1) {
           continue label9
          }
          break block87;
         };
        }
        if (!((HEAPU8[($0_1 + 12 | 0) >> 0] | 0) & 8 | 0)) {
         break block88
        }
       }
       $0_1 = 77600;
       block90 : {
        label10 : while (1) {
         block89 : {
          $6_1 = HEAP32[$0_1 >> 2] | 0;
          if ($4_1 >>> 0 < $6_1 >>> 0) {
           break block89
          }
          $6_1 = $6_1 + (HEAP32[($0_1 + 4 | 0) >> 2] | 0) | 0;
          if ($4_1 >>> 0 < $6_1 >>> 0) {
           break block90
          }
         }
         $0_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
         continue label10;
        };
       }
       $0_1 = $2_1 + -40 | 0;
       $8_1 = (-8 - $5_1 | 0) & 7 | 0;
       $12_1 = $0_1 - $8_1 | 0;
       HEAP32[(0 + 77164 | 0) >> 2] = $12_1;
       $8_1 = $5_1 + $8_1 | 0;
       HEAP32[(0 + 77176 | 0) >> 2] = $8_1;
       HEAP32[($8_1 + 4 | 0) >> 2] = $12_1 | 1 | 0;
       HEAP32[(($5_1 + $0_1 | 0) + 4 | 0) >> 2] = 40;
       HEAP32[(0 + 77180 | 0) >> 2] = HEAP32[(0 + 77640 | 0) >> 2] | 0;
       $0_1 = ($6_1 + ((39 - $6_1 | 0) & 7 | 0) | 0) + -47 | 0;
       $8_1 = $0_1 >>> 0 < ($4_1 + 16 | 0) >>> 0 ? $4_1 : $0_1;
       HEAP32[($8_1 + 4 | 0) >> 2] = 27;
       i64toi32_i32$2 = 0;
       i64toi32_i32$0 = HEAP32[(i64toi32_i32$2 + 77608 | 0) >> 2] | 0;
       i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 77612 | 0) >> 2] | 0;
       $1142 = i64toi32_i32$0;
       i64toi32_i32$0 = $8_1;
       HEAP32[($8_1 + 16 | 0) >> 2] = $1142;
       HEAP32[($8_1 + 20 | 0) >> 2] = i64toi32_i32$1;
       i64toi32_i32$2 = 0;
       i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 77600 | 0) >> 2] | 0;
       i64toi32_i32$0 = HEAP32[(i64toi32_i32$2 + 77604 | 0) >> 2] | 0;
       $1144 = i64toi32_i32$1;
       i64toi32_i32$1 = $8_1;
       HEAP32[($8_1 + 8 | 0) >> 2] = $1144;
       HEAP32[($8_1 + 12 | 0) >> 2] = i64toi32_i32$0;
       HEAP32[(0 + 77608 | 0) >> 2] = $8_1 + 8 | 0;
       HEAP32[(0 + 77604 | 0) >> 2] = $2_1;
       HEAP32[(0 + 77600 | 0) >> 2] = $5_1;
       HEAP32[(0 + 77612 | 0) >> 2] = 0;
       $0_1 = $8_1 + 24 | 0;
       label11 : while (1) {
        HEAP32[($0_1 + 4 | 0) >> 2] = 7;
        $5_1 = $0_1 + 8 | 0;
        $0_1 = $0_1 + 4 | 0;
        if ($5_1 >>> 0 < $6_1 >>> 0) {
         continue label11
        }
        break label11;
       };
       if (($8_1 | 0) == ($4_1 | 0)) {
        break block84
       }
       HEAP32[($8_1 + 4 | 0) >> 2] = (HEAP32[($8_1 + 4 | 0) >> 2] | 0) & -2 | 0;
       $5_1 = $8_1 - $4_1 | 0;
       HEAP32[($4_1 + 4 | 0) >> 2] = $5_1 | 1 | 0;
       HEAP32[$8_1 >> 2] = $5_1;
       block94 : {
        block91 : {
         if ($5_1 >>> 0 > 255 >>> 0) {
          break block91
         }
         $0_1 = ($5_1 & 248 | 0) + 77192 | 0;
         block93 : {
          block92 : {
           $6_1 = HEAP32[(0 + 77152 | 0) >> 2] | 0;
           $5_1 = 1 << ($5_1 >>> 3 | 0) | 0;
           if ($6_1 & $5_1 | 0) {
            break block92
           }
           HEAP32[(0 + 77152 | 0) >> 2] = $6_1 | $5_1 | 0;
           $6_1 = $0_1;
           break block93;
          }
          $6_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
          if ($6_1 >>> 0 < (HEAP32[(0 + 77168 | 0) >> 2] | 0) >>> 0) {
           break block4
          }
         }
         HEAP32[($0_1 + 8 | 0) >> 2] = $4_1;
         HEAP32[($6_1 + 12 | 0) >> 2] = $4_1;
         $5_1 = 12;
         $8_1 = 8;
         break block94;
        }
        $0_1 = 31;
        block95 : {
         if ($5_1 >>> 0 > 16777215 >>> 0) {
          break block95
         }
         $0_1 = Math_clz32($5_1 >>> 8 | 0);
         $0_1 = (($5_1 >>> (38 - $0_1 | 0) | 0) & 1 | 0 | ($0_1 << 1 | 0) | 0) ^ 62 | 0;
        }
        HEAP32[($4_1 + 28 | 0) >> 2] = $0_1;
        i64toi32_i32$1 = $4_1;
        i64toi32_i32$0 = 0;
        HEAP32[($4_1 + 16 | 0) >> 2] = 0;
        HEAP32[($4_1 + 20 | 0) >> 2] = i64toi32_i32$0;
        $6_1 = ($0_1 << 2 | 0) + 77456 | 0;
        block98 : {
         block97 : {
          block96 : {
           $8_1 = HEAP32[(0 + 77156 | 0) >> 2] | 0;
           $2_1 = 1 << $0_1 | 0;
           if ($8_1 & $2_1 | 0) {
            break block96
           }
           HEAP32[(0 + 77156 | 0) >> 2] = $8_1 | $2_1 | 0;
           HEAP32[$6_1 >> 2] = $4_1;
           HEAP32[($4_1 + 24 | 0) >> 2] = $6_1;
           break block97;
          }
          $0_1 = $5_1 << (($0_1 | 0) == (31 | 0) ? 0 : 25 - ($0_1 >>> 1 | 0) | 0) | 0;
          $8_1 = HEAP32[$6_1 >> 2] | 0;
          label12 : while (1) {
           $6_1 = $8_1;
           if (((HEAP32[($6_1 + 4 | 0) >> 2] | 0) & -8 | 0 | 0) == ($5_1 | 0)) {
            break block98
           }
           $8_1 = $0_1 >>> 29 | 0;
           $0_1 = $0_1 << 1 | 0;
           $2_1 = $6_1 + ($8_1 & 4 | 0) | 0;
           $8_1 = HEAP32[($2_1 + 16 | 0) >> 2] | 0;
           if ($8_1) {
            continue label12
           }
           break label12;
          };
          $0_1 = $2_1 + 16 | 0;
          if ($0_1 >>> 0 < (HEAP32[(0 + 77168 | 0) >> 2] | 0) >>> 0) {
           break block4
          }
          HEAP32[$0_1 >> 2] = $4_1;
          HEAP32[($4_1 + 24 | 0) >> 2] = $6_1;
         }
         $5_1 = 8;
         $8_1 = 12;
         $6_1 = $4_1;
         $0_1 = $6_1;
         break block94;
        }
        $5_1 = HEAP32[(0 + 77168 | 0) >> 2] | 0;
        if ($6_1 >>> 0 < $5_1 >>> 0) {
         break block4
        }
        $0_1 = HEAP32[($6_1 + 8 | 0) >> 2] | 0;
        if ($0_1 >>> 0 < $5_1 >>> 0) {
         break block4
        }
        HEAP32[($0_1 + 12 | 0) >> 2] = $4_1;
        HEAP32[($6_1 + 8 | 0) >> 2] = $4_1;
        HEAP32[($4_1 + 8 | 0) >> 2] = $0_1;
        $0_1 = 0;
        $5_1 = 24;
        $8_1 = 12;
       }
       HEAP32[($4_1 + $8_1 | 0) >> 2] = $6_1;
       HEAP32[($4_1 + $5_1 | 0) >> 2] = $0_1;
      }
      $0_1 = HEAP32[(0 + 77164 | 0) >> 2] | 0;
      if ($0_1 >>> 0 <= $3_1 >>> 0) {
       break block77
      }
      $4_1 = $0_1 - $3_1 | 0;
      HEAP32[(0 + 77164 | 0) >> 2] = $4_1;
      $0_1 = HEAP32[(0 + 77176 | 0) >> 2] | 0;
      $6_1 = $0_1 + $3_1 | 0;
      HEAP32[(0 + 77176 | 0) >> 2] = $6_1;
      HEAP32[($6_1 + 4 | 0) >> 2] = $4_1 | 1 | 0;
      HEAP32[($0_1 + 4 | 0) >> 2] = $3_1 | 3 | 0;
      $0_1 = $0_1 + 8 | 0;
      break block5;
     }
     (wasm2js_i32$0 = $134() | 0, wasm2js_i32$1 = 48), HEAP32[wasm2js_i32$0 >> 2] = wasm2js_i32$1;
     $0_1 = 0;
     break block5;
    }
    $158();
    wasm2js_trap();
   }
   HEAP32[$0_1 >> 2] = $5_1;
   HEAP32[($0_1 + 4 | 0) >> 2] = (HEAP32[($0_1 + 4 | 0) >> 2] | 0) + $2_1 | 0;
   $0_1 = $183($5_1 | 0, $8_1 | 0, $3_1 | 0) | 0;
  }
  global$0 = $1_1 + 16 | 0;
  return $0_1 | 0;
 }
 
 function $183($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $4_1 = 0, $5_1 = 0, $7_1 = 0, $6_1 = 0, $8_1 = 0, $3_1 = 0, $9_1 = 0, $352 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $3_1 = $0_1 + ((-8 - $0_1 | 0) & 7 | 0) | 0;
  HEAP32[($3_1 + 4 | 0) >> 2] = $2_1 | 3 | 0;
  $4_1 = $1_1 + ((-8 - $1_1 | 0) & 7 | 0) | 0;
  $5_1 = $3_1 + $2_1 | 0;
  $0_1 = $4_1 - $5_1 | 0;
  block6 : {
   block1 : {
    block : {
     if (($4_1 | 0) != (HEAP32[(0 + 77176 | 0) >> 2] | 0 | 0)) {
      break block
     }
     HEAP32[(0 + 77176 | 0) >> 2] = $5_1;
     $2_1 = (HEAP32[(0 + 77164 | 0) >> 2] | 0) + $0_1 | 0;
     HEAP32[(0 + 77164 | 0) >> 2] = $2_1;
     HEAP32[($5_1 + 4 | 0) >> 2] = $2_1 | 1 | 0;
     break block1;
    }
    block2 : {
     if (($4_1 | 0) != (HEAP32[(0 + 77172 | 0) >> 2] | 0 | 0)) {
      break block2
     }
     HEAP32[(0 + 77172 | 0) >> 2] = $5_1;
     $2_1 = (HEAP32[(0 + 77160 | 0) >> 2] | 0) + $0_1 | 0;
     HEAP32[(0 + 77160 | 0) >> 2] = $2_1;
     HEAP32[($5_1 + 4 | 0) >> 2] = $2_1 | 1 | 0;
     HEAP32[($5_1 + $2_1 | 0) >> 2] = $2_1;
     break block1;
    }
    block3 : {
     $6_1 = HEAP32[($4_1 + 4 | 0) >> 2] | 0;
     if (($6_1 & 3 | 0 | 0) != (1 | 0)) {
      break block3
     }
     $2_1 = HEAP32[($4_1 + 12 | 0) >> 2] | 0;
     block8 : {
      block4 : {
       if ($6_1 >>> 0 > 255 >>> 0) {
        break block4
       }
       block5 : {
        $1_1 = HEAP32[($4_1 + 8 | 0) >> 2] | 0;
        $7_1 = ($6_1 & 248 | 0) + 77192 | 0;
        if (($1_1 | 0) == ($7_1 | 0)) {
         break block5
        }
        if ($1_1 >>> 0 < (HEAP32[(0 + 77168 | 0) >> 2] | 0) >>> 0) {
         break block6
        }
        if ((HEAP32[($1_1 + 12 | 0) >> 2] | 0 | 0) != ($4_1 | 0)) {
         break block6
        }
       }
       block7 : {
        if (($2_1 | 0) != ($1_1 | 0)) {
         break block7
        }
        (wasm2js_i32$0 = 0, wasm2js_i32$1 = (HEAP32[(0 + 77152 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $6_1 >>> 3 | 0 | 0) | 0) | 0), HEAP32[(wasm2js_i32$0 + 77152 | 0) >> 2] = wasm2js_i32$1;
        break block8;
       }
       block9 : {
        if (($2_1 | 0) == ($7_1 | 0)) {
         break block9
        }
        if ($2_1 >>> 0 < (HEAP32[(0 + 77168 | 0) >> 2] | 0) >>> 0) {
         break block6
        }
        if ((HEAP32[($2_1 + 8 | 0) >> 2] | 0 | 0) != ($4_1 | 0)) {
         break block6
        }
       }
       HEAP32[($1_1 + 12 | 0) >> 2] = $2_1;
       HEAP32[($2_1 + 8 | 0) >> 2] = $1_1;
       break block8;
      }
      $8_1 = HEAP32[($4_1 + 24 | 0) >> 2] | 0;
      block11 : {
       block10 : {
        if (($2_1 | 0) == ($4_1 | 0)) {
         break block10
        }
        $1_1 = HEAP32[($4_1 + 8 | 0) >> 2] | 0;
        if ($1_1 >>> 0 < (HEAP32[(0 + 77168 | 0) >> 2] | 0) >>> 0) {
         break block6
        }
        if ((HEAP32[($1_1 + 12 | 0) >> 2] | 0 | 0) != ($4_1 | 0)) {
         break block6
        }
        if ((HEAP32[($2_1 + 8 | 0) >> 2] | 0 | 0) != ($4_1 | 0)) {
         break block6
        }
        HEAP32[($1_1 + 12 | 0) >> 2] = $2_1;
        HEAP32[($2_1 + 8 | 0) >> 2] = $1_1;
        break block11;
       }
       block14 : {
        block13 : {
         block12 : {
          $1_1 = HEAP32[($4_1 + 20 | 0) >> 2] | 0;
          if (!$1_1) {
           break block12
          }
          $7_1 = $4_1 + 20 | 0;
          break block13;
         }
         $1_1 = HEAP32[($4_1 + 16 | 0) >> 2] | 0;
         if (!$1_1) {
          break block14
         }
         $7_1 = $4_1 + 16 | 0;
        }
        label : while (1) {
         $9_1 = $7_1;
         $2_1 = $1_1;
         $7_1 = $2_1 + 20 | 0;
         $1_1 = HEAP32[($2_1 + 20 | 0) >> 2] | 0;
         if ($1_1) {
          continue label
         }
         $7_1 = $2_1 + 16 | 0;
         $1_1 = HEAP32[($2_1 + 16 | 0) >> 2] | 0;
         if ($1_1) {
          continue label
         }
         break label;
        };
        if ($9_1 >>> 0 < (HEAP32[(0 + 77168 | 0) >> 2] | 0) >>> 0) {
         break block6
        }
        HEAP32[$9_1 >> 2] = 0;
        break block11;
       }
       $2_1 = 0;
      }
      if (!$8_1) {
       break block8
      }
      block16 : {
       block15 : {
        $7_1 = HEAP32[($4_1 + 28 | 0) >> 2] | 0;
        $1_1 = $7_1 << 2 | 0;
        if (($4_1 | 0) != (HEAP32[($1_1 + 77456 | 0) >> 2] | 0 | 0)) {
         break block15
        }
        HEAP32[($1_1 + 77456 | 0) >> 2] = $2_1;
        if ($2_1) {
         break block16
        }
        (wasm2js_i32$0 = 0, wasm2js_i32$1 = (HEAP32[(0 + 77156 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $7_1 | 0) | 0) | 0), HEAP32[(wasm2js_i32$0 + 77156 | 0) >> 2] = wasm2js_i32$1;
        break block8;
       }
       if ($8_1 >>> 0 < (HEAP32[(0 + 77168 | 0) >> 2] | 0) >>> 0) {
        break block6
       }
       block18 : {
        block17 : {
         if ((HEAP32[($8_1 + 16 | 0) >> 2] | 0 | 0) != ($4_1 | 0)) {
          break block17
         }
         HEAP32[($8_1 + 16 | 0) >> 2] = $2_1;
         break block18;
        }
        HEAP32[($8_1 + 20 | 0) >> 2] = $2_1;
       }
       if (!$2_1) {
        break block8
       }
      }
      $7_1 = HEAP32[(0 + 77168 | 0) >> 2] | 0;
      if ($2_1 >>> 0 < $7_1 >>> 0) {
       break block6
      }
      HEAP32[($2_1 + 24 | 0) >> 2] = $8_1;
      block19 : {
       $1_1 = HEAP32[($4_1 + 16 | 0) >> 2] | 0;
       if (!$1_1) {
        break block19
       }
       if ($1_1 >>> 0 < $7_1 >>> 0) {
        break block6
       }
       HEAP32[($2_1 + 16 | 0) >> 2] = $1_1;
       HEAP32[($1_1 + 24 | 0) >> 2] = $2_1;
      }
      $1_1 = HEAP32[($4_1 + 20 | 0) >> 2] | 0;
      if (!$1_1) {
       break block8
      }
      if ($1_1 >>> 0 < $7_1 >>> 0) {
       break block6
      }
      HEAP32[($2_1 + 20 | 0) >> 2] = $1_1;
      HEAP32[($1_1 + 24 | 0) >> 2] = $2_1;
     }
     $2_1 = $6_1 & -8 | 0;
     $0_1 = $2_1 + $0_1 | 0;
     $4_1 = $4_1 + $2_1 | 0;
     $6_1 = HEAP32[($4_1 + 4 | 0) >> 2] | 0;
    }
    HEAP32[($4_1 + 4 | 0) >> 2] = $6_1 & -2 | 0;
    HEAP32[($5_1 + 4 | 0) >> 2] = $0_1 | 1 | 0;
    HEAP32[($5_1 + $0_1 | 0) >> 2] = $0_1;
    block20 : {
     if ($0_1 >>> 0 > 255 >>> 0) {
      break block20
     }
     $2_1 = ($0_1 & 248 | 0) + 77192 | 0;
     block22 : {
      block21 : {
       $1_1 = HEAP32[(0 + 77152 | 0) >> 2] | 0;
       $0_1 = 1 << ($0_1 >>> 3 | 0) | 0;
       if ($1_1 & $0_1 | 0) {
        break block21
       }
       HEAP32[(0 + 77152 | 0) >> 2] = $1_1 | $0_1 | 0;
       $0_1 = $2_1;
       break block22;
      }
      $0_1 = HEAP32[($2_1 + 8 | 0) >> 2] | 0;
      if ($0_1 >>> 0 < (HEAP32[(0 + 77168 | 0) >> 2] | 0) >>> 0) {
       break block6
      }
     }
     HEAP32[($2_1 + 8 | 0) >> 2] = $5_1;
     HEAP32[($0_1 + 12 | 0) >> 2] = $5_1;
     HEAP32[($5_1 + 12 | 0) >> 2] = $2_1;
     HEAP32[($5_1 + 8 | 0) >> 2] = $0_1;
     break block1;
    }
    $2_1 = 31;
    block23 : {
     if ($0_1 >>> 0 > 16777215 >>> 0) {
      break block23
     }
     $2_1 = Math_clz32($0_1 >>> 8 | 0);
     $2_1 = (($0_1 >>> (38 - $2_1 | 0) | 0) & 1 | 0 | ($2_1 << 1 | 0) | 0) ^ 62 | 0;
    }
    HEAP32[($5_1 + 28 | 0) >> 2] = $2_1;
    HEAP32[($5_1 + 16 | 0) >> 2] = 0;
    HEAP32[($5_1 + 20 | 0) >> 2] = 0;
    $1_1 = ($2_1 << 2 | 0) + 77456 | 0;
    block26 : {
     block25 : {
      block24 : {
       $7_1 = HEAP32[(0 + 77156 | 0) >> 2] | 0;
       $4_1 = 1 << $2_1 | 0;
       if ($7_1 & $4_1 | 0) {
        break block24
       }
       HEAP32[(0 + 77156 | 0) >> 2] = $7_1 | $4_1 | 0;
       HEAP32[$1_1 >> 2] = $5_1;
       HEAP32[($5_1 + 24 | 0) >> 2] = $1_1;
       break block25;
      }
      $2_1 = $0_1 << (($2_1 | 0) == (31 | 0) ? 0 : 25 - ($2_1 >>> 1 | 0) | 0) | 0;
      $7_1 = HEAP32[$1_1 >> 2] | 0;
      label1 : while (1) {
       $1_1 = $7_1;
       if (((HEAP32[($1_1 + 4 | 0) >> 2] | 0) & -8 | 0 | 0) == ($0_1 | 0)) {
        break block26
       }
       $7_1 = $2_1 >>> 29 | 0;
       $2_1 = $2_1 << 1 | 0;
       $4_1 = $1_1 + ($7_1 & 4 | 0) | 0;
       $7_1 = HEAP32[($4_1 + 16 | 0) >> 2] | 0;
       if ($7_1) {
        continue label1
       }
       break label1;
      };
      $2_1 = $4_1 + 16 | 0;
      if ($2_1 >>> 0 < (HEAP32[(0 + 77168 | 0) >> 2] | 0) >>> 0) {
       break block6
      }
      HEAP32[$2_1 >> 2] = $5_1;
      HEAP32[($5_1 + 24 | 0) >> 2] = $1_1;
     }
     HEAP32[($5_1 + 12 | 0) >> 2] = $5_1;
     HEAP32[($5_1 + 8 | 0) >> 2] = $5_1;
     break block1;
    }
    $0_1 = HEAP32[(0 + 77168 | 0) >> 2] | 0;
    if ($1_1 >>> 0 < $0_1 >>> 0) {
     break block6
    }
    $2_1 = HEAP32[($1_1 + 8 | 0) >> 2] | 0;
    if ($2_1 >>> 0 < $0_1 >>> 0) {
     break block6
    }
    HEAP32[($2_1 + 12 | 0) >> 2] = $5_1;
    HEAP32[($1_1 + 8 | 0) >> 2] = $5_1;
    HEAP32[($5_1 + 24 | 0) >> 2] = 0;
    HEAP32[($5_1 + 12 | 0) >> 2] = $1_1;
    HEAP32[($5_1 + 8 | 0) >> 2] = $2_1;
   }
   return $3_1 + 8 | 0 | 0;
  }
  $158();
  wasm2js_trap();
 }
 
 function $184($0_1) {
  $0_1 = $0_1 | 0;
  var $3_1 = 0, $5_1 = 0, $1_1 = 0, $6_1 = 0, $4_1 = 0, $2_1 = 0, $7_1 = 0, $8_1 = 0, $10_1 = 0, $9_1 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  block1 : {
   block : {
    if (!$0_1) {
     break block
    }
    $1_1 = $0_1 + -8 | 0;
    $2_1 = HEAP32[(0 + 77168 | 0) >> 2] | 0;
    if ($1_1 >>> 0 < $2_1 >>> 0) {
     break block1
    }
    $3_1 = HEAP32[($0_1 + -4 | 0) >> 2] | 0;
    if (($3_1 & 3 | 0 | 0) == (1 | 0)) {
     break block1
    }
    $0_1 = $3_1 & -8 | 0;
    $4_1 = $1_1 + $0_1 | 0;
    block2 : {
     if ($3_1 & 1 | 0) {
      break block2
     }
     if (!($3_1 & 2 | 0)) {
      break block
     }
     $5_1 = HEAP32[$1_1 >> 2] | 0;
     $1_1 = $1_1 - $5_1 | 0;
     if ($1_1 >>> 0 < $2_1 >>> 0) {
      break block1
     }
     $0_1 = $5_1 + $0_1 | 0;
     block3 : {
      if (($1_1 | 0) == (HEAP32[(0 + 77172 | 0) >> 2] | 0 | 0)) {
       break block3
      }
      $3_1 = HEAP32[($1_1 + 12 | 0) >> 2] | 0;
      block4 : {
       if ($5_1 >>> 0 > 255 >>> 0) {
        break block4
       }
       block5 : {
        $6_1 = HEAP32[($1_1 + 8 | 0) >> 2] | 0;
        $7_1 = ($5_1 & 248 | 0) + 77192 | 0;
        if (($6_1 | 0) == ($7_1 | 0)) {
         break block5
        }
        if ($6_1 >>> 0 < $2_1 >>> 0) {
         break block1
        }
        if ((HEAP32[($6_1 + 12 | 0) >> 2] | 0 | 0) != ($1_1 | 0)) {
         break block1
        }
       }
       block6 : {
        if (($3_1 | 0) != ($6_1 | 0)) {
         break block6
        }
        (wasm2js_i32$0 = 0, wasm2js_i32$1 = (HEAP32[(0 + 77152 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $5_1 >>> 3 | 0 | 0) | 0) | 0), HEAP32[(wasm2js_i32$0 + 77152 | 0) >> 2] = wasm2js_i32$1;
        break block2;
       }
       block7 : {
        if (($3_1 | 0) == ($7_1 | 0)) {
         break block7
        }
        if ($3_1 >>> 0 < $2_1 >>> 0) {
         break block1
        }
        if ((HEAP32[($3_1 + 8 | 0) >> 2] | 0 | 0) != ($1_1 | 0)) {
         break block1
        }
       }
       HEAP32[($6_1 + 12 | 0) >> 2] = $3_1;
       HEAP32[($3_1 + 8 | 0) >> 2] = $6_1;
       break block2;
      }
      $8_1 = HEAP32[($1_1 + 24 | 0) >> 2] | 0;
      block9 : {
       block8 : {
        if (($3_1 | 0) == ($1_1 | 0)) {
         break block8
        }
        $5_1 = HEAP32[($1_1 + 8 | 0) >> 2] | 0;
        if ($5_1 >>> 0 < $2_1 >>> 0) {
         break block1
        }
        if ((HEAP32[($5_1 + 12 | 0) >> 2] | 0 | 0) != ($1_1 | 0)) {
         break block1
        }
        if ((HEAP32[($3_1 + 8 | 0) >> 2] | 0 | 0) != ($1_1 | 0)) {
         break block1
        }
        HEAP32[($5_1 + 12 | 0) >> 2] = $3_1;
        HEAP32[($3_1 + 8 | 0) >> 2] = $5_1;
        break block9;
       }
       block12 : {
        block11 : {
         block10 : {
          $5_1 = HEAP32[($1_1 + 20 | 0) >> 2] | 0;
          if (!$5_1) {
           break block10
          }
          $6_1 = $1_1 + 20 | 0;
          break block11;
         }
         $5_1 = HEAP32[($1_1 + 16 | 0) >> 2] | 0;
         if (!$5_1) {
          break block12
         }
         $6_1 = $1_1 + 16 | 0;
        }
        label : while (1) {
         $7_1 = $6_1;
         $3_1 = $5_1;
         $6_1 = $3_1 + 20 | 0;
         $5_1 = HEAP32[($3_1 + 20 | 0) >> 2] | 0;
         if ($5_1) {
          continue label
         }
         $6_1 = $3_1 + 16 | 0;
         $5_1 = HEAP32[($3_1 + 16 | 0) >> 2] | 0;
         if ($5_1) {
          continue label
         }
         break label;
        };
        if ($7_1 >>> 0 < $2_1 >>> 0) {
         break block1
        }
        HEAP32[$7_1 >> 2] = 0;
        break block9;
       }
       $3_1 = 0;
      }
      if (!$8_1) {
       break block2
      }
      block14 : {
       block13 : {
        $6_1 = HEAP32[($1_1 + 28 | 0) >> 2] | 0;
        $5_1 = $6_1 << 2 | 0;
        if (($1_1 | 0) != (HEAP32[($5_1 + 77456 | 0) >> 2] | 0 | 0)) {
         break block13
        }
        HEAP32[($5_1 + 77456 | 0) >> 2] = $3_1;
        if ($3_1) {
         break block14
        }
        (wasm2js_i32$0 = 0, wasm2js_i32$1 = (HEAP32[(0 + 77156 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $6_1 | 0) | 0) | 0), HEAP32[(wasm2js_i32$0 + 77156 | 0) >> 2] = wasm2js_i32$1;
        break block2;
       }
       if ($8_1 >>> 0 < $2_1 >>> 0) {
        break block1
       }
       block16 : {
        block15 : {
         if ((HEAP32[($8_1 + 16 | 0) >> 2] | 0 | 0) != ($1_1 | 0)) {
          break block15
         }
         HEAP32[($8_1 + 16 | 0) >> 2] = $3_1;
         break block16;
        }
        HEAP32[($8_1 + 20 | 0) >> 2] = $3_1;
       }
       if (!$3_1) {
        break block2
       }
      }
      if ($3_1 >>> 0 < $2_1 >>> 0) {
       break block1
      }
      HEAP32[($3_1 + 24 | 0) >> 2] = $8_1;
      block17 : {
       $5_1 = HEAP32[($1_1 + 16 | 0) >> 2] | 0;
       if (!$5_1) {
        break block17
       }
       if ($5_1 >>> 0 < $2_1 >>> 0) {
        break block1
       }
       HEAP32[($3_1 + 16 | 0) >> 2] = $5_1;
       HEAP32[($5_1 + 24 | 0) >> 2] = $3_1;
      }
      $5_1 = HEAP32[($1_1 + 20 | 0) >> 2] | 0;
      if (!$5_1) {
       break block2
      }
      if ($5_1 >>> 0 < $2_1 >>> 0) {
       break block1
      }
      HEAP32[($3_1 + 20 | 0) >> 2] = $5_1;
      HEAP32[($5_1 + 24 | 0) >> 2] = $3_1;
      break block2;
     }
     $3_1 = HEAP32[($4_1 + 4 | 0) >> 2] | 0;
     if (($3_1 & 3 | 0 | 0) != (3 | 0)) {
      break block2
     }
     HEAP32[(0 + 77160 | 0) >> 2] = $0_1;
     HEAP32[($4_1 + 4 | 0) >> 2] = $3_1 & -2 | 0;
     HEAP32[($1_1 + 4 | 0) >> 2] = $0_1 | 1 | 0;
     HEAP32[$4_1 >> 2] = $0_1;
     return;
    }
    if ($1_1 >>> 0 >= $4_1 >>> 0) {
     break block1
    }
    $7_1 = HEAP32[($4_1 + 4 | 0) >> 2] | 0;
    if (!($7_1 & 1 | 0)) {
     break block1
    }
    block36 : {
     block18 : {
      if ($7_1 & 2 | 0) {
       break block18
      }
      block19 : {
       if (($4_1 | 0) != (HEAP32[(0 + 77176 | 0) >> 2] | 0 | 0)) {
        break block19
       }
       HEAP32[(0 + 77176 | 0) >> 2] = $1_1;
       $0_1 = (HEAP32[(0 + 77164 | 0) >> 2] | 0) + $0_1 | 0;
       HEAP32[(0 + 77164 | 0) >> 2] = $0_1;
       HEAP32[($1_1 + 4 | 0) >> 2] = $0_1 | 1 | 0;
       if (($1_1 | 0) != (HEAP32[(0 + 77172 | 0) >> 2] | 0 | 0)) {
        break block
       }
       HEAP32[(0 + 77160 | 0) >> 2] = 0;
       HEAP32[(0 + 77172 | 0) >> 2] = 0;
       return;
      }
      block20 : {
       $9_1 = HEAP32[(0 + 77172 | 0) >> 2] | 0;
       if (($4_1 | 0) != ($9_1 | 0)) {
        break block20
       }
       HEAP32[(0 + 77172 | 0) >> 2] = $1_1;
       $0_1 = (HEAP32[(0 + 77160 | 0) >> 2] | 0) + $0_1 | 0;
       HEAP32[(0 + 77160 | 0) >> 2] = $0_1;
       HEAP32[($1_1 + 4 | 0) >> 2] = $0_1 | 1 | 0;
       HEAP32[($1_1 + $0_1 | 0) >> 2] = $0_1;
       return;
      }
      $3_1 = HEAP32[($4_1 + 12 | 0) >> 2] | 0;
      block24 : {
       block21 : {
        if ($7_1 >>> 0 > 255 >>> 0) {
         break block21
        }
        block22 : {
         $5_1 = HEAP32[($4_1 + 8 | 0) >> 2] | 0;
         $6_1 = ($7_1 & 248 | 0) + 77192 | 0;
         if (($5_1 | 0) == ($6_1 | 0)) {
          break block22
         }
         if ($5_1 >>> 0 < $2_1 >>> 0) {
          break block1
         }
         if ((HEAP32[($5_1 + 12 | 0) >> 2] | 0 | 0) != ($4_1 | 0)) {
          break block1
         }
        }
        block23 : {
         if (($3_1 | 0) != ($5_1 | 0)) {
          break block23
         }
         (wasm2js_i32$0 = 0, wasm2js_i32$1 = (HEAP32[(0 + 77152 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $7_1 >>> 3 | 0 | 0) | 0) | 0), HEAP32[(wasm2js_i32$0 + 77152 | 0) >> 2] = wasm2js_i32$1;
         break block24;
        }
        block25 : {
         if (($3_1 | 0) == ($6_1 | 0)) {
          break block25
         }
         if ($3_1 >>> 0 < $2_1 >>> 0) {
          break block1
         }
         if ((HEAP32[($3_1 + 8 | 0) >> 2] | 0 | 0) != ($4_1 | 0)) {
          break block1
         }
        }
        HEAP32[($5_1 + 12 | 0) >> 2] = $3_1;
        HEAP32[($3_1 + 8 | 0) >> 2] = $5_1;
        break block24;
       }
       $10_1 = HEAP32[($4_1 + 24 | 0) >> 2] | 0;
       block27 : {
        block26 : {
         if (($3_1 | 0) == ($4_1 | 0)) {
          break block26
         }
         $5_1 = HEAP32[($4_1 + 8 | 0) >> 2] | 0;
         if ($5_1 >>> 0 < $2_1 >>> 0) {
          break block1
         }
         if ((HEAP32[($5_1 + 12 | 0) >> 2] | 0 | 0) != ($4_1 | 0)) {
          break block1
         }
         if ((HEAP32[($3_1 + 8 | 0) >> 2] | 0 | 0) != ($4_1 | 0)) {
          break block1
         }
         HEAP32[($5_1 + 12 | 0) >> 2] = $3_1;
         HEAP32[($3_1 + 8 | 0) >> 2] = $5_1;
         break block27;
        }
        block30 : {
         block29 : {
          block28 : {
           $5_1 = HEAP32[($4_1 + 20 | 0) >> 2] | 0;
           if (!$5_1) {
            break block28
           }
           $6_1 = $4_1 + 20 | 0;
           break block29;
          }
          $5_1 = HEAP32[($4_1 + 16 | 0) >> 2] | 0;
          if (!$5_1) {
           break block30
          }
          $6_1 = $4_1 + 16 | 0;
         }
         label1 : while (1) {
          $8_1 = $6_1;
          $3_1 = $5_1;
          $6_1 = $3_1 + 20 | 0;
          $5_1 = HEAP32[($3_1 + 20 | 0) >> 2] | 0;
          if ($5_1) {
           continue label1
          }
          $6_1 = $3_1 + 16 | 0;
          $5_1 = HEAP32[($3_1 + 16 | 0) >> 2] | 0;
          if ($5_1) {
           continue label1
          }
          break label1;
         };
         if ($8_1 >>> 0 < $2_1 >>> 0) {
          break block1
         }
         HEAP32[$8_1 >> 2] = 0;
         break block27;
        }
        $3_1 = 0;
       }
       if (!$10_1) {
        break block24
       }
       block32 : {
        block31 : {
         $6_1 = HEAP32[($4_1 + 28 | 0) >> 2] | 0;
         $5_1 = $6_1 << 2 | 0;
         if (($4_1 | 0) != (HEAP32[($5_1 + 77456 | 0) >> 2] | 0 | 0)) {
          break block31
         }
         HEAP32[($5_1 + 77456 | 0) >> 2] = $3_1;
         if ($3_1) {
          break block32
         }
         (wasm2js_i32$0 = 0, wasm2js_i32$1 = (HEAP32[(0 + 77156 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $6_1 | 0) | 0) | 0), HEAP32[(wasm2js_i32$0 + 77156 | 0) >> 2] = wasm2js_i32$1;
         break block24;
        }
        if ($10_1 >>> 0 < $2_1 >>> 0) {
         break block1
        }
        block34 : {
         block33 : {
          if ((HEAP32[($10_1 + 16 | 0) >> 2] | 0 | 0) != ($4_1 | 0)) {
           break block33
          }
          HEAP32[($10_1 + 16 | 0) >> 2] = $3_1;
          break block34;
         }
         HEAP32[($10_1 + 20 | 0) >> 2] = $3_1;
        }
        if (!$3_1) {
         break block24
        }
       }
       if ($3_1 >>> 0 < $2_1 >>> 0) {
        break block1
       }
       HEAP32[($3_1 + 24 | 0) >> 2] = $10_1;
       block35 : {
        $5_1 = HEAP32[($4_1 + 16 | 0) >> 2] | 0;
        if (!$5_1) {
         break block35
        }
        if ($5_1 >>> 0 < $2_1 >>> 0) {
         break block1
        }
        HEAP32[($3_1 + 16 | 0) >> 2] = $5_1;
        HEAP32[($5_1 + 24 | 0) >> 2] = $3_1;
       }
       $5_1 = HEAP32[($4_1 + 20 | 0) >> 2] | 0;
       if (!$5_1) {
        break block24
       }
       if ($5_1 >>> 0 < $2_1 >>> 0) {
        break block1
       }
       HEAP32[($3_1 + 20 | 0) >> 2] = $5_1;
       HEAP32[($5_1 + 24 | 0) >> 2] = $3_1;
      }
      $0_1 = ($7_1 & -8 | 0) + $0_1 | 0;
      HEAP32[($1_1 + 4 | 0) >> 2] = $0_1 | 1 | 0;
      HEAP32[($1_1 + $0_1 | 0) >> 2] = $0_1;
      if (($1_1 | 0) != ($9_1 | 0)) {
       break block36
      }
      HEAP32[(0 + 77160 | 0) >> 2] = $0_1;
      return;
     }
     HEAP32[($4_1 + 4 | 0) >> 2] = $7_1 & -2 | 0;
     HEAP32[($1_1 + 4 | 0) >> 2] = $0_1 | 1 | 0;
     HEAP32[($1_1 + $0_1 | 0) >> 2] = $0_1;
    }
    block37 : {
     if ($0_1 >>> 0 > 255 >>> 0) {
      break block37
     }
     $3_1 = ($0_1 & 248 | 0) + 77192 | 0;
     block39 : {
      block38 : {
       $5_1 = HEAP32[(0 + 77152 | 0) >> 2] | 0;
       $0_1 = 1 << ($0_1 >>> 3 | 0) | 0;
       if ($5_1 & $0_1 | 0) {
        break block38
       }
       HEAP32[(0 + 77152 | 0) >> 2] = $5_1 | $0_1 | 0;
       $0_1 = $3_1;
       break block39;
      }
      $0_1 = HEAP32[($3_1 + 8 | 0) >> 2] | 0;
      if ($0_1 >>> 0 < $2_1 >>> 0) {
       break block1
      }
     }
     HEAP32[($3_1 + 8 | 0) >> 2] = $1_1;
     HEAP32[($0_1 + 12 | 0) >> 2] = $1_1;
     HEAP32[($1_1 + 12 | 0) >> 2] = $3_1;
     HEAP32[($1_1 + 8 | 0) >> 2] = $0_1;
     return;
    }
    $3_1 = 31;
    block40 : {
     if ($0_1 >>> 0 > 16777215 >>> 0) {
      break block40
     }
     $3_1 = Math_clz32($0_1 >>> 8 | 0);
     $3_1 = (($0_1 >>> (38 - $3_1 | 0) | 0) & 1 | 0 | ($3_1 << 1 | 0) | 0) ^ 62 | 0;
    }
    HEAP32[($1_1 + 28 | 0) >> 2] = $3_1;
    HEAP32[($1_1 + 16 | 0) >> 2] = 0;
    HEAP32[($1_1 + 20 | 0) >> 2] = 0;
    $6_1 = ($3_1 << 2 | 0) + 77456 | 0;
    block44 : {
     block43 : {
      block42 : {
       block41 : {
        $5_1 = HEAP32[(0 + 77156 | 0) >> 2] | 0;
        $4_1 = 1 << $3_1 | 0;
        if ($5_1 & $4_1 | 0) {
         break block41
        }
        HEAP32[(0 + 77156 | 0) >> 2] = $5_1 | $4_1 | 0;
        HEAP32[$6_1 >> 2] = $1_1;
        $0_1 = 8;
        $3_1 = 24;
        break block42;
       }
       $3_1 = $0_1 << (($3_1 | 0) == (31 | 0) ? 0 : 25 - ($3_1 >>> 1 | 0) | 0) | 0;
       $6_1 = HEAP32[$6_1 >> 2] | 0;
       label2 : while (1) {
        $5_1 = $6_1;
        if (((HEAP32[($5_1 + 4 | 0) >> 2] | 0) & -8 | 0 | 0) == ($0_1 | 0)) {
         break block43
        }
        $6_1 = $3_1 >>> 29 | 0;
        $3_1 = $3_1 << 1 | 0;
        $4_1 = $5_1 + ($6_1 & 4 | 0) | 0;
        $6_1 = HEAP32[($4_1 + 16 | 0) >> 2] | 0;
        if ($6_1) {
         continue label2
        }
        break label2;
       };
       $0_1 = $4_1 + 16 | 0;
       if ($0_1 >>> 0 < $2_1 >>> 0) {
        break block1
       }
       HEAP32[$0_1 >> 2] = $1_1;
       $0_1 = 8;
       $3_1 = 24;
       $6_1 = $5_1;
      }
      $5_1 = $1_1;
      $4_1 = $5_1;
      break block44;
     }
     if ($5_1 >>> 0 < $2_1 >>> 0) {
      break block1
     }
     $6_1 = HEAP32[($5_1 + 8 | 0) >> 2] | 0;
     if ($6_1 >>> 0 < $2_1 >>> 0) {
      break block1
     }
     HEAP32[($6_1 + 12 | 0) >> 2] = $1_1;
     HEAP32[($5_1 + 8 | 0) >> 2] = $1_1;
     $4_1 = 0;
     $0_1 = 24;
     $3_1 = 8;
    }
    HEAP32[($1_1 + $3_1 | 0) >> 2] = $6_1;
    HEAP32[($1_1 + 12 | 0) >> 2] = $5_1;
    HEAP32[($1_1 + $0_1 | 0) >> 2] = $4_1;
    $1_1 = (HEAP32[(0 + 77184 | 0) >> 2] | 0) + -1 | 0;
    HEAP32[(0 + 77184 | 0) >> 2] = $1_1 ? $1_1 : -1;
   }
   return;
  }
  $158();
  wasm2js_trap();
 }
 
 function $185($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, i64toi32_i32$4 = 0, $2_1 = 0, i64toi32_i32$3 = 0, $11_1 = 0, $6$hi = 0, $8$hi = 0, $16_1 = 0, i64toi32_i32$2 = 0;
  block1 : {
   block : {
    if ($0_1) {
     break block
    }
    $2_1 = 0;
    break block1;
   }
   i64toi32_i32$0 = 0;
   $6$hi = i64toi32_i32$0;
   i64toi32_i32$0 = 0;
   $8$hi = i64toi32_i32$0;
   i64toi32_i32$0 = $6$hi;
   i64toi32_i32$1 = $8$hi;
   i64toi32_i32$1 = __wasm_i64_mul($0_1 | 0, i64toi32_i32$0 | 0, $1_1 | 0, i64toi32_i32$1 | 0) | 0;
   i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
   $2_1 = i64toi32_i32$1;
   if (($1_1 | $0_1 | 0) >>> 0 < 65536 >>> 0) {
    break block1
   }
   $16_1 = i64toi32_i32$1;
   i64toi32_i32$2 = i64toi32_i32$1;
   i64toi32_i32$1 = 0;
   i64toi32_i32$3 = 32;
   i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
    i64toi32_i32$1 = 0;
    $11_1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
   } else {
    i64toi32_i32$1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
    $11_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$2 >>> i64toi32_i32$4 | 0) | 0;
   }
   $2_1 = ($11_1 | 0) != (0 | 0) ? -1 : $16_1;
  }
  block2 : {
   $0_1 = $182($2_1 | 0) | 0;
   if (!$0_1) {
    break block2
   }
   if (!((HEAPU8[($0_1 + -4 | 0) >> 0] | 0) & 3 | 0)) {
    break block2
   }
   $136($0_1 | 0, 0 | 0, $2_1 | 0) | 0;
  }
  return $0_1 | 0;
 }
 
 function $186($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0, $3_1 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  block : {
   if ($0_1) {
    break block
   }
   return $182($1_1 | 0) | 0 | 0;
  }
  block1 : {
   if ($1_1 >>> 0 < -64 >>> 0) {
    break block1
   }
   (wasm2js_i32$0 = $134() | 0, wasm2js_i32$1 = 48), HEAP32[wasm2js_i32$0 >> 2] = wasm2js_i32$1;
   return 0 | 0;
  }
  block2 : {
   $2_1 = $187($0_1 + -8 | 0 | 0, ($1_1 >>> 0 < 11 >>> 0 ? 16 : ($1_1 + 11 | 0) & -8 | 0) | 0) | 0;
   if (!$2_1) {
    break block2
   }
   return $2_1 + 8 | 0 | 0;
  }
  block3 : {
   $2_1 = $182($1_1 | 0) | 0;
   if ($2_1) {
    break block3
   }
   return 0 | 0;
  }
  $3_1 = HEAP32[($0_1 + -4 | 0) >> 2] | 0;
  $3_1 = ($3_1 & 3 | 0 ? -4 : -8) + ($3_1 & -8 | 0) | 0;
  $145($2_1 | 0, $0_1 | 0, ($3_1 >>> 0 < $1_1 >>> 0 ? $3_1 : $1_1) | 0) | 0;
  $184($0_1 | 0);
  return $2_1 | 0;
 }
 
 function $187($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $5_1 = 0, $4_1 = 0, $6_1 = 0, $3_1 = 0, $7_1 = 0, $2_1 = 0, $10_1 = 0, $8_1 = 0, $9_1 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  block2 : {
   block : {
    $2_1 = HEAP32[(0 + 77168 | 0) >> 2] | 0;
    if ($0_1 >>> 0 < $2_1 >>> 0) {
     break block
    }
    $3_1 = HEAP32[($0_1 + 4 | 0) >> 2] | 0;
    $4_1 = $3_1 & 3 | 0;
    if (($4_1 | 0) == (1 | 0)) {
     break block
    }
    $5_1 = $3_1 & -8 | 0;
    if (!$5_1) {
     break block
    }
    $6_1 = $0_1 + $5_1 | 0;
    $7_1 = HEAP32[($6_1 + 4 | 0) >> 2] | 0;
    if (!($7_1 & 1 | 0)) {
     break block
    }
    block1 : {
     if ($4_1) {
      break block1
     }
     $4_1 = 0;
     if ($1_1 >>> 0 < 256 >>> 0) {
      break block2
     }
     block3 : {
      if ($5_1 >>> 0 < ($1_1 + 4 | 0) >>> 0) {
       break block3
      }
      $4_1 = $0_1;
      if (($5_1 - $1_1 | 0) >>> 0 <= ((HEAP32[(0 + 77632 | 0) >> 2] | 0) << 1 | 0) >>> 0) {
       break block2
      }
     }
     $4_1 = 0;
     break block2;
    }
    block4 : {
     if ($5_1 >>> 0 < $1_1 >>> 0) {
      break block4
     }
     block5 : {
      $5_1 = $5_1 - $1_1 | 0;
      if ($5_1 >>> 0 < 16 >>> 0) {
       break block5
      }
      HEAP32[($0_1 + 4 | 0) >> 2] = $1_1 | ($3_1 & 1 | 0) | 0 | 2 | 0;
      $1_1 = $0_1 + $1_1 | 0;
      HEAP32[($1_1 + 4 | 0) >> 2] = $5_1 | 3 | 0;
      HEAP32[($6_1 + 4 | 0) >> 2] = HEAP32[($6_1 + 4 | 0) >> 2] | 0 | 1 | 0;
      $188($1_1 | 0, $5_1 | 0);
     }
     return $0_1 | 0;
    }
    $4_1 = 0;
    block6 : {
     if (($6_1 | 0) != (HEAP32[(0 + 77176 | 0) >> 2] | 0 | 0)) {
      break block6
     }
     $5_1 = (HEAP32[(0 + 77164 | 0) >> 2] | 0) + $5_1 | 0;
     if ($5_1 >>> 0 <= $1_1 >>> 0) {
      break block2
     }
     HEAP32[($0_1 + 4 | 0) >> 2] = $1_1 | ($3_1 & 1 | 0) | 0 | 2 | 0;
     $3_1 = $0_1 + $1_1 | 0;
     $5_1 = $5_1 - $1_1 | 0;
     HEAP32[($3_1 + 4 | 0) >> 2] = $5_1 | 1 | 0;
     HEAP32[(0 + 77164 | 0) >> 2] = $5_1;
     HEAP32[(0 + 77176 | 0) >> 2] = $3_1;
     return $0_1 | 0;
    }
    block7 : {
     if (($6_1 | 0) != (HEAP32[(0 + 77172 | 0) >> 2] | 0 | 0)) {
      break block7
     }
     $4_1 = 0;
     $5_1 = (HEAP32[(0 + 77160 | 0) >> 2] | 0) + $5_1 | 0;
     if ($5_1 >>> 0 < $1_1 >>> 0) {
      break block2
     }
     block9 : {
      block8 : {
       $4_1 = $5_1 - $1_1 | 0;
       if ($4_1 >>> 0 < 16 >>> 0) {
        break block8
       }
       HEAP32[($0_1 + 4 | 0) >> 2] = $1_1 | ($3_1 & 1 | 0) | 0 | 2 | 0;
       $1_1 = $0_1 + $1_1 | 0;
       HEAP32[($1_1 + 4 | 0) >> 2] = $4_1 | 1 | 0;
       $5_1 = $0_1 + $5_1 | 0;
       HEAP32[$5_1 >> 2] = $4_1;
       HEAP32[($5_1 + 4 | 0) >> 2] = (HEAP32[($5_1 + 4 | 0) >> 2] | 0) & -2 | 0;
       break block9;
      }
      HEAP32[($0_1 + 4 | 0) >> 2] = $3_1 & 1 | 0 | $5_1 | 0 | 2 | 0;
      $5_1 = $0_1 + $5_1 | 0;
      HEAP32[($5_1 + 4 | 0) >> 2] = HEAP32[($5_1 + 4 | 0) >> 2] | 0 | 1 | 0;
      $1_1 = 0;
      $4_1 = 0;
     }
     HEAP32[(0 + 77172 | 0) >> 2] = $1_1;
     HEAP32[(0 + 77160 | 0) >> 2] = $4_1;
     return $0_1 | 0;
    }
    $4_1 = 0;
    if ($7_1 & 2 | 0) {
     break block2
    }
    $8_1 = ($7_1 & -8 | 0) + $5_1 | 0;
    if ($8_1 >>> 0 < $1_1 >>> 0) {
     break block2
    }
    $5_1 = HEAP32[($6_1 + 12 | 0) >> 2] | 0;
    block13 : {
     block10 : {
      if ($7_1 >>> 0 > 255 >>> 0) {
       break block10
      }
      block11 : {
       $4_1 = HEAP32[($6_1 + 8 | 0) >> 2] | 0;
       $9_1 = ($7_1 & 248 | 0) + 77192 | 0;
       if (($4_1 | 0) == ($9_1 | 0)) {
        break block11
       }
       if ($4_1 >>> 0 < $2_1 >>> 0) {
        break block
       }
       if ((HEAP32[($4_1 + 12 | 0) >> 2] | 0 | 0) != ($6_1 | 0)) {
        break block
       }
      }
      block12 : {
       if (($5_1 | 0) != ($4_1 | 0)) {
        break block12
       }
       (wasm2js_i32$0 = 0, wasm2js_i32$1 = (HEAP32[(0 + 77152 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $7_1 >>> 3 | 0 | 0) | 0) | 0), HEAP32[(wasm2js_i32$0 + 77152 | 0) >> 2] = wasm2js_i32$1;
       break block13;
      }
      block14 : {
       if (($5_1 | 0) == ($9_1 | 0)) {
        break block14
       }
       if ($5_1 >>> 0 < $2_1 >>> 0) {
        break block
       }
       if ((HEAP32[($5_1 + 8 | 0) >> 2] | 0 | 0) != ($6_1 | 0)) {
        break block
       }
      }
      HEAP32[($4_1 + 12 | 0) >> 2] = $5_1;
      HEAP32[($5_1 + 8 | 0) >> 2] = $4_1;
      break block13;
     }
     $10_1 = HEAP32[($6_1 + 24 | 0) >> 2] | 0;
     block16 : {
      block15 : {
       if (($5_1 | 0) == ($6_1 | 0)) {
        break block15
       }
       $4_1 = HEAP32[($6_1 + 8 | 0) >> 2] | 0;
       if ($4_1 >>> 0 < $2_1 >>> 0) {
        break block
       }
       if ((HEAP32[($4_1 + 12 | 0) >> 2] | 0 | 0) != ($6_1 | 0)) {
        break block
       }
       if ((HEAP32[($5_1 + 8 | 0) >> 2] | 0 | 0) != ($6_1 | 0)) {
        break block
       }
       HEAP32[($4_1 + 12 | 0) >> 2] = $5_1;
       HEAP32[($5_1 + 8 | 0) >> 2] = $4_1;
       break block16;
      }
      block19 : {
       block18 : {
        block17 : {
         $4_1 = HEAP32[($6_1 + 20 | 0) >> 2] | 0;
         if (!$4_1) {
          break block17
         }
         $7_1 = $6_1 + 20 | 0;
         break block18;
        }
        $4_1 = HEAP32[($6_1 + 16 | 0) >> 2] | 0;
        if (!$4_1) {
         break block19
        }
        $7_1 = $6_1 + 16 | 0;
       }
       label : while (1) {
        $9_1 = $7_1;
        $5_1 = $4_1;
        $7_1 = $5_1 + 20 | 0;
        $4_1 = HEAP32[($5_1 + 20 | 0) >> 2] | 0;
        if ($4_1) {
         continue label
        }
        $7_1 = $5_1 + 16 | 0;
        $4_1 = HEAP32[($5_1 + 16 | 0) >> 2] | 0;
        if ($4_1) {
         continue label
        }
        break label;
       };
       if ($9_1 >>> 0 < $2_1 >>> 0) {
        break block
       }
       HEAP32[$9_1 >> 2] = 0;
       break block16;
      }
      $5_1 = 0;
     }
     if (!$10_1) {
      break block13
     }
     block21 : {
      block20 : {
       $7_1 = HEAP32[($6_1 + 28 | 0) >> 2] | 0;
       $4_1 = $7_1 << 2 | 0;
       if (($6_1 | 0) != (HEAP32[($4_1 + 77456 | 0) >> 2] | 0 | 0)) {
        break block20
       }
       HEAP32[($4_1 + 77456 | 0) >> 2] = $5_1;
       if ($5_1) {
        break block21
       }
       (wasm2js_i32$0 = 0, wasm2js_i32$1 = (HEAP32[(0 + 77156 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $7_1 | 0) | 0) | 0), HEAP32[(wasm2js_i32$0 + 77156 | 0) >> 2] = wasm2js_i32$1;
       break block13;
      }
      if ($10_1 >>> 0 < $2_1 >>> 0) {
       break block
      }
      block23 : {
       block22 : {
        if ((HEAP32[($10_1 + 16 | 0) >> 2] | 0 | 0) != ($6_1 | 0)) {
         break block22
        }
        HEAP32[($10_1 + 16 | 0) >> 2] = $5_1;
        break block23;
       }
       HEAP32[($10_1 + 20 | 0) >> 2] = $5_1;
      }
      if (!$5_1) {
       break block13
      }
     }
     if ($5_1 >>> 0 < $2_1 >>> 0) {
      break block
     }
     HEAP32[($5_1 + 24 | 0) >> 2] = $10_1;
     block24 : {
      $4_1 = HEAP32[($6_1 + 16 | 0) >> 2] | 0;
      if (!$4_1) {
       break block24
      }
      if ($4_1 >>> 0 < $2_1 >>> 0) {
       break block
      }
      HEAP32[($5_1 + 16 | 0) >> 2] = $4_1;
      HEAP32[($4_1 + 24 | 0) >> 2] = $5_1;
     }
     $4_1 = HEAP32[($6_1 + 20 | 0) >> 2] | 0;
     if (!$4_1) {
      break block13
     }
     if ($4_1 >>> 0 < $2_1 >>> 0) {
      break block
     }
     HEAP32[($5_1 + 20 | 0) >> 2] = $4_1;
     HEAP32[($4_1 + 24 | 0) >> 2] = $5_1;
    }
    block25 : {
     $5_1 = $8_1 - $1_1 | 0;
     if ($5_1 >>> 0 > 15 >>> 0) {
      break block25
     }
     HEAP32[($0_1 + 4 | 0) >> 2] = $3_1 & 1 | 0 | $8_1 | 0 | 2 | 0;
     $5_1 = $0_1 + $8_1 | 0;
     HEAP32[($5_1 + 4 | 0) >> 2] = HEAP32[($5_1 + 4 | 0) >> 2] | 0 | 1 | 0;
     return $0_1 | 0;
    }
    HEAP32[($0_1 + 4 | 0) >> 2] = $1_1 | ($3_1 & 1 | 0) | 0 | 2 | 0;
    $1_1 = $0_1 + $1_1 | 0;
    HEAP32[($1_1 + 4 | 0) >> 2] = $5_1 | 3 | 0;
    $3_1 = $0_1 + $8_1 | 0;
    HEAP32[($3_1 + 4 | 0) >> 2] = HEAP32[($3_1 + 4 | 0) >> 2] | 0 | 1 | 0;
    $188($1_1 | 0, $5_1 | 0);
    return $0_1 | 0;
   }
   $158();
   wasm2js_trap();
  }
  return $4_1 | 0;
 }
 
 function $188($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $5_1 = 0, $3_1 = 0, $6_1 = 0, $2_1 = 0, $4_1 = 0, $8_1 = 0, $7_1 = 0, $10_1 = 0, $9_1 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  $2_1 = $0_1 + $1_1 | 0;
  block3 : {
   block2 : {
    block1 : {
     block : {
      $3_1 = HEAP32[($0_1 + 4 | 0) >> 2] | 0;
      if (!($3_1 & 1 | 0)) {
       break block
      }
      $4_1 = HEAP32[(0 + 77168 | 0) >> 2] | 0;
      break block1;
     }
     if (!($3_1 & 2 | 0)) {
      break block2
     }
     $5_1 = HEAP32[$0_1 >> 2] | 0;
     $0_1 = $0_1 - $5_1 | 0;
     $4_1 = HEAP32[(0 + 77168 | 0) >> 2] | 0;
     if ($0_1 >>> 0 < $4_1 >>> 0) {
      break block3
     }
     $1_1 = $5_1 + $1_1 | 0;
     block4 : {
      if (($0_1 | 0) == (HEAP32[(0 + 77172 | 0) >> 2] | 0 | 0)) {
       break block4
      }
      $3_1 = HEAP32[($0_1 + 12 | 0) >> 2] | 0;
      block5 : {
       if ($5_1 >>> 0 > 255 >>> 0) {
        break block5
       }
       block6 : {
        $6_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
        $7_1 = ($5_1 & 248 | 0) + 77192 | 0;
        if (($6_1 | 0) == ($7_1 | 0)) {
         break block6
        }
        if ($6_1 >>> 0 < $4_1 >>> 0) {
         break block3
        }
        if ((HEAP32[($6_1 + 12 | 0) >> 2] | 0 | 0) != ($0_1 | 0)) {
         break block3
        }
       }
       block7 : {
        if (($3_1 | 0) != ($6_1 | 0)) {
         break block7
        }
        (wasm2js_i32$0 = 0, wasm2js_i32$1 = (HEAP32[(0 + 77152 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $5_1 >>> 3 | 0 | 0) | 0) | 0), HEAP32[(wasm2js_i32$0 + 77152 | 0) >> 2] = wasm2js_i32$1;
        break block1;
       }
       block8 : {
        if (($3_1 | 0) == ($7_1 | 0)) {
         break block8
        }
        if ($3_1 >>> 0 < $4_1 >>> 0) {
         break block3
        }
        if ((HEAP32[($3_1 + 8 | 0) >> 2] | 0 | 0) != ($0_1 | 0)) {
         break block3
        }
       }
       HEAP32[($6_1 + 12 | 0) >> 2] = $3_1;
       HEAP32[($3_1 + 8 | 0) >> 2] = $6_1;
       break block1;
      }
      $8_1 = HEAP32[($0_1 + 24 | 0) >> 2] | 0;
      block10 : {
       block9 : {
        if (($3_1 | 0) == ($0_1 | 0)) {
         break block9
        }
        $5_1 = HEAP32[($0_1 + 8 | 0) >> 2] | 0;
        if ($5_1 >>> 0 < $4_1 >>> 0) {
         break block3
        }
        if ((HEAP32[($5_1 + 12 | 0) >> 2] | 0 | 0) != ($0_1 | 0)) {
         break block3
        }
        if ((HEAP32[($3_1 + 8 | 0) >> 2] | 0 | 0) != ($0_1 | 0)) {
         break block3
        }
        HEAP32[($5_1 + 12 | 0) >> 2] = $3_1;
        HEAP32[($3_1 + 8 | 0) >> 2] = $5_1;
        break block10;
       }
       block13 : {
        block12 : {
         block11 : {
          $5_1 = HEAP32[($0_1 + 20 | 0) >> 2] | 0;
          if (!$5_1) {
           break block11
          }
          $6_1 = $0_1 + 20 | 0;
          break block12;
         }
         $5_1 = HEAP32[($0_1 + 16 | 0) >> 2] | 0;
         if (!$5_1) {
          break block13
         }
         $6_1 = $0_1 + 16 | 0;
        }
        label : while (1) {
         $7_1 = $6_1;
         $3_1 = $5_1;
         $6_1 = $3_1 + 20 | 0;
         $5_1 = HEAP32[($3_1 + 20 | 0) >> 2] | 0;
         if ($5_1) {
          continue label
         }
         $6_1 = $3_1 + 16 | 0;
         $5_1 = HEAP32[($3_1 + 16 | 0) >> 2] | 0;
         if ($5_1) {
          continue label
         }
         break label;
        };
        if ($7_1 >>> 0 < $4_1 >>> 0) {
         break block3
        }
        HEAP32[$7_1 >> 2] = 0;
        break block10;
       }
       $3_1 = 0;
      }
      if (!$8_1) {
       break block1
      }
      block15 : {
       block14 : {
        $6_1 = HEAP32[($0_1 + 28 | 0) >> 2] | 0;
        $5_1 = $6_1 << 2 | 0;
        if (($0_1 | 0) != (HEAP32[($5_1 + 77456 | 0) >> 2] | 0 | 0)) {
         break block14
        }
        HEAP32[($5_1 + 77456 | 0) >> 2] = $3_1;
        if ($3_1) {
         break block15
        }
        (wasm2js_i32$0 = 0, wasm2js_i32$1 = (HEAP32[(0 + 77156 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $6_1 | 0) | 0) | 0), HEAP32[(wasm2js_i32$0 + 77156 | 0) >> 2] = wasm2js_i32$1;
        break block1;
       }
       if ($8_1 >>> 0 < $4_1 >>> 0) {
        break block3
       }
       block17 : {
        block16 : {
         if ((HEAP32[($8_1 + 16 | 0) >> 2] | 0 | 0) != ($0_1 | 0)) {
          break block16
         }
         HEAP32[($8_1 + 16 | 0) >> 2] = $3_1;
         break block17;
        }
        HEAP32[($8_1 + 20 | 0) >> 2] = $3_1;
       }
       if (!$3_1) {
        break block1
       }
      }
      if ($3_1 >>> 0 < $4_1 >>> 0) {
       break block3
      }
      HEAP32[($3_1 + 24 | 0) >> 2] = $8_1;
      block18 : {
       $5_1 = HEAP32[($0_1 + 16 | 0) >> 2] | 0;
       if (!$5_1) {
        break block18
       }
       if ($5_1 >>> 0 < $4_1 >>> 0) {
        break block3
       }
       HEAP32[($3_1 + 16 | 0) >> 2] = $5_1;
       HEAP32[($5_1 + 24 | 0) >> 2] = $3_1;
      }
      $5_1 = HEAP32[($0_1 + 20 | 0) >> 2] | 0;
      if (!$5_1) {
       break block1
      }
      if ($5_1 >>> 0 < $4_1 >>> 0) {
       break block3
      }
      HEAP32[($3_1 + 20 | 0) >> 2] = $5_1;
      HEAP32[($5_1 + 24 | 0) >> 2] = $3_1;
      break block1;
     }
     $3_1 = HEAP32[($2_1 + 4 | 0) >> 2] | 0;
     if (($3_1 & 3 | 0 | 0) != (3 | 0)) {
      break block1
     }
     HEAP32[(0 + 77160 | 0) >> 2] = $1_1;
     HEAP32[($2_1 + 4 | 0) >> 2] = $3_1 & -2 | 0;
     HEAP32[($0_1 + 4 | 0) >> 2] = $1_1 | 1 | 0;
     HEAP32[$2_1 >> 2] = $1_1;
     return;
    }
    if ($2_1 >>> 0 < $4_1 >>> 0) {
     break block3
    }
    block37 : {
     block19 : {
      $8_1 = HEAP32[($2_1 + 4 | 0) >> 2] | 0;
      if ($8_1 & 2 | 0) {
       break block19
      }
      block20 : {
       if (($2_1 | 0) != (HEAP32[(0 + 77176 | 0) >> 2] | 0 | 0)) {
        break block20
       }
       HEAP32[(0 + 77176 | 0) >> 2] = $0_1;
       $1_1 = (HEAP32[(0 + 77164 | 0) >> 2] | 0) + $1_1 | 0;
       HEAP32[(0 + 77164 | 0) >> 2] = $1_1;
       HEAP32[($0_1 + 4 | 0) >> 2] = $1_1 | 1 | 0;
       if (($0_1 | 0) != (HEAP32[(0 + 77172 | 0) >> 2] | 0 | 0)) {
        break block2
       }
       HEAP32[(0 + 77160 | 0) >> 2] = 0;
       HEAP32[(0 + 77172 | 0) >> 2] = 0;
       return;
      }
      block21 : {
       $9_1 = HEAP32[(0 + 77172 | 0) >> 2] | 0;
       if (($2_1 | 0) != ($9_1 | 0)) {
        break block21
       }
       HEAP32[(0 + 77172 | 0) >> 2] = $0_1;
       $1_1 = (HEAP32[(0 + 77160 | 0) >> 2] | 0) + $1_1 | 0;
       HEAP32[(0 + 77160 | 0) >> 2] = $1_1;
       HEAP32[($0_1 + 4 | 0) >> 2] = $1_1 | 1 | 0;
       HEAP32[($0_1 + $1_1 | 0) >> 2] = $1_1;
       return;
      }
      $3_1 = HEAP32[($2_1 + 12 | 0) >> 2] | 0;
      block25 : {
       block22 : {
        if ($8_1 >>> 0 > 255 >>> 0) {
         break block22
        }
        block23 : {
         $5_1 = HEAP32[($2_1 + 8 | 0) >> 2] | 0;
         $6_1 = ($8_1 & 248 | 0) + 77192 | 0;
         if (($5_1 | 0) == ($6_1 | 0)) {
          break block23
         }
         if ($5_1 >>> 0 < $4_1 >>> 0) {
          break block3
         }
         if ((HEAP32[($5_1 + 12 | 0) >> 2] | 0 | 0) != ($2_1 | 0)) {
          break block3
         }
        }
        block24 : {
         if (($3_1 | 0) != ($5_1 | 0)) {
          break block24
         }
         (wasm2js_i32$0 = 0, wasm2js_i32$1 = (HEAP32[(0 + 77152 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $8_1 >>> 3 | 0 | 0) | 0) | 0), HEAP32[(wasm2js_i32$0 + 77152 | 0) >> 2] = wasm2js_i32$1;
         break block25;
        }
        block26 : {
         if (($3_1 | 0) == ($6_1 | 0)) {
          break block26
         }
         if ($3_1 >>> 0 < $4_1 >>> 0) {
          break block3
         }
         if ((HEAP32[($3_1 + 8 | 0) >> 2] | 0 | 0) != ($2_1 | 0)) {
          break block3
         }
        }
        HEAP32[($5_1 + 12 | 0) >> 2] = $3_1;
        HEAP32[($3_1 + 8 | 0) >> 2] = $5_1;
        break block25;
       }
       $10_1 = HEAP32[($2_1 + 24 | 0) >> 2] | 0;
       block28 : {
        block27 : {
         if (($3_1 | 0) == ($2_1 | 0)) {
          break block27
         }
         $5_1 = HEAP32[($2_1 + 8 | 0) >> 2] | 0;
         if ($5_1 >>> 0 < $4_1 >>> 0) {
          break block3
         }
         if ((HEAP32[($5_1 + 12 | 0) >> 2] | 0 | 0) != ($2_1 | 0)) {
          break block3
         }
         if ((HEAP32[($3_1 + 8 | 0) >> 2] | 0 | 0) != ($2_1 | 0)) {
          break block3
         }
         HEAP32[($5_1 + 12 | 0) >> 2] = $3_1;
         HEAP32[($3_1 + 8 | 0) >> 2] = $5_1;
         break block28;
        }
        block31 : {
         block30 : {
          block29 : {
           $5_1 = HEAP32[($2_1 + 20 | 0) >> 2] | 0;
           if (!$5_1) {
            break block29
           }
           $6_1 = $2_1 + 20 | 0;
           break block30;
          }
          $5_1 = HEAP32[($2_1 + 16 | 0) >> 2] | 0;
          if (!$5_1) {
           break block31
          }
          $6_1 = $2_1 + 16 | 0;
         }
         label1 : while (1) {
          $7_1 = $6_1;
          $3_1 = $5_1;
          $6_1 = $3_1 + 20 | 0;
          $5_1 = HEAP32[($3_1 + 20 | 0) >> 2] | 0;
          if ($5_1) {
           continue label1
          }
          $6_1 = $3_1 + 16 | 0;
          $5_1 = HEAP32[($3_1 + 16 | 0) >> 2] | 0;
          if ($5_1) {
           continue label1
          }
          break label1;
         };
         if ($7_1 >>> 0 < $4_1 >>> 0) {
          break block3
         }
         HEAP32[$7_1 >> 2] = 0;
         break block28;
        }
        $3_1 = 0;
       }
       if (!$10_1) {
        break block25
       }
       block33 : {
        block32 : {
         $6_1 = HEAP32[($2_1 + 28 | 0) >> 2] | 0;
         $5_1 = $6_1 << 2 | 0;
         if (($2_1 | 0) != (HEAP32[($5_1 + 77456 | 0) >> 2] | 0 | 0)) {
          break block32
         }
         HEAP32[($5_1 + 77456 | 0) >> 2] = $3_1;
         if ($3_1) {
          break block33
         }
         (wasm2js_i32$0 = 0, wasm2js_i32$1 = (HEAP32[(0 + 77156 | 0) >> 2] | 0) & (__wasm_rotl_i32(-2 | 0, $6_1 | 0) | 0) | 0), HEAP32[(wasm2js_i32$0 + 77156 | 0) >> 2] = wasm2js_i32$1;
         break block25;
        }
        if ($10_1 >>> 0 < $4_1 >>> 0) {
         break block3
        }
        block35 : {
         block34 : {
          if ((HEAP32[($10_1 + 16 | 0) >> 2] | 0 | 0) != ($2_1 | 0)) {
           break block34
          }
          HEAP32[($10_1 + 16 | 0) >> 2] = $3_1;
          break block35;
         }
         HEAP32[($10_1 + 20 | 0) >> 2] = $3_1;
        }
        if (!$3_1) {
         break block25
        }
       }
       if ($3_1 >>> 0 < $4_1 >>> 0) {
        break block3
       }
       HEAP32[($3_1 + 24 | 0) >> 2] = $10_1;
       block36 : {
        $5_1 = HEAP32[($2_1 + 16 | 0) >> 2] | 0;
        if (!$5_1) {
         break block36
        }
        if ($5_1 >>> 0 < $4_1 >>> 0) {
         break block3
        }
        HEAP32[($3_1 + 16 | 0) >> 2] = $5_1;
        HEAP32[($5_1 + 24 | 0) >> 2] = $3_1;
       }
       $5_1 = HEAP32[($2_1 + 20 | 0) >> 2] | 0;
       if (!$5_1) {
        break block25
       }
       if ($5_1 >>> 0 < $4_1 >>> 0) {
        break block3
       }
       HEAP32[($3_1 + 20 | 0) >> 2] = $5_1;
       HEAP32[($5_1 + 24 | 0) >> 2] = $3_1;
      }
      $1_1 = ($8_1 & -8 | 0) + $1_1 | 0;
      HEAP32[($0_1 + 4 | 0) >> 2] = $1_1 | 1 | 0;
      HEAP32[($0_1 + $1_1 | 0) >> 2] = $1_1;
      if (($0_1 | 0) != ($9_1 | 0)) {
       break block37
      }
      HEAP32[(0 + 77160 | 0) >> 2] = $1_1;
      return;
     }
     HEAP32[($2_1 + 4 | 0) >> 2] = $8_1 & -2 | 0;
     HEAP32[($0_1 + 4 | 0) >> 2] = $1_1 | 1 | 0;
     HEAP32[($0_1 + $1_1 | 0) >> 2] = $1_1;
    }
    block38 : {
     if ($1_1 >>> 0 > 255 >>> 0) {
      break block38
     }
     $3_1 = ($1_1 & 248 | 0) + 77192 | 0;
     block40 : {
      block39 : {
       $5_1 = HEAP32[(0 + 77152 | 0) >> 2] | 0;
       $1_1 = 1 << ($1_1 >>> 3 | 0) | 0;
       if ($5_1 & $1_1 | 0) {
        break block39
       }
       HEAP32[(0 + 77152 | 0) >> 2] = $5_1 | $1_1 | 0;
       $1_1 = $3_1;
       break block40;
      }
      $1_1 = HEAP32[($3_1 + 8 | 0) >> 2] | 0;
      if ($1_1 >>> 0 < $4_1 >>> 0) {
       break block3
      }
     }
     HEAP32[($3_1 + 8 | 0) >> 2] = $0_1;
     HEAP32[($1_1 + 12 | 0) >> 2] = $0_1;
     HEAP32[($0_1 + 12 | 0) >> 2] = $3_1;
     HEAP32[($0_1 + 8 | 0) >> 2] = $1_1;
     return;
    }
    $3_1 = 31;
    block41 : {
     if ($1_1 >>> 0 > 16777215 >>> 0) {
      break block41
     }
     $3_1 = Math_clz32($1_1 >>> 8 | 0);
     $3_1 = (($1_1 >>> (38 - $3_1 | 0) | 0) & 1 | 0 | ($3_1 << 1 | 0) | 0) ^ 62 | 0;
    }
    HEAP32[($0_1 + 28 | 0) >> 2] = $3_1;
    HEAP32[($0_1 + 16 | 0) >> 2] = 0;
    HEAP32[($0_1 + 20 | 0) >> 2] = 0;
    $5_1 = ($3_1 << 2 | 0) + 77456 | 0;
    block44 : {
     block43 : {
      block42 : {
       $6_1 = HEAP32[(0 + 77156 | 0) >> 2] | 0;
       $2_1 = 1 << $3_1 | 0;
       if ($6_1 & $2_1 | 0) {
        break block42
       }
       HEAP32[(0 + 77156 | 0) >> 2] = $6_1 | $2_1 | 0;
       HEAP32[$5_1 >> 2] = $0_1;
       HEAP32[($0_1 + 24 | 0) >> 2] = $5_1;
       break block43;
      }
      $3_1 = $1_1 << (($3_1 | 0) == (31 | 0) ? 0 : 25 - ($3_1 >>> 1 | 0) | 0) | 0;
      $6_1 = HEAP32[$5_1 >> 2] | 0;
      label2 : while (1) {
       $5_1 = $6_1;
       if (((HEAP32[($5_1 + 4 | 0) >> 2] | 0) & -8 | 0 | 0) == ($1_1 | 0)) {
        break block44
       }
       $6_1 = $3_1 >>> 29 | 0;
       $3_1 = $3_1 << 1 | 0;
       $2_1 = $5_1 + ($6_1 & 4 | 0) | 0;
       $6_1 = HEAP32[($2_1 + 16 | 0) >> 2] | 0;
       if ($6_1) {
        continue label2
       }
       break label2;
      };
      $1_1 = $2_1 + 16 | 0;
      if ($1_1 >>> 0 < $4_1 >>> 0) {
       break block3
      }
      HEAP32[$1_1 >> 2] = $0_1;
      HEAP32[($0_1 + 24 | 0) >> 2] = $5_1;
     }
     HEAP32[($0_1 + 12 | 0) >> 2] = $0_1;
     HEAP32[($0_1 + 8 | 0) >> 2] = $0_1;
     return;
    }
    if ($5_1 >>> 0 < $4_1 >>> 0) {
     break block3
    }
    $1_1 = HEAP32[($5_1 + 8 | 0) >> 2] | 0;
    if ($1_1 >>> 0 < $4_1 >>> 0) {
     break block3
    }
    HEAP32[($1_1 + 12 | 0) >> 2] = $0_1;
    HEAP32[($5_1 + 8 | 0) >> 2] = $0_1;
    HEAP32[($0_1 + 24 | 0) >> 2] = 0;
    HEAP32[($0_1 + 12 | 0) >> 2] = $5_1;
    HEAP32[($0_1 + 8 | 0) >> 2] = $1_1;
   }
   return;
  }
  $158();
  wasm2js_trap();
 }
 
 function $189() {
  return __wasm_memory_size() << 16 | 0 | 0;
 }
 
 function $190($0_1) {
  $0_1 = $0_1 | 0;
  var i64toi32_i32$2 = 0, i64toi32_i32$4 = 0, i64toi32_i32$3 = 0, i64toi32_i32$5 = 0, i64toi32_i32$1 = 0, i64toi32_i32$0 = 0, $6$hi = 0, $9$hi = 0, $2_1 = 0, wasm2js_i32$0 = 0, wasm2js_i32$1 = 0;
  block1 : {
   block : {
    i64toi32_i32$0 = 0;
    i64toi32_i32$2 = $0_1;
    i64toi32_i32$1 = 0;
    i64toi32_i32$3 = 7;
    i64toi32_i32$4 = i64toi32_i32$2 + i64toi32_i32$3 | 0;
    i64toi32_i32$5 = i64toi32_i32$0 + i64toi32_i32$1 | 0;
    if (i64toi32_i32$4 >>> 0 < i64toi32_i32$3 >>> 0) {
     i64toi32_i32$5 = i64toi32_i32$5 + 1 | 0
    }
    i64toi32_i32$0 = i64toi32_i32$4;
    i64toi32_i32$2 = 1;
    i64toi32_i32$3 = -8;
    i64toi32_i32$2 = i64toi32_i32$5 & i64toi32_i32$2 | 0;
    $6$hi = i64toi32_i32$2;
    $0_1 = HEAP32[(0 + 75724 | 0) >> 2] | 0;
    i64toi32_i32$2 = 0;
    $9$hi = i64toi32_i32$2;
    i64toi32_i32$2 = $6$hi;
    i64toi32_i32$5 = i64toi32_i32$4 & i64toi32_i32$3 | 0;
    i64toi32_i32$0 = $9$hi;
    i64toi32_i32$3 = $0_1;
    i64toi32_i32$1 = i64toi32_i32$5 + i64toi32_i32$3 | 0;
    i64toi32_i32$4 = i64toi32_i32$2 + i64toi32_i32$0 | 0;
    if (i64toi32_i32$1 >>> 0 < i64toi32_i32$3 >>> 0) {
     i64toi32_i32$4 = i64toi32_i32$4 + 1 | 0
    }
    i64toi32_i32$2 = i64toi32_i32$1;
    i64toi32_i32$5 = 0;
    i64toi32_i32$3 = -1;
    if (i64toi32_i32$4 >>> 0 > i64toi32_i32$5 >>> 0 | ((i64toi32_i32$4 | 0) == (i64toi32_i32$5 | 0) & i64toi32_i32$2 >>> 0 > i64toi32_i32$3 >>> 0 | 0) | 0) {
     break block
    }
    i64toi32_i32$2 = i64toi32_i32$4;
    i64toi32_i32$2 = i64toi32_i32$4;
    $2_1 = i64toi32_i32$1;
    if (($189() | 0) >>> 0 >= i64toi32_i32$1 >>> 0) {
     break block1
    }
    if (fimport$7(i64toi32_i32$1 | 0) | 0) {
     break block1
    }
   }
   (wasm2js_i32$0 = $134() | 0, wasm2js_i32$1 = 48), HEAP32[wasm2js_i32$0 >> 2] = wasm2js_i32$1;
   return -1 | 0;
  }
  HEAP32[(0 + 75724 | 0) >> 2] = $2_1;
  return $0_1 | 0;
 }
 
 function $191($0_1, $1_1, $1$hi, $2_1, $2$hi, $3_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $1$hi = $1$hi | 0;
  $2_1 = $2_1 | 0;
  $2$hi = $2$hi | 0;
  $3_1 = $3_1 | 0;
  var i64toi32_i32$1 = 0, i64toi32_i32$4 = 0, i64toi32_i32$2 = 0, i64toi32_i32$0 = 0, i64toi32_i32$3 = 0, $4$hi = 0, $18_1 = 0, $20_1 = 0, $21_1 = 0, $22_1 = 0, $11$hi = 0, $18$hi = 0, $19_1 = 0, $19$hi = 0, $4_1 = 0, $24$hi = 0;
  block1 : {
   block : {
    if (!($3_1 & 64 | 0)) {
     break block
    }
    i64toi32_i32$0 = $1$hi;
    i64toi32_i32$0 = 0;
    $11$hi = i64toi32_i32$0;
    i64toi32_i32$0 = $1$hi;
    i64toi32_i32$2 = $1_1;
    i64toi32_i32$1 = $11$hi;
    i64toi32_i32$3 = $3_1 + -64 | 0;
    i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
     i64toi32_i32$1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
     $18_1 = 0;
    } else {
     i64toi32_i32$1 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$0 << i64toi32_i32$4 | 0) | 0;
     $18_1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
    }
    $2_1 = $18_1;
    $2$hi = i64toi32_i32$1;
    i64toi32_i32$1 = 0;
    $1_1 = 0;
    $1$hi = i64toi32_i32$1;
    break block1;
   }
   if (!$3_1) {
    break block1
   }
   i64toi32_i32$1 = $1$hi;
   i64toi32_i32$1 = 0;
   $18$hi = i64toi32_i32$1;
   i64toi32_i32$1 = $1$hi;
   i64toi32_i32$0 = $1_1;
   i64toi32_i32$2 = $18$hi;
   i64toi32_i32$3 = 64 - $3_1 | 0;
   i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
    i64toi32_i32$2 = 0;
    $20_1 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
   } else {
    i64toi32_i32$2 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
    $20_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$1 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$0 >>> i64toi32_i32$4 | 0) | 0;
   }
   $19_1 = $20_1;
   $19$hi = i64toi32_i32$2;
   i64toi32_i32$2 = $2$hi;
   i64toi32_i32$2 = 0;
   $4_1 = $3_1;
   $4$hi = i64toi32_i32$2;
   i64toi32_i32$2 = $2$hi;
   i64toi32_i32$1 = $2_1;
   i64toi32_i32$0 = $4$hi;
   i64toi32_i32$3 = $3_1;
   i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
    i64toi32_i32$0 = i64toi32_i32$1 << i64toi32_i32$4 | 0;
    $21_1 = 0;
   } else {
    i64toi32_i32$0 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$1 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$2 << i64toi32_i32$4 | 0) | 0;
    $21_1 = i64toi32_i32$1 << i64toi32_i32$4 | 0;
   }
   $24$hi = i64toi32_i32$0;
   i64toi32_i32$0 = $19$hi;
   i64toi32_i32$2 = $19_1;
   i64toi32_i32$1 = $24$hi;
   i64toi32_i32$3 = $21_1;
   i64toi32_i32$1 = i64toi32_i32$0 | i64toi32_i32$1 | 0;
   $2_1 = i64toi32_i32$2 | i64toi32_i32$3 | 0;
   $2$hi = i64toi32_i32$1;
   i64toi32_i32$1 = $1$hi;
   i64toi32_i32$1 = $4$hi;
   i64toi32_i32$1 = $1$hi;
   i64toi32_i32$0 = $1_1;
   i64toi32_i32$2 = $4$hi;
   i64toi32_i32$3 = $4_1;
   i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
    i64toi32_i32$2 = i64toi32_i32$0 << i64toi32_i32$4 | 0;
    $22_1 = 0;
   } else {
    i64toi32_i32$2 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$0 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$1 << i64toi32_i32$4 | 0) | 0;
    $22_1 = i64toi32_i32$0 << i64toi32_i32$4 | 0;
   }
   $1_1 = $22_1;
   $1$hi = i64toi32_i32$2;
  }
  i64toi32_i32$2 = $1$hi;
  i64toi32_i32$0 = $0_1;
  HEAP32[i64toi32_i32$0 >> 2] = $1_1;
  HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = i64toi32_i32$2;
  i64toi32_i32$2 = $2$hi;
  HEAP32[(i64toi32_i32$0 + 8 | 0) >> 2] = $2_1;
  HEAP32[(i64toi32_i32$0 + 12 | 0) >> 2] = i64toi32_i32$2;
 }
 
 function $192($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = +$1_1;
  var i64toi32_i32$3 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, i64toi32_i32$2 = 0, i64toi32_i32$5 = 0, i64toi32_i32$4 = 0, $5_1 = 0, $5$hi = 0, $6_1 = 0, $6$hi = 0, $2_1 = 0, $7$hi = 0, $7_1 = 0, $4_1 = 0, $27_1 = 0, $28_1 = 0, $29_1 = 0, $30_1 = 0, $31_1 = 0, $32_1 = 0, $3_1 = 0, $33_1 = 0, $4$hi = 0, $35_1 = 0, $36_1 = 0, $36$hi = 0, $52_1 = 0, $54$hi = 0, $56_1 = 0, $56$hi = 0, $57$hi = 0, $59_1 = 0;
  $2_1 = global$0 - 16 | 0;
  global$0 = $2_1;
  wasm2js_scratch_store_f64(+$1_1);
  i64toi32_i32$0 = wasm2js_scratch_load_i32(1 | 0) | 0;
  $4_1 = wasm2js_scratch_load_i32(0 | 0) | 0;
  $4$hi = i64toi32_i32$0;
  i64toi32_i32$2 = $4_1;
  i64toi32_i32$1 = 1048575;
  i64toi32_i32$3 = -1;
  i64toi32_i32$1 = i64toi32_i32$0 & i64toi32_i32$1 | 0;
  $5_1 = i64toi32_i32$2 & i64toi32_i32$3 | 0;
  $5$hi = i64toi32_i32$1;
  block2 : {
   block : {
    i64toi32_i32$1 = i64toi32_i32$0;
    i64toi32_i32$1 = i64toi32_i32$0;
    i64toi32_i32$0 = i64toi32_i32$2;
    i64toi32_i32$2 = 0;
    i64toi32_i32$3 = 52;
    i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
     i64toi32_i32$2 = 0;
     $27_1 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
    } else {
     i64toi32_i32$2 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
     $27_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$1 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$0 >>> i64toi32_i32$4 | 0) | 0;
    }
    i64toi32_i32$1 = $27_1;
    i64toi32_i32$0 = 0;
    i64toi32_i32$3 = 2047;
    i64toi32_i32$0 = i64toi32_i32$2 & i64toi32_i32$0 | 0;
    $6_1 = i64toi32_i32$1 & i64toi32_i32$3 | 0;
    $6$hi = i64toi32_i32$0;
    if (!($6_1 | i64toi32_i32$0 | 0)) {
     break block
    }
    block1 : {
     i64toi32_i32$2 = $6_1;
     i64toi32_i32$1 = 0;
     i64toi32_i32$3 = 2047;
     if ((i64toi32_i32$2 | 0) == (i64toi32_i32$3 | 0) & (i64toi32_i32$0 | 0) == (i64toi32_i32$1 | 0) | 0) {
      break block1
     }
     i64toi32_i32$2 = $5$hi;
     i64toi32_i32$3 = $5_1;
     i64toi32_i32$0 = 0;
     i64toi32_i32$1 = 4;
     i64toi32_i32$4 = i64toi32_i32$1 & 31 | 0;
     if (32 >>> 0 <= (i64toi32_i32$1 & 63 | 0) >>> 0) {
      i64toi32_i32$0 = 0;
      $28_1 = i64toi32_i32$2 >>> i64toi32_i32$4 | 0;
     } else {
      i64toi32_i32$0 = i64toi32_i32$2 >>> i64toi32_i32$4 | 0;
      $28_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$2 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$3 >>> i64toi32_i32$4 | 0) | 0;
     }
     $7_1 = $28_1;
     $7$hi = i64toi32_i32$0;
     i64toi32_i32$0 = $5$hi;
     i64toi32_i32$2 = $5_1;
     i64toi32_i32$3 = 0;
     i64toi32_i32$1 = 60;
     i64toi32_i32$4 = i64toi32_i32$1 & 31 | 0;
     if (32 >>> 0 <= (i64toi32_i32$1 & 63 | 0) >>> 0) {
      i64toi32_i32$3 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
      $29_1 = 0;
     } else {
      i64toi32_i32$3 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$0 << i64toi32_i32$4 | 0) | 0;
      $29_1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
     }
     $5_1 = $29_1;
     $5$hi = i64toi32_i32$3;
     i64toi32_i32$3 = $6$hi;
     i64toi32_i32$0 = $6_1;
     i64toi32_i32$2 = 0;
     i64toi32_i32$1 = 15360;
     i64toi32_i32$4 = i64toi32_i32$0 + i64toi32_i32$1 | 0;
     i64toi32_i32$5 = i64toi32_i32$3 + i64toi32_i32$2 | 0;
     if (i64toi32_i32$4 >>> 0 < i64toi32_i32$1 >>> 0) {
      i64toi32_i32$5 = i64toi32_i32$5 + 1 | 0
     }
     $6_1 = i64toi32_i32$4;
     $6$hi = i64toi32_i32$5;
     break block2;
    }
    i64toi32_i32$5 = $5$hi;
    i64toi32_i32$3 = $5_1;
    i64toi32_i32$0 = 0;
    i64toi32_i32$1 = 4;
    i64toi32_i32$2 = i64toi32_i32$1 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$1 & 63 | 0) >>> 0) {
     i64toi32_i32$0 = 0;
     $30_1 = i64toi32_i32$5 >>> i64toi32_i32$2 | 0;
    } else {
     i64toi32_i32$0 = i64toi32_i32$5 >>> i64toi32_i32$2 | 0;
     $30_1 = (((1 << i64toi32_i32$2 | 0) - 1 | 0) & i64toi32_i32$5 | 0) << (32 - i64toi32_i32$2 | 0) | 0 | (i64toi32_i32$3 >>> i64toi32_i32$2 | 0) | 0;
    }
    $7_1 = $30_1;
    $7$hi = i64toi32_i32$0;
    i64toi32_i32$0 = $5$hi;
    i64toi32_i32$5 = $5_1;
    i64toi32_i32$3 = 0;
    i64toi32_i32$1 = 60;
    i64toi32_i32$2 = i64toi32_i32$1 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$1 & 63 | 0) >>> 0) {
     i64toi32_i32$3 = i64toi32_i32$5 << i64toi32_i32$2 | 0;
     $31_1 = 0;
    } else {
     i64toi32_i32$3 = ((1 << i64toi32_i32$2 | 0) - 1 | 0) & (i64toi32_i32$5 >>> (32 - i64toi32_i32$2 | 0) | 0) | 0 | (i64toi32_i32$0 << i64toi32_i32$2 | 0) | 0;
     $31_1 = i64toi32_i32$5 << i64toi32_i32$2 | 0;
    }
    $5_1 = $31_1;
    $5$hi = i64toi32_i32$3;
    i64toi32_i32$3 = 0;
    $6_1 = 32767;
    $6$hi = i64toi32_i32$3;
    break block2;
   }
   block3 : {
    i64toi32_i32$3 = $5$hi;
    if (!!($5_1 | i64toi32_i32$3 | 0)) {
     break block3
    }
    i64toi32_i32$3 = 0;
    $5_1 = 0;
    $5$hi = i64toi32_i32$3;
    i64toi32_i32$3 = 0;
    $7_1 = 0;
    $7$hi = i64toi32_i32$3;
    i64toi32_i32$3 = 0;
    $6_1 = 0;
    $6$hi = i64toi32_i32$3;
    break block2;
   }
   $35_1 = $2_1;
   i64toi32_i32$3 = $5$hi;
   $36_1 = $5_1;
   $36$hi = i64toi32_i32$3;
   i64toi32_i32$5 = $5_1;
   i64toi32_i32$1 = Math_clz32(i64toi32_i32$3);
   i64toi32_i32$0 = 0;
   if ((i64toi32_i32$1 | 0) == (32 | 0)) {
    $32_1 = Math_clz32(i64toi32_i32$5) + 32 | 0
   } else {
    $32_1 = i64toi32_i32$1
   }
   $3_1 = $32_1;
   i64toi32_i32$0 = $36$hi;
   i64toi32_i32$3 = 0;
   $191($35_1 | 0, $36_1 | 0, i64toi32_i32$0 | 0, 0 | 0, i64toi32_i32$3 | 0, $3_1 + 49 | 0 | 0);
   i64toi32_i32$5 = $2_1;
   i64toi32_i32$3 = HEAP32[(i64toi32_i32$5 + 8 | 0) >> 2] | 0;
   i64toi32_i32$0 = HEAP32[(i64toi32_i32$5 + 12 | 0) >> 2] | 0;
   i64toi32_i32$5 = i64toi32_i32$3;
   i64toi32_i32$3 = 65536;
   i64toi32_i32$1 = 0;
   i64toi32_i32$3 = i64toi32_i32$0 ^ i64toi32_i32$3 | 0;
   $7_1 = i64toi32_i32$5 ^ i64toi32_i32$1 | 0;
   $7$hi = i64toi32_i32$3;
   i64toi32_i32$3 = 0;
   $6_1 = 15372 - $3_1 | 0;
   $6$hi = i64toi32_i32$3;
   i64toi32_i32$0 = $2_1;
   i64toi32_i32$3 = HEAP32[i64toi32_i32$0 >> 2] | 0;
   i64toi32_i32$5 = HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] | 0;
   $5_1 = i64toi32_i32$3;
   $5$hi = i64toi32_i32$5;
  }
  i64toi32_i32$5 = $5$hi;
  i64toi32_i32$3 = $0_1;
  HEAP32[i64toi32_i32$3 >> 2] = $5_1;
  HEAP32[(i64toi32_i32$3 + 4 | 0) >> 2] = i64toi32_i32$5;
  $52_1 = i64toi32_i32$3;
  i64toi32_i32$5 = $6$hi;
  i64toi32_i32$0 = $6_1;
  i64toi32_i32$3 = 0;
  i64toi32_i32$1 = 48;
  i64toi32_i32$2 = i64toi32_i32$1 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$1 & 63 | 0) >>> 0) {
   i64toi32_i32$3 = i64toi32_i32$0 << i64toi32_i32$2 | 0;
   $33_1 = 0;
  } else {
   i64toi32_i32$3 = ((1 << i64toi32_i32$2 | 0) - 1 | 0) & (i64toi32_i32$0 >>> (32 - i64toi32_i32$2 | 0) | 0) | 0 | (i64toi32_i32$5 << i64toi32_i32$2 | 0) | 0;
   $33_1 = i64toi32_i32$0 << i64toi32_i32$2 | 0;
  }
  $54$hi = i64toi32_i32$3;
  i64toi32_i32$3 = $4$hi;
  i64toi32_i32$5 = $4_1;
  i64toi32_i32$0 = -2147483648;
  i64toi32_i32$1 = 0;
  i64toi32_i32$0 = i64toi32_i32$3 & i64toi32_i32$0 | 0;
  $56_1 = i64toi32_i32$5 & i64toi32_i32$1 | 0;
  $56$hi = i64toi32_i32$0;
  i64toi32_i32$0 = $54$hi;
  i64toi32_i32$3 = $33_1;
  i64toi32_i32$5 = $56$hi;
  i64toi32_i32$1 = $56_1;
  i64toi32_i32$5 = i64toi32_i32$0 | i64toi32_i32$5 | 0;
  $57$hi = i64toi32_i32$5;
  i64toi32_i32$5 = $7$hi;
  i64toi32_i32$5 = $57$hi;
  i64toi32_i32$0 = i64toi32_i32$3 | i64toi32_i32$1 | 0;
  i64toi32_i32$3 = $7$hi;
  i64toi32_i32$1 = $7_1;
  i64toi32_i32$3 = i64toi32_i32$5 | i64toi32_i32$3 | 0;
  $59_1 = i64toi32_i32$0 | i64toi32_i32$1 | 0;
  i64toi32_i32$0 = $52_1;
  HEAP32[(i64toi32_i32$0 + 8 | 0) >> 2] = $59_1;
  HEAP32[(i64toi32_i32$0 + 12 | 0) >> 2] = i64toi32_i32$3;
  global$0 = $2_1 + 16 | 0;
 }
 
 function $193($0_1, $0$hi, $1_1, $1$hi) {
  $0_1 = $0_1 | 0;
  $0$hi = $0$hi | 0;
  $1_1 = $1_1 | 0;
  $1$hi = $1$hi | 0;
  var i64toi32_i32$1 = 0, i64toi32_i32$2 = 0, i64toi32_i32$0 = 0, i64toi32_i32$3 = 0, i64toi32_i32$4 = 0, $3_1 = 0, $2_1 = 0, $4_1 = 0, $16_1 = 0, $17_1 = 0, $18_1 = 0, $19_1 = 0, $20_1 = 0, $25_1 = 0, $25$hi = 0, $30_1 = 0, $32_1 = 0;
  $2_1 = global$0 - 16 | 0;
  global$0 = $2_1;
  $3_1 = 0;
  block : {
   i64toi32_i32$0 = $1$hi;
   i64toi32_i32$2 = $1_1;
   i64toi32_i32$1 = 0;
   i64toi32_i32$3 = 48;
   i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
    i64toi32_i32$1 = 0;
    $16_1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
   } else {
    i64toi32_i32$1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
    $16_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$2 >>> i64toi32_i32$4 | 0) | 0;
   }
   $4_1 = $16_1 & 32767 | 0;
   if ($4_1 >>> 0 < 16383 >>> 0) {
    break block
   }
   block1 : {
    if (($4_1 + -16415 | 0) >>> 0 > -33 >>> 0) {
     break block1
    }
    i64toi32_i32$1 = $1$hi;
    i64toi32_i32$0 = $1_1;
    i64toi32_i32$2 = 0;
    i64toi32_i32$3 = 63;
    i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
     i64toi32_i32$2 = i64toi32_i32$1 >> 31 | 0;
     $17_1 = i64toi32_i32$1 >> i64toi32_i32$4 | 0;
    } else {
     i64toi32_i32$2 = i64toi32_i32$1 >> i64toi32_i32$4 | 0;
     $17_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$1 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$0 >>> i64toi32_i32$4 | 0) | 0;
    }
    $3_1 = $17_1 ^ 2147483647 | 0;
    break block;
   }
   i64toi32_i32$2 = $0$hi;
   i64toi32_i32$2 = $1$hi;
   i64toi32_i32$1 = $1_1;
   i64toi32_i32$0 = 65535;
   i64toi32_i32$3 = -1;
   i64toi32_i32$0 = i64toi32_i32$2 & i64toi32_i32$0 | 0;
   i64toi32_i32$2 = i64toi32_i32$1 & i64toi32_i32$3 | 0;
   i64toi32_i32$1 = 65536;
   i64toi32_i32$3 = 0;
   i64toi32_i32$1 = i64toi32_i32$0 | i64toi32_i32$1 | 0;
   $25_1 = i64toi32_i32$2 | i64toi32_i32$3 | 0;
   $25$hi = i64toi32_i32$1;
   i64toi32_i32$1 = $0$hi;
   i64toi32_i32$2 = $25$hi;
   $195($2_1 | 0, $0_1 | 0, i64toi32_i32$1 | 0, $25_1 | 0, i64toi32_i32$2 | 0, 16495 - $4_1 | 0 | 0);
   $3_1 = HEAP32[$2_1 >> 2] | 0;
   $30_1 = $3_1;
   $32_1 = 0 - $3_1 | 0;
   i64toi32_i32$2 = $1$hi;
   i64toi32_i32$0 = $1_1;
   i64toi32_i32$1 = -1;
   i64toi32_i32$3 = -1;
   if ((i64toi32_i32$2 | 0) > (i64toi32_i32$1 | 0)) {
    $18_1 = 1
   } else {
    if ((i64toi32_i32$2 | 0) >= (i64toi32_i32$1 | 0)) {
     if (i64toi32_i32$0 >>> 0 <= i64toi32_i32$3 >>> 0) {
      $19_1 = 0
     } else {
      $19_1 = 1
     }
     $20_1 = $19_1;
    } else {
     $20_1 = 0
    }
    $18_1 = $20_1;
   }
   $3_1 = $18_1 ? $30_1 : $32_1;
  }
  global$0 = $2_1 + 16 | 0;
  return $3_1 | 0;
 }
 
 function $194($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var i64toi32_i32$1 = 0, i64toi32_i32$0 = 0, i64toi32_i32$2 = 0, i64toi32_i32$5 = 0, i64toi32_i32$4 = 0, i64toi32_i32$3 = 0, $2_1 = 0, $3_1 = 0, $3$hi = 0, $4_1 = 0, $4$hi = 0, $17_1 = 0, $11_1 = 0, $19_1 = 0, $19$hi = 0, $23$hi = 0;
  $2_1 = global$0 - 16 | 0;
  global$0 = $2_1;
  block1 : {
   block : {
    if ($1_1) {
     break block
    }
    i64toi32_i32$0 = 0;
    $3_1 = 0;
    $3$hi = i64toi32_i32$0;
    i64toi32_i32$0 = 0;
    $4_1 = 0;
    $4$hi = i64toi32_i32$0;
    break block1;
   }
   i64toi32_i32$0 = 0;
   $11_1 = $1_1;
   $1_1 = Math_clz32($1_1);
   i64toi32_i32$1 = 0;
   $191($2_1 | 0, $11_1 | 0, i64toi32_i32$0 | 0, 0 | 0, i64toi32_i32$1 | 0, 112 - ($1_1 ^ 31 | 0) | 0 | 0);
   i64toi32_i32$2 = $2_1;
   i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 8 | 0) >> 2] | 0;
   i64toi32_i32$0 = HEAP32[(i64toi32_i32$2 + 12 | 0) >> 2] | 0;
   i64toi32_i32$2 = i64toi32_i32$1;
   i64toi32_i32$1 = 65536;
   i64toi32_i32$3 = 0;
   i64toi32_i32$1 = i64toi32_i32$0 ^ i64toi32_i32$1 | 0;
   $19_1 = i64toi32_i32$2 ^ i64toi32_i32$3 | 0;
   $19$hi = i64toi32_i32$1;
   i64toi32_i32$1 = 0;
   i64toi32_i32$0 = 16414 - $1_1 | 0;
   i64toi32_i32$2 = 0;
   i64toi32_i32$3 = 48;
   i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
    i64toi32_i32$2 = i64toi32_i32$0 << i64toi32_i32$4 | 0;
    $17_1 = 0;
   } else {
    i64toi32_i32$2 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$0 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$1 << i64toi32_i32$4 | 0) | 0;
    $17_1 = i64toi32_i32$0 << i64toi32_i32$4 | 0;
   }
   $23$hi = i64toi32_i32$2;
   i64toi32_i32$2 = $19$hi;
   i64toi32_i32$1 = $19_1;
   i64toi32_i32$0 = $23$hi;
   i64toi32_i32$3 = $17_1;
   i64toi32_i32$4 = i64toi32_i32$1 + i64toi32_i32$3 | 0;
   i64toi32_i32$5 = i64toi32_i32$2 + i64toi32_i32$0 | 0;
   if (i64toi32_i32$4 >>> 0 < i64toi32_i32$3 >>> 0) {
    i64toi32_i32$5 = i64toi32_i32$5 + 1 | 0
   }
   $4_1 = i64toi32_i32$4;
   $4$hi = i64toi32_i32$5;
   i64toi32_i32$2 = $2_1;
   i64toi32_i32$5 = HEAP32[i64toi32_i32$2 >> 2] | 0;
   i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 4 | 0) >> 2] | 0;
   $3_1 = i64toi32_i32$5;
   $3$hi = i64toi32_i32$1;
  }
  i64toi32_i32$1 = $3$hi;
  i64toi32_i32$5 = $0_1;
  HEAP32[i64toi32_i32$5 >> 2] = $3_1;
  HEAP32[(i64toi32_i32$5 + 4 | 0) >> 2] = i64toi32_i32$1;
  i64toi32_i32$1 = $4$hi;
  HEAP32[(i64toi32_i32$5 + 8 | 0) >> 2] = $4_1;
  HEAP32[(i64toi32_i32$5 + 12 | 0) >> 2] = i64toi32_i32$1;
  global$0 = $2_1 + 16 | 0;
 }
 
 function $195($0_1, $1_1, $1$hi, $2_1, $2$hi, $3_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $1$hi = $1$hi | 0;
  $2_1 = $2_1 | 0;
  $2$hi = $2$hi | 0;
  $3_1 = $3_1 | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$4 = 0, i64toi32_i32$2 = 0, i64toi32_i32$1 = 0, i64toi32_i32$3 = 0, $4$hi = 0, $18_1 = 0, $20_1 = 0, $21_1 = 0, $22_1 = 0, $11$hi = 0, $18$hi = 0, $19_1 = 0, $19$hi = 0, $4_1 = 0, $24$hi = 0;
  block1 : {
   block : {
    if (!($3_1 & 64 | 0)) {
     break block
    }
    i64toi32_i32$0 = $2$hi;
    i64toi32_i32$0 = 0;
    $11$hi = i64toi32_i32$0;
    i64toi32_i32$0 = $2$hi;
    i64toi32_i32$2 = $2_1;
    i64toi32_i32$1 = $11$hi;
    i64toi32_i32$3 = $3_1 + -64 | 0;
    i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
     i64toi32_i32$1 = 0;
     $18_1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
    } else {
     i64toi32_i32$1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
     $18_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$2 >>> i64toi32_i32$4 | 0) | 0;
    }
    $1_1 = $18_1;
    $1$hi = i64toi32_i32$1;
    i64toi32_i32$1 = 0;
    $2_1 = 0;
    $2$hi = i64toi32_i32$1;
    break block1;
   }
   if (!$3_1) {
    break block1
   }
   i64toi32_i32$1 = $2$hi;
   i64toi32_i32$1 = 0;
   $18$hi = i64toi32_i32$1;
   i64toi32_i32$1 = $2$hi;
   i64toi32_i32$0 = $2_1;
   i64toi32_i32$2 = $18$hi;
   i64toi32_i32$3 = 64 - $3_1 | 0;
   i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
    i64toi32_i32$2 = i64toi32_i32$0 << i64toi32_i32$4 | 0;
    $20_1 = 0;
   } else {
    i64toi32_i32$2 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$0 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$1 << i64toi32_i32$4 | 0) | 0;
    $20_1 = i64toi32_i32$0 << i64toi32_i32$4 | 0;
   }
   $19_1 = $20_1;
   $19$hi = i64toi32_i32$2;
   i64toi32_i32$2 = $1$hi;
   i64toi32_i32$2 = 0;
   $4_1 = $3_1;
   $4$hi = i64toi32_i32$2;
   i64toi32_i32$2 = $1$hi;
   i64toi32_i32$1 = $1_1;
   i64toi32_i32$0 = $4$hi;
   i64toi32_i32$3 = $3_1;
   i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
    i64toi32_i32$0 = 0;
    $21_1 = i64toi32_i32$2 >>> i64toi32_i32$4 | 0;
   } else {
    i64toi32_i32$0 = i64toi32_i32$2 >>> i64toi32_i32$4 | 0;
    $21_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$2 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$1 >>> i64toi32_i32$4 | 0) | 0;
   }
   $24$hi = i64toi32_i32$0;
   i64toi32_i32$0 = $19$hi;
   i64toi32_i32$2 = $19_1;
   i64toi32_i32$1 = $24$hi;
   i64toi32_i32$3 = $21_1;
   i64toi32_i32$1 = i64toi32_i32$0 | i64toi32_i32$1 | 0;
   $1_1 = i64toi32_i32$2 | i64toi32_i32$3 | 0;
   $1$hi = i64toi32_i32$1;
   i64toi32_i32$1 = $2$hi;
   i64toi32_i32$1 = $4$hi;
   i64toi32_i32$1 = $2$hi;
   i64toi32_i32$0 = $2_1;
   i64toi32_i32$2 = $4$hi;
   i64toi32_i32$3 = $4_1;
   i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
    i64toi32_i32$2 = 0;
    $22_1 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
   } else {
    i64toi32_i32$2 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
    $22_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$1 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$0 >>> i64toi32_i32$4 | 0) | 0;
   }
   $2_1 = $22_1;
   $2$hi = i64toi32_i32$2;
  }
  i64toi32_i32$2 = $1$hi;
  i64toi32_i32$0 = $0_1;
  HEAP32[i64toi32_i32$0 >> 2] = $1_1;
  HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = i64toi32_i32$2;
  i64toi32_i32$2 = $2$hi;
  HEAP32[(i64toi32_i32$0 + 8 | 0) >> 2] = $2_1;
  HEAP32[(i64toi32_i32$0 + 12 | 0) >> 2] = i64toi32_i32$2;
 }
 
 function $196($0_1, $1_1, $1$hi, $2_1, $2$hi, $3_1, $3$hi, $4_1, $4$hi) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $1$hi = $1$hi | 0;
  $2_1 = $2_1 | 0;
  $2$hi = $2$hi | 0;
  $3_1 = $3_1 | 0;
  $3$hi = $3$hi | 0;
  $4_1 = $4_1 | 0;
  $4$hi = $4$hi | 0;
  var i64toi32_i32$2 = 0, i64toi32_i32$1 = 0, i64toi32_i32$0 = 0, i64toi32_i32$4 = 0, i64toi32_i32$3 = 0, i64toi32_i32$5 = 0, $10$hi = 0, $11$hi = 0, $13$hi = 0, $14$hi = 0, $10_1 = 0, $11_1 = 0, $15$hi = 0, $16$hi = 0, $5_1 = 0, $12$hi = 0, $13_1 = 0, $6_1 = 0, $14_1 = 0, $12_1 = 0, $15_1 = 0, $17$hi = 0, $8_1 = 0, $16_1 = 0, $17_1 = 0, $7_1 = 0, $9_1 = 0, $18$hi = 0, $215 = 0, $216 = 0, $218 = 0, $219 = 0, $220 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $229 = 0, $230 = 0, $18_1 = 0, $231 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $239 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $248 = 0, $249 = 0, $250 = 0, $251 = 0, $252 = 0, $254 = 0, $255 = 0, $47_1 = 0, $51_1 = 0, $58_1 = 0, $62_1 = 0, $71_1 = 0, $71$hi = 0, $83_1 = 0, $83$hi = 0, $105_1 = 0, $106_1 = 0, $106$hi = 0, $107_1 = 0, $107$hi = 0, $114$hi = 0, $116_1 = 0, $116$hi = 0, $132_1 = 0, $133_1 = 0, $133$hi = 0, $134_1 = 0, $134$hi = 0, $141$hi = 0, $143_1 = 0, $143$hi = 0, $167_1 = 0, $167$hi = 0, $172_1 = 0, $172$hi = 0, $181_1 = 0, $181$hi = 0, $186_1 = 0, $186$hi = 0, $187_1 = 0, $187$hi = 0, $189$hi = 0, $197_1 = 0, $197$hi = 0, $201_1 = 0, $202$hi = 0, $203$hi = 0, $206_1 = 0, $206$hi = 0, $207_1 = 0, $207$hi = 0, $208_1 = 0, $208$hi = 0, $217 = 0, $217$hi = 0, $221 = 0, $222 = 0, $222$hi = 0, $228 = 0, $228$hi = 0, $232 = 0, $233$hi = 0, $234$hi = 0, $238 = 0, $239$hi = 0, $240 = 0, $240$hi = 0, $247 = 0, $247$hi = 0, $253 = 0, $253$hi = 0, $255$hi = 0, $256 = 0, $256$hi = 0, $257 = 0, $257$hi = 0, $258 = 0, $258$hi = 0, $260$hi = 0, $264 = 0, $265$hi = 0, $266 = 0, $266$hi = 0, $267 = 0, $267$hi = 0, $274 = 0, $274$hi = 0, $279 = 0, $279$hi = 0, $284 = 0, $284$hi = 0, $287 = 0, $287$hi = 0, $290 = 0, $291$hi = 0, $294 = 0, $295$hi = 0, $296$hi = 0, $299 = 0, $300$hi = 0, $302$hi = 0, $303 = 0, $303$hi = 0, $307 = 0, $308$hi = 0, $309 = 0, $309$hi = 0, $310 = 0, $310$hi = 0, $311 = 0, $311$hi = 0, $318 = 0, $318$hi = 0, $321 = 0, $321$hi = 0, $324 = 0, $326$hi = 0, $327 = 0, $327$hi = 0, $332 = 0, $332$hi = 0, $333 = 0, $333$hi = 0, $335$hi = 0, $339 = 0, $340$hi = 0, $341$hi = 0, $345 = 0, $346$hi = 0, $347 = 0, $347$hi = 0, $348 = 0, $348$hi = 0, $349 = 0, $349$hi = 0, $355 = 0, $355$hi = 0, $359 = 0, $360$hi = 0, $364 = 0, $365$hi = 0, $369 = 0, $370$hi = 0, $380 = 0, $380$hi = 0, $382$hi = 0, $385 = 0, $385$hi = 0, $387$hi = 0, $391 = 0, $391$hi = 0, $393$hi = 0, $427 = 0, $427$hi = 0, $429 = 0, $429$hi = 0, $430 = 0, $430$hi = 0, $432 = 0, $432$hi = 0, $434 = 0, $434$hi = 0, $436 = 0, $437$hi = 0, $440 = 0, $440$hi = 0, $442 = 0, $442$hi = 0, $450$hi = 0, $452 = 0, $452$hi = 0, $458 = 0, $464 = 0, $464$hi = 0, $468 = 0, $469$hi = 0, $473 = 0, $473$hi = 0, $477 = 0, $477$hi = 0, $480 = 0, $480$hi = 0, $484 = 0, $485$hi = 0;
  $5_1 = global$0 - 96 | 0;
  global$0 = $5_1;
  i64toi32_i32$0 = $4$hi;
  i64toi32_i32$2 = $4_1;
  i64toi32_i32$1 = 65535;
  i64toi32_i32$3 = -1;
  i64toi32_i32$1 = i64toi32_i32$0 & i64toi32_i32$1 | 0;
  $10_1 = i64toi32_i32$2 & i64toi32_i32$3 | 0;
  $10$hi = i64toi32_i32$1;
  i64toi32_i32$1 = i64toi32_i32$0;
  i64toi32_i32$1 = $2$hi;
  i64toi32_i32$1 = i64toi32_i32$0;
  i64toi32_i32$0 = i64toi32_i32$2;
  i64toi32_i32$2 = $2$hi;
  i64toi32_i32$3 = $2_1;
  i64toi32_i32$2 = i64toi32_i32$1 ^ i64toi32_i32$2 | 0;
  i64toi32_i32$1 = i64toi32_i32$0 ^ i64toi32_i32$3 | 0;
  i64toi32_i32$0 = -2147483648;
  i64toi32_i32$3 = 0;
  i64toi32_i32$0 = i64toi32_i32$2 & i64toi32_i32$0 | 0;
  $11_1 = i64toi32_i32$1 & i64toi32_i32$3 | 0;
  $11$hi = i64toi32_i32$0;
  i64toi32_i32$0 = $2$hi;
  i64toi32_i32$2 = $2_1;
  i64toi32_i32$1 = 65535;
  i64toi32_i32$3 = -1;
  i64toi32_i32$1 = i64toi32_i32$0 & i64toi32_i32$1 | 0;
  $12_1 = i64toi32_i32$2 & i64toi32_i32$3 | 0;
  $12$hi = i64toi32_i32$1;
  i64toi32_i32$0 = $12_1;
  i64toi32_i32$2 = 0;
  i64toi32_i32$3 = 32;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$2 = 0;
   $215 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
  } else {
   i64toi32_i32$2 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
   $215 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$1 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$0 >>> i64toi32_i32$4 | 0) | 0;
  }
  $13_1 = $215;
  $13$hi = i64toi32_i32$2;
  i64toi32_i32$2 = $4$hi;
  i64toi32_i32$1 = $4_1;
  i64toi32_i32$0 = 0;
  i64toi32_i32$3 = 48;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$0 = 0;
   $216 = i64toi32_i32$2 >>> i64toi32_i32$4 | 0;
  } else {
   i64toi32_i32$0 = i64toi32_i32$2 >>> i64toi32_i32$4 | 0;
   $216 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$2 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$1 >>> i64toi32_i32$4 | 0) | 0;
  }
  $6_1 = $216 & 32767 | 0;
  block3 : {
   block1 : {
    block : {
     i64toi32_i32$0 = $2$hi;
     i64toi32_i32$2 = $2_1;
     i64toi32_i32$1 = 0;
     i64toi32_i32$3 = 48;
     i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
     if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
      i64toi32_i32$1 = 0;
      $218 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
     } else {
      i64toi32_i32$1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
      $218 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$2 >>> i64toi32_i32$4 | 0) | 0;
     }
     $7_1 = $218 & 32767 | 0;
     if (($7_1 + -32767 | 0) >>> 0 < -32766 >>> 0) {
      break block
     }
     $8_1 = 0;
     if (($6_1 + -32767 | 0) >>> 0 > -32767 >>> 0) {
      break block1
     }
    }
    block2 : {
     i64toi32_i32$1 = $1$hi;
     $47_1 = !($1_1 | i64toi32_i32$1 | 0);
     i64toi32_i32$1 = $2$hi;
     i64toi32_i32$0 = $2_1;
     i64toi32_i32$2 = 2147483647;
     i64toi32_i32$3 = -1;
     i64toi32_i32$2 = i64toi32_i32$1 & i64toi32_i32$2 | 0;
     $14_1 = i64toi32_i32$0 & i64toi32_i32$3 | 0;
     $14$hi = i64toi32_i32$2;
     i64toi32_i32$1 = $14_1;
     i64toi32_i32$0 = 2147418112;
     i64toi32_i32$3 = 0;
     $51_1 = i64toi32_i32$2 >>> 0 < i64toi32_i32$0 >>> 0 | ((i64toi32_i32$2 | 0) == (i64toi32_i32$0 | 0) & i64toi32_i32$1 >>> 0 < i64toi32_i32$3 >>> 0 | 0) | 0;
     i64toi32_i32$1 = i64toi32_i32$2;
     i64toi32_i32$3 = $14_1;
     i64toi32_i32$2 = 2147418112;
     i64toi32_i32$0 = 0;
     if ((i64toi32_i32$3 | 0) == (i64toi32_i32$0 | 0) & (i64toi32_i32$1 | 0) == (i64toi32_i32$2 | 0) | 0 ? $47_1 : $51_1) {
      break block2
     }
     i64toi32_i32$3 = $2$hi;
     i64toi32_i32$0 = $2_1;
     i64toi32_i32$1 = 32768;
     i64toi32_i32$2 = 0;
     i64toi32_i32$1 = i64toi32_i32$3 | i64toi32_i32$1 | 0;
     $11_1 = i64toi32_i32$0 | i64toi32_i32$2 | 0;
     $11$hi = i64toi32_i32$1;
     break block3;
    }
    block4 : {
     i64toi32_i32$1 = $3$hi;
     $58_1 = !($3_1 | i64toi32_i32$1 | 0);
     i64toi32_i32$1 = $4$hi;
     i64toi32_i32$3 = $4_1;
     i64toi32_i32$0 = 2147483647;
     i64toi32_i32$2 = -1;
     i64toi32_i32$0 = i64toi32_i32$1 & i64toi32_i32$0 | 0;
     $2_1 = i64toi32_i32$3 & i64toi32_i32$2 | 0;
     $2$hi = i64toi32_i32$0;
     i64toi32_i32$1 = $2_1;
     i64toi32_i32$3 = 2147418112;
     i64toi32_i32$2 = 0;
     $62_1 = i64toi32_i32$0 >>> 0 < i64toi32_i32$3 >>> 0 | ((i64toi32_i32$0 | 0) == (i64toi32_i32$3 | 0) & i64toi32_i32$1 >>> 0 < i64toi32_i32$2 >>> 0 | 0) | 0;
     i64toi32_i32$1 = i64toi32_i32$0;
     i64toi32_i32$2 = $2_1;
     i64toi32_i32$0 = 2147418112;
     i64toi32_i32$3 = 0;
     if ((i64toi32_i32$2 | 0) == (i64toi32_i32$3 | 0) & (i64toi32_i32$1 | 0) == (i64toi32_i32$0 | 0) | 0 ? $58_1 : $62_1) {
      break block4
     }
     i64toi32_i32$2 = $4$hi;
     i64toi32_i32$3 = $4_1;
     i64toi32_i32$1 = 32768;
     i64toi32_i32$0 = 0;
     i64toi32_i32$1 = i64toi32_i32$2 | i64toi32_i32$1 | 0;
     $11_1 = i64toi32_i32$3 | i64toi32_i32$0 | 0;
     $11$hi = i64toi32_i32$1;
     i64toi32_i32$1 = $3$hi;
     $1_1 = $3_1;
     $1$hi = i64toi32_i32$1;
     break block3;
    }
    block5 : {
     i64toi32_i32$1 = $1$hi;
     i64toi32_i32$1 = $14$hi;
     i64toi32_i32$2 = $14_1;
     i64toi32_i32$3 = 2147418112;
     i64toi32_i32$0 = 0;
     i64toi32_i32$3 = i64toi32_i32$1 ^ i64toi32_i32$3 | 0;
     $71_1 = i64toi32_i32$2 ^ i64toi32_i32$0 | 0;
     $71$hi = i64toi32_i32$3;
     i64toi32_i32$3 = $1$hi;
     i64toi32_i32$1 = $1_1;
     i64toi32_i32$2 = $71$hi;
     i64toi32_i32$0 = $71_1;
     i64toi32_i32$2 = i64toi32_i32$3 | i64toi32_i32$2 | 0;
     i64toi32_i32$3 = i64toi32_i32$1 | i64toi32_i32$0 | 0;
     i64toi32_i32$1 = 0;
     i64toi32_i32$0 = 0;
     if ((i64toi32_i32$3 | 0) != (i64toi32_i32$0 | 0) | (i64toi32_i32$2 | 0) != (i64toi32_i32$1 | 0) | 0) {
      break block5
     }
     block6 : {
      i64toi32_i32$3 = $3$hi;
      i64toi32_i32$3 = $2$hi;
      i64toi32_i32$3 = $3$hi;
      i64toi32_i32$0 = $3_1;
      i64toi32_i32$2 = $2$hi;
      i64toi32_i32$1 = $2_1;
      i64toi32_i32$2 = i64toi32_i32$3 | i64toi32_i32$2 | 0;
      if (!!(i64toi32_i32$0 | i64toi32_i32$1 | 0 | i64toi32_i32$2 | 0)) {
       break block6
      }
      i64toi32_i32$2 = 2147450880;
      $11_1 = 0;
      $11$hi = i64toi32_i32$2;
      i64toi32_i32$2 = 0;
      $1_1 = 0;
      $1$hi = i64toi32_i32$2;
      break block3;
     }
     i64toi32_i32$2 = $11$hi;
     i64toi32_i32$3 = $11_1;
     i64toi32_i32$0 = 2147418112;
     i64toi32_i32$1 = 0;
     i64toi32_i32$0 = i64toi32_i32$2 | i64toi32_i32$0 | 0;
     $11_1 = i64toi32_i32$3 | i64toi32_i32$1 | 0;
     $11$hi = i64toi32_i32$0;
     i64toi32_i32$0 = 0;
     $1_1 = 0;
     $1$hi = i64toi32_i32$0;
     break block3;
    }
    block7 : {
     i64toi32_i32$0 = $3$hi;
     i64toi32_i32$0 = $2$hi;
     i64toi32_i32$2 = $2_1;
     i64toi32_i32$3 = 2147418112;
     i64toi32_i32$1 = 0;
     i64toi32_i32$3 = i64toi32_i32$0 ^ i64toi32_i32$3 | 0;
     $83_1 = i64toi32_i32$2 ^ i64toi32_i32$1 | 0;
     $83$hi = i64toi32_i32$3;
     i64toi32_i32$3 = $3$hi;
     i64toi32_i32$0 = $3_1;
     i64toi32_i32$2 = $83$hi;
     i64toi32_i32$1 = $83_1;
     i64toi32_i32$2 = i64toi32_i32$3 | i64toi32_i32$2 | 0;
     i64toi32_i32$3 = i64toi32_i32$0 | i64toi32_i32$1 | 0;
     i64toi32_i32$0 = 0;
     i64toi32_i32$1 = 0;
     if ((i64toi32_i32$3 | 0) != (i64toi32_i32$1 | 0) | (i64toi32_i32$2 | 0) != (i64toi32_i32$0 | 0) | 0) {
      break block7
     }
     i64toi32_i32$3 = $1$hi;
     i64toi32_i32$3 = $14$hi;
     i64toi32_i32$3 = $1$hi;
     i64toi32_i32$1 = $1_1;
     i64toi32_i32$2 = $14$hi;
     i64toi32_i32$0 = $14_1;
     i64toi32_i32$2 = i64toi32_i32$3 | i64toi32_i32$2 | 0;
     $2_1 = i64toi32_i32$1 | i64toi32_i32$0 | 0;
     $2$hi = i64toi32_i32$2;
     i64toi32_i32$2 = 0;
     $1_1 = 0;
     $1$hi = i64toi32_i32$2;
     block8 : {
      i64toi32_i32$2 = $2$hi;
      if (!!($2_1 | i64toi32_i32$2 | 0)) {
       break block8
      }
      i64toi32_i32$2 = 2147450880;
      $11_1 = 0;
      $11$hi = i64toi32_i32$2;
      break block3;
     }
     i64toi32_i32$2 = $11$hi;
     i64toi32_i32$3 = $11_1;
     i64toi32_i32$1 = 2147418112;
     i64toi32_i32$0 = 0;
     i64toi32_i32$1 = i64toi32_i32$2 | i64toi32_i32$1 | 0;
     $11_1 = i64toi32_i32$3 | i64toi32_i32$0 | 0;
     $11$hi = i64toi32_i32$1;
     break block3;
    }
    block9 : {
     i64toi32_i32$1 = $1$hi;
     i64toi32_i32$1 = $14$hi;
     i64toi32_i32$1 = $1$hi;
     i64toi32_i32$2 = $1_1;
     i64toi32_i32$3 = $14$hi;
     i64toi32_i32$0 = $14_1;
     i64toi32_i32$3 = i64toi32_i32$1 | i64toi32_i32$3 | 0;
     i64toi32_i32$1 = i64toi32_i32$2 | i64toi32_i32$0 | 0;
     i64toi32_i32$2 = 0;
     i64toi32_i32$0 = 0;
     if ((i64toi32_i32$1 | 0) != (i64toi32_i32$0 | 0) | (i64toi32_i32$3 | 0) != (i64toi32_i32$2 | 0) | 0) {
      break block9
     }
     i64toi32_i32$1 = 0;
     $1_1 = 0;
     $1$hi = i64toi32_i32$1;
     break block3;
    }
    block10 : {
     i64toi32_i32$1 = $3$hi;
     i64toi32_i32$1 = $2$hi;
     i64toi32_i32$1 = $3$hi;
     i64toi32_i32$0 = $3_1;
     i64toi32_i32$3 = $2$hi;
     i64toi32_i32$2 = $2_1;
     i64toi32_i32$3 = i64toi32_i32$1 | i64toi32_i32$3 | 0;
     i64toi32_i32$1 = i64toi32_i32$0 | i64toi32_i32$2 | 0;
     i64toi32_i32$0 = 0;
     i64toi32_i32$2 = 0;
     if ((i64toi32_i32$1 | 0) != (i64toi32_i32$2 | 0) | (i64toi32_i32$3 | 0) != (i64toi32_i32$0 | 0) | 0) {
      break block10
     }
     i64toi32_i32$1 = 0;
     $1_1 = 0;
     $1$hi = i64toi32_i32$1;
     break block3;
    }
    $8_1 = 0;
    block11 : {
     i64toi32_i32$1 = $14$hi;
     i64toi32_i32$2 = $14_1;
     i64toi32_i32$3 = 65535;
     i64toi32_i32$0 = -1;
     if (i64toi32_i32$1 >>> 0 > i64toi32_i32$3 >>> 0 | ((i64toi32_i32$1 | 0) == (i64toi32_i32$3 | 0) & i64toi32_i32$2 >>> 0 > i64toi32_i32$0 >>> 0 | 0) | 0) {
      break block11
     }
     $105_1 = $5_1 + 80 | 0;
     i64toi32_i32$2 = $1$hi;
     $106_1 = $1_1;
     $106$hi = i64toi32_i32$2;
     i64toi32_i32$2 = $12$hi;
     $107_1 = $12_1;
     $107$hi = i64toi32_i32$2;
     i64toi32_i32$2 = $1$hi;
     i64toi32_i32$2 = $12$hi;
     $8_1 = !($12_1 | i64toi32_i32$2 | 0);
     i64toi32_i32$4 = $8_1;
     i64toi32_i32$2 = $1$hi;
     i64toi32_i32$1 = $12$hi;
     i64toi32_i32$3 = i64toi32_i32$4 ? $1_1 : $12_1;
     i64toi32_i32$0 = i64toi32_i32$4 ? i64toi32_i32$2 : i64toi32_i32$1;
     i64toi32_i32$1 = Math_clz32(i64toi32_i32$0);
     i64toi32_i32$4 = 0;
     if ((i64toi32_i32$1 | 0) == (32 | 0)) {
      $219 = Math_clz32(i64toi32_i32$3) + 32 | 0
     } else {
      $219 = i64toi32_i32$1
     }
     $114$hi = i64toi32_i32$4;
     i64toi32_i32$2 = $8_1;
     i64toi32_i32$4 = 0;
     i64toi32_i32$0 = 0;
     i64toi32_i32$1 = i64toi32_i32$2 ? 64 : 0;
     i64toi32_i32$3 = i64toi32_i32$2 ? i64toi32_i32$4 : i64toi32_i32$0;
     $116_1 = i64toi32_i32$1;
     $116$hi = i64toi32_i32$3;
     i64toi32_i32$3 = $114$hi;
     i64toi32_i32$2 = $219;
     i64toi32_i32$1 = $116$hi;
     i64toi32_i32$0 = $116_1;
     i64toi32_i32$4 = i64toi32_i32$2 + i64toi32_i32$0 | 0;
     i64toi32_i32$5 = i64toi32_i32$3 + i64toi32_i32$1 | 0;
     if (i64toi32_i32$4 >>> 0 < i64toi32_i32$0 >>> 0) {
      i64toi32_i32$5 = i64toi32_i32$5 + 1 | 0
     }
     $8_1 = i64toi32_i32$4;
     i64toi32_i32$5 = $106$hi;
     i64toi32_i32$2 = $107$hi;
     $191($105_1 | 0, $106_1 | 0, i64toi32_i32$5 | 0, $107_1 | 0, i64toi32_i32$2 | 0, i64toi32_i32$4 + -15 | 0 | 0);
     $8_1 = 16 - i64toi32_i32$4 | 0;
     i64toi32_i32$3 = $5_1;
     i64toi32_i32$2 = HEAP32[(i64toi32_i32$3 + 88 | 0) >> 2] | 0;
     i64toi32_i32$5 = HEAP32[(i64toi32_i32$3 + 92 | 0) >> 2] | 0;
     $12_1 = i64toi32_i32$2;
     $12$hi = i64toi32_i32$5;
     i64toi32_i32$3 = i64toi32_i32$2;
     i64toi32_i32$2 = 0;
     i64toi32_i32$0 = 32;
     i64toi32_i32$1 = i64toi32_i32$0 & 31 | 0;
     if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
      i64toi32_i32$2 = 0;
      $220 = i64toi32_i32$5 >>> i64toi32_i32$1 | 0;
     } else {
      i64toi32_i32$2 = i64toi32_i32$5 >>> i64toi32_i32$1 | 0;
      $220 = (((1 << i64toi32_i32$1 | 0) - 1 | 0) & i64toi32_i32$5 | 0) << (32 - i64toi32_i32$1 | 0) | 0 | (i64toi32_i32$3 >>> i64toi32_i32$1 | 0) | 0;
     }
     $13_1 = $220;
     $13$hi = i64toi32_i32$2;
     i64toi32_i32$5 = $5_1;
     i64toi32_i32$2 = HEAP32[(i64toi32_i32$5 + 80 | 0) >> 2] | 0;
     i64toi32_i32$3 = HEAP32[(i64toi32_i32$5 + 84 | 0) >> 2] | 0;
     $1_1 = i64toi32_i32$2;
     $1$hi = i64toi32_i32$3;
    }
    i64toi32_i32$3 = $2$hi;
    i64toi32_i32$5 = $2_1;
    i64toi32_i32$2 = 65535;
    i64toi32_i32$0 = -1;
    if (i64toi32_i32$3 >>> 0 > i64toi32_i32$2 >>> 0 | ((i64toi32_i32$3 | 0) == (i64toi32_i32$2 | 0) & i64toi32_i32$5 >>> 0 > i64toi32_i32$0 >>> 0 | 0) | 0) {
     break block1
    }
    $132_1 = $5_1 + 64 | 0;
    i64toi32_i32$5 = $3$hi;
    $133_1 = $3_1;
    $133$hi = i64toi32_i32$5;
    i64toi32_i32$5 = $10$hi;
    $134_1 = $10_1;
    $134$hi = i64toi32_i32$5;
    i64toi32_i32$5 = $3$hi;
    i64toi32_i32$5 = $10$hi;
    $9_1 = !($10_1 | i64toi32_i32$5 | 0);
    i64toi32_i32$1 = $9_1;
    i64toi32_i32$5 = $3$hi;
    i64toi32_i32$3 = $10$hi;
    i64toi32_i32$2 = i64toi32_i32$1 ? $3_1 : $10_1;
    i64toi32_i32$0 = i64toi32_i32$1 ? i64toi32_i32$5 : i64toi32_i32$3;
    i64toi32_i32$3 = Math_clz32(i64toi32_i32$0);
    i64toi32_i32$1 = 0;
    if ((i64toi32_i32$3 | 0) == (32 | 0)) {
     $223 = Math_clz32(i64toi32_i32$2) + 32 | 0
    } else {
     $223 = i64toi32_i32$3
    }
    $141$hi = i64toi32_i32$1;
    i64toi32_i32$5 = $9_1;
    i64toi32_i32$1 = 0;
    i64toi32_i32$0 = 0;
    i64toi32_i32$3 = i64toi32_i32$5 ? 64 : 0;
    i64toi32_i32$2 = i64toi32_i32$5 ? i64toi32_i32$1 : i64toi32_i32$0;
    $143_1 = i64toi32_i32$3;
    $143$hi = i64toi32_i32$2;
    i64toi32_i32$2 = $141$hi;
    i64toi32_i32$5 = $223;
    i64toi32_i32$3 = $143$hi;
    i64toi32_i32$0 = $143_1;
    i64toi32_i32$1 = i64toi32_i32$5 + i64toi32_i32$0 | 0;
    i64toi32_i32$4 = i64toi32_i32$2 + i64toi32_i32$3 | 0;
    if (i64toi32_i32$1 >>> 0 < i64toi32_i32$0 >>> 0) {
     i64toi32_i32$4 = i64toi32_i32$4 + 1 | 0
    }
    $9_1 = i64toi32_i32$1;
    i64toi32_i32$4 = $133$hi;
    i64toi32_i32$5 = $134$hi;
    $191($132_1 | 0, $133_1 | 0, i64toi32_i32$4 | 0, $134_1 | 0, i64toi32_i32$5 | 0, i64toi32_i32$1 + -15 | 0 | 0);
    $8_1 = ($8_1 - i64toi32_i32$1 | 0) + 16 | 0;
    i64toi32_i32$2 = $5_1;
    i64toi32_i32$5 = HEAP32[(i64toi32_i32$2 + 72 | 0) >> 2] | 0;
    i64toi32_i32$4 = HEAP32[(i64toi32_i32$2 + 76 | 0) >> 2] | 0;
    $10_1 = i64toi32_i32$5;
    $10$hi = i64toi32_i32$4;
    i64toi32_i32$4 = HEAP32[(i64toi32_i32$2 + 64 | 0) >> 2] | 0;
    i64toi32_i32$5 = HEAP32[(i64toi32_i32$2 + 68 | 0) >> 2] | 0;
    $3_1 = i64toi32_i32$4;
    $3$hi = i64toi32_i32$5;
   }
   $6_1 = (($7_1 + $6_1 | 0) + $8_1 | 0) + -16383 | 0;
   block13 : {
    block12 : {
     i64toi32_i32$5 = $10$hi;
     i64toi32_i32$2 = $10_1;
     i64toi32_i32$4 = 0;
     i64toi32_i32$0 = 15;
     i64toi32_i32$3 = i64toi32_i32$0 & 31 | 0;
     if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
      i64toi32_i32$4 = i64toi32_i32$2 << i64toi32_i32$3 | 0;
      $224 = 0;
     } else {
      i64toi32_i32$4 = ((1 << i64toi32_i32$3 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$3 | 0) | 0) | 0 | (i64toi32_i32$5 << i64toi32_i32$3 | 0) | 0;
      $224 = i64toi32_i32$2 << i64toi32_i32$3 | 0;
     }
     $15_1 = $224;
     $15$hi = i64toi32_i32$4;
     i64toi32_i32$5 = $15_1;
     i64toi32_i32$2 = 0;
     i64toi32_i32$0 = 32;
     i64toi32_i32$3 = i64toi32_i32$0 & 31 | 0;
     if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
      i64toi32_i32$2 = 0;
      $225 = i64toi32_i32$4 >>> i64toi32_i32$3 | 0;
     } else {
      i64toi32_i32$2 = i64toi32_i32$4 >>> i64toi32_i32$3 | 0;
      $225 = (((1 << i64toi32_i32$3 | 0) - 1 | 0) & i64toi32_i32$4 | 0) << (32 - i64toi32_i32$3 | 0) | 0 | (i64toi32_i32$5 >>> i64toi32_i32$3 | 0) | 0;
     }
     i64toi32_i32$4 = $225;
     i64toi32_i32$5 = 0;
     i64toi32_i32$0 = -2147483648;
     i64toi32_i32$5 = i64toi32_i32$2 | i64toi32_i32$5 | 0;
     $2_1 = i64toi32_i32$4 | i64toi32_i32$0 | 0;
     $2$hi = i64toi32_i32$5;
     $167_1 = $2_1;
     $167$hi = i64toi32_i32$5;
     i64toi32_i32$5 = $1$hi;
     i64toi32_i32$2 = $1_1;
     i64toi32_i32$4 = 0;
     i64toi32_i32$0 = 32;
     i64toi32_i32$3 = i64toi32_i32$0 & 31 | 0;
     if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
      i64toi32_i32$4 = 0;
      $226 = i64toi32_i32$5 >>> i64toi32_i32$3 | 0;
     } else {
      i64toi32_i32$4 = i64toi32_i32$5 >>> i64toi32_i32$3 | 0;
      $226 = (((1 << i64toi32_i32$3 | 0) - 1 | 0) & i64toi32_i32$5 | 0) << (32 - i64toi32_i32$3 | 0) | 0 | (i64toi32_i32$2 >>> i64toi32_i32$3 | 0) | 0;
     }
     $4_1 = $226;
     $4$hi = i64toi32_i32$4;
     i64toi32_i32$4 = $167$hi;
     i64toi32_i32$2 = $4$hi;
     i64toi32_i32$2 = __wasm_i64_mul($167_1 | 0, i64toi32_i32$4 | 0, $4_1 | 0, i64toi32_i32$2 | 0) | 0;
     i64toi32_i32$4 = i64toi32_i32$HIGH_BITS;
     $16_1 = i64toi32_i32$2;
     $16$hi = i64toi32_i32$4;
     $172_1 = i64toi32_i32$2;
     $172$hi = i64toi32_i32$4;
     i64toi32_i32$4 = $3$hi;
     i64toi32_i32$5 = $3_1;
     i64toi32_i32$2 = 0;
     i64toi32_i32$0 = 15;
     i64toi32_i32$3 = i64toi32_i32$0 & 31 | 0;
     if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
      i64toi32_i32$2 = i64toi32_i32$5 << i64toi32_i32$3 | 0;
      $227 = 0;
     } else {
      i64toi32_i32$2 = ((1 << i64toi32_i32$3 | 0) - 1 | 0) & (i64toi32_i32$5 >>> (32 - i64toi32_i32$3 | 0) | 0) | 0 | (i64toi32_i32$4 << i64toi32_i32$3 | 0) | 0;
      $227 = i64toi32_i32$5 << i64toi32_i32$3 | 0;
     }
     $17_1 = $227;
     $17$hi = i64toi32_i32$2;
     i64toi32_i32$4 = $17_1;
     i64toi32_i32$5 = 0;
     i64toi32_i32$0 = 32;
     i64toi32_i32$3 = i64toi32_i32$0 & 31 | 0;
     if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
      i64toi32_i32$5 = 0;
      $229 = i64toi32_i32$2 >>> i64toi32_i32$3 | 0;
     } else {
      i64toi32_i32$5 = i64toi32_i32$2 >>> i64toi32_i32$3 | 0;
      $229 = (((1 << i64toi32_i32$3 | 0) - 1 | 0) & i64toi32_i32$2 | 0) << (32 - i64toi32_i32$3 | 0) | 0 | (i64toi32_i32$4 >>> i64toi32_i32$3 | 0) | 0;
     }
     $10_1 = $229;
     $10$hi = i64toi32_i32$5;
     i64toi32_i32$5 = $13$hi;
     i64toi32_i32$2 = $13_1;
     i64toi32_i32$4 = 0;
     i64toi32_i32$0 = 65536;
     i64toi32_i32$4 = i64toi32_i32$5 | i64toi32_i32$4 | 0;
     $13_1 = i64toi32_i32$2 | i64toi32_i32$0 | 0;
     $13$hi = i64toi32_i32$4;
     i64toi32_i32$4 = $10$hi;
     i64toi32_i32$2 = $13$hi;
     i64toi32_i32$2 = __wasm_i64_mul($10_1 | 0, i64toi32_i32$4 | 0, $13_1 | 0, i64toi32_i32$2 | 0) | 0;
     i64toi32_i32$4 = i64toi32_i32$HIGH_BITS;
     $181_1 = i64toi32_i32$2;
     $181$hi = i64toi32_i32$4;
     i64toi32_i32$4 = $172$hi;
     i64toi32_i32$5 = $172_1;
     i64toi32_i32$2 = $181$hi;
     i64toi32_i32$0 = $181_1;
     i64toi32_i32$3 = i64toi32_i32$5 + i64toi32_i32$0 | 0;
     i64toi32_i32$1 = i64toi32_i32$4 + i64toi32_i32$2 | 0;
     if (i64toi32_i32$3 >>> 0 < i64toi32_i32$0 >>> 0) {
      i64toi32_i32$1 = i64toi32_i32$1 + 1 | 0
     }
     $14_1 = i64toi32_i32$3;
     $14$hi = i64toi32_i32$1;
     i64toi32_i32$1 = $16$hi;
     i64toi32_i32$1 = $14$hi;
     i64toi32_i32$4 = i64toi32_i32$3;
     i64toi32_i32$5 = $16$hi;
     i64toi32_i32$0 = $16_1;
     i64toi32_i32$4 = 0;
     $186_1 = i64toi32_i32$1 >>> 0 < i64toi32_i32$5 >>> 0 | ((i64toi32_i32$1 | 0) == (i64toi32_i32$5 | 0) & i64toi32_i32$3 >>> 0 < i64toi32_i32$0 >>> 0 | 0) | 0;
     $186$hi = i64toi32_i32$4;
     i64toi32_i32$4 = i64toi32_i32$1;
     $187_1 = i64toi32_i32$3;
     $187$hi = i64toi32_i32$1;
     i64toi32_i32$4 = $3$hi;
     i64toi32_i32$0 = $3_1;
     i64toi32_i32$1 = 0;
     i64toi32_i32$5 = 49;
     i64toi32_i32$2 = i64toi32_i32$5 & 31 | 0;
     if (32 >>> 0 <= (i64toi32_i32$5 & 63 | 0) >>> 0) {
      i64toi32_i32$1 = 0;
      $230 = i64toi32_i32$4 >>> i64toi32_i32$2 | 0;
     } else {
      i64toi32_i32$1 = i64toi32_i32$4 >>> i64toi32_i32$2 | 0;
      $230 = (((1 << i64toi32_i32$2 | 0) - 1 | 0) & i64toi32_i32$4 | 0) << (32 - i64toi32_i32$2 | 0) | 0 | (i64toi32_i32$0 >>> i64toi32_i32$2 | 0) | 0;
     }
     $189$hi = i64toi32_i32$1;
     i64toi32_i32$1 = $15$hi;
     i64toi32_i32$1 = $189$hi;
     i64toi32_i32$4 = $230;
     i64toi32_i32$0 = $15$hi;
     i64toi32_i32$5 = $15_1;
     i64toi32_i32$0 = i64toi32_i32$1 | i64toi32_i32$0 | 0;
     i64toi32_i32$1 = i64toi32_i32$4 | i64toi32_i32$5 | 0;
     i64toi32_i32$4 = 0;
     i64toi32_i32$5 = -1;
     i64toi32_i32$4 = i64toi32_i32$0 & i64toi32_i32$4 | 0;
     $3_1 = i64toi32_i32$1 & i64toi32_i32$5 | 0;
     $3$hi = i64toi32_i32$4;
     i64toi32_i32$4 = $12$hi;
     i64toi32_i32$0 = $12_1;
     i64toi32_i32$1 = 0;
     i64toi32_i32$5 = -1;
     i64toi32_i32$1 = i64toi32_i32$4 & i64toi32_i32$1 | 0;
     $12_1 = i64toi32_i32$0 & i64toi32_i32$5 | 0;
     $12$hi = i64toi32_i32$1;
     i64toi32_i32$1 = $3$hi;
     i64toi32_i32$0 = $12$hi;
     i64toi32_i32$0 = __wasm_i64_mul($3_1 | 0, i64toi32_i32$1 | 0, $12_1 | 0, i64toi32_i32$0 | 0) | 0;
     i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
     $197_1 = i64toi32_i32$0;
     $197$hi = i64toi32_i32$1;
     i64toi32_i32$1 = $187$hi;
     i64toi32_i32$4 = $187_1;
     i64toi32_i32$0 = $197$hi;
     i64toi32_i32$5 = $197_1;
     i64toi32_i32$2 = i64toi32_i32$4 + i64toi32_i32$5 | 0;
     i64toi32_i32$3 = i64toi32_i32$1 + i64toi32_i32$0 | 0;
     if (i64toi32_i32$2 >>> 0 < i64toi32_i32$5 >>> 0) {
      i64toi32_i32$3 = i64toi32_i32$3 + 1 | 0
     }
     $15_1 = i64toi32_i32$2;
     $15$hi = i64toi32_i32$3;
     i64toi32_i32$3 = $14$hi;
     i64toi32_i32$3 = $15$hi;
     i64toi32_i32$1 = i64toi32_i32$2;
     i64toi32_i32$4 = $14$hi;
     i64toi32_i32$5 = $14_1;
     $201_1 = i64toi32_i32$3 >>> 0 < i64toi32_i32$4 >>> 0 | ((i64toi32_i32$3 | 0) == (i64toi32_i32$4 | 0) & i64toi32_i32$2 >>> 0 < i64toi32_i32$5 >>> 0 | 0) | 0;
     i64toi32_i32$1 = 0;
     $202$hi = i64toi32_i32$1;
     i64toi32_i32$1 = $186$hi;
     i64toi32_i32$5 = $186_1;
     i64toi32_i32$3 = $202$hi;
     i64toi32_i32$4 = $201_1;
     i64toi32_i32$0 = i64toi32_i32$5 + i64toi32_i32$4 | 0;
     i64toi32_i32$2 = i64toi32_i32$1 + i64toi32_i32$3 | 0;
     if (i64toi32_i32$0 >>> 0 < i64toi32_i32$4 >>> 0) {
      i64toi32_i32$2 = i64toi32_i32$2 + 1 | 0
     }
     $203$hi = i64toi32_i32$2;
     i64toi32_i32$2 = $2$hi;
     i64toi32_i32$2 = $13$hi;
     i64toi32_i32$2 = $2$hi;
     i64toi32_i32$5 = $13$hi;
     i64toi32_i32$5 = __wasm_i64_mul($2_1 | 0, i64toi32_i32$2 | 0, $13_1 | 0, i64toi32_i32$5 | 0) | 0;
     i64toi32_i32$2 = i64toi32_i32$HIGH_BITS;
     $206_1 = i64toi32_i32$5;
     $206$hi = i64toi32_i32$2;
     i64toi32_i32$2 = $203$hi;
     i64toi32_i32$1 = i64toi32_i32$0;
     i64toi32_i32$5 = $206$hi;
     i64toi32_i32$4 = $206_1;
     i64toi32_i32$3 = i64toi32_i32$1 + i64toi32_i32$4 | 0;
     i64toi32_i32$0 = i64toi32_i32$2 + i64toi32_i32$5 | 0;
     if (i64toi32_i32$3 >>> 0 < i64toi32_i32$4 >>> 0) {
      i64toi32_i32$0 = i64toi32_i32$0 + 1 | 0
     }
     $207_1 = i64toi32_i32$3;
     $207$hi = i64toi32_i32$0;
     i64toi32_i32$0 = $15$hi;
     $208_1 = $15_1;
     $208$hi = i64toi32_i32$0;
     i64toi32_i32$0 = $17$hi;
     i64toi32_i32$2 = $17_1;
     i64toi32_i32$1 = 0;
     i64toi32_i32$4 = -32768;
     i64toi32_i32$1 = i64toi32_i32$0 & i64toi32_i32$1 | 0;
     $14_1 = i64toi32_i32$2 & i64toi32_i32$4 | 0;
     $14$hi = i64toi32_i32$1;
     i64toi32_i32$1 = $12$hi;
     i64toi32_i32$1 = $14$hi;
     i64toi32_i32$2 = $12$hi;
     i64toi32_i32$2 = __wasm_i64_mul($14_1 | 0, i64toi32_i32$1 | 0, $12_1 | 0, i64toi32_i32$2 | 0) | 0;
     i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
     $17_1 = i64toi32_i32$2;
     $17$hi = i64toi32_i32$1;
     i64toi32_i32$1 = $10$hi;
     i64toi32_i32$1 = $4$hi;
     i64toi32_i32$1 = $10$hi;
     i64toi32_i32$2 = $4$hi;
     i64toi32_i32$2 = __wasm_i64_mul($10_1 | 0, i64toi32_i32$1 | 0, $4_1 | 0, i64toi32_i32$2 | 0) | 0;
     i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
     $217 = i64toi32_i32$2;
     $217$hi = i64toi32_i32$1;
     i64toi32_i32$1 = $17$hi;
     i64toi32_i32$0 = $17_1;
     i64toi32_i32$2 = $217$hi;
     i64toi32_i32$4 = $217;
     i64toi32_i32$5 = i64toi32_i32$0 + i64toi32_i32$4 | 0;
     i64toi32_i32$3 = i64toi32_i32$1 + i64toi32_i32$2 | 0;
     if (i64toi32_i32$5 >>> 0 < i64toi32_i32$4 >>> 0) {
      i64toi32_i32$3 = i64toi32_i32$3 + 1 | 0
     }
     $16_1 = i64toi32_i32$5;
     $16$hi = i64toi32_i32$3;
     i64toi32_i32$3 = $17$hi;
     i64toi32_i32$3 = $16$hi;
     i64toi32_i32$1 = i64toi32_i32$5;
     i64toi32_i32$0 = $17$hi;
     i64toi32_i32$4 = $17_1;
     $221 = i64toi32_i32$3 >>> 0 < i64toi32_i32$0 >>> 0 | ((i64toi32_i32$3 | 0) == (i64toi32_i32$0 | 0) & i64toi32_i32$1 >>> 0 < i64toi32_i32$4 >>> 0 | 0) | 0;
     i64toi32_i32$1 = 0;
     $222 = $221;
     $222$hi = i64toi32_i32$1;
     i64toi32_i32$1 = i64toi32_i32$3;
     i64toi32_i32$1 = $3$hi;
     i64toi32_i32$1 = $1$hi;
     i64toi32_i32$4 = $1_1;
     i64toi32_i32$3 = 0;
     i64toi32_i32$0 = -1;
     i64toi32_i32$3 = i64toi32_i32$1 & i64toi32_i32$3 | 0;
     $1_1 = i64toi32_i32$4 & i64toi32_i32$0 | 0;
     $1$hi = i64toi32_i32$3;
     i64toi32_i32$3 = $3$hi;
     i64toi32_i32$4 = $1$hi;
     i64toi32_i32$4 = __wasm_i64_mul($3_1 | 0, i64toi32_i32$3 | 0, $1_1 | 0, i64toi32_i32$4 | 0) | 0;
     i64toi32_i32$3 = i64toi32_i32$HIGH_BITS;
     $228 = i64toi32_i32$4;
     $228$hi = i64toi32_i32$3;
     i64toi32_i32$3 = $16$hi;
     i64toi32_i32$1 = i64toi32_i32$5;
     i64toi32_i32$4 = $228$hi;
     i64toi32_i32$0 = $228;
     i64toi32_i32$2 = i64toi32_i32$1 + i64toi32_i32$0 | 0;
     i64toi32_i32$5 = i64toi32_i32$3 + i64toi32_i32$4 | 0;
     if (i64toi32_i32$2 >>> 0 < i64toi32_i32$0 >>> 0) {
      i64toi32_i32$5 = i64toi32_i32$5 + 1 | 0
     }
     $17_1 = i64toi32_i32$2;
     $17$hi = i64toi32_i32$5;
     i64toi32_i32$5 = $16$hi;
     i64toi32_i32$5 = $17$hi;
     i64toi32_i32$3 = i64toi32_i32$2;
     i64toi32_i32$1 = $16$hi;
     i64toi32_i32$0 = $16_1;
     $232 = i64toi32_i32$5 >>> 0 < i64toi32_i32$1 >>> 0 | ((i64toi32_i32$5 | 0) == (i64toi32_i32$1 | 0) & i64toi32_i32$2 >>> 0 < i64toi32_i32$0 >>> 0 | 0) | 0;
     i64toi32_i32$3 = 0;
     $233$hi = i64toi32_i32$3;
     i64toi32_i32$3 = $222$hi;
     i64toi32_i32$0 = $222;
     i64toi32_i32$5 = $233$hi;
     i64toi32_i32$1 = $232;
     i64toi32_i32$4 = i64toi32_i32$0 + i64toi32_i32$1 | 0;
     i64toi32_i32$2 = i64toi32_i32$3 + i64toi32_i32$5 | 0;
     if (i64toi32_i32$4 >>> 0 < i64toi32_i32$1 >>> 0) {
      i64toi32_i32$2 = i64toi32_i32$2 + 1 | 0
     }
     $234$hi = i64toi32_i32$2;
     i64toi32_i32$2 = $208$hi;
     i64toi32_i32$3 = $208_1;
     i64toi32_i32$0 = $234$hi;
     i64toi32_i32$1 = i64toi32_i32$4;
     i64toi32_i32$5 = i64toi32_i32$3 + i64toi32_i32$1 | 0;
     i64toi32_i32$4 = i64toi32_i32$2 + i64toi32_i32$0 | 0;
     if (i64toi32_i32$5 >>> 0 < i64toi32_i32$1 >>> 0) {
      i64toi32_i32$4 = i64toi32_i32$4 + 1 | 0
     }
     $16_1 = i64toi32_i32$5;
     $16$hi = i64toi32_i32$4;
     i64toi32_i32$4 = $15$hi;
     i64toi32_i32$4 = $16$hi;
     i64toi32_i32$2 = i64toi32_i32$5;
     i64toi32_i32$3 = $15$hi;
     i64toi32_i32$1 = $15_1;
     $238 = i64toi32_i32$4 >>> 0 < i64toi32_i32$3 >>> 0 | ((i64toi32_i32$4 | 0) == (i64toi32_i32$3 | 0) & i64toi32_i32$2 >>> 0 < i64toi32_i32$1 >>> 0 | 0) | 0;
     i64toi32_i32$2 = 0;
     $239$hi = i64toi32_i32$2;
     i64toi32_i32$2 = $207$hi;
     i64toi32_i32$1 = $207_1;
     i64toi32_i32$4 = $239$hi;
     i64toi32_i32$3 = $238;
     i64toi32_i32$0 = i64toi32_i32$1 + i64toi32_i32$3 | 0;
     i64toi32_i32$5 = i64toi32_i32$2 + i64toi32_i32$4 | 0;
     if (i64toi32_i32$0 >>> 0 < i64toi32_i32$3 >>> 0) {
      i64toi32_i32$5 = i64toi32_i32$5 + 1 | 0
     }
     $240 = i64toi32_i32$0;
     $240$hi = i64toi32_i32$5;
     i64toi32_i32$5 = $3$hi;
     i64toi32_i32$5 = $13$hi;
     i64toi32_i32$5 = $3$hi;
     i64toi32_i32$1 = $13$hi;
     i64toi32_i32$1 = __wasm_i64_mul($3_1 | 0, i64toi32_i32$5 | 0, $13_1 | 0, i64toi32_i32$1 | 0) | 0;
     i64toi32_i32$5 = i64toi32_i32$HIGH_BITS;
     $18_1 = i64toi32_i32$1;
     $18$hi = i64toi32_i32$5;
     i64toi32_i32$5 = $2$hi;
     i64toi32_i32$5 = $12$hi;
     i64toi32_i32$5 = $2$hi;
     i64toi32_i32$1 = $12$hi;
     i64toi32_i32$1 = __wasm_i64_mul($2_1 | 0, i64toi32_i32$5 | 0, $12_1 | 0, i64toi32_i32$1 | 0) | 0;
     i64toi32_i32$5 = i64toi32_i32$HIGH_BITS;
     $247 = i64toi32_i32$1;
     $247$hi = i64toi32_i32$5;
     i64toi32_i32$5 = $18$hi;
     i64toi32_i32$2 = $18_1;
     i64toi32_i32$1 = $247$hi;
     i64toi32_i32$3 = $247;
     i64toi32_i32$4 = i64toi32_i32$2 + i64toi32_i32$3 | 0;
     i64toi32_i32$0 = i64toi32_i32$5 + i64toi32_i32$1 | 0;
     if (i64toi32_i32$4 >>> 0 < i64toi32_i32$3 >>> 0) {
      i64toi32_i32$0 = i64toi32_i32$0 + 1 | 0
     }
     $15_1 = i64toi32_i32$4;
     $15$hi = i64toi32_i32$0;
     i64toi32_i32$0 = $18$hi;
     i64toi32_i32$0 = $15$hi;
     i64toi32_i32$5 = i64toi32_i32$4;
     i64toi32_i32$2 = $18$hi;
     i64toi32_i32$3 = $18_1;
     i64toi32_i32$5 = 0;
     i64toi32_i32$3 = i64toi32_i32$0 >>> 0 < i64toi32_i32$2 >>> 0 | ((i64toi32_i32$0 | 0) == (i64toi32_i32$2 | 0) & i64toi32_i32$4 >>> 0 < i64toi32_i32$3 >>> 0 | 0) | 0;
     i64toi32_i32$0 = 0;
     i64toi32_i32$2 = 32;
     i64toi32_i32$1 = i64toi32_i32$2 & 31 | 0;
     if (32 >>> 0 <= (i64toi32_i32$2 & 63 | 0) >>> 0) {
      i64toi32_i32$0 = i64toi32_i32$3 << i64toi32_i32$1 | 0;
      $231 = 0;
     } else {
      i64toi32_i32$0 = ((1 << i64toi32_i32$1 | 0) - 1 | 0) & (i64toi32_i32$3 >>> (32 - i64toi32_i32$1 | 0) | 0) | 0 | (i64toi32_i32$5 << i64toi32_i32$1 | 0) | 0;
      $231 = i64toi32_i32$3 << i64toi32_i32$1 | 0;
     }
     $253 = $231;
     $253$hi = i64toi32_i32$0;
     i64toi32_i32$0 = $15$hi;
     i64toi32_i32$5 = $15_1;
     i64toi32_i32$3 = 0;
     i64toi32_i32$2 = 32;
     i64toi32_i32$1 = i64toi32_i32$2 & 31 | 0;
     if (32 >>> 0 <= (i64toi32_i32$2 & 63 | 0) >>> 0) {
      i64toi32_i32$3 = 0;
      $233 = i64toi32_i32$0 >>> i64toi32_i32$1 | 0;
     } else {
      i64toi32_i32$3 = i64toi32_i32$0 >>> i64toi32_i32$1 | 0;
      $233 = (((1 << i64toi32_i32$1 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$1 | 0) | 0 | (i64toi32_i32$5 >>> i64toi32_i32$1 | 0) | 0;
     }
     $255$hi = i64toi32_i32$3;
     i64toi32_i32$3 = $253$hi;
     i64toi32_i32$0 = $253;
     i64toi32_i32$5 = $255$hi;
     i64toi32_i32$2 = $233;
     i64toi32_i32$5 = i64toi32_i32$3 | i64toi32_i32$5 | 0;
     $256 = i64toi32_i32$0 | i64toi32_i32$2 | 0;
     $256$hi = i64toi32_i32$5;
     i64toi32_i32$5 = $240$hi;
     i64toi32_i32$3 = $240;
     i64toi32_i32$0 = $256$hi;
     i64toi32_i32$2 = $256;
     i64toi32_i32$1 = i64toi32_i32$3 + i64toi32_i32$2 | 0;
     i64toi32_i32$4 = i64toi32_i32$5 + i64toi32_i32$0 | 0;
     if (i64toi32_i32$1 >>> 0 < i64toi32_i32$2 >>> 0) {
      i64toi32_i32$4 = i64toi32_i32$4 + 1 | 0
     }
     $257 = i64toi32_i32$1;
     $257$hi = i64toi32_i32$4;
     i64toi32_i32$4 = $16$hi;
     $258 = $16_1;
     $258$hi = i64toi32_i32$4;
     i64toi32_i32$4 = $15$hi;
     i64toi32_i32$5 = $15_1;
     i64toi32_i32$3 = 0;
     i64toi32_i32$2 = 32;
     i64toi32_i32$0 = i64toi32_i32$2 & 31 | 0;
     if (32 >>> 0 <= (i64toi32_i32$2 & 63 | 0) >>> 0) {
      i64toi32_i32$3 = i64toi32_i32$5 << i64toi32_i32$0 | 0;
      $234 = 0;
     } else {
      i64toi32_i32$3 = ((1 << i64toi32_i32$0 | 0) - 1 | 0) & (i64toi32_i32$5 >>> (32 - i64toi32_i32$0 | 0) | 0) | 0 | (i64toi32_i32$4 << i64toi32_i32$0 | 0) | 0;
      $234 = i64toi32_i32$5 << i64toi32_i32$0 | 0;
     }
     $260$hi = i64toi32_i32$3;
     i64toi32_i32$3 = $258$hi;
     i64toi32_i32$4 = $258;
     i64toi32_i32$5 = $260$hi;
     i64toi32_i32$2 = $234;
     i64toi32_i32$0 = i64toi32_i32$4 + i64toi32_i32$2 | 0;
     i64toi32_i32$1 = i64toi32_i32$3 + i64toi32_i32$5 | 0;
     if (i64toi32_i32$0 >>> 0 < i64toi32_i32$2 >>> 0) {
      i64toi32_i32$1 = i64toi32_i32$1 + 1 | 0
     }
     $15_1 = i64toi32_i32$0;
     $15$hi = i64toi32_i32$1;
     i64toi32_i32$1 = $16$hi;
     i64toi32_i32$1 = $15$hi;
     i64toi32_i32$3 = i64toi32_i32$0;
     i64toi32_i32$4 = $16$hi;
     i64toi32_i32$2 = $16_1;
     $264 = i64toi32_i32$1 >>> 0 < i64toi32_i32$4 >>> 0 | ((i64toi32_i32$1 | 0) == (i64toi32_i32$4 | 0) & i64toi32_i32$0 >>> 0 < i64toi32_i32$2 >>> 0 | 0) | 0;
     i64toi32_i32$3 = 0;
     $265$hi = i64toi32_i32$3;
     i64toi32_i32$3 = $257$hi;
     i64toi32_i32$2 = $257;
     i64toi32_i32$1 = $265$hi;
     i64toi32_i32$4 = $264;
     i64toi32_i32$5 = i64toi32_i32$2 + i64toi32_i32$4 | 0;
     i64toi32_i32$0 = i64toi32_i32$3 + i64toi32_i32$1 | 0;
     if (i64toi32_i32$5 >>> 0 < i64toi32_i32$4 >>> 0) {
      i64toi32_i32$0 = i64toi32_i32$0 + 1 | 0
     }
     $266 = i64toi32_i32$5;
     $266$hi = i64toi32_i32$0;
     i64toi32_i32$0 = $15$hi;
     $267 = $15_1;
     $267$hi = i64toi32_i32$0;
     i64toi32_i32$0 = $14$hi;
     i64toi32_i32$0 = $13$hi;
     i64toi32_i32$0 = $14$hi;
     i64toi32_i32$2 = $13$hi;
     i64toi32_i32$2 = __wasm_i64_mul($14_1 | 0, i64toi32_i32$0 | 0, $13_1 | 0, i64toi32_i32$2 | 0) | 0;
     i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
     $16_1 = i64toi32_i32$2;
     $16$hi = i64toi32_i32$0;
     i64toi32_i32$0 = $10$hi;
     i64toi32_i32$0 = $12$hi;
     i64toi32_i32$0 = $10$hi;
     i64toi32_i32$2 = $12$hi;
     i64toi32_i32$2 = __wasm_i64_mul($10_1 | 0, i64toi32_i32$0 | 0, $12_1 | 0, i64toi32_i32$2 | 0) | 0;
     i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
     $274 = i64toi32_i32$2;
     $274$hi = i64toi32_i32$0;
     i64toi32_i32$0 = $16$hi;
     i64toi32_i32$3 = $16_1;
     i64toi32_i32$2 = $274$hi;
     i64toi32_i32$4 = $274;
     i64toi32_i32$1 = i64toi32_i32$3 + i64toi32_i32$4 | 0;
     i64toi32_i32$5 = i64toi32_i32$0 + i64toi32_i32$2 | 0;
     if (i64toi32_i32$1 >>> 0 < i64toi32_i32$4 >>> 0) {
      i64toi32_i32$5 = i64toi32_i32$5 + 1 | 0
     }
     $13_1 = i64toi32_i32$1;
     $13$hi = i64toi32_i32$5;
     i64toi32_i32$5 = $2$hi;
     i64toi32_i32$5 = $1$hi;
     i64toi32_i32$5 = $2$hi;
     i64toi32_i32$3 = $1$hi;
     i64toi32_i32$3 = __wasm_i64_mul($2_1 | 0, i64toi32_i32$5 | 0, $1_1 | 0, i64toi32_i32$3 | 0) | 0;
     i64toi32_i32$5 = i64toi32_i32$HIGH_BITS;
     $279 = i64toi32_i32$3;
     $279$hi = i64toi32_i32$5;
     i64toi32_i32$5 = $13$hi;
     i64toi32_i32$0 = i64toi32_i32$1;
     i64toi32_i32$3 = $279$hi;
     i64toi32_i32$4 = $279;
     i64toi32_i32$2 = i64toi32_i32$1 + i64toi32_i32$4 | 0;
     i64toi32_i32$1 = i64toi32_i32$5 + i64toi32_i32$3 | 0;
     if (i64toi32_i32$2 >>> 0 < i64toi32_i32$4 >>> 0) {
      i64toi32_i32$1 = i64toi32_i32$1 + 1 | 0
     }
     $2_1 = i64toi32_i32$2;
     $2$hi = i64toi32_i32$1;
     i64toi32_i32$1 = $3$hi;
     i64toi32_i32$1 = $4$hi;
     i64toi32_i32$1 = $3$hi;
     i64toi32_i32$0 = $4$hi;
     i64toi32_i32$0 = __wasm_i64_mul($3_1 | 0, i64toi32_i32$1 | 0, $4_1 | 0, i64toi32_i32$0 | 0) | 0;
     i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
     $284 = i64toi32_i32$0;
     $284$hi = i64toi32_i32$1;
     i64toi32_i32$1 = $2$hi;
     i64toi32_i32$5 = i64toi32_i32$2;
     i64toi32_i32$0 = $284$hi;
     i64toi32_i32$4 = $284;
     i64toi32_i32$3 = i64toi32_i32$2 + i64toi32_i32$4 | 0;
     i64toi32_i32$2 = i64toi32_i32$1 + i64toi32_i32$0 | 0;
     if (i64toi32_i32$3 >>> 0 < i64toi32_i32$4 >>> 0) {
      i64toi32_i32$2 = i64toi32_i32$2 + 1 | 0
     }
     $3_1 = i64toi32_i32$3;
     $3$hi = i64toi32_i32$2;
     i64toi32_i32$1 = i64toi32_i32$3;
     i64toi32_i32$5 = 0;
     i64toi32_i32$4 = 32;
     i64toi32_i32$0 = i64toi32_i32$4 & 31 | 0;
     if (32 >>> 0 <= (i64toi32_i32$4 & 63 | 0) >>> 0) {
      i64toi32_i32$5 = 0;
      $235 = i64toi32_i32$2 >>> i64toi32_i32$0 | 0;
     } else {
      i64toi32_i32$5 = i64toi32_i32$2 >>> i64toi32_i32$0 | 0;
      $235 = (((1 << i64toi32_i32$0 | 0) - 1 | 0) & i64toi32_i32$2 | 0) << (32 - i64toi32_i32$0 | 0) | 0 | (i64toi32_i32$1 >>> i64toi32_i32$0 | 0) | 0;
     }
     $287 = $235;
     $287$hi = i64toi32_i32$5;
     i64toi32_i32$5 = $13$hi;
     i64toi32_i32$5 = $16$hi;
     i64toi32_i32$5 = $13$hi;
     i64toi32_i32$2 = $13_1;
     i64toi32_i32$1 = $16$hi;
     i64toi32_i32$4 = $16_1;
     $290 = i64toi32_i32$5 >>> 0 < i64toi32_i32$1 >>> 0 | ((i64toi32_i32$5 | 0) == (i64toi32_i32$1 | 0) & i64toi32_i32$2 >>> 0 < i64toi32_i32$4 >>> 0 | 0) | 0;
     i64toi32_i32$2 = 0;
     $291$hi = i64toi32_i32$2;
     i64toi32_i32$2 = $2$hi;
     i64toi32_i32$2 = i64toi32_i32$5;
     i64toi32_i32$2 = $2$hi;
     i64toi32_i32$4 = $2_1;
     i64toi32_i32$1 = $13_1;
     $294 = i64toi32_i32$2 >>> 0 < i64toi32_i32$5 >>> 0 | ((i64toi32_i32$2 | 0) == (i64toi32_i32$5 | 0) & i64toi32_i32$4 >>> 0 < i64toi32_i32$1 >>> 0 | 0) | 0;
     i64toi32_i32$4 = 0;
     $295$hi = i64toi32_i32$4;
     i64toi32_i32$4 = $291$hi;
     i64toi32_i32$1 = $290;
     i64toi32_i32$2 = $295$hi;
     i64toi32_i32$5 = $294;
     i64toi32_i32$0 = i64toi32_i32$1 + i64toi32_i32$5 | 0;
     i64toi32_i32$3 = i64toi32_i32$4 + i64toi32_i32$2 | 0;
     if (i64toi32_i32$0 >>> 0 < i64toi32_i32$5 >>> 0) {
      i64toi32_i32$3 = i64toi32_i32$3 + 1 | 0
     }
     $296$hi = i64toi32_i32$3;
     i64toi32_i32$3 = $3$hi;
     i64toi32_i32$3 = $2$hi;
     i64toi32_i32$3 = $3$hi;
     i64toi32_i32$4 = $3_1;
     i64toi32_i32$1 = $2$hi;
     i64toi32_i32$5 = $2_1;
     $299 = i64toi32_i32$3 >>> 0 < i64toi32_i32$1 >>> 0 | ((i64toi32_i32$3 | 0) == (i64toi32_i32$1 | 0) & i64toi32_i32$4 >>> 0 < i64toi32_i32$5 >>> 0 | 0) | 0;
     i64toi32_i32$4 = 0;
     $300$hi = i64toi32_i32$4;
     i64toi32_i32$4 = $296$hi;
     i64toi32_i32$5 = i64toi32_i32$0;
     i64toi32_i32$3 = $300$hi;
     i64toi32_i32$1 = $299;
     i64toi32_i32$2 = i64toi32_i32$0 + i64toi32_i32$1 | 0;
     i64toi32_i32$0 = i64toi32_i32$4 + i64toi32_i32$3 | 0;
     if (i64toi32_i32$2 >>> 0 < i64toi32_i32$1 >>> 0) {
      i64toi32_i32$0 = i64toi32_i32$0 + 1 | 0
     }
     i64toi32_i32$4 = i64toi32_i32$2;
     i64toi32_i32$5 = 0;
     i64toi32_i32$1 = 32;
     i64toi32_i32$3 = i64toi32_i32$1 & 31 | 0;
     if (32 >>> 0 <= (i64toi32_i32$1 & 63 | 0) >>> 0) {
      i64toi32_i32$5 = i64toi32_i32$2 << i64toi32_i32$3 | 0;
      $236 = 0;
     } else {
      i64toi32_i32$5 = ((1 << i64toi32_i32$3 | 0) - 1 | 0) & (i64toi32_i32$4 >>> (32 - i64toi32_i32$3 | 0) | 0) | 0 | (i64toi32_i32$0 << i64toi32_i32$3 | 0) | 0;
      $236 = i64toi32_i32$4 << i64toi32_i32$3 | 0;
     }
     $302$hi = i64toi32_i32$5;
     i64toi32_i32$5 = $287$hi;
     i64toi32_i32$0 = $287;
     i64toi32_i32$4 = $302$hi;
     i64toi32_i32$1 = $236;
     i64toi32_i32$4 = i64toi32_i32$5 | i64toi32_i32$4 | 0;
     $303 = i64toi32_i32$0 | i64toi32_i32$1 | 0;
     $303$hi = i64toi32_i32$4;
     i64toi32_i32$4 = $267$hi;
     i64toi32_i32$5 = $267;
     i64toi32_i32$0 = $303$hi;
     i64toi32_i32$1 = $303;
     i64toi32_i32$3 = i64toi32_i32$5 + i64toi32_i32$1 | 0;
     i64toi32_i32$2 = i64toi32_i32$4 + i64toi32_i32$0 | 0;
     if (i64toi32_i32$3 >>> 0 < i64toi32_i32$1 >>> 0) {
      i64toi32_i32$2 = i64toi32_i32$2 + 1 | 0
     }
     $2_1 = i64toi32_i32$3;
     $2$hi = i64toi32_i32$2;
     i64toi32_i32$2 = $15$hi;
     i64toi32_i32$2 = $2$hi;
     i64toi32_i32$4 = i64toi32_i32$3;
     i64toi32_i32$5 = $15$hi;
     i64toi32_i32$1 = $15_1;
     $307 = i64toi32_i32$2 >>> 0 < i64toi32_i32$5 >>> 0 | ((i64toi32_i32$2 | 0) == (i64toi32_i32$5 | 0) & i64toi32_i32$3 >>> 0 < i64toi32_i32$1 >>> 0 | 0) | 0;
     i64toi32_i32$4 = 0;
     $308$hi = i64toi32_i32$4;
     i64toi32_i32$4 = $266$hi;
     i64toi32_i32$1 = $266;
     i64toi32_i32$2 = $308$hi;
     i64toi32_i32$5 = $307;
     i64toi32_i32$0 = i64toi32_i32$1 + i64toi32_i32$5 | 0;
     i64toi32_i32$3 = i64toi32_i32$4 + i64toi32_i32$2 | 0;
     if (i64toi32_i32$0 >>> 0 < i64toi32_i32$5 >>> 0) {
      i64toi32_i32$3 = i64toi32_i32$3 + 1 | 0
     }
     $309 = i64toi32_i32$0;
     $309$hi = i64toi32_i32$3;
     i64toi32_i32$3 = $2$hi;
     $310 = $2_1;
     $310$hi = i64toi32_i32$3;
     i64toi32_i32$3 = $17$hi;
     $311 = $17_1;
     $311$hi = i64toi32_i32$3;
     i64toi32_i32$3 = $14$hi;
     i64toi32_i32$3 = $4$hi;
     i64toi32_i32$3 = $14$hi;
     i64toi32_i32$1 = $4$hi;
     i64toi32_i32$1 = __wasm_i64_mul($14_1 | 0, i64toi32_i32$3 | 0, $4_1 | 0, i64toi32_i32$1 | 0) | 0;
     i64toi32_i32$3 = i64toi32_i32$HIGH_BITS;
     $13_1 = i64toi32_i32$1;
     $13$hi = i64toi32_i32$3;
     i64toi32_i32$3 = $10$hi;
     i64toi32_i32$3 = $1$hi;
     i64toi32_i32$3 = $10$hi;
     i64toi32_i32$1 = $1$hi;
     i64toi32_i32$1 = __wasm_i64_mul($10_1 | 0, i64toi32_i32$3 | 0, $1_1 | 0, i64toi32_i32$1 | 0) | 0;
     i64toi32_i32$3 = i64toi32_i32$HIGH_BITS;
     $318 = i64toi32_i32$1;
     $318$hi = i64toi32_i32$3;
     i64toi32_i32$3 = $13$hi;
     i64toi32_i32$4 = $13_1;
     i64toi32_i32$1 = $318$hi;
     i64toi32_i32$5 = $318;
     i64toi32_i32$2 = i64toi32_i32$4 + i64toi32_i32$5 | 0;
     i64toi32_i32$0 = i64toi32_i32$3 + i64toi32_i32$1 | 0;
     if (i64toi32_i32$2 >>> 0 < i64toi32_i32$5 >>> 0) {
      i64toi32_i32$0 = i64toi32_i32$0 + 1 | 0
     }
     $4_1 = i64toi32_i32$2;
     $4$hi = i64toi32_i32$0;
     i64toi32_i32$3 = i64toi32_i32$2;
     i64toi32_i32$4 = 0;
     i64toi32_i32$5 = 32;
     i64toi32_i32$1 = i64toi32_i32$5 & 31 | 0;
     if (32 >>> 0 <= (i64toi32_i32$5 & 63 | 0) >>> 0) {
      i64toi32_i32$4 = 0;
      $237 = i64toi32_i32$0 >>> i64toi32_i32$1 | 0;
     } else {
      i64toi32_i32$4 = i64toi32_i32$0 >>> i64toi32_i32$1 | 0;
      $237 = (((1 << i64toi32_i32$1 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$1 | 0) | 0 | (i64toi32_i32$3 >>> i64toi32_i32$1 | 0) | 0;
     }
     $321 = $237;
     $321$hi = i64toi32_i32$4;
     i64toi32_i32$4 = $4$hi;
     i64toi32_i32$4 = $13$hi;
     i64toi32_i32$4 = $4$hi;
     i64toi32_i32$0 = $4_1;
     i64toi32_i32$3 = $13$hi;
     i64toi32_i32$5 = $13_1;
     $324 = i64toi32_i32$4 >>> 0 < i64toi32_i32$3 >>> 0 | ((i64toi32_i32$4 | 0) == (i64toi32_i32$3 | 0) & i64toi32_i32$0 >>> 0 < i64toi32_i32$5 >>> 0 | 0) | 0;
     i64toi32_i32$0 = 0;
     i64toi32_i32$5 = $324;
     i64toi32_i32$4 = 0;
     i64toi32_i32$3 = 32;
     i64toi32_i32$1 = i64toi32_i32$3 & 31 | 0;
     if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
      i64toi32_i32$4 = i64toi32_i32$5 << i64toi32_i32$1 | 0;
      $239 = 0;
     } else {
      i64toi32_i32$4 = ((1 << i64toi32_i32$1 | 0) - 1 | 0) & (i64toi32_i32$5 >>> (32 - i64toi32_i32$1 | 0) | 0) | 0 | (i64toi32_i32$0 << i64toi32_i32$1 | 0) | 0;
      $239 = i64toi32_i32$5 << i64toi32_i32$1 | 0;
     }
     $326$hi = i64toi32_i32$4;
     i64toi32_i32$4 = $321$hi;
     i64toi32_i32$0 = $321;
     i64toi32_i32$5 = $326$hi;
     i64toi32_i32$3 = $239;
     i64toi32_i32$5 = i64toi32_i32$4 | i64toi32_i32$5 | 0;
     $327 = i64toi32_i32$0 | i64toi32_i32$3 | 0;
     $327$hi = i64toi32_i32$5;
     i64toi32_i32$5 = $311$hi;
     i64toi32_i32$4 = $311;
     i64toi32_i32$0 = $327$hi;
     i64toi32_i32$3 = $327;
     i64toi32_i32$1 = i64toi32_i32$4 + i64toi32_i32$3 | 0;
     i64toi32_i32$2 = i64toi32_i32$5 + i64toi32_i32$0 | 0;
     if (i64toi32_i32$1 >>> 0 < i64toi32_i32$3 >>> 0) {
      i64toi32_i32$2 = i64toi32_i32$2 + 1 | 0
     }
     $10_1 = i64toi32_i32$1;
     $10$hi = i64toi32_i32$2;
     i64toi32_i32$2 = $17$hi;
     i64toi32_i32$2 = $10$hi;
     i64toi32_i32$5 = i64toi32_i32$1;
     i64toi32_i32$4 = $17$hi;
     i64toi32_i32$3 = $17_1;
     i64toi32_i32$5 = 0;
     $332 = i64toi32_i32$2 >>> 0 < i64toi32_i32$4 >>> 0 | ((i64toi32_i32$2 | 0) == (i64toi32_i32$4 | 0) & i64toi32_i32$1 >>> 0 < i64toi32_i32$3 >>> 0 | 0) | 0;
     $332$hi = i64toi32_i32$5;
     i64toi32_i32$5 = i64toi32_i32$2;
     $333 = i64toi32_i32$1;
     $333$hi = i64toi32_i32$2;
     i64toi32_i32$5 = $3$hi;
     i64toi32_i32$3 = $3_1;
     i64toi32_i32$2 = 0;
     i64toi32_i32$4 = 32;
     i64toi32_i32$0 = i64toi32_i32$4 & 31 | 0;
     if (32 >>> 0 <= (i64toi32_i32$4 & 63 | 0) >>> 0) {
      i64toi32_i32$2 = i64toi32_i32$3 << i64toi32_i32$0 | 0;
      $241 = 0;
     } else {
      i64toi32_i32$2 = ((1 << i64toi32_i32$0 | 0) - 1 | 0) & (i64toi32_i32$3 >>> (32 - i64toi32_i32$0 | 0) | 0) | 0 | (i64toi32_i32$5 << i64toi32_i32$0 | 0) | 0;
      $241 = i64toi32_i32$3 << i64toi32_i32$0 | 0;
     }
     $335$hi = i64toi32_i32$2;
     i64toi32_i32$2 = $333$hi;
     i64toi32_i32$5 = $333;
     i64toi32_i32$3 = $335$hi;
     i64toi32_i32$4 = $241;
     i64toi32_i32$0 = i64toi32_i32$5 + i64toi32_i32$4 | 0;
     i64toi32_i32$1 = i64toi32_i32$2 + i64toi32_i32$3 | 0;
     if (i64toi32_i32$0 >>> 0 < i64toi32_i32$4 >>> 0) {
      i64toi32_i32$1 = i64toi32_i32$1 + 1 | 0
     }
     $3_1 = i64toi32_i32$0;
     $3$hi = i64toi32_i32$1;
     i64toi32_i32$1 = $10$hi;
     i64toi32_i32$1 = $3$hi;
     i64toi32_i32$2 = i64toi32_i32$0;
     i64toi32_i32$5 = $10$hi;
     i64toi32_i32$4 = $10_1;
     $339 = i64toi32_i32$1 >>> 0 < i64toi32_i32$5 >>> 0 | ((i64toi32_i32$1 | 0) == (i64toi32_i32$5 | 0) & i64toi32_i32$2 >>> 0 < i64toi32_i32$4 >>> 0 | 0) | 0;
     i64toi32_i32$2 = 0;
     $340$hi = i64toi32_i32$2;
     i64toi32_i32$2 = $332$hi;
     i64toi32_i32$4 = $332;
     i64toi32_i32$1 = $340$hi;
     i64toi32_i32$5 = $339;
     i64toi32_i32$3 = i64toi32_i32$4 + i64toi32_i32$5 | 0;
     i64toi32_i32$0 = i64toi32_i32$2 + i64toi32_i32$1 | 0;
     if (i64toi32_i32$3 >>> 0 < i64toi32_i32$5 >>> 0) {
      i64toi32_i32$0 = i64toi32_i32$0 + 1 | 0
     }
     $341$hi = i64toi32_i32$0;
     i64toi32_i32$0 = $310$hi;
     i64toi32_i32$2 = $310;
     i64toi32_i32$4 = $341$hi;
     i64toi32_i32$5 = i64toi32_i32$3;
     i64toi32_i32$1 = i64toi32_i32$2 + i64toi32_i32$3 | 0;
     i64toi32_i32$3 = i64toi32_i32$0 + i64toi32_i32$4 | 0;
     if (i64toi32_i32$1 >>> 0 < i64toi32_i32$5 >>> 0) {
      i64toi32_i32$3 = i64toi32_i32$3 + 1 | 0
     }
     $10_1 = i64toi32_i32$1;
     $10$hi = i64toi32_i32$3;
     i64toi32_i32$3 = $2$hi;
     i64toi32_i32$3 = $10$hi;
     i64toi32_i32$0 = i64toi32_i32$1;
     i64toi32_i32$2 = $2$hi;
     i64toi32_i32$5 = $2_1;
     $345 = i64toi32_i32$3 >>> 0 < i64toi32_i32$2 >>> 0 | ((i64toi32_i32$3 | 0) == (i64toi32_i32$2 | 0) & i64toi32_i32$1 >>> 0 < i64toi32_i32$5 >>> 0 | 0) | 0;
     i64toi32_i32$0 = 0;
     $346$hi = i64toi32_i32$0;
     i64toi32_i32$0 = $309$hi;
     i64toi32_i32$5 = $309;
     i64toi32_i32$3 = $346$hi;
     i64toi32_i32$2 = $345;
     i64toi32_i32$4 = i64toi32_i32$5 + i64toi32_i32$2 | 0;
     i64toi32_i32$1 = i64toi32_i32$0 + i64toi32_i32$3 | 0;
     if (i64toi32_i32$4 >>> 0 < i64toi32_i32$2 >>> 0) {
      i64toi32_i32$1 = i64toi32_i32$1 + 1 | 0
     }
     $347 = i64toi32_i32$4;
     $347$hi = i64toi32_i32$1;
     i64toi32_i32$1 = $10$hi;
     $348 = $10_1;
     $348$hi = i64toi32_i32$1;
     i64toi32_i32$1 = $3$hi;
     $349 = $3_1;
     $349$hi = i64toi32_i32$1;
     i64toi32_i32$1 = $4$hi;
     i64toi32_i32$0 = $4_1;
     i64toi32_i32$5 = 0;
     i64toi32_i32$2 = 32;
     i64toi32_i32$3 = i64toi32_i32$2 & 31 | 0;
     if (32 >>> 0 <= (i64toi32_i32$2 & 63 | 0) >>> 0) {
      i64toi32_i32$5 = i64toi32_i32$0 << i64toi32_i32$3 | 0;
      $242 = 0;
     } else {
      i64toi32_i32$5 = ((1 << i64toi32_i32$3 | 0) - 1 | 0) & (i64toi32_i32$0 >>> (32 - i64toi32_i32$3 | 0) | 0) | 0 | (i64toi32_i32$1 << i64toi32_i32$3 | 0) | 0;
      $242 = i64toi32_i32$0 << i64toi32_i32$3 | 0;
     }
     $2_1 = $242;
     $2$hi = i64toi32_i32$5;
     i64toi32_i32$5 = $14$hi;
     i64toi32_i32$5 = $1$hi;
     i64toi32_i32$5 = $14$hi;
     i64toi32_i32$0 = $1$hi;
     i64toi32_i32$0 = __wasm_i64_mul($14_1 | 0, i64toi32_i32$5 | 0, $1_1 | 0, i64toi32_i32$0 | 0) | 0;
     i64toi32_i32$5 = i64toi32_i32$HIGH_BITS;
     $355 = i64toi32_i32$0;
     $355$hi = i64toi32_i32$5;
     i64toi32_i32$5 = $2$hi;
     i64toi32_i32$1 = $2_1;
     i64toi32_i32$0 = $355$hi;
     i64toi32_i32$2 = $355;
     i64toi32_i32$3 = i64toi32_i32$1 + i64toi32_i32$2 | 0;
     i64toi32_i32$4 = i64toi32_i32$5 + i64toi32_i32$0 | 0;
     if (i64toi32_i32$3 >>> 0 < i64toi32_i32$2 >>> 0) {
      i64toi32_i32$4 = i64toi32_i32$4 + 1 | 0
     }
     $1_1 = i64toi32_i32$3;
     $1$hi = i64toi32_i32$4;
     i64toi32_i32$4 = $2$hi;
     i64toi32_i32$4 = $1$hi;
     i64toi32_i32$5 = i64toi32_i32$3;
     i64toi32_i32$1 = $2$hi;
     i64toi32_i32$2 = $2_1;
     $359 = i64toi32_i32$4 >>> 0 < i64toi32_i32$1 >>> 0 | ((i64toi32_i32$4 | 0) == (i64toi32_i32$1 | 0) & i64toi32_i32$3 >>> 0 < i64toi32_i32$2 >>> 0 | 0) | 0;
     i64toi32_i32$5 = 0;
     $360$hi = i64toi32_i32$5;
     i64toi32_i32$5 = $349$hi;
     i64toi32_i32$2 = $349;
     i64toi32_i32$4 = $360$hi;
     i64toi32_i32$1 = $359;
     i64toi32_i32$0 = i64toi32_i32$2 + i64toi32_i32$1 | 0;
     i64toi32_i32$3 = i64toi32_i32$5 + i64toi32_i32$4 | 0;
     if (i64toi32_i32$0 >>> 0 < i64toi32_i32$1 >>> 0) {
      i64toi32_i32$3 = i64toi32_i32$3 + 1 | 0
     }
     $2_1 = i64toi32_i32$0;
     $2$hi = i64toi32_i32$3;
     i64toi32_i32$3 = $3$hi;
     i64toi32_i32$3 = $2$hi;
     i64toi32_i32$5 = i64toi32_i32$0;
     i64toi32_i32$2 = $3$hi;
     i64toi32_i32$1 = $3_1;
     $364 = i64toi32_i32$3 >>> 0 < i64toi32_i32$2 >>> 0 | ((i64toi32_i32$3 | 0) == (i64toi32_i32$2 | 0) & i64toi32_i32$0 >>> 0 < i64toi32_i32$1 >>> 0 | 0) | 0;
     i64toi32_i32$5 = 0;
     $365$hi = i64toi32_i32$5;
     i64toi32_i32$5 = $348$hi;
     i64toi32_i32$1 = $348;
     i64toi32_i32$3 = $365$hi;
     i64toi32_i32$2 = $364;
     i64toi32_i32$4 = i64toi32_i32$1 + i64toi32_i32$2 | 0;
     i64toi32_i32$0 = i64toi32_i32$5 + i64toi32_i32$3 | 0;
     if (i64toi32_i32$4 >>> 0 < i64toi32_i32$2 >>> 0) {
      i64toi32_i32$0 = i64toi32_i32$0 + 1 | 0
     }
     $4_1 = i64toi32_i32$4;
     $4$hi = i64toi32_i32$0;
     i64toi32_i32$0 = $10$hi;
     i64toi32_i32$0 = $4$hi;
     i64toi32_i32$5 = i64toi32_i32$4;
     i64toi32_i32$1 = $10$hi;
     i64toi32_i32$2 = $10_1;
     $369 = i64toi32_i32$0 >>> 0 < i64toi32_i32$1 >>> 0 | ((i64toi32_i32$0 | 0) == (i64toi32_i32$1 | 0) & i64toi32_i32$4 >>> 0 < i64toi32_i32$2 >>> 0 | 0) | 0;
     i64toi32_i32$5 = 0;
     $370$hi = i64toi32_i32$5;
     i64toi32_i32$5 = $347$hi;
     i64toi32_i32$2 = $347;
     i64toi32_i32$0 = $370$hi;
     i64toi32_i32$1 = $369;
     i64toi32_i32$3 = i64toi32_i32$2 + i64toi32_i32$1 | 0;
     i64toi32_i32$4 = i64toi32_i32$5 + i64toi32_i32$0 | 0;
     if (i64toi32_i32$3 >>> 0 < i64toi32_i32$1 >>> 0) {
      i64toi32_i32$4 = i64toi32_i32$4 + 1 | 0
     }
     $3_1 = i64toi32_i32$3;
     $3$hi = i64toi32_i32$4;
     i64toi32_i32$5 = i64toi32_i32$3;
     i64toi32_i32$2 = 65536;
     i64toi32_i32$1 = 0;
     i64toi32_i32$2 = i64toi32_i32$4 & i64toi32_i32$2 | 0;
     if (!(i64toi32_i32$3 & i64toi32_i32$1 | 0 | i64toi32_i32$2 | 0)) {
      break block12
     }
     $6_1 = $6_1 + 1 | 0;
     break block13;
    }
    i64toi32_i32$2 = $1$hi;
    i64toi32_i32$4 = $1_1;
    i64toi32_i32$5 = 0;
    i64toi32_i32$1 = 63;
    i64toi32_i32$0 = i64toi32_i32$1 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$1 & 63 | 0) >>> 0) {
     i64toi32_i32$5 = 0;
     $243 = i64toi32_i32$2 >>> i64toi32_i32$0 | 0;
    } else {
     i64toi32_i32$5 = i64toi32_i32$2 >>> i64toi32_i32$0 | 0;
     $243 = (((1 << i64toi32_i32$0 | 0) - 1 | 0) & i64toi32_i32$2 | 0) << (32 - i64toi32_i32$0 | 0) | 0 | (i64toi32_i32$4 >>> i64toi32_i32$0 | 0) | 0;
    }
    $10_1 = $243;
    $10$hi = i64toi32_i32$5;
    i64toi32_i32$5 = $3$hi;
    i64toi32_i32$2 = $3_1;
    i64toi32_i32$4 = 0;
    i64toi32_i32$1 = 1;
    i64toi32_i32$0 = i64toi32_i32$1 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$1 & 63 | 0) >>> 0) {
     i64toi32_i32$4 = i64toi32_i32$2 << i64toi32_i32$0 | 0;
     $244 = 0;
    } else {
     i64toi32_i32$4 = ((1 << i64toi32_i32$0 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$0 | 0) | 0) | 0 | (i64toi32_i32$5 << i64toi32_i32$0 | 0) | 0;
     $244 = i64toi32_i32$2 << i64toi32_i32$0 | 0;
    }
    $380 = $244;
    $380$hi = i64toi32_i32$4;
    i64toi32_i32$4 = $4$hi;
    i64toi32_i32$5 = $4_1;
    i64toi32_i32$2 = 0;
    i64toi32_i32$1 = 63;
    i64toi32_i32$0 = i64toi32_i32$1 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$1 & 63 | 0) >>> 0) {
     i64toi32_i32$2 = 0;
     $245 = i64toi32_i32$4 >>> i64toi32_i32$0 | 0;
    } else {
     i64toi32_i32$2 = i64toi32_i32$4 >>> i64toi32_i32$0 | 0;
     $245 = (((1 << i64toi32_i32$0 | 0) - 1 | 0) & i64toi32_i32$4 | 0) << (32 - i64toi32_i32$0 | 0) | 0 | (i64toi32_i32$5 >>> i64toi32_i32$0 | 0) | 0;
    }
    $382$hi = i64toi32_i32$2;
    i64toi32_i32$2 = $380$hi;
    i64toi32_i32$4 = $380;
    i64toi32_i32$5 = $382$hi;
    i64toi32_i32$1 = $245;
    i64toi32_i32$5 = i64toi32_i32$2 | i64toi32_i32$5 | 0;
    $3_1 = i64toi32_i32$4 | i64toi32_i32$1 | 0;
    $3$hi = i64toi32_i32$5;
    i64toi32_i32$5 = $4$hi;
    i64toi32_i32$2 = $4_1;
    i64toi32_i32$4 = 0;
    i64toi32_i32$1 = 1;
    i64toi32_i32$0 = i64toi32_i32$1 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$1 & 63 | 0) >>> 0) {
     i64toi32_i32$4 = i64toi32_i32$2 << i64toi32_i32$0 | 0;
     $246 = 0;
    } else {
     i64toi32_i32$4 = ((1 << i64toi32_i32$0 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$0 | 0) | 0) | 0 | (i64toi32_i32$5 << i64toi32_i32$0 | 0) | 0;
     $246 = i64toi32_i32$2 << i64toi32_i32$0 | 0;
    }
    $385 = $246;
    $385$hi = i64toi32_i32$4;
    i64toi32_i32$4 = $2$hi;
    i64toi32_i32$5 = $2_1;
    i64toi32_i32$2 = 0;
    i64toi32_i32$1 = 63;
    i64toi32_i32$0 = i64toi32_i32$1 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$1 & 63 | 0) >>> 0) {
     i64toi32_i32$2 = 0;
     $248 = i64toi32_i32$4 >>> i64toi32_i32$0 | 0;
    } else {
     i64toi32_i32$2 = i64toi32_i32$4 >>> i64toi32_i32$0 | 0;
     $248 = (((1 << i64toi32_i32$0 | 0) - 1 | 0) & i64toi32_i32$4 | 0) << (32 - i64toi32_i32$0 | 0) | 0 | (i64toi32_i32$5 >>> i64toi32_i32$0 | 0) | 0;
    }
    $387$hi = i64toi32_i32$2;
    i64toi32_i32$2 = $385$hi;
    i64toi32_i32$4 = $385;
    i64toi32_i32$5 = $387$hi;
    i64toi32_i32$1 = $248;
    i64toi32_i32$5 = i64toi32_i32$2 | i64toi32_i32$5 | 0;
    $4_1 = i64toi32_i32$4 | i64toi32_i32$1 | 0;
    $4$hi = i64toi32_i32$5;
    i64toi32_i32$5 = $1$hi;
    i64toi32_i32$2 = $1_1;
    i64toi32_i32$4 = 0;
    i64toi32_i32$1 = 1;
    i64toi32_i32$0 = i64toi32_i32$1 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$1 & 63 | 0) >>> 0) {
     i64toi32_i32$4 = i64toi32_i32$2 << i64toi32_i32$0 | 0;
     $249 = 0;
    } else {
     i64toi32_i32$4 = ((1 << i64toi32_i32$0 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$0 | 0) | 0) | 0 | (i64toi32_i32$5 << i64toi32_i32$0 | 0) | 0;
     $249 = i64toi32_i32$2 << i64toi32_i32$0 | 0;
    }
    $1_1 = $249;
    $1$hi = i64toi32_i32$4;
    i64toi32_i32$4 = $10$hi;
    $391 = $10_1;
    $391$hi = i64toi32_i32$4;
    i64toi32_i32$4 = $2$hi;
    i64toi32_i32$5 = $2_1;
    i64toi32_i32$2 = 0;
    i64toi32_i32$1 = 1;
    i64toi32_i32$0 = i64toi32_i32$1 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$1 & 63 | 0) >>> 0) {
     i64toi32_i32$2 = i64toi32_i32$5 << i64toi32_i32$0 | 0;
     $250 = 0;
    } else {
     i64toi32_i32$2 = ((1 << i64toi32_i32$0 | 0) - 1 | 0) & (i64toi32_i32$5 >>> (32 - i64toi32_i32$0 | 0) | 0) | 0 | (i64toi32_i32$4 << i64toi32_i32$0 | 0) | 0;
     $250 = i64toi32_i32$5 << i64toi32_i32$0 | 0;
    }
    $393$hi = i64toi32_i32$2;
    i64toi32_i32$2 = $391$hi;
    i64toi32_i32$4 = $391;
    i64toi32_i32$5 = $393$hi;
    i64toi32_i32$1 = $250;
    i64toi32_i32$5 = i64toi32_i32$2 | i64toi32_i32$5 | 0;
    $2_1 = i64toi32_i32$4 | i64toi32_i32$1 | 0;
    $2$hi = i64toi32_i32$5;
   }
   block14 : {
    if (($6_1 | 0) < (32767 | 0)) {
     break block14
    }
    i64toi32_i32$5 = $11$hi;
    i64toi32_i32$2 = $11_1;
    i64toi32_i32$4 = 2147418112;
    i64toi32_i32$1 = 0;
    i64toi32_i32$4 = i64toi32_i32$5 | i64toi32_i32$4 | 0;
    $11_1 = i64toi32_i32$2 | i64toi32_i32$1 | 0;
    $11$hi = i64toi32_i32$4;
    i64toi32_i32$4 = 0;
    $1_1 = 0;
    $1$hi = i64toi32_i32$4;
    break block3;
   }
   block17 : {
    block15 : {
     if (($6_1 | 0) > (0 | 0)) {
      break block15
     }
     block16 : {
      $7_1 = 1 - $6_1 | 0;
      if ($7_1 >>> 0 > 127 >>> 0) {
       break block16
      }
      i64toi32_i32$4 = $1$hi;
      i64toi32_i32$4 = $2$hi;
      $6_1 = $6_1 + 127 | 0;
      i64toi32_i32$4 = $1$hi;
      i64toi32_i32$2 = $2$hi;
      $191($5_1 + 48 | 0 | 0, $1_1 | 0, i64toi32_i32$4 | 0, $2_1 | 0, i64toi32_i32$2 | 0, $6_1 | 0);
      i64toi32_i32$2 = $4$hi;
      i64toi32_i32$2 = $3$hi;
      i64toi32_i32$2 = $4$hi;
      i64toi32_i32$4 = $3$hi;
      $191($5_1 + 32 | 0 | 0, $4_1 | 0, i64toi32_i32$2 | 0, $3_1 | 0, i64toi32_i32$4 | 0, $6_1 | 0);
      i64toi32_i32$4 = $1$hi;
      i64toi32_i32$4 = $2$hi;
      i64toi32_i32$4 = $1$hi;
      i64toi32_i32$2 = $2$hi;
      $195($5_1 + 16 | 0 | 0, $1_1 | 0, i64toi32_i32$4 | 0, $2_1 | 0, i64toi32_i32$2 | 0, $7_1 | 0);
      i64toi32_i32$2 = $4$hi;
      i64toi32_i32$2 = $3$hi;
      i64toi32_i32$2 = $4$hi;
      i64toi32_i32$4 = $3$hi;
      $195($5_1 | 0, $4_1 | 0, i64toi32_i32$2 | 0, $3_1 | 0, i64toi32_i32$4 | 0, $7_1 | 0);
      i64toi32_i32$5 = $5_1;
      i64toi32_i32$4 = HEAP32[(i64toi32_i32$5 + 32 | 0) >> 2] | 0;
      i64toi32_i32$2 = HEAP32[(i64toi32_i32$5 + 36 | 0) >> 2] | 0;
      $427 = i64toi32_i32$4;
      $427$hi = i64toi32_i32$2;
      i64toi32_i32$2 = HEAP32[(i64toi32_i32$5 + 16 | 0) >> 2] | 0;
      i64toi32_i32$4 = HEAP32[(i64toi32_i32$5 + 20 | 0) >> 2] | 0;
      $429 = i64toi32_i32$2;
      $429$hi = i64toi32_i32$4;
      i64toi32_i32$4 = $427$hi;
      i64toi32_i32$5 = $427;
      i64toi32_i32$2 = $429$hi;
      i64toi32_i32$1 = $429;
      i64toi32_i32$2 = i64toi32_i32$4 | i64toi32_i32$2 | 0;
      $430 = i64toi32_i32$5 | i64toi32_i32$1 | 0;
      $430$hi = i64toi32_i32$2;
      i64toi32_i32$4 = $5_1;
      i64toi32_i32$2 = HEAP32[(i64toi32_i32$4 + 48 | 0) >> 2] | 0;
      i64toi32_i32$5 = HEAP32[(i64toi32_i32$4 + 52 | 0) >> 2] | 0;
      $432 = i64toi32_i32$2;
      $432$hi = i64toi32_i32$5;
      i64toi32_i32$5 = HEAP32[(i64toi32_i32$4 + 56 | 0) >> 2] | 0;
      i64toi32_i32$2 = HEAP32[(i64toi32_i32$4 + 60 | 0) >> 2] | 0;
      $434 = i64toi32_i32$5;
      $434$hi = i64toi32_i32$2;
      i64toi32_i32$2 = $432$hi;
      i64toi32_i32$4 = $432;
      i64toi32_i32$5 = $434$hi;
      i64toi32_i32$1 = $434;
      i64toi32_i32$5 = i64toi32_i32$2 | i64toi32_i32$5 | 0;
      i64toi32_i32$2 = i64toi32_i32$4 | i64toi32_i32$1 | 0;
      i64toi32_i32$4 = 0;
      i64toi32_i32$1 = 0;
      $436 = (i64toi32_i32$2 | 0) != (i64toi32_i32$1 | 0) | (i64toi32_i32$5 | 0) != (i64toi32_i32$4 | 0) | 0;
      i64toi32_i32$2 = 0;
      $437$hi = i64toi32_i32$2;
      i64toi32_i32$2 = $430$hi;
      i64toi32_i32$1 = $430;
      i64toi32_i32$5 = $437$hi;
      i64toi32_i32$4 = $436;
      i64toi32_i32$5 = i64toi32_i32$2 | i64toi32_i32$5 | 0;
      $1_1 = i64toi32_i32$1 | i64toi32_i32$4 | 0;
      $1$hi = i64toi32_i32$5;
      i64toi32_i32$2 = $5_1;
      i64toi32_i32$5 = HEAP32[(i64toi32_i32$2 + 40 | 0) >> 2] | 0;
      i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 44 | 0) >> 2] | 0;
      $440 = i64toi32_i32$5;
      $440$hi = i64toi32_i32$1;
      i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 24 | 0) >> 2] | 0;
      i64toi32_i32$5 = HEAP32[(i64toi32_i32$2 + 28 | 0) >> 2] | 0;
      $442 = i64toi32_i32$1;
      $442$hi = i64toi32_i32$5;
      i64toi32_i32$5 = $440$hi;
      i64toi32_i32$2 = $440;
      i64toi32_i32$1 = $442$hi;
      i64toi32_i32$4 = $442;
      i64toi32_i32$1 = i64toi32_i32$5 | i64toi32_i32$1 | 0;
      $2_1 = i64toi32_i32$2 | i64toi32_i32$4 | 0;
      $2$hi = i64toi32_i32$1;
      i64toi32_i32$5 = $5_1;
      i64toi32_i32$1 = HEAP32[(i64toi32_i32$5 + 8 | 0) >> 2] | 0;
      i64toi32_i32$2 = HEAP32[(i64toi32_i32$5 + 12 | 0) >> 2] | 0;
      $3_1 = i64toi32_i32$1;
      $3$hi = i64toi32_i32$2;
      i64toi32_i32$2 = HEAP32[i64toi32_i32$5 >> 2] | 0;
      i64toi32_i32$1 = HEAP32[(i64toi32_i32$5 + 4 | 0) >> 2] | 0;
      $4_1 = i64toi32_i32$2;
      $4$hi = i64toi32_i32$1;
      break block17;
     }
     i64toi32_i32$1 = 0;
     $1_1 = 0;
     $1$hi = i64toi32_i32$1;
     break block3;
    }
    i64toi32_i32$1 = 0;
    i64toi32_i32$5 = $6_1;
    i64toi32_i32$2 = 0;
    i64toi32_i32$4 = 48;
    i64toi32_i32$0 = i64toi32_i32$4 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$4 & 63 | 0) >>> 0) {
     i64toi32_i32$2 = i64toi32_i32$5 << i64toi32_i32$0 | 0;
     $251 = 0;
    } else {
     i64toi32_i32$2 = ((1 << i64toi32_i32$0 | 0) - 1 | 0) & (i64toi32_i32$5 >>> (32 - i64toi32_i32$0 | 0) | 0) | 0 | (i64toi32_i32$1 << i64toi32_i32$0 | 0) | 0;
     $251 = i64toi32_i32$5 << i64toi32_i32$0 | 0;
    }
    $450$hi = i64toi32_i32$2;
    i64toi32_i32$2 = $3$hi;
    i64toi32_i32$1 = $3_1;
    i64toi32_i32$5 = 65535;
    i64toi32_i32$4 = -1;
    i64toi32_i32$5 = i64toi32_i32$2 & i64toi32_i32$5 | 0;
    $452 = i64toi32_i32$1 & i64toi32_i32$4 | 0;
    $452$hi = i64toi32_i32$5;
    i64toi32_i32$5 = $450$hi;
    i64toi32_i32$2 = $251;
    i64toi32_i32$1 = $452$hi;
    i64toi32_i32$4 = $452;
    i64toi32_i32$1 = i64toi32_i32$5 | i64toi32_i32$1 | 0;
    $3_1 = i64toi32_i32$2 | i64toi32_i32$4 | 0;
    $3$hi = i64toi32_i32$1;
   }
   i64toi32_i32$1 = $3$hi;
   i64toi32_i32$1 = $11$hi;
   i64toi32_i32$1 = $3$hi;
   i64toi32_i32$5 = $3_1;
   i64toi32_i32$2 = $11$hi;
   i64toi32_i32$4 = $11_1;
   i64toi32_i32$2 = i64toi32_i32$1 | i64toi32_i32$2 | 0;
   $11_1 = i64toi32_i32$5 | i64toi32_i32$4 | 0;
   $11$hi = i64toi32_i32$2;
   block18 : {
    i64toi32_i32$2 = $1$hi;
    $458 = !($1_1 | i64toi32_i32$2 | 0);
    i64toi32_i32$2 = $2$hi;
    i64toi32_i32$1 = $2_1;
    i64toi32_i32$5 = -1;
    i64toi32_i32$4 = -1;
    if ((i64toi32_i32$2 | 0) > (i64toi32_i32$5 | 0)) {
     $252 = 1
    } else {
     if ((i64toi32_i32$2 | 0) >= (i64toi32_i32$5 | 0)) {
      if (i64toi32_i32$1 >>> 0 <= i64toi32_i32$4 >>> 0) {
       $254 = 0
      } else {
       $254 = 1
      }
      $255 = $254;
     } else {
      $255 = 0
     }
     $252 = $255;
    }
    i64toi32_i32$1 = $2$hi;
    i64toi32_i32$4 = $2_1;
    i64toi32_i32$2 = -2147483648;
    i64toi32_i32$5 = 0;
    if ((i64toi32_i32$4 | 0) == (i64toi32_i32$5 | 0) & (i64toi32_i32$1 | 0) == (i64toi32_i32$2 | 0) | 0 ? $458 : $252) {
     break block18
    }
    i64toi32_i32$4 = $11$hi;
    $464 = $11_1;
    $464$hi = i64toi32_i32$4;
    i64toi32_i32$4 = $4$hi;
    i64toi32_i32$5 = $4_1;
    i64toi32_i32$1 = 0;
    i64toi32_i32$2 = 1;
    i64toi32_i32$0 = i64toi32_i32$5 + i64toi32_i32$2 | 0;
    i64toi32_i32$3 = i64toi32_i32$4 + i64toi32_i32$1 | 0;
    if (i64toi32_i32$0 >>> 0 < i64toi32_i32$2 >>> 0) {
     i64toi32_i32$3 = i64toi32_i32$3 + 1 | 0
    }
    $1_1 = i64toi32_i32$0;
    $1$hi = i64toi32_i32$3;
    $468 = !(i64toi32_i32$0 | i64toi32_i32$3 | 0);
    i64toi32_i32$3 = 0;
    $469$hi = i64toi32_i32$3;
    i64toi32_i32$3 = $464$hi;
    i64toi32_i32$4 = $464;
    i64toi32_i32$5 = $469$hi;
    i64toi32_i32$2 = $468;
    i64toi32_i32$1 = i64toi32_i32$4 + i64toi32_i32$2 | 0;
    i64toi32_i32$0 = i64toi32_i32$3 + i64toi32_i32$5 | 0;
    if (i64toi32_i32$1 >>> 0 < i64toi32_i32$2 >>> 0) {
     i64toi32_i32$0 = i64toi32_i32$0 + 1 | 0
    }
    $11_1 = i64toi32_i32$1;
    $11$hi = i64toi32_i32$0;
    break block3;
   }
   block19 : {
    i64toi32_i32$0 = $1$hi;
    i64toi32_i32$0 = $2$hi;
    i64toi32_i32$3 = $2_1;
    i64toi32_i32$4 = -2147483648;
    i64toi32_i32$2 = 0;
    i64toi32_i32$4 = i64toi32_i32$0 ^ i64toi32_i32$4 | 0;
    $473 = i64toi32_i32$3 ^ i64toi32_i32$2 | 0;
    $473$hi = i64toi32_i32$4;
    i64toi32_i32$4 = $1$hi;
    i64toi32_i32$0 = $1_1;
    i64toi32_i32$3 = $473$hi;
    i64toi32_i32$2 = $473;
    i64toi32_i32$3 = i64toi32_i32$4 | i64toi32_i32$3 | 0;
    i64toi32_i32$4 = i64toi32_i32$0 | i64toi32_i32$2 | 0;
    i64toi32_i32$0 = 0;
    i64toi32_i32$2 = 0;
    if ((i64toi32_i32$4 | 0) == (i64toi32_i32$2 | 0) & (i64toi32_i32$3 | 0) == (i64toi32_i32$0 | 0) | 0) {
     break block19
    }
    i64toi32_i32$4 = $4$hi;
    $1_1 = $4_1;
    $1$hi = i64toi32_i32$4;
    break block3;
   }
   i64toi32_i32$4 = $11$hi;
   $477 = $11_1;
   $477$hi = i64toi32_i32$4;
   i64toi32_i32$4 = $4$hi;
   i64toi32_i32$2 = $4_1;
   i64toi32_i32$3 = 0;
   i64toi32_i32$0 = 1;
   i64toi32_i32$3 = i64toi32_i32$4 & i64toi32_i32$3 | 0;
   $480 = i64toi32_i32$2 & i64toi32_i32$0 | 0;
   $480$hi = i64toi32_i32$3;
   i64toi32_i32$3 = i64toi32_i32$4;
   i64toi32_i32$4 = i64toi32_i32$2;
   i64toi32_i32$2 = $480$hi;
   i64toi32_i32$0 = $480;
   i64toi32_i32$5 = i64toi32_i32$4 + i64toi32_i32$0 | 0;
   i64toi32_i32$1 = i64toi32_i32$3 + i64toi32_i32$2 | 0;
   if (i64toi32_i32$5 >>> 0 < i64toi32_i32$0 >>> 0) {
    i64toi32_i32$1 = i64toi32_i32$1 + 1 | 0
   }
   $1_1 = i64toi32_i32$5;
   $1$hi = i64toi32_i32$1;
   i64toi32_i32$1 = $4$hi;
   i64toi32_i32$1 = $1$hi;
   i64toi32_i32$3 = i64toi32_i32$5;
   i64toi32_i32$4 = $4$hi;
   i64toi32_i32$0 = $4_1;
   $484 = i64toi32_i32$1 >>> 0 < i64toi32_i32$4 >>> 0 | ((i64toi32_i32$1 | 0) == (i64toi32_i32$4 | 0) & i64toi32_i32$3 >>> 0 < i64toi32_i32$0 >>> 0 | 0) | 0;
   i64toi32_i32$3 = 0;
   $485$hi = i64toi32_i32$3;
   i64toi32_i32$3 = $477$hi;
   i64toi32_i32$0 = $477;
   i64toi32_i32$1 = $485$hi;
   i64toi32_i32$4 = $484;
   i64toi32_i32$2 = i64toi32_i32$0 + i64toi32_i32$4 | 0;
   i64toi32_i32$5 = i64toi32_i32$3 + i64toi32_i32$1 | 0;
   if (i64toi32_i32$2 >>> 0 < i64toi32_i32$4 >>> 0) {
    i64toi32_i32$5 = i64toi32_i32$5 + 1 | 0
   }
   $11_1 = i64toi32_i32$2;
   $11$hi = i64toi32_i32$5;
  }
  i64toi32_i32$5 = $1$hi;
  i64toi32_i32$0 = $0_1;
  HEAP32[i64toi32_i32$0 >> 2] = $1_1;
  HEAP32[(i64toi32_i32$0 + 4 | 0) >> 2] = i64toi32_i32$5;
  i64toi32_i32$5 = $11$hi;
  HEAP32[(i64toi32_i32$0 + 8 | 0) >> 2] = $11_1;
  HEAP32[(i64toi32_i32$0 + 12 | 0) >> 2] = i64toi32_i32$5;
  global$0 = $5_1 + 96 | 0;
 }
 
 function $197() {
  global$2 = 65536;
  global$1 = (0 + 15 | 0) & -16 | 0;
 }
 
 function $198() {
  return global$0 - global$1 | 0 | 0;
 }
 
 function $199() {
  return global$2 | 0;
 }
 
 function $200() {
  return global$1 | 0;
 }
 
 function $201($0_1, $0$hi, $1_1, $1$hi) {
  $0_1 = $0_1 | 0;
  $0$hi = $0$hi | 0;
  $1_1 = $1_1 | 0;
  $1$hi = $1$hi | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$2 = 0, i64toi32_i32$1 = 0, i64toi32_i32$4 = 0, i64toi32_i32$3 = 0, $4_1 = 0, $7_1 = 0, $7$hi = 0, $3_1 = 0, $5_1 = 0, $2_1 = 0, $8_1 = 0, $35_1 = 0, $8$hi = 0, $36_1 = 0, $37_1 = 0, $6_1 = 0, $39_1 = 0, $40_1 = 0, $26_1 = 0, $30_1 = 0, $38_1 = 0, $38$hi = 0, $77_1 = 0, $77$hi = 0, $90_1 = 0, $90$hi = 0, $92_1 = 0, $92$hi = 0, $105$hi = 0, $107$hi = 0, $110_1 = 0, $114_1 = 0, $122_1 = 0, $122$hi = 0, $139_1 = 0;
  $2_1 = global$0 - 32 | 0;
  global$0 = $2_1;
  i64toi32_i32$0 = $1$hi;
  i64toi32_i32$2 = $1_1;
  i64toi32_i32$1 = 65535;
  i64toi32_i32$3 = -1;
  i64toi32_i32$1 = i64toi32_i32$0 & i64toi32_i32$1 | 0;
  $7_1 = i64toi32_i32$2 & i64toi32_i32$3 | 0;
  $7$hi = i64toi32_i32$1;
  block3 : {
   block : {
    i64toi32_i32$1 = i64toi32_i32$0;
    i64toi32_i32$1 = i64toi32_i32$0;
    i64toi32_i32$0 = i64toi32_i32$2;
    i64toi32_i32$2 = 0;
    i64toi32_i32$3 = 48;
    i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
     i64toi32_i32$2 = 0;
     $35_1 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
    } else {
     i64toi32_i32$2 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
     $35_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$1 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$0 >>> i64toi32_i32$4 | 0) | 0;
    }
    i64toi32_i32$1 = $35_1;
    i64toi32_i32$0 = 0;
    i64toi32_i32$3 = 32767;
    i64toi32_i32$0 = i64toi32_i32$2 & i64toi32_i32$0 | 0;
    $8_1 = i64toi32_i32$1 & i64toi32_i32$3 | 0;
    $8$hi = i64toi32_i32$0;
    $3_1 = $8_1;
    if (($3_1 + -16257 | 0) >>> 0 > 253 >>> 0) {
     break block
    }
    i64toi32_i32$0 = $7$hi;
    i64toi32_i32$2 = $7_1;
    i64toi32_i32$1 = 0;
    i64toi32_i32$3 = 25;
    i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
     i64toi32_i32$1 = 0;
     $36_1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
    } else {
     i64toi32_i32$1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
     $36_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$2 >>> i64toi32_i32$4 | 0) | 0;
    }
    $4_1 = $36_1;
    block2 : {
     block1 : {
      i64toi32_i32$1 = $0$hi;
      $26_1 = !($0_1 | i64toi32_i32$1 | 0);
      i64toi32_i32$1 = $1$hi;
      i64toi32_i32$0 = $1_1;
      i64toi32_i32$2 = 0;
      i64toi32_i32$3 = 33554431;
      i64toi32_i32$2 = i64toi32_i32$1 & i64toi32_i32$2 | 0;
      $7_1 = i64toi32_i32$0 & i64toi32_i32$3 | 0;
      $7$hi = i64toi32_i32$2;
      i64toi32_i32$1 = $7_1;
      i64toi32_i32$0 = 0;
      i64toi32_i32$3 = 16777216;
      $30_1 = i64toi32_i32$2 >>> 0 < i64toi32_i32$0 >>> 0 | ((i64toi32_i32$2 | 0) == (i64toi32_i32$0 | 0) & i64toi32_i32$1 >>> 0 < i64toi32_i32$3 >>> 0 | 0) | 0;
      i64toi32_i32$1 = i64toi32_i32$2;
      i64toi32_i32$1 = i64toi32_i32$2;
      i64toi32_i32$3 = $7_1;
      i64toi32_i32$2 = 0;
      i64toi32_i32$0 = 16777216;
      if ((i64toi32_i32$3 | 0) == (i64toi32_i32$0 | 0) & (i64toi32_i32$1 | 0) == (i64toi32_i32$2 | 0) | 0 ? $26_1 : $30_1) {
       break block1
      }
      $4_1 = $4_1 + 1 | 0;
      break block2;
     }
     i64toi32_i32$3 = $0$hi;
     i64toi32_i32$3 = $7$hi;
     i64toi32_i32$0 = $7_1;
     i64toi32_i32$1 = 0;
     i64toi32_i32$2 = 16777216;
     i64toi32_i32$1 = i64toi32_i32$3 ^ i64toi32_i32$1 | 0;
     $38_1 = i64toi32_i32$0 ^ i64toi32_i32$2 | 0;
     $38$hi = i64toi32_i32$1;
     i64toi32_i32$1 = $0$hi;
     i64toi32_i32$3 = $0_1;
     i64toi32_i32$0 = $38$hi;
     i64toi32_i32$2 = $38_1;
     i64toi32_i32$0 = i64toi32_i32$1 | i64toi32_i32$0 | 0;
     i64toi32_i32$1 = i64toi32_i32$3 | i64toi32_i32$2 | 0;
     i64toi32_i32$3 = 0;
     i64toi32_i32$2 = 0;
     if ((i64toi32_i32$1 | 0) != (i64toi32_i32$2 | 0) | (i64toi32_i32$0 | 0) != (i64toi32_i32$3 | 0) | 0) {
      break block2
     }
     $4_1 = ($4_1 & 1 | 0) + $4_1 | 0;
    }
    $5_1 = $4_1 >>> 0 > 8388607 >>> 0;
    $4_1 = $5_1 ? 0 : $4_1;
    $3_1 = ($5_1 ? -16255 : -16256) + $3_1 | 0;
    break block3;
   }
   block4 : {
    i64toi32_i32$1 = $0$hi;
    i64toi32_i32$1 = $7$hi;
    i64toi32_i32$1 = $0$hi;
    i64toi32_i32$2 = $0_1;
    i64toi32_i32$0 = $7$hi;
    i64toi32_i32$3 = $7_1;
    i64toi32_i32$0 = i64toi32_i32$1 | i64toi32_i32$0 | 0;
    if (!(i64toi32_i32$2 | i64toi32_i32$3 | 0 | i64toi32_i32$0 | 0)) {
     break block4
    }
    i64toi32_i32$0 = $8$hi;
    i64toi32_i32$1 = $8_1;
    i64toi32_i32$2 = 0;
    i64toi32_i32$3 = 32767;
    if ((i64toi32_i32$1 | 0) != (i64toi32_i32$3 | 0) | (i64toi32_i32$0 | 0) != (i64toi32_i32$2 | 0) | 0) {
     break block4
    }
    i64toi32_i32$1 = $7$hi;
    i64toi32_i32$3 = $7_1;
    i64toi32_i32$0 = 0;
    i64toi32_i32$2 = 25;
    i64toi32_i32$4 = i64toi32_i32$2 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$2 & 63 | 0) >>> 0) {
     i64toi32_i32$0 = 0;
     $37_1 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
    } else {
     i64toi32_i32$0 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
     $37_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$1 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$3 >>> i64toi32_i32$4 | 0) | 0;
    }
    $4_1 = $37_1 | 4194304 | 0;
    $3_1 = 255;
    break block3;
   }
   block5 : {
    if ($3_1 >>> 0 <= 16510 >>> 0) {
     break block5
    }
    $3_1 = 255;
    $4_1 = 0;
    break block3;
   }
   block6 : {
    i64toi32_i32$0 = $8$hi;
    $5_1 = !($8_1 | i64toi32_i32$0 | 0);
    $6_1 = $5_1 ? 16256 : 16257;
    $4_1 = $6_1 - $3_1 | 0;
    if (($4_1 | 0) <= (112 | 0)) {
     break block6
    }
    $4_1 = 0;
    $3_1 = 0;
    break block3;
   }
   i64toi32_i32$0 = $7$hi;
   i64toi32_i32$1 = $7_1;
   i64toi32_i32$3 = 65536;
   i64toi32_i32$2 = 0;
   i64toi32_i32$3 = i64toi32_i32$0 | i64toi32_i32$3 | 0;
   $77_1 = i64toi32_i32$1 | i64toi32_i32$2 | 0;
   $77$hi = i64toi32_i32$3;
   i64toi32_i32$4 = $5_1;
   i64toi32_i32$3 = i64toi32_i32$0;
   i64toi32_i32$1 = $77$hi;
   i64toi32_i32$2 = i64toi32_i32$4 ? $7_1 : $77_1;
   i64toi32_i32$0 = i64toi32_i32$4 ? i64toi32_i32$0 : i64toi32_i32$1;
   $7_1 = i64toi32_i32$2;
   $7$hi = i64toi32_i32$0;
   $5_1 = 0;
   block7 : {
    if (($6_1 | 0) == ($3_1 | 0)) {
     break block7
    }
    i64toi32_i32$0 = $0$hi;
    i64toi32_i32$0 = $7$hi;
    i64toi32_i32$0 = $0$hi;
    i64toi32_i32$2 = $7$hi;
    $191($2_1 + 16 | 0 | 0, $0_1 | 0, i64toi32_i32$0 | 0, $7_1 | 0, i64toi32_i32$2 | 0, 128 - $4_1 | 0 | 0);
    i64toi32_i32$4 = $2_1;
    i64toi32_i32$2 = HEAP32[(i64toi32_i32$4 + 16 | 0) >> 2] | 0;
    i64toi32_i32$0 = HEAP32[(i64toi32_i32$4 + 20 | 0) >> 2] | 0;
    $90_1 = i64toi32_i32$2;
    $90$hi = i64toi32_i32$0;
    i64toi32_i32$0 = HEAP32[(i64toi32_i32$4 + 24 | 0) >> 2] | 0;
    i64toi32_i32$2 = HEAP32[(i64toi32_i32$4 + 28 | 0) >> 2] | 0;
    $92_1 = i64toi32_i32$0;
    $92$hi = i64toi32_i32$2;
    i64toi32_i32$2 = $90$hi;
    i64toi32_i32$4 = $90_1;
    i64toi32_i32$0 = $92$hi;
    i64toi32_i32$1 = $92_1;
    i64toi32_i32$0 = i64toi32_i32$2 | i64toi32_i32$0 | 0;
    i64toi32_i32$2 = i64toi32_i32$4 | i64toi32_i32$1 | 0;
    i64toi32_i32$4 = 0;
    i64toi32_i32$1 = 0;
    $5_1 = (i64toi32_i32$2 | 0) != (i64toi32_i32$1 | 0) | (i64toi32_i32$0 | 0) != (i64toi32_i32$4 | 0) | 0;
   }
   i64toi32_i32$2 = $0$hi;
   i64toi32_i32$2 = $7$hi;
   i64toi32_i32$2 = $0$hi;
   i64toi32_i32$0 = $7$hi;
   $195($2_1 | 0, $0_1 | 0, i64toi32_i32$2 | 0, $7_1 | 0, i64toi32_i32$0 | 0, $4_1 | 0);
   i64toi32_i32$1 = $2_1;
   i64toi32_i32$0 = HEAP32[(i64toi32_i32$1 + 8 | 0) >> 2] | 0;
   i64toi32_i32$2 = HEAP32[(i64toi32_i32$1 + 12 | 0) >> 2] | 0;
   $7_1 = i64toi32_i32$0;
   $7$hi = i64toi32_i32$2;
   i64toi32_i32$1 = i64toi32_i32$0;
   i64toi32_i32$0 = 0;
   i64toi32_i32$4 = 25;
   i64toi32_i32$3 = i64toi32_i32$4 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$4 & 63 | 0) >>> 0) {
    i64toi32_i32$0 = 0;
    $39_1 = i64toi32_i32$2 >>> i64toi32_i32$3 | 0;
   } else {
    i64toi32_i32$0 = i64toi32_i32$2 >>> i64toi32_i32$3 | 0;
    $39_1 = (((1 << i64toi32_i32$3 | 0) - 1 | 0) & i64toi32_i32$2 | 0) << (32 - i64toi32_i32$3 | 0) | 0 | (i64toi32_i32$1 >>> i64toi32_i32$3 | 0) | 0;
   }
   $4_1 = $39_1;
   block9 : {
    block8 : {
     i64toi32_i32$2 = $2_1;
     i64toi32_i32$0 = HEAP32[i64toi32_i32$2 >> 2] | 0;
     i64toi32_i32$1 = HEAP32[(i64toi32_i32$2 + 4 | 0) >> 2] | 0;
     $105$hi = i64toi32_i32$1;
     i64toi32_i32$1 = 0;
     $107$hi = i64toi32_i32$1;
     i64toi32_i32$1 = $105$hi;
     i64toi32_i32$2 = i64toi32_i32$0;
     i64toi32_i32$0 = $107$hi;
     i64toi32_i32$4 = $5_1;
     i64toi32_i32$0 = i64toi32_i32$1 | i64toi32_i32$0 | 0;
     $0_1 = i64toi32_i32$2 | i64toi32_i32$4 | 0;
     $0$hi = i64toi32_i32$0;
     $110_1 = !($0_1 | i64toi32_i32$0 | 0);
     i64toi32_i32$0 = $7$hi;
     i64toi32_i32$1 = $7_1;
     i64toi32_i32$2 = 0;
     i64toi32_i32$4 = 33554431;
     i64toi32_i32$2 = i64toi32_i32$0 & i64toi32_i32$2 | 0;
     $7_1 = i64toi32_i32$1 & i64toi32_i32$4 | 0;
     $7$hi = i64toi32_i32$2;
     i64toi32_i32$0 = $7_1;
     i64toi32_i32$1 = 0;
     i64toi32_i32$4 = 16777216;
     $114_1 = i64toi32_i32$2 >>> 0 < i64toi32_i32$1 >>> 0 | ((i64toi32_i32$2 | 0) == (i64toi32_i32$1 | 0) & i64toi32_i32$0 >>> 0 < i64toi32_i32$4 >>> 0 | 0) | 0;
     i64toi32_i32$0 = i64toi32_i32$2;
     i64toi32_i32$4 = $7_1;
     i64toi32_i32$2 = 0;
     i64toi32_i32$1 = 16777216;
     if ((i64toi32_i32$4 | 0) == (i64toi32_i32$1 | 0) & (i64toi32_i32$0 | 0) == (i64toi32_i32$2 | 0) | 0 ? $110_1 : $114_1) {
      break block8
     }
     $4_1 = $4_1 + 1 | 0;
     break block9;
    }
    i64toi32_i32$4 = $0$hi;
    i64toi32_i32$4 = $7$hi;
    i64toi32_i32$1 = $7_1;
    i64toi32_i32$0 = 0;
    i64toi32_i32$2 = 16777216;
    i64toi32_i32$0 = i64toi32_i32$4 ^ i64toi32_i32$0 | 0;
    $122_1 = i64toi32_i32$1 ^ i64toi32_i32$2 | 0;
    $122$hi = i64toi32_i32$0;
    i64toi32_i32$0 = $0$hi;
    i64toi32_i32$4 = $0_1;
    i64toi32_i32$1 = $122$hi;
    i64toi32_i32$2 = $122_1;
    i64toi32_i32$1 = i64toi32_i32$0 | i64toi32_i32$1 | 0;
    i64toi32_i32$0 = i64toi32_i32$4 | i64toi32_i32$2 | 0;
    i64toi32_i32$4 = 0;
    i64toi32_i32$2 = 0;
    if ((i64toi32_i32$0 | 0) != (i64toi32_i32$2 | 0) | (i64toi32_i32$1 | 0) != (i64toi32_i32$4 | 0) | 0) {
     break block9
    }
    $4_1 = ($4_1 & 1 | 0) + $4_1 | 0;
   }
   $3_1 = $4_1 >>> 0 > 8388607 >>> 0;
   $4_1 = $3_1 ? $4_1 ^ 8388608 | 0 : $4_1;
  }
  global$0 = $2_1 + 32 | 0;
  $139_1 = $3_1 << 23 | 0;
  i64toi32_i32$0 = $1$hi;
  i64toi32_i32$2 = $1_1;
  i64toi32_i32$1 = 0;
  i64toi32_i32$4 = 32;
  i64toi32_i32$3 = i64toi32_i32$4 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$4 & 63 | 0) >>> 0) {
   i64toi32_i32$1 = 0;
   $40_1 = i64toi32_i32$0 >>> i64toi32_i32$3 | 0;
  } else {
   i64toi32_i32$1 = i64toi32_i32$0 >>> i64toi32_i32$3 | 0;
   $40_1 = (((1 << i64toi32_i32$3 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$3 | 0) | 0 | (i64toi32_i32$2 >>> i64toi32_i32$3 | 0) | 0;
  }
  return Math_fround((wasm2js_scratch_store_i32(2, $139_1 | ($40_1 & -2147483648 | 0) | 0 | $4_1 | 0), wasm2js_scratch_load_f32()));
 }
 
 function $202($0_1) {
  $0_1 = $0_1 | 0;
  global$3 = $0_1;
 }
 
 function $203() {
  return global$3 | 0;
 }
 
 function $204($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0;
  $2_1 = 65621;
  block : {
   if ($0_1 >>> 0 > 153 >>> 0) {
    break block
   }
   block2 : {
    block1 : {
     if ($0_1) {
      break block1
     }
     $0_1 = 0;
     break block2;
    }
    $0_1 = HEAPU16[(($0_1 << 1 | 0) + 73312 | 0) >> 1] | 0;
    if (!$0_1) {
     break block
    }
   }
   $2_1 = $0_1 + 73620 | 0;
  }
  return $2_1 | 0;
 }
 
 function $205($0_1) {
  $0_1 = $0_1 | 0;
  return $204($0_1 | 0, $0_1 | 0) | 0 | 0;
 }
 
 function $206($0_1) {
  $0_1 = $0_1 | 0;
  global$0 = $0_1;
 }
 
 function $207($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0;
  $1_1 = (global$0 - $0_1 | 0) & -16 | 0;
  global$0 = $1_1;
  return $1_1 | 0;
 }
 
 function $208() {
  return global$0 | 0;
 }
 
 function $209($0_1, $1_1, $2_1, $2$hi, $3_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $2$hi = $2$hi | 0;
  $3_1 = $3_1 | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$1 = 0;
  i64toi32_i32$0 = $2$hi;
  i64toi32_i32$0 = FUNCTION_TABLE[$0_1 | 0]($1_1, $2_1, i64toi32_i32$0, $3_1) | 0;
  i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$1;
  return i64toi32_i32$0 | 0;
 }
 
 function $210($0_1, $1_1, $2_1, $3_1, $4_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  $4_1 = $4_1 | 0;
  var i64toi32_i32$2 = 0, i64toi32_i32$4 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, i64toi32_i32$3 = 0, $17_1 = 0, $18_1 = 0, $6_1 = 0, $7_1 = 0, $9_1 = 0, $9$hi = 0, $12$hi = 0, $5_1 = 0, $5$hi = 0;
  $6_1 = $0_1;
  $7_1 = $1_1;
  i64toi32_i32$0 = 0;
  $9_1 = $2_1;
  $9$hi = i64toi32_i32$0;
  i64toi32_i32$0 = 0;
  i64toi32_i32$2 = $3_1;
  i64toi32_i32$1 = 0;
  i64toi32_i32$3 = 32;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
   $17_1 = 0;
  } else {
   i64toi32_i32$1 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$0 << i64toi32_i32$4 | 0) | 0;
   $17_1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
  }
  $12$hi = i64toi32_i32$1;
  i64toi32_i32$1 = $9$hi;
  i64toi32_i32$0 = $9_1;
  i64toi32_i32$2 = $12$hi;
  i64toi32_i32$3 = $17_1;
  i64toi32_i32$2 = i64toi32_i32$1 | i64toi32_i32$2 | 0;
  i64toi32_i32$2 = $209($6_1 | 0, $7_1 | 0, i64toi32_i32$0 | i64toi32_i32$3 | 0 | 0, i64toi32_i32$2 | 0, $4_1 | 0) | 0;
  i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
  $5_1 = i64toi32_i32$2;
  $5$hi = i64toi32_i32$0;
  i64toi32_i32$1 = i64toi32_i32$2;
  i64toi32_i32$2 = 0;
  i64toi32_i32$3 = 32;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$2 = 0;
   $18_1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
  } else {
   i64toi32_i32$2 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
   $18_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$1 >>> i64toi32_i32$4 | 0) | 0;
  }
  $202($18_1 | 0);
  i64toi32_i32$2 = $5$hi;
  return $5_1 | 0;
 }
 
 function $211($0_1, $1_1, $1$hi, $2_1, $3_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $1$hi = $1$hi | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  var i64toi32_i32$4 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, i64toi32_i32$3 = 0, $12_1 = 0, $4_1 = 0, $6_1 = 0, i64toi32_i32$2 = 0;
  $4_1 = $0_1;
  i64toi32_i32$0 = $1$hi;
  $6_1 = $1_1;
  i64toi32_i32$2 = $1_1;
  i64toi32_i32$1 = 0;
  i64toi32_i32$3 = 32;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$1 = 0;
   $12_1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
  } else {
   i64toi32_i32$1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
   $12_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$2 >>> i64toi32_i32$4 | 0) | 0;
  }
  return fimport$8($4_1 | 0, $6_1 | 0, $12_1 | 0, $2_1 | 0, $3_1 | 0) | 0 | 0;
 }
 
 function _ZN17compiler_builtins3int3mul3Mul3mul17h070e9a1c69faec5bE(var$0, var$0$hi, var$1, var$1$hi) {
  var$0 = var$0 | 0;
  var$0$hi = var$0$hi | 0;
  var$1 = var$1 | 0;
  var$1$hi = var$1$hi | 0;
  var i64toi32_i32$4 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, var$2 = 0, i64toi32_i32$2 = 0, i64toi32_i32$3 = 0, var$3 = 0, var$4 = 0, var$5 = 0, $21_1 = 0, $22_1 = 0, var$6 = 0, $24_1 = 0, $17_1 = 0, $18_1 = 0, $23_1 = 0, $29_1 = 0, $45_1 = 0, $56$hi = 0, $62$hi = 0;
  i64toi32_i32$0 = var$1$hi;
  var$2 = var$1;
  var$4 = var$2 >>> 16 | 0;
  i64toi32_i32$0 = var$0$hi;
  var$3 = var$0;
  var$5 = var$3 >>> 16 | 0;
  $17_1 = Math_imul(var$4, var$5);
  $18_1 = var$2;
  i64toi32_i32$2 = var$3;
  i64toi32_i32$1 = 0;
  i64toi32_i32$3 = 32;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$1 = 0;
   $21_1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
  } else {
   i64toi32_i32$1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
   $21_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$2 >>> i64toi32_i32$4 | 0) | 0;
  }
  $23_1 = $17_1 + Math_imul($18_1, $21_1) | 0;
  i64toi32_i32$1 = var$1$hi;
  i64toi32_i32$0 = var$1;
  i64toi32_i32$2 = 0;
  i64toi32_i32$3 = 32;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$2 = 0;
   $22_1 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
  } else {
   i64toi32_i32$2 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
   $22_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$1 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$0 >>> i64toi32_i32$4 | 0) | 0;
  }
  $29_1 = $23_1 + Math_imul($22_1, var$3) | 0;
  var$2 = var$2 & 65535 | 0;
  var$3 = var$3 & 65535 | 0;
  var$6 = Math_imul(var$2, var$3);
  var$2 = (var$6 >>> 16 | 0) + Math_imul(var$2, var$5) | 0;
  $45_1 = $29_1 + (var$2 >>> 16 | 0) | 0;
  var$2 = (var$2 & 65535 | 0) + Math_imul(var$4, var$3) | 0;
  i64toi32_i32$2 = 0;
  i64toi32_i32$1 = $45_1 + (var$2 >>> 16 | 0) | 0;
  i64toi32_i32$0 = 0;
  i64toi32_i32$3 = 32;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$0 = i64toi32_i32$1 << i64toi32_i32$4 | 0;
   $24_1 = 0;
  } else {
   i64toi32_i32$0 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$1 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$2 << i64toi32_i32$4 | 0) | 0;
   $24_1 = i64toi32_i32$1 << i64toi32_i32$4 | 0;
  }
  $56$hi = i64toi32_i32$0;
  i64toi32_i32$0 = 0;
  $62$hi = i64toi32_i32$0;
  i64toi32_i32$0 = $56$hi;
  i64toi32_i32$2 = $24_1;
  i64toi32_i32$1 = $62$hi;
  i64toi32_i32$3 = var$2 << 16 | 0 | (var$6 & 65535 | 0) | 0;
  i64toi32_i32$1 = i64toi32_i32$0 | i64toi32_i32$1 | 0;
  i64toi32_i32$2 = i64toi32_i32$2 | i64toi32_i32$3 | 0;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$1;
  return i64toi32_i32$2 | 0;
 }
 
 function _ZN17compiler_builtins3int4udiv10divmod_u6417h6026910b5ed08e40E(var$0, var$0$hi, var$1, var$1$hi) {
  var$0 = var$0 | 0;
  var$0$hi = var$0$hi | 0;
  var$1 = var$1 | 0;
  var$1$hi = var$1$hi | 0;
  var i64toi32_i32$2 = 0, i64toi32_i32$3 = 0, i64toi32_i32$4 = 0, i64toi32_i32$1 = 0, i64toi32_i32$0 = 0, i64toi32_i32$5 = 0, var$2 = 0, var$3 = 0, var$4 = 0, var$5 = 0, var$5$hi = 0, var$6 = 0, var$6$hi = 0, i64toi32_i32$6 = 0, $37_1 = 0, $38_1 = 0, $39_1 = 0, $40_1 = 0, $41_1 = 0, $42_1 = 0, $43_1 = 0, $44_1 = 0, var$8$hi = 0, $45_1 = 0, $46_1 = 0, $47_1 = 0, $48_1 = 0, var$7$hi = 0, $49_1 = 0, $63$hi = 0, $65_1 = 0, $65$hi = 0, $120$hi = 0, $129$hi = 0, $134$hi = 0, var$8 = 0, $140_1 = 0, $140$hi = 0, $142$hi = 0, $144_1 = 0, $144$hi = 0, $151_1 = 0, $151$hi = 0, $154$hi = 0, var$7 = 0, $165$hi = 0;
  label$1 : {
   label$2 : {
    label$3 : {
     label$4 : {
      label$5 : {
       label$6 : {
        label$7 : {
         label$8 : {
          label$9 : {
           label$10 : {
            label$11 : {
             i64toi32_i32$0 = var$0$hi;
             i64toi32_i32$2 = var$0;
             i64toi32_i32$1 = 0;
             i64toi32_i32$3 = 32;
             i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
             if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
              i64toi32_i32$1 = 0;
              $37_1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
             } else {
              i64toi32_i32$1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
              $37_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$2 >>> i64toi32_i32$4 | 0) | 0;
             }
             var$2 = $37_1;
             if (var$2) {
              i64toi32_i32$1 = var$1$hi;
              var$3 = var$1;
              if (!var$3) {
               break label$11
              }
              i64toi32_i32$0 = var$3;
              i64toi32_i32$2 = 0;
              i64toi32_i32$3 = 32;
              i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
              if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
               i64toi32_i32$2 = 0;
               $38_1 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
              } else {
               i64toi32_i32$2 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
               $38_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$1 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$0 >>> i64toi32_i32$4 | 0) | 0;
              }
              var$4 = $38_1;
              if (!var$4) {
               break label$9
              }
              var$2 = Math_clz32(var$4) - Math_clz32(var$2) | 0;
              if (var$2 >>> 0 <= 31 >>> 0) {
               break label$8
              }
              break label$2;
             }
             i64toi32_i32$2 = var$1$hi;
             i64toi32_i32$1 = var$1;
             i64toi32_i32$0 = 1;
             i64toi32_i32$3 = 0;
             if (i64toi32_i32$2 >>> 0 > i64toi32_i32$0 >>> 0 | ((i64toi32_i32$2 | 0) == (i64toi32_i32$0 | 0) & i64toi32_i32$1 >>> 0 >= i64toi32_i32$3 >>> 0 | 0) | 0) {
              break label$2
             }
             i64toi32_i32$1 = var$0$hi;
             var$2 = var$0;
             i64toi32_i32$1 = i64toi32_i32$2;
             i64toi32_i32$1 = i64toi32_i32$2;
             var$3 = var$1;
             var$2 = (var$2 >>> 0) / (var$3 >>> 0) | 0;
             i64toi32_i32$1 = 0;
             __wasm_intrinsics_temp_i64 = var$0 - Math_imul(var$2, var$3) | 0;
             __wasm_intrinsics_temp_i64$hi = i64toi32_i32$1;
             i64toi32_i32$1 = 0;
             i64toi32_i32$2 = var$2;
             i64toi32_i32$HIGH_BITS = i64toi32_i32$1;
             return i64toi32_i32$2 | 0;
            }
            i64toi32_i32$2 = var$1$hi;
            i64toi32_i32$3 = var$1;
            i64toi32_i32$1 = 0;
            i64toi32_i32$0 = 32;
            i64toi32_i32$4 = i64toi32_i32$0 & 31 | 0;
            if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
             i64toi32_i32$1 = 0;
             $39_1 = i64toi32_i32$2 >>> i64toi32_i32$4 | 0;
            } else {
             i64toi32_i32$1 = i64toi32_i32$2 >>> i64toi32_i32$4 | 0;
             $39_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$2 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$3 >>> i64toi32_i32$4 | 0) | 0;
            }
            var$3 = $39_1;
            i64toi32_i32$1 = var$0$hi;
            if (!var$0) {
             break label$7
            }
            if (!var$3) {
             break label$6
            }
            var$4 = var$3 + -1 | 0;
            if (var$4 & var$3 | 0) {
             break label$6
            }
            i64toi32_i32$1 = 0;
            i64toi32_i32$2 = var$4 & var$2 | 0;
            i64toi32_i32$3 = 0;
            i64toi32_i32$0 = 32;
            i64toi32_i32$4 = i64toi32_i32$0 & 31 | 0;
            if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
             i64toi32_i32$3 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
             $40_1 = 0;
            } else {
             i64toi32_i32$3 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$1 << i64toi32_i32$4 | 0) | 0;
             $40_1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
            }
            $63$hi = i64toi32_i32$3;
            i64toi32_i32$3 = var$0$hi;
            i64toi32_i32$1 = var$0;
            i64toi32_i32$2 = 0;
            i64toi32_i32$0 = -1;
            i64toi32_i32$2 = i64toi32_i32$3 & i64toi32_i32$2 | 0;
            $65_1 = i64toi32_i32$1 & i64toi32_i32$0 | 0;
            $65$hi = i64toi32_i32$2;
            i64toi32_i32$2 = $63$hi;
            i64toi32_i32$3 = $40_1;
            i64toi32_i32$1 = $65$hi;
            i64toi32_i32$0 = $65_1;
            i64toi32_i32$1 = i64toi32_i32$2 | i64toi32_i32$1 | 0;
            __wasm_intrinsics_temp_i64 = i64toi32_i32$3 | i64toi32_i32$0 | 0;
            __wasm_intrinsics_temp_i64$hi = i64toi32_i32$1;
            i64toi32_i32$1 = 0;
            i64toi32_i32$3 = var$2 >>> ((__wasm_ctz_i32(var$3 | 0) | 0) & 31 | 0) | 0;
            i64toi32_i32$HIGH_BITS = i64toi32_i32$1;
            return i64toi32_i32$3 | 0;
           }
          }
          var$4 = var$3 + -1 | 0;
          if (!(var$4 & var$3 | 0)) {
           break label$5
          }
          var$2 = (Math_clz32(var$3) + 33 | 0) - Math_clz32(var$2) | 0;
          var$3 = 0 - var$2 | 0;
          break label$3;
         }
         var$3 = 63 - var$2 | 0;
         var$2 = var$2 + 1 | 0;
         break label$3;
        }
        var$4 = (var$2 >>> 0) / (var$3 >>> 0) | 0;
        i64toi32_i32$3 = 0;
        i64toi32_i32$2 = var$2 - Math_imul(var$4, var$3) | 0;
        i64toi32_i32$1 = 0;
        i64toi32_i32$0 = 32;
        i64toi32_i32$4 = i64toi32_i32$0 & 31 | 0;
        if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
         i64toi32_i32$1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
         $41_1 = 0;
        } else {
         i64toi32_i32$1 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$3 << i64toi32_i32$4 | 0) | 0;
         $41_1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
        }
        __wasm_intrinsics_temp_i64 = $41_1;
        __wasm_intrinsics_temp_i64$hi = i64toi32_i32$1;
        i64toi32_i32$1 = 0;
        i64toi32_i32$2 = var$4;
        i64toi32_i32$HIGH_BITS = i64toi32_i32$1;
        return i64toi32_i32$2 | 0;
       }
       var$2 = Math_clz32(var$3) - Math_clz32(var$2) | 0;
       if (var$2 >>> 0 < 31 >>> 0) {
        break label$4
       }
       break label$2;
      }
      i64toi32_i32$2 = var$0$hi;
      i64toi32_i32$2 = 0;
      __wasm_intrinsics_temp_i64 = var$4 & var$0 | 0;
      __wasm_intrinsics_temp_i64$hi = i64toi32_i32$2;
      if ((var$3 | 0) == (1 | 0)) {
       break label$1
      }
      i64toi32_i32$2 = var$0$hi;
      i64toi32_i32$2 = 0;
      $120$hi = i64toi32_i32$2;
      i64toi32_i32$2 = var$0$hi;
      i64toi32_i32$3 = var$0;
      i64toi32_i32$1 = $120$hi;
      i64toi32_i32$0 = __wasm_ctz_i32(var$3 | 0) | 0;
      i64toi32_i32$4 = i64toi32_i32$0 & 31 | 0;
      if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
       i64toi32_i32$1 = 0;
       $42_1 = i64toi32_i32$2 >>> i64toi32_i32$4 | 0;
      } else {
       i64toi32_i32$1 = i64toi32_i32$2 >>> i64toi32_i32$4 | 0;
       $42_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$2 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$3 >>> i64toi32_i32$4 | 0) | 0;
      }
      i64toi32_i32$3 = $42_1;
      i64toi32_i32$HIGH_BITS = i64toi32_i32$1;
      return i64toi32_i32$3 | 0;
     }
     var$3 = 63 - var$2 | 0;
     var$2 = var$2 + 1 | 0;
    }
    i64toi32_i32$3 = var$0$hi;
    i64toi32_i32$3 = 0;
    $129$hi = i64toi32_i32$3;
    i64toi32_i32$3 = var$0$hi;
    i64toi32_i32$2 = var$0;
    i64toi32_i32$1 = $129$hi;
    i64toi32_i32$0 = var$2 & 63 | 0;
    i64toi32_i32$4 = i64toi32_i32$0 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
     i64toi32_i32$1 = 0;
     $43_1 = i64toi32_i32$3 >>> i64toi32_i32$4 | 0;
    } else {
     i64toi32_i32$1 = i64toi32_i32$3 >>> i64toi32_i32$4 | 0;
     $43_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$3 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$2 >>> i64toi32_i32$4 | 0) | 0;
    }
    var$5 = $43_1;
    var$5$hi = i64toi32_i32$1;
    i64toi32_i32$1 = var$0$hi;
    i64toi32_i32$1 = 0;
    $134$hi = i64toi32_i32$1;
    i64toi32_i32$1 = var$0$hi;
    i64toi32_i32$3 = var$0;
    i64toi32_i32$2 = $134$hi;
    i64toi32_i32$0 = var$3 & 63 | 0;
    i64toi32_i32$4 = i64toi32_i32$0 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
     i64toi32_i32$2 = i64toi32_i32$3 << i64toi32_i32$4 | 0;
     $44_1 = 0;
    } else {
     i64toi32_i32$2 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$3 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$1 << i64toi32_i32$4 | 0) | 0;
     $44_1 = i64toi32_i32$3 << i64toi32_i32$4 | 0;
    }
    var$0 = $44_1;
    var$0$hi = i64toi32_i32$2;
    label$13 : {
     if (var$2) {
      i64toi32_i32$2 = var$1$hi;
      i64toi32_i32$1 = var$1;
      i64toi32_i32$3 = -1;
      i64toi32_i32$0 = -1;
      i64toi32_i32$4 = i64toi32_i32$1 + i64toi32_i32$0 | 0;
      i64toi32_i32$5 = i64toi32_i32$2 + i64toi32_i32$3 | 0;
      if (i64toi32_i32$4 >>> 0 < i64toi32_i32$0 >>> 0) {
       i64toi32_i32$5 = i64toi32_i32$5 + 1 | 0
      }
      var$8 = i64toi32_i32$4;
      var$8$hi = i64toi32_i32$5;
      label$15 : while (1) {
       i64toi32_i32$5 = var$5$hi;
       i64toi32_i32$2 = var$5;
       i64toi32_i32$1 = 0;
       i64toi32_i32$0 = 1;
       i64toi32_i32$3 = i64toi32_i32$0 & 31 | 0;
       if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
        i64toi32_i32$1 = i64toi32_i32$2 << i64toi32_i32$3 | 0;
        $45_1 = 0;
       } else {
        i64toi32_i32$1 = ((1 << i64toi32_i32$3 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$3 | 0) | 0) | 0 | (i64toi32_i32$5 << i64toi32_i32$3 | 0) | 0;
        $45_1 = i64toi32_i32$2 << i64toi32_i32$3 | 0;
       }
       $140_1 = $45_1;
       $140$hi = i64toi32_i32$1;
       i64toi32_i32$1 = var$0$hi;
       i64toi32_i32$5 = var$0;
       i64toi32_i32$2 = 0;
       i64toi32_i32$0 = 63;
       i64toi32_i32$3 = i64toi32_i32$0 & 31 | 0;
       if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
        i64toi32_i32$2 = 0;
        $46_1 = i64toi32_i32$1 >>> i64toi32_i32$3 | 0;
       } else {
        i64toi32_i32$2 = i64toi32_i32$1 >>> i64toi32_i32$3 | 0;
        $46_1 = (((1 << i64toi32_i32$3 | 0) - 1 | 0) & i64toi32_i32$1 | 0) << (32 - i64toi32_i32$3 | 0) | 0 | (i64toi32_i32$5 >>> i64toi32_i32$3 | 0) | 0;
       }
       $142$hi = i64toi32_i32$2;
       i64toi32_i32$2 = $140$hi;
       i64toi32_i32$1 = $140_1;
       i64toi32_i32$5 = $142$hi;
       i64toi32_i32$0 = $46_1;
       i64toi32_i32$5 = i64toi32_i32$2 | i64toi32_i32$5 | 0;
       var$5 = i64toi32_i32$1 | i64toi32_i32$0 | 0;
       var$5$hi = i64toi32_i32$5;
       $144_1 = var$5;
       $144$hi = i64toi32_i32$5;
       i64toi32_i32$5 = var$8$hi;
       i64toi32_i32$5 = var$5$hi;
       i64toi32_i32$5 = var$8$hi;
       i64toi32_i32$2 = var$8;
       i64toi32_i32$1 = var$5$hi;
       i64toi32_i32$0 = var$5;
       i64toi32_i32$3 = i64toi32_i32$2 - i64toi32_i32$0 | 0;
       i64toi32_i32$6 = i64toi32_i32$2 >>> 0 < i64toi32_i32$0 >>> 0;
       i64toi32_i32$4 = i64toi32_i32$6 + i64toi32_i32$1 | 0;
       i64toi32_i32$4 = i64toi32_i32$5 - i64toi32_i32$4 | 0;
       i64toi32_i32$5 = i64toi32_i32$3;
       i64toi32_i32$2 = 0;
       i64toi32_i32$0 = 63;
       i64toi32_i32$1 = i64toi32_i32$0 & 31 | 0;
       if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
        i64toi32_i32$2 = i64toi32_i32$4 >> 31 | 0;
        $47_1 = i64toi32_i32$4 >> i64toi32_i32$1 | 0;
       } else {
        i64toi32_i32$2 = i64toi32_i32$4 >> i64toi32_i32$1 | 0;
        $47_1 = (((1 << i64toi32_i32$1 | 0) - 1 | 0) & i64toi32_i32$4 | 0) << (32 - i64toi32_i32$1 | 0) | 0 | (i64toi32_i32$5 >>> i64toi32_i32$1 | 0) | 0;
       }
       var$6 = $47_1;
       var$6$hi = i64toi32_i32$2;
       i64toi32_i32$2 = var$1$hi;
       i64toi32_i32$2 = var$6$hi;
       i64toi32_i32$4 = var$6;
       i64toi32_i32$5 = var$1$hi;
       i64toi32_i32$0 = var$1;
       i64toi32_i32$5 = i64toi32_i32$2 & i64toi32_i32$5 | 0;
       $151_1 = i64toi32_i32$4 & i64toi32_i32$0 | 0;
       $151$hi = i64toi32_i32$5;
       i64toi32_i32$5 = $144$hi;
       i64toi32_i32$2 = $144_1;
       i64toi32_i32$4 = $151$hi;
       i64toi32_i32$0 = $151_1;
       i64toi32_i32$1 = i64toi32_i32$2 - i64toi32_i32$0 | 0;
       i64toi32_i32$6 = i64toi32_i32$2 >>> 0 < i64toi32_i32$0 >>> 0;
       i64toi32_i32$3 = i64toi32_i32$6 + i64toi32_i32$4 | 0;
       i64toi32_i32$3 = i64toi32_i32$5 - i64toi32_i32$3 | 0;
       var$5 = i64toi32_i32$1;
       var$5$hi = i64toi32_i32$3;
       i64toi32_i32$3 = var$0$hi;
       i64toi32_i32$5 = var$0;
       i64toi32_i32$2 = 0;
       i64toi32_i32$0 = 1;
       i64toi32_i32$4 = i64toi32_i32$0 & 31 | 0;
       if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
        i64toi32_i32$2 = i64toi32_i32$5 << i64toi32_i32$4 | 0;
        $48_1 = 0;
       } else {
        i64toi32_i32$2 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$5 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$3 << i64toi32_i32$4 | 0) | 0;
        $48_1 = i64toi32_i32$5 << i64toi32_i32$4 | 0;
       }
       $154$hi = i64toi32_i32$2;
       i64toi32_i32$2 = var$7$hi;
       i64toi32_i32$2 = $154$hi;
       i64toi32_i32$3 = $48_1;
       i64toi32_i32$5 = var$7$hi;
       i64toi32_i32$0 = var$7;
       i64toi32_i32$5 = i64toi32_i32$2 | i64toi32_i32$5 | 0;
       var$0 = i64toi32_i32$3 | i64toi32_i32$0 | 0;
       var$0$hi = i64toi32_i32$5;
       i64toi32_i32$5 = var$6$hi;
       i64toi32_i32$2 = var$6;
       i64toi32_i32$3 = 0;
       i64toi32_i32$0 = 1;
       i64toi32_i32$3 = i64toi32_i32$5 & i64toi32_i32$3 | 0;
       var$6 = i64toi32_i32$2 & i64toi32_i32$0 | 0;
       var$6$hi = i64toi32_i32$3;
       var$7 = var$6;
       var$7$hi = i64toi32_i32$3;
       var$2 = var$2 + -1 | 0;
       if (var$2) {
        continue label$15
       }
       break label$15;
      };
      break label$13;
     }
    }
    i64toi32_i32$3 = var$5$hi;
    __wasm_intrinsics_temp_i64 = var$5;
    __wasm_intrinsics_temp_i64$hi = i64toi32_i32$3;
    i64toi32_i32$3 = var$0$hi;
    i64toi32_i32$5 = var$0;
    i64toi32_i32$2 = 0;
    i64toi32_i32$0 = 1;
    i64toi32_i32$4 = i64toi32_i32$0 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
     i64toi32_i32$2 = i64toi32_i32$5 << i64toi32_i32$4 | 0;
     $49_1 = 0;
    } else {
     i64toi32_i32$2 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$5 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$3 << i64toi32_i32$4 | 0) | 0;
     $49_1 = i64toi32_i32$5 << i64toi32_i32$4 | 0;
    }
    $165$hi = i64toi32_i32$2;
    i64toi32_i32$2 = var$6$hi;
    i64toi32_i32$2 = $165$hi;
    i64toi32_i32$3 = $49_1;
    i64toi32_i32$5 = var$6$hi;
    i64toi32_i32$0 = var$6;
    i64toi32_i32$5 = i64toi32_i32$2 | i64toi32_i32$5 | 0;
    i64toi32_i32$3 = i64toi32_i32$3 | i64toi32_i32$0 | 0;
    i64toi32_i32$HIGH_BITS = i64toi32_i32$5;
    return i64toi32_i32$3 | 0;
   }
   i64toi32_i32$3 = var$0$hi;
   __wasm_intrinsics_temp_i64 = var$0;
   __wasm_intrinsics_temp_i64$hi = i64toi32_i32$3;
   i64toi32_i32$3 = 0;
   var$0 = 0;
   var$0$hi = i64toi32_i32$3;
  }
  i64toi32_i32$3 = var$0$hi;
  i64toi32_i32$5 = var$0;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$3;
  return i64toi32_i32$5 | 0;
 }
 
 function __wasm_ctz_i32(var$0) {
  var$0 = var$0 | 0;
  if (var$0) {
   return 31 - Math_clz32((var$0 + -1 | 0) ^ var$0 | 0) | 0 | 0
  }
  return 32 | 0;
 }
 
 function __wasm_i64_mul(var$0, var$0$hi, var$1, var$1$hi) {
  var$0 = var$0 | 0;
  var$0$hi = var$0$hi | 0;
  var$1 = var$1 | 0;
  var$1$hi = var$1$hi | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$1 = 0;
  i64toi32_i32$0 = var$0$hi;
  i64toi32_i32$0 = var$1$hi;
  i64toi32_i32$0 = var$0$hi;
  i64toi32_i32$1 = var$1$hi;
  i64toi32_i32$1 = _ZN17compiler_builtins3int3mul3Mul3mul17h070e9a1c69faec5bE(var$0 | 0, i64toi32_i32$0 | 0, var$1 | 0, i64toi32_i32$1 | 0) | 0;
  i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$0;
  return i64toi32_i32$1 | 0;
 }
 
 function __wasm_i64_udiv(var$0, var$0$hi, var$1, var$1$hi) {
  var$0 = var$0 | 0;
  var$0$hi = var$0$hi | 0;
  var$1 = var$1 | 0;
  var$1$hi = var$1$hi | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$1 = 0;
  i64toi32_i32$0 = var$0$hi;
  i64toi32_i32$0 = var$1$hi;
  i64toi32_i32$0 = var$0$hi;
  i64toi32_i32$1 = var$1$hi;
  i64toi32_i32$1 = _ZN17compiler_builtins3int4udiv10divmod_u6417h6026910b5ed08e40E(var$0 | 0, i64toi32_i32$0 | 0, var$1 | 0, i64toi32_i32$1 | 0) | 0;
  i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$0;
  return i64toi32_i32$1 | 0;
 }
 
 function __wasm_rotl_i32(var$0, var$1) {
  var$0 = var$0 | 0;
  var$1 = var$1 | 0;
  var var$2 = 0;
  var$2 = var$1 & 31 | 0;
  var$1 = (0 - var$1 | 0) & 31 | 0;
  return ((-1 >>> var$2 | 0) & var$0 | 0) << var$2 | 0 | (((-1 << var$1 | 0) & var$0 | 0) >>> var$1 | 0) | 0 | 0;
 }
 
 function __wasm_rotr_i32(var$0, var$1) {
  var$0 = var$0 | 0;
  var$1 = var$1 | 0;
  var var$2 = 0;
  var$2 = var$1 & 31 | 0;
  var$1 = (0 - var$1 | 0) & 31 | 0;
  return ((-1 << var$2 | 0) & var$0 | 0) >>> var$2 | 0 | (((-1 >>> var$1 | 0) & var$0 | 0) << var$1 | 0) | 0 | 0;
 }
 
 // EMSCRIPTEN_END_FUNCS
;
 bufferView = HEAPU8;
 initActiveSegments(imports);
 var FUNCTION_TABLE = Table([null, $35, $36, $37, $39, $38, $40, $110, $111, $112, $113, $137, $138, $139, $141]);
 function __wasm_memory_size() {
  return buffer.byteLength >> 16;
 }
 
 function __wasm_memory_grow(pagesToAdd) {
  pagesToAdd = pagesToAdd | 0;
  var oldPages = __wasm_memory_size() | 0;
  var newPages = oldPages + pagesToAdd | 0;
  if ((oldPages < newPages) && (newPages < 65536) && (newPages <= 32768)) {
   var newBuffer = new ArrayBuffer(newPages << 16);
   var newHEAP8 = new Int8Array(newBuffer);
   newHEAP8.set(HEAP8);
   HEAP8 = new Int8Array(newBuffer);
   HEAP16 = new Int16Array(newBuffer);
   HEAP32 = new Int32Array(newBuffer);
   HEAPU8 = new Uint8Array(newBuffer);
   HEAPU16 = new Uint16Array(newBuffer);
   HEAPU32 = new Uint32Array(newBuffer);
   HEAPF32 = new Float32Array(newBuffer);
   HEAPF64 = new Float64Array(newBuffer);
   buffer = newBuffer;
   bufferView = HEAPU8;
  }
  return oldPages;
 }
 
 return {
  "memory": Object.create(Object.prototype, {
   "grow": {
    "value": __wasm_memory_grow
   }, 
   "buffer": {
    "get": function () {
     return buffer;
    }
    
   }
  }), 
  "__wasm_call_ctors": $0, 
  "malloc": $182, 
  "free": $184, 
  "__indirect_function_table": FUNCTION_TABLE, 
  "mid_song_start": $41, 
  "mid_song_seek": $46, 
  "mid_song_get_total_time": $47, 
  "mid_song_get_time": $48, 
  "mid_song_read_wave": $49, 
  "mid_song_set_volume": $66, 
  "mid_note_on": $67, 
  "mid_note_off": $70, 
  "mid_send_event": $71, 
  "mid_song_resend_active_notes": $72, 
  "mid_song_get_controller_value_at_tick": $73, 
  "mid_istream_seek": $115, 
  "mid_init_no_config": $85, 
  "mid_exit": $87, 
  "mid_init": $88, 
  "mid_song_load": $92, 
  "mid_song_free": $94, 
  "mid_song_create": $95, 
  "mid_song_set_event_callback": $96, 
  "mid_set_debug_msg_callback": $97, 
  "mid_get_version": $98, 
  "mid_song_get_patch_names": $99, 
  "mid_song_get_required_patches": $101, 
  "mid_song_get_current_tick": $102, 
  "mid_song_load_program": $103, 
  "mid_dlspatches_load": $104, 
  "mid_dlspatches_free": $105, 
  "mid_song_load_dls": $106, 
  "mid_istream_open_mem": $109, 
  "mid_istream_close": $118, 
  "fflush": $133, 
  "emscripten_stack_get_end": $200, 
  "emscripten_stack_get_base": $199, 
  "strerror": $205, 
  "__get_temp_ret": $203, 
  "__set_temp_ret": $202, 
  "emscripten_stack_init": $197, 
  "emscripten_stack_get_free": $198, 
  "_emscripten_stack_restore": $206, 
  "_emscripten_stack_alloc": $207, 
  "emscripten_stack_get_current": $208, 
  "dynCall_jiji": $210
 };
}

  return asmFunc(info);
}

)(info);
  },

  instantiate: /** @suppress{checkTypes} */ function(binary, info) {
    return {
      then: function(ok) {
        var module = new WebAssembly.Module(binary);
        ok({
          'instance': new WebAssembly.Instance(module, info)
        });
        // Emulate a simple WebAssembly.instantiate(..).then(()=>{}).catch(()=>{}) syntax.
        return { catch: function() {} };
      }
    };
  },

  RuntimeError: Error,

  isWasm2js: true,
};
// end include: wasm2js.js

if (WebAssembly.isWasm2js) {
  // We don't need to actually download a wasm binary, mark it as present but
  // empty.
  wasmBinary = [];
}

if (!globalThis.WebAssembly) {
  err('no native wasm support detected');
}

// Wasm globals

//========================================
// Runtime essentials
//========================================

// whether we are quitting the application. no code should run after this.
// set in exit() and abort()
var ABORT = false;

// set by exit() and abort().  Passed to 'onExit' handler.
// NOTE: This is also used as the process return code in shell environments
// but only when noExitRuntime is false.
var EXITSTATUS;

// In STRICT mode, we only define assert() when ASSERTIONS is set.  i.e. we
// don't define it at all in release modes.  This matches the behaviour of
// MINIMAL_RUNTIME.
// TODO(sbc): Make this the default even without STRICT enabled.
/** @type {function(*, string=)} */
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed' + (text ? ': ' + text : ''));
  }
}

// We used to include malloc/free by default in the past. Show a helpful error in
// builds with assertions.

/**
 * Indicates whether filename is delivered via file protocol (as opposed to http/https)
 * @noinline
 */
var isFileURI = (filename) => filename.startsWith('file://');

// include: runtime_common.js
// include: runtime_exceptions.js
// Base Emscripten EH error class
class EmscriptenEH {}

class EmscriptenSjLj extends EmscriptenEH {}

// end include: runtime_exceptions.js
// include: runtime_debug.js
var runtimeDebug = true; // Switch to false at runtime to disable logging at the right times

// Used by XXXXX_DEBUG settings to output debug messages.
function dbg(...args) {
  if (!runtimeDebug && typeof runtimeDebug != 'undefined') return;
  // TODO(sbc): Make this configurable somehow.  Its not always convenient for
  // logging to show up as warnings.
  console.warn(...args);
}

// Endianness check
(() => {
  var h16 = new Int16Array(1);
  var h8 = new Int8Array(h16.buffer);
  h16[0] = 0x6373;
  if (h8[0] !== 0x73 || h8[1] !== 0x63) abort('Runtime error: expected the system to be little-endian! (Run with -sSUPPORT_BIG_ENDIAN to bypass)');
})();

function consumedModuleProp(prop) {
  var value = Module[prop];
  var msg = `Attempt to modify \`Module.${prop}\` after it has already been processed.  This can happen, for example, when code is injected via '--post-js' rather than '--pre-js'`;
  if (Array.isArray(value)) {
    value = new Proxy(value, {
      set(target, key, val) {
        abort(msg);
        return false;
      },
      defineProperty(target, key, descriptor) {
        abort(msg);
        return false;
      },
      deleteProperty(target, key) {
        abort(msg);
        return false;
      }
    });
  }
  Object.defineProperty(Module, prop, {
    configurable: true,
    get() { return value; },
    set() {
      abort(msg);
    }
  });
}

function makeInvalidEarlyAccess(name) {
  return () => assert(false, `call to '${name}' via reference taken before Wasm module initialization`);

}

function ignoredModuleProp(prop) {
  if (Object.getOwnPropertyDescriptor(Module, prop)) {
    abort(`\`Module.${prop}\` was supplied but \`${prop}\` not included in INCOMING_MODULE_JS_API`);
  }
}

// forcing the filesystem exports a few things by default
function isExportedByForceFilesystem(name) {
  return name === 'FS_createPath' ||
         name === 'FS_createDataFile' ||
         name === 'FS_createPreloadedFile' ||
         name === 'FS_preloadFile' ||
         name === 'FS_unlink' ||
         name === 'addRunDependency' ||
         // The old FS has some functionality that WasmFS lacks.
         name === 'FS_createLazyFile' ||
         name === 'FS_createDevice' ||
         name === 'removeRunDependency';
}

/**
 * Intercept access to a symbols in the global symbol.  This enables us to give
 * informative warnings/errors when folks attempt to use symbols they did not
 * include in their build, or no symbols that no longer exist.
 *
 * We don't define this in MODULARIZE mode since in that mode emscripten symbols
 * are never placed in the global scope.
 */
function hookGlobalSymbolAccess(sym, func) {
  if (!Object.getOwnPropertyDescriptor(globalThis, sym)) {
    Object.defineProperty(globalThis, sym, {
      configurable: true,
      get() {
        func();
        return undefined;
      }
    });
  }
}

function missingGlobal(sym, msg) {
  hookGlobalSymbolAccess(sym, () => {
    warnOnce(`\`${sym}\` is no longer defined by emscripten. ${msg}`);
  });
}

missingGlobal('buffer', 'Please use HEAP8.buffer or wasmMemory.buffer');
missingGlobal('asm', 'Please use wasmExports instead');

function missingLibrarySymbol(sym) {
  hookGlobalSymbolAccess(sym, () => {
    // Can't `abort()` here because it would break code that does runtime
    // checks.  e.g. `if (typeof SDL === 'undefined')`.
    var msg = `\`${sym}\` is a library symbol and not included by default; add it to your library.js __deps or to DEFAULT_LIBRARY_FUNCS_TO_INCLUDE on the command line`;
    // DEFAULT_LIBRARY_FUNCS_TO_INCLUDE requires the name as it appears in
    // library.js, which means $name for a JS name with no prefix, or name
    // for a JS name like _name.
    var librarySymbol = sym;
    if (!librarySymbol.startsWith('_')) {
      librarySymbol = '$' + sym;
    }
    msg += ` (e.g. -sDEFAULT_LIBRARY_FUNCS_TO_INCLUDE='${librarySymbol}')`;
    if (isExportedByForceFilesystem(sym)) {
      msg += '. Alternatively, forcing filesystem support (-sFORCE_FILESYSTEM) can export this for you';
    }
    warnOnce(msg);
  });

  // Any symbol that is not included from the JS library is also (by definition)
  // not exported on the Module object.
  unexportedRuntimeSymbol(sym);
}

function unexportedRuntimeSymbol(sym) {
  if (!Object.getOwnPropertyDescriptor(Module, sym)) {
    Object.defineProperty(Module, sym, {
      configurable: true,
      get() {
        var msg = `'${sym}' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the Emscripten FAQ)`;
        if (isExportedByForceFilesystem(sym)) {
          msg += '. Alternatively, forcing filesystem support (-sFORCE_FILESYSTEM) can export this for you';
        }
        abort(msg);
      },
    });
  }
}

// end include: runtime_debug.js
// include: runtime_stack_check.js
const stackCookie1 = 0x02135467;
const stackCookie2 = 0x89BACDFE;

// Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.
function writeStackCookie() {
  var max = _emscripten_stack_get_end();
  assert((max & 3) == 0);
  // If the stack ends at address zero we write our cookies 4 bytes into the
  // stack.  This prevents interference with SAFE_HEAP and ASAN which also
  // monitor writes to address zero.
  if (max == 0) {
    max += 4;
  }
  // The stack grow downwards towards _emscripten_stack_get_end.
  // We write cookies to the final two words in the stack and detect if they are
  // ever overwritten.
  HEAPU32[((max)>>2)] = stackCookie1;
  HEAPU32[(((max)+(4))>>2)] = stackCookie2;
  // Also test the global address 0 for integrity.
  HEAPU32[((0)>>2)] = 1668509029;
}

function u32ToHexString(num) {
  return '0x' + (num >>> 0).toString(16).padStart(8, '0');
}

function checkStackCookie() {
  if (ABORT) return;
  var max = _emscripten_stack_get_end();
  // See writeStackCookie().
  if (max == 0) {
    max += 4;
  }
  var val1 = HEAPU32[((max)>>2)];
  var val2 = HEAPU32[(((max)+(4))>>2)];
  if (val1 != stackCookie1 || val2 != stackCookie2) {
    abort(`Stack overflow! Stack cookie has been overwritten at ${ptrToString(max)}, expected hex dwords ${u32ToHexString(stackCookie2)} and ${u32ToHexString(stackCookie1)}, but received ${u32ToHexString(val2)} ${u32ToHexString(val1)}`);
  }
  // Also test the global address 0 for integrity.
  if (HEAPU32[((0)>>2)] != 0x63736d65 /* 'emsc' */) {
    abort('Runtime error: The application has corrupted its heap memory area (address zero)!');
  }
}
// end include: runtime_stack_check.js
// Memory management

var runtimeInitialized = false;



// When ALLOW_MEMORY_GROWTH is enabled, the conversion from Wasm
// memory to ArrayBuffer requires some additional logic.
function getMemoryBuffer() {
  return wasmMemory.buffer;
}

function updateMemoryViews() {
  // If we already have a heap that is resizeable/growable buffer we don't
  // need to do anything in updateMemoryViews.
  if (HEAP8?.buffer?.resizable) return;
  var b = getMemoryBuffer();
  HEAP8 = new Int8Array(b);
  Module['HEAP16'] = HEAP16 = new Int16Array(b);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(b);
  
  Module['HEAP32'] = HEAP32 = new Int32Array(b);
  HEAPU32 = new Uint32Array(b);
  HEAPF32 = new Float32Array(b);
  HEAPF64 = new Float64Array(b);
}

// include: memoryprofiler.js
// end include: memoryprofiler.js
// end include: runtime_common.js
assert(globalThis.Int32Array && globalThis.Float64Array && Int32Array.prototype.subarray && Int32Array.prototype.set,
       'JS engine does not provide full typed array support');

function preRun() {
  var preRun = Module['preRun'];
  if (preRun) {
    if (typeof preRun == 'function') preRun = [preRun];
    onPreRuns.push(...preRun);
  }
  consumedModuleProp('preRun');
  // Begin ATPRERUNS hooks
  callRuntimeCallbacks(onPreRuns);
  // End ATPRERUNS hooks
}

function initRuntime() {
  assert(!runtimeInitialized);
  runtimeInitialized = true;

  checkStackCookie();

  // Begin ATINITS hooks
  if (!Module['noFSInit'] && !FS.initialized) FS.init();
TTY.init();
  // End ATINITS hooks

  wasmExports['__wasm_call_ctors']();

  // Begin ATPOSTCTORS hooks
  FS.ignorePermissions = false;
  // End ATPOSTCTORS hooks

  checkStackCookie();
}

function postRun() {
  checkStackCookie();

  var postRun = Module['postRun'];
  if (postRun) {
    if (typeof postRun == 'function') postRun = [postRun];
    onPostRuns.push(...postRun);
  }
  consumedModuleProp('postRun');

  // Begin ATPOSTRUNS hooks
  callRuntimeCallbacks(onPostRuns);
  // End ATPOSTRUNS hooks
}

/**
 * @param {string|number=} what
 */
function abort(what) {
  Module['onAbort']?.(what);

  what = `Aborted(${what})`;
  // TODO(sbc): Should we remove printing and leave it up to whoever
  // catches the exception?
  err(what);

  ABORT = true;

  // Use a wasm runtime error, because a JS error might be seen as a foreign
  // exception, which means we'd run destructors on it. We need the error to
  // simply make the program stop.
  // FIXME This approach does not work in Wasm EH because it currently does not assume
  // all RuntimeErrors are from traps; it decides whether a RuntimeError is from
  // a trap or not based on a hidden field within the object. So at the moment
  // we don't have a way of throwing a wasm trap from JS. TODO Make a JS API that
  // allows this in the wasm spec.

  // Suppress closure compiler warning here. Closure compiler's builtin extern
  // definition for WebAssembly.RuntimeError claims it takes no arguments even
  // though it can.
  // TODO(https://github.com/google/closure-compiler/pull/3913): Remove if/when upstream closure gets fixed.
  /** @suppress {checkTypes} */
  var e = new WebAssembly.RuntimeError(what);

  // Throw the error whether or not MODULARIZE is set because abort is used
  // in code paths apart from instantiation where an exception is expected
  // to be thrown when abort is called.
  throw e;
}

function createExportWrapper(name, func, nargs) {
  assert(func);
  return (...args) => {
    assert(runtimeInitialized, `native function \`${name}\` called before runtime initialization`);
    // Only assert for too many arguments. Too few can be valid since the missing arguments will be zero filled.
    assert(args.length <= nargs, `native function \`${name}\` called with ${args.length} args but expects ${nargs}`);
    return func(...args);
  };
}

var wasmBinaryFile;

// When building with wasm2js these 3 functions all no-ops.
function findWasmBinary(file) {}
function getBinarySync(file) {}
function getWasmBinary(file) {}

async function instantiateArrayBuffer(binaryFile, imports) {
  try {
    var binary = await getWasmBinary(binaryFile);
    var instance = await WebAssembly.instantiate(binary, imports);
    return instance;
  } catch (reason) {
    err(`failed to asynchronously prepare wasm: ${reason}`);

    // Warn on some common problems.
    if (isFileURI(binaryFile)) {
      err(`warning: Loading from a file URI (${binaryFile}) is not supported in most browsers. See https://emscripten.org/docs/getting_started/FAQ.html#how-do-i-run-a-local-webserver-for-testing-why-does-my-program-stall-in-downloading-or-preparing`);
    }
    abort(reason);
  }
}

async function instantiateAsync(binary, binaryFile, imports) {
  if (!binary
      // Don't use streaming for file:// delivered objects in a webview, fetch them synchronously.
      && !isFileURI(binaryFile)
      // Avoid instantiateStreaming() on Node.js environment for now, as while
      // Node.js v18.1.0 implements it, it does not have a full fetch()
      // implementation yet.
      //
      // Reference:
      //   https://github.com/emscripten-core/emscripten/pull/16917
      && !ENVIRONMENT_IS_NODE
     ) {
    try {
      var response = fetch(binaryFile, { credentials: 'same-origin' });
      var instantiationResult = await WebAssembly.instantiateStreaming(response, imports);
      return instantiationResult;
    } catch (reason) {
      // We expect the most common failure cause to be a bad MIME type for the binary,
      // in which case falling back to ArrayBuffer instantiation should work.
      err(`wasm streaming compile failed: ${reason}`);
      err('falling back to ArrayBuffer instantiation');
      // fall back of instantiateArrayBuffer below
    };
  }
  return instantiateArrayBuffer(binaryFile, imports);
}

function getWasmImports() {
  // prepare imports
  var imports = {
    'env': wasmImports,
    'wasi_snapshot_preview1': wasmImports,
  };
  return imports;
}

// Create the wasm instance.
// Receives the wasm imports, returns the exports.
async function createWasm() {
  // Load the wasm module and create an instance of using native support in the JS engine.
  // handle a generated wasm instance, receiving its exports and
  // performing other necessary setup
  function receiveInstance(instance) {
    wasmExports = instance.exports;

    assignWasmExports(wasmExports);

    updateMemoryViews();

    return wasmExports;
  }

  // Prefer streaming instantiation if available.
  // Async compilation can be confusing when an error on the page overwrites Module
  // (for example, if the order of elements is wrong, and the one defining Module is
  // later), so we save Module and check it later.
  var trueModule = Module;
  function receiveInstantiationResult(result) {
    // 'result' is a ResultObject object which has both the module and instance.
    // receiveInstance() will swap in the exports (to Module.asm) so they can be called
    assert(Module === trueModule, 'the Module object should not be replaced during async compilation - perhaps the order of HTML elements is wrong?');
    trueModule = null;
    // TODO: Due to Closure regression https://github.com/google/closure-compiler/issues/3193, the above line no longer optimizes out down to the following line.
    // When the regression is fixed, can restore the above PTHREADS-enabled path.
    return receiveInstance(result['instance']);
  }

  var info = getWasmImports();

  // User shell pages can write their own Module.instantiateWasm = function(imports, successCallback) callback
  // to manually instantiate the Wasm module themselves. This allows pages to
  // run the instantiation parallel to any other async startup actions they are
  // performing.
  // Also pthreads and wasm workers initialize the wasm instance through this
  // path.
  var instantiateWasm = Module['instantiateWasm'];
  if (instantiateWasm) {
    return new Promise((resolve) => {
      try {
        instantiateWasm(info, (inst) => resolve(receiveInstance(inst)));
      } catch(e) {
        err(`Module.instantiateWasm callback failed with error: ${e}`);
        throw e;
      }
    });
  }

  wasmBinaryFile ??= findWasmBinary();
  var result = await instantiateAsync(wasmBinary, wasmBinaryFile, info);
  var exports = receiveInstantiationResult(result);
  return exports;
}

// Globals used by JS i64 conversions (see makeSetValue)
var tempDouble;
var tempI64;

// end include: preamble.js

// Begin JS library code


  class ExitStatus {
      name = 'ExitStatus';
      constructor(status) {
        this.message = `Program terminated with exit(${status})`;
        this.status = status;
      }
    }

  /** @type {!Int32Array} */
  var HEAP32;

  /** @type {!Int8Array} */
  var HEAP8;

  /** @type {!Uint32Array} */
  var HEAPU32;

  var callRuntimeCallbacks = (callbacks) => {
      while (callbacks.length > 0) {
        // Pass the module as the first argument.
        callbacks.shift()(Module);
      }
    };
  var onPostRuns = [];
  var addOnPostRun = (cb) => onPostRuns.push(cb);

  var onPreRuns = [];
  var addOnPreRun = (cb) => onPreRuns.push(cb);


  var noExitRuntime = true;

  function ptrToString(ptr) {
      assert(typeof ptr === 'number', `ptrToString expects a number, got ${typeof ptr}`);
      // Convert to 32-bit unsigned value
      ptr >>>= 0;
      return '0x' + ptr.toString(16).padStart(8, '0');
    }

  var stackRestore = (val) => __emscripten_stack_restore(val);

  var stackSave = () => _emscripten_stack_get_current();

  var warnOnce = (text) => {
      warnOnce.shown ||= {};
      if (!warnOnce.shown[text]) {
        warnOnce.shown[text] = 1;
        if (ENVIRONMENT_IS_NODE) text = 'warning: ' + text;
        err(text);
      }
    };

  

  var syscallGetVarargI = () => {
      assert(SYSCALLS.varargs != undefined);
      // the `+` prepended here is necessary to convince the JSCompiler that varargs is indeed a number.
      var ret = HEAP32[((+SYSCALLS.varargs)>>2)];
      SYSCALLS.varargs += 4;
      return ret;
    };
  var syscallGetVarargP = syscallGetVarargI;
  
  
  var PATH = {
  isAbs:(path) => path.charAt(0) === '/',
  splitPath:(filename) => {
        var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
        return splitPathRe.exec(filename).slice(1);
      },
  normalizeArray:(parts, allowAboveRoot) => {
        // if the path tries to go above the root, `up` ends up > 0
        var up = 0;
        for (var i = parts.length - 1; i >= 0; i--) {
          var last = parts[i];
          if (last === '.') {
            parts.splice(i, 1);
          } else if (last === '..') {
            parts.splice(i, 1);
            up++;
          } else if (up) {
            parts.splice(i, 1);
            up--;
          }
        }
        // if the path is allowed to go above the root, restore leading ..s
        if (allowAboveRoot) {
          for (; up; up--) {
            parts.unshift('..');
          }
        }
        return parts;
      },
  normalize:(path) => {
        var isAbsolute = PATH.isAbs(path),
            trailingSlash = path.slice(-1) === '/';
        // Normalize the path
        path = PATH.normalizeArray(path.split('/').filter((p) => !!p), !isAbsolute).join('/');
        if (!path && !isAbsolute) {
          path = '.';
        }
        if (path && trailingSlash) {
          path += '/';
        }
        return (isAbsolute ? '/' : '') + path;
      },
  dirname:(path) => {
        var result = PATH.splitPath(path),
            root = result[0],
            dir = result[1];
        if (!root && !dir) {
          // No dirname whatsoever
          return '.';
        }
        if (dir) {
          // It has a dirname, strip trailing slash
          dir = dir.slice(0, -1);
        }
        return root + dir;
      },
  basename:(path) => path && path.match(/([^\/]+|\/)\/*$/)[1],
join:(...paths) => PATH.normalize(paths.join('/')),
join2:(l, r) => PATH.normalize(l + '/' + r),
};

var initRandomFill = () => {
    // This block is not needed on v19+ since crypto.getRandomValues is builtin
    if (ENVIRONMENT_IS_NODE) {
      var nodeCrypto = require('node:crypto');
      return (view) => (nodeCrypto.randomFillSync(view), 0);
    }

    return (view) => (crypto.getRandomValues(view), 0);
  };
var randomFill = (view) => (randomFill = initRandomFill())(view);



var PATH_FS = {
resolve:(...args) => {
      var resolvedPath = '',
        resolvedAbsolute = false;
      for (var i = args.length - 1; i >= -1 && !resolvedAbsolute; i--) {
        var path = (i >= 0) ? args[i] : FS.cwd();
        // Skip empty and invalid entries
        if (typeof path != 'string') {
          throw new TypeError('Arguments to path.resolve must be strings');
        } else if (!path) {
          return ''; // an invalid portion invalidates the whole thing
        }
        resolvedPath = path + '/' + resolvedPath;
        resolvedAbsolute = PATH.isAbs(path);
      }
      // At this point the path should be resolved to a full absolute path, but
      // handle relative paths to be safe (might happen when process.cwd() fails)
      resolvedPath = PATH.normalizeArray(resolvedPath.split('/').filter((p) => !!p), !resolvedAbsolute).join('/');
      return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
    },
relative:(from, to) => {
      from = PATH_FS.resolve(from).slice(1);
      to = PATH_FS.resolve(to).slice(1);
      function trim(arr) {
        var start = 0;
        for (; start < arr.length; start++) {
          if (arr[start] !== '') break;
        }
        var end = arr.length - 1;
        for (; end >= 0; end--) {
          if (arr[end] !== '') break;
        }
        if (start > end) return [];
        return arr.slice(start, end - start + 1);
      }
      var fromParts = trim(from.split('/'));
      var toParts = trim(to.split('/'));
      var length = Math.min(fromParts.length, toParts.length);
      var samePartsLength = length;
      for (var i = 0; i < length; i++) {
        if (fromParts[i] !== toParts[i]) {
          samePartsLength = i;
          break;
        }
      }
      var outputParts = [];
      for (var i = samePartsLength; i < fromParts.length; i++) {
        outputParts.push('..');
      }
      outputParts = outputParts.concat(toParts.slice(samePartsLength));
      return outputParts.join('/');
    },
};


var UTF8Decoder = globalThis.TextDecoder && new TextDecoder();


  /**
   * heapOrArray is either a regular array, or a JavaScript typed array view.
   * @param {number} idx
   * @param {number=} maxBytesToRead
   * @param {boolean=} ignoreNul
   * @return {number}
   */
  var findStringEnd = (heapOrArray, idx, maxBytesToRead, ignoreNul) => {
      var maxIdx = idx + maxBytesToRead;
      if (ignoreNul) return maxIdx;
      // TextDecoder needs to know the byte length in advance, it doesn't stop on
      // null terminator by itself.
      // As a tiny code save trick, compare idx against maxIdx using a negation,
      // so that maxBytesToRead=undefined/NaN means Infinity.
      while (heapOrArray[idx] && !(idx >= maxIdx)) ++idx;
      return idx;
    };
  
  
    /**
   * Given a pointer 'idx' to a null-terminated UTF8-encoded string in the given
   * array that contains uint8 values, returns a copy of that string as a
   * Javascript String object.
   * heapOrArray is either a regular array, or a JavaScript typed array view.
   * @param {number=} idx
   * @param {number=} maxBytesToRead
   * @param {boolean=} ignoreNul - If true, the function will not stop on a NUL character.
   * @return {string}
   */
  var UTF8ArrayToString = (heapOrArray, idx = 0, maxBytesToRead, ignoreNul) => {
  
      var endPtr = findStringEnd(heapOrArray, idx, maxBytesToRead, ignoreNul);
  
      // When using conditional TextDecoder, skip it for short strings as the overhead of the native call is not worth it.
      if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
        return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
      }
      var str = '';
      while (idx < endPtr) {
        // For UTF8 byte structure, see:
        // http://en.wikipedia.org/wiki/UTF-8#Description
        // https://www.ietf.org/rfc/rfc2279.txt
        // https://tools.ietf.org/html/rfc3629
        var u0 = heapOrArray[idx++];
        if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
        var u1 = heapOrArray[idx++] & 63;
        if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
        var u2 = heapOrArray[idx++] & 63;
        if ((u0 & 0xF0) == 0xE0) {
          u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
        } else {
          if ((u0 & 0xF8) != 0xF0) warnOnce(`Invalid UTF-8 leading byte ${ptrToString(u0)} encountered when deserializing a UTF-8 string in wasm memory to a JS string!`);
          u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (heapOrArray[idx++] & 63);
        }
  
        if (u0 < 0x10000) {
          str += String.fromCharCode(u0);
        } else {
          var ch = u0 - 0x10000;
          str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
        }
      }
      return str;
    };
  
  var FS_stdin_getChar_buffer = [];
  
  var lengthBytesUTF8 = (str) => {
      var len = 0;
      for (var i = 0; i < str.length; ++i) {
        // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code
        // unit, not a Unicode code point of the character! So decode
        // UTF16->UTF32->UTF8.
        // See http://unicode.org/faq/utf_bom.html#utf16-3
        var c = str.charCodeAt(i); // possibly a lead surrogate
        if (c <= 0x7F) {
          len++;
        } else if (c <= 0x7FF) {
          len += 2;
        } else if (c >= 0xD800 && c <= 0xDFFF) {
          len += 4; ++i;
        } else {
          len += 3;
        }
      }
      return len;
    };
  
  var stringToUTF8Array = (str, heap, outIdx, maxBytesToWrite) => {
      assert(typeof str === 'string', `stringToUTF8Array expects a string (got ${typeof str})`);
      // Parameter maxBytesToWrite is not optional. Negative values, 0, null,
      // undefined and false each don't write out any bytes.
      if (!(maxBytesToWrite > 0))
        return 0;
  
      var startIdx = outIdx;
      var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
      for (var i = 0; i < str.length; ++i) {
        // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description
        // and https://www.ietf.org/rfc/rfc2279.txt
        // and https://tools.ietf.org/html/rfc3629
        var u = str.codePointAt(i);
        if (u <= 0x7F) {
          if (outIdx >= endIdx) break;
          heap[outIdx++] = u;
        } else if (u <= 0x7FF) {
          if (outIdx + 1 >= endIdx) break;
          heap[outIdx++] = 0xC0 | (u >> 6);
          heap[outIdx++] = 0x80 | (u & 63);
        } else if (u <= 0xFFFF) {
          if (outIdx + 2 >= endIdx) break;
          heap[outIdx++] = 0xE0 | (u >> 12);
          heap[outIdx++] = 0x80 | ((u >> 6) & 63);
          heap[outIdx++] = 0x80 | (u & 63);
        } else {
          if (outIdx + 3 >= endIdx) break;
          if (u > 0x10FFFF) warnOnce(`Invalid Unicode code point ${ptrToString(u)} encountered when serializing a JS string to a UTF-8 string in wasm memory! (Valid unicode code points should be in range 0-0x10FFFF).`);
          heap[outIdx++] = 0xF0 | (u >> 18);
          heap[outIdx++] = 0x80 | ((u >> 12) & 63);
          heap[outIdx++] = 0x80 | ((u >> 6) & 63);
          heap[outIdx++] = 0x80 | (u & 63);
          // Gotcha: if codePoint is over 0xFFFF, it is represented as a surrogate pair in UTF-16.
          // We need to manually skip over the second code unit for correct iteration.
          i++;
        }
      }
      // Null-terminate the pointer to the buffer.
      heap[outIdx] = 0;
      return outIdx - startIdx;
    };
  /** @type {function(string, boolean=, number=)} */
  var intArrayFromString = (stringy, dontAddNull, length) => {
      var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
      var u8array = new Array(len);
      var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
      if (dontAddNull) u8array.length = numBytesWritten;
      return u8array;
    };
  var FS_stdin_getChar = () => {
      if (!FS_stdin_getChar_buffer.length) {
        var result = null;
        if (ENVIRONMENT_IS_NODE) {
          // we will read data by chunks of BUFSIZE
          var BUFSIZE = 256;
          var buf = Buffer.alloc(BUFSIZE);
          var bytesRead = 0;
  
          // For some reason we must suppress a closure warning here, even though
          // fd definitely exists on process.stdin, and is even the proper way to
          // get the fd of stdin,
          // https://github.com/nodejs/help/issues/2136#issuecomment-523649904
          // This started to happen after moving this logic out of library_tty.js,
          // so it is related to the surrounding code in some unclear manner.
          /** @suppress {missingProperties} */
          var fd = process.stdin.fd;
  
          try {
            bytesRead = fs.readSync(fd, buf, 0, BUFSIZE);
          } catch(e) {
            // Cross-platform differences: on Windows, reading EOF throws an
            // exception, but on other OSes, reading EOF returns 0. Uniformize
            // behavior by treating the EOF exception to return 0.
            if (e.toString().includes('EOF')) bytesRead = 0;
            else throw e;
          }
  
          if (bytesRead > 0) {
            result = buf.slice(0, bytesRead).toString('utf-8');
          }
        } else
        if (globalThis.window?.prompt) {
          // Browser.
          result = window.prompt('Input: ');  // returns null on cancel
          if (result !== null) {
            result += '\n';
          }
        } else
        {}
        if (!result) {
          return null;
        }
        FS_stdin_getChar_buffer = intArrayFromString(result, true);
      }
      return FS_stdin_getChar_buffer.shift();
    };
  var TTY = {
  ttys:[],
  init() {
        // https://github.com/emscripten-core/emscripten/pull/1555
        // if (ENVIRONMENT_IS_NODE) {
        //   // currently, FS.init does not distinguish if process.stdin is a file or TTY
        //   // device, it always assumes it's a TTY device. because of this, we're forcing
        //   // process.stdin to UTF8 encoding to at least make stdin reading compatible
        //   // with text files until FS.init can be refactored.
        //   process.stdin.setEncoding('utf8');
        // }
      },
  shutdown() {
        // https://github.com/emscripten-core/emscripten/pull/1555
        // if (ENVIRONMENT_IS_NODE) {
        //   // inolen: any idea as to why node -e 'process.stdin.read()' wouldn't exit immediately (with process.stdin being a tty)?
        //   // isaacs: because now it's reading from the stream, you've expressed interest in it, so that read() kicks off a _read() which creates a ReadReq operation
        //   // inolen: I thought read() in that case was a synchronous operation that just grabbed some amount of buffered data if it exists?
        //   // isaacs: it is. but it also triggers a _read() call, which calls readStart() on the handle
        //   // isaacs: do process.stdin.pause() and i'd think it'd probably close the pending call
        //   process.stdin.pause();
        // }
      },
  register(dev, ops) {
        TTY.ttys[dev] = { input: [], output: [], ops: ops };
        FS.registerDevice(dev, TTY.stream_ops);
      },
  stream_ops:{
  open(stream) {
          var tty = TTY.ttys[stream.node.rdev];
          if (!tty) {
            throw new FS.ErrnoError(43);
          }
          stream.tty = tty;
          stream.seekable = false;
        },
  close(stream) {
          // flush any pending line data
          stream.tty.ops.fsync(stream.tty);
        },
  fsync(stream) {
          stream.tty.ops.fsync(stream.tty);
        },
  read(stream, buffer, offset, length, pos /* ignored */) {
          if (!stream.tty || !stream.tty.ops.get_char) {
            throw new FS.ErrnoError(60);
          }
          var bytesRead = 0;
          for (var i = 0; i < length; i++) {
            var result;
            try {
              result = stream.tty.ops.get_char(stream.tty);
            } catch (e) {
              throw new FS.ErrnoError(29);
            }
            if (result === undefined && bytesRead === 0) {
              throw new FS.ErrnoError(6);
            }
            if (result === null || result === undefined) break;
            bytesRead++;
            buffer[offset+i] = result;
          }
          if (bytesRead) {
            stream.node.atime = Date.now();
          }
          return bytesRead;
        },
  write(stream, buffer, offset, length, pos) {
          if (!stream.tty || !stream.tty.ops.put_char) {
            throw new FS.ErrnoError(60);
          }
          try {
            for (var i = 0; i < length; i++) {
              stream.tty.ops.put_char(stream.tty, buffer[offset+i]);
            }
          } catch (e) {
            throw new FS.ErrnoError(29);
          }
          if (length) {
            stream.node.mtime = stream.node.ctime = Date.now();
          }
          return i;
        },
  },
  default_tty_ops:{
  get_char(tty) {
          return FS_stdin_getChar();
        },
  put_char(tty, val) {
          if (val === null || val === 10) {
            out(UTF8ArrayToString(tty.output));
            tty.output = [];
          } else {
            if (val != 0) tty.output.push(val); // val == 0 would cut text output off in the middle.
          }
        },
  fsync(tty) {
          if (tty.output?.length > 0) {
            out(UTF8ArrayToString(tty.output));
            tty.output = [];
          }
        },
  ioctl_tcgets(tty) {
          // typical setting
          return {
            c_iflag: 25856,
            c_oflag: 5,
            c_cflag: 191,
            c_lflag: 35387,
            c_cc: [
              0x03, 0x1c, 0x7f, 0x15, 0x04, 0x00, 0x01, 0x00, 0x11, 0x13, 0x1a, 0x00,
              0x12, 0x0f, 0x17, 0x16, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
              0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            ]
          };
        },
  ioctl_tcsets(tty, optional_actions, data) {
          // currently just ignore
          return 0;
        },
  ioctl_tiocgwinsz(tty) {
          return [24, 80];
        },
  },
  default_tty1_ops:{
  put_char(tty, val) {
          if (val === null || val === 10) {
            err(UTF8ArrayToString(tty.output));
            tty.output = [];
          } else {
            if (val != 0) tty.output.push(val);
          }
        },
  fsync(tty) {
          if (tty.output?.length > 0) {
            err(UTF8ArrayToString(tty.output));
            tty.output = [];
          }
        },
  },
  };
  
  
  var mmapAlloc = (size) => {
      abort('internal error: mmapAlloc called but `emscripten_builtin_memalign` native symbol not exported');
    };
  
  var MEMFS = {
  ops_table:null,
  mount(mount) {
        return MEMFS.createNode(null, '/', 16895, 0);
      },
  createNode(parent, name, mode, dev) {
        if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
          // not supported
          throw new FS.ErrnoError(63);
        }
        MEMFS.ops_table ||= {
          dir: {
            node: {
              getattr: MEMFS.node_ops.getattr,
              setattr: MEMFS.node_ops.setattr,
              lookup: MEMFS.node_ops.lookup,
              mknod: MEMFS.node_ops.mknod,
              rename: MEMFS.node_ops.rename,
              unlink: MEMFS.node_ops.unlink,
              rmdir: MEMFS.node_ops.rmdir,
              readdir: MEMFS.node_ops.readdir,
              symlink: MEMFS.node_ops.symlink
            },
            stream: {
              llseek: MEMFS.stream_ops.llseek
            }
          },
          file: {
            node: {
              getattr: MEMFS.node_ops.getattr,
              setattr: MEMFS.node_ops.setattr
            },
            stream: {
              llseek: MEMFS.stream_ops.llseek,
              read: MEMFS.stream_ops.read,
              write: MEMFS.stream_ops.write,
              mmap: MEMFS.stream_ops.mmap,
              msync: MEMFS.stream_ops.msync
            }
          },
          link: {
            node: {
              getattr: MEMFS.node_ops.getattr,
              setattr: MEMFS.node_ops.setattr,
              readlink: MEMFS.node_ops.readlink
            },
            stream: {}
          },
          chrdev: {
            node: {
              getattr: MEMFS.node_ops.getattr,
              setattr: MEMFS.node_ops.setattr
            },
            stream: FS.chrdev_stream_ops
          }
        };
        var node = FS.createNode(parent, name, mode, dev);
        if (FS.isDir(node.mode)) {
          node.node_ops = MEMFS.ops_table.dir.node;
          node.stream_ops = MEMFS.ops_table.dir.stream;
          node.contents = {};
        } else if (FS.isFile(node.mode)) {
          node.node_ops = MEMFS.ops_table.file.node;
          node.stream_ops = MEMFS.ops_table.file.stream;
          // The actual number of bytes used in the typed array, as opposed to
          // contents.length which gives the whole capacity.
          node.usedBytes = 0;
          // The byte data of the file is stored in a typed array.
          // Note: typed arrays are not resizable like normal JS arrays are, so
          // there is a small penalty involved for appending file writes that
          // continuously grow a file similar to std::vector capacity vs used.
          node.contents = MEMFS.emptyFileContents ??= new Uint8Array(0);
        } else if (FS.isLink(node.mode)) {
          node.node_ops = MEMFS.ops_table.link.node;
          node.stream_ops = MEMFS.ops_table.link.stream;
        } else if (FS.isChrdev(node.mode)) {
          node.node_ops = MEMFS.ops_table.chrdev.node;
          node.stream_ops = MEMFS.ops_table.chrdev.stream;
        }
        node.atime = node.mtime = node.ctime = Date.now();
        // add the new node to the parent
        if (parent) {
          parent.contents[name] = node;
          parent.atime = parent.mtime = parent.ctime = node.atime;
        }
        return node;
      },
  getFileDataAsTypedArray(node) {
        assert(FS.isFile(node.mode), 'getFileDataAsTypedArray called on non-file');
        return node.contents.subarray(0, node.usedBytes); // Make sure to not return excess unused bytes.
      },
  expandFileStorage(node, newCapacity) {
        var prevCapacity = node.contents.length;
        if (prevCapacity >= newCapacity) return; // No need to expand, the storage was already large enough.
        // Don't expand strictly to the given requested limit if it's only a very
        // small increase, but instead geometrically grow capacity.
        // For small filesizes (<1MB), perform size*2 geometric increase, but for
        // large sizes, do a much more conservative size*1.125 increase to avoid
        // overshooting the allocation cap by a very large margin.
        var CAPACITY_DOUBLING_MAX = 1024 * 1024;
        newCapacity = Math.max(newCapacity, (prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2.0 : 1.125)) >>> 0);
        if (prevCapacity) newCapacity = Math.max(newCapacity, 256); // At minimum allocate 256b for each file when expanding.
        var oldContents = MEMFS.getFileDataAsTypedArray(node);
        node.contents = new Uint8Array(newCapacity); // Allocate new storage.
        node.contents.set(oldContents);
      },
  resizeFileStorage(node, newSize) {
        if (node.usedBytes == newSize) return;
        var oldContents = node.contents;
        node.contents = new Uint8Array(newSize); // Allocate new storage.
        node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes))); // Copy old data over to the new storage.
        node.usedBytes = newSize;
      },
  node_ops:{
  getattr(node) {
          var attr = {};
          // device numbers reuse inode numbers.
          attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
          attr.ino = node.id;
          attr.mode = node.mode;
          attr.nlink = 1;
          attr.uid = 0;
          attr.gid = 0;
          attr.rdev = node.rdev;
          if (FS.isDir(node.mode)) {
            attr.size = 4096;
          } else if (FS.isFile(node.mode)) {
            attr.size = node.usedBytes;
          } else if (FS.isLink(node.mode)) {
            attr.size = node.link.length;
          } else {
            attr.size = 0;
          }
          attr.atime = new Date(node.atime);
          attr.mtime = new Date(node.mtime);
          attr.ctime = new Date(node.ctime);
          // NOTE: In our implementation, st_blocks = Math.ceil(st_size/st_blksize),
          //       but this is not required by the standard.
          attr.blksize = 4096;
          attr.blocks = Math.ceil(attr.size / attr.blksize);
          return attr;
        },
  setattr(node, attr) {
          for (const key of ['mode', 'atime', 'mtime', 'ctime']) {
            if (attr[key] != null) {
              node[key] = attr[key];
            }
          }
          if (attr.size !== undefined) {
            MEMFS.resizeFileStorage(node, attr.size);
          }
        },
  lookup(parent, name) {
          throw new FS.ErrnoError(44);
        },
  mknod(parent, name, mode, dev) {
          return MEMFS.createNode(parent, name, mode, dev);
        },
  rename(old_node, new_dir, new_name) {
          var new_node;
          try {
            new_node = FS.lookupNode(new_dir, new_name);
          } catch (e) {}
          if (new_node) {
            if (FS.isDir(old_node.mode)) {
              // if we're overwriting a directory at new_name, make sure it's empty.
              for (var i in new_node.contents) {
                throw new FS.ErrnoError(55);
              }
            }
            FS.hashRemoveNode(new_node);
          }
          // do the internal rewiring
          delete old_node.parent.contents[old_node.name];
          new_dir.contents[new_name] = old_node;
          old_node.name = new_name;
          new_dir.ctime = new_dir.mtime = old_node.parent.ctime = old_node.parent.mtime = Date.now();
        },
  unlink(parent, name) {
          delete parent.contents[name];
          parent.ctime = parent.mtime = Date.now();
        },
  rmdir(parent, name) {
          var node = FS.lookupNode(parent, name);
          for (var i in node.contents) {
            throw new FS.ErrnoError(55);
          }
          delete parent.contents[name];
          parent.ctime = parent.mtime = Date.now();
        },
  readdir(node) {
          return ['.', '..', ...Object.keys(node.contents)];
        },
  symlink(parent, newname, oldpath) {
          var node = MEMFS.createNode(parent, newname, 0o777 | 40960, 0);
          node.link = oldpath;
          return node;
        },
  readlink(node) {
          if (!FS.isLink(node.mode)) {
            throw new FS.ErrnoError(28);
          }
          return node.link;
        },
  },
  stream_ops:{
  read(stream, buffer, offset, length, position) {
          var contents = stream.node.contents;
          if (position >= stream.node.usedBytes) return 0;
          var size = Math.min(stream.node.usedBytes - position, length);
          assert(size >= 0);
          buffer.set(contents.subarray(position, position + size), offset);
          return size;
        },
  write(stream, buffer, offset, length, position, canOwn) {
          assert(buffer.subarray, 'FS.write expects a TypedArray');
          // If the buffer is located in main memory (HEAP), and if
          // memory can grow, we can't hold on to references of the
          // memory buffer, as they may get invalidated. That means we
          // need to copy its contents.
          if (buffer.buffer === HEAP8.buffer) {
            canOwn = false;
          }
  
          if (!length) return 0;
          var node = stream.node;
          node.mtime = node.ctime = Date.now();
  
          if (canOwn) {
            assert(position === 0, 'canOwn must imply no weird position inside the file');
            node.contents = buffer.subarray(offset, offset + length);
            node.usedBytes = length;
          } else if (node.usedBytes === 0 && position === 0) { // If this is a simple first write to an empty file, do a fast set since we don't need to care about old data.
            node.contents = buffer.slice(offset, offset + length);
            node.usedBytes = length;
          } else {
            MEMFS.expandFileStorage(node, position+length);
            // Use typed array write which is available.
            node.contents.set(buffer.subarray(offset, offset + length), position);
            node.usedBytes = Math.max(node.usedBytes, position + length);
          }
          return length;
        },
  llseek(stream, offset, whence) {
          var position = offset;
          if (whence === 1) {
            position += stream.position;
          } else if (whence === 2) {
            if (FS.isFile(stream.node.mode)) {
              position += stream.node.usedBytes;
            }
          }
          if (position < 0) {
            throw new FS.ErrnoError(28);
          }
          return position;
        },
  mmap(stream, length, position, prot, flags) {
          if (!FS.isFile(stream.node.mode)) {
            throw new FS.ErrnoError(43);
          }
          var ptr;
          var allocated;
          var contents = stream.node.contents;
          // Only make a new copy when MAP_PRIVATE is specified.
          if (!(flags & 2) && contents.buffer === HEAP8.buffer) {
            // We can't emulate MAP_SHARED when the file is not backed by the
            // buffer we're mapping to (e.g. the HEAP buffer).
            allocated = false;
            ptr = contents.byteOffset;
          } else {
            allocated = true;
            ptr = mmapAlloc(length);
            if (!ptr) {
              throw new FS.ErrnoError(48);
            }
            if (contents) {
              // Try to avoid unnecessary slices.
              if (position > 0 || position + length < contents.length) {
                if (contents.subarray) {
                  contents = contents.subarray(position, position + length);
                } else {
                  contents = Array.prototype.slice.call(contents, position, position + length);
                }
              }
              HEAP8.set(contents, ptr);
            }
          }
          return { ptr, allocated };
        },
  msync(stream, buffer, offset, length, mmapFlags) {
          MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
          // should we check if bytesWritten and length are the same?
          return 0;
        },
  },
  };
  
  var FS_modeStringToFlags = (str) => {
      if (typeof str != 'string') return str;
      var flagModes = {
        'r': 0,
        'r+': 2,
        'w': 512 | 64 | 1,
        'w+': 512 | 64 | 2,
        'a': 1024 | 64 | 1,
        'a+': 1024 | 64 | 2,
      };
      var flags = flagModes[str];
      if (typeof flags == 'undefined') {
        throw new Error(`Unknown file open mode: ${str}`);
      }
      return flags;
    };
  
  var FS_fileDataToTypedArray = (data) => {
      if (typeof data == 'string') {
        data = intArrayFromString(data, true);
      }
      if (!data.subarray) {
        data = new Uint8Array(data);
      }
      return data;
    };
  
  var FS_getMode = (canRead, canWrite) => {
      var mode = 0;
      if (canRead) mode |= 292 | 73;
      if (canWrite) mode |= 146;
      return mode;
    };
  
  
  
  
  /** @type {!Uint8Array} */
  var HEAPU8;
  
    /**
   * Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the
   * emscripten HEAP, returns a copy of that string as a Javascript String object.
   *
   * @param {number} ptr
   * @param {number=} maxBytesToRead - An optional length that specifies the
   *   maximum number of bytes to read. You can omit this parameter to scan the
   *   string until the first 0 byte. If maxBytesToRead is passed, and the string
   *   at [ptr, ptr+maxBytesToReadr[ contains a null byte in the middle, then the
   *   string will cut short at that byte index.
   * @param {boolean=} ignoreNul - If true, the function will not stop on a NUL character.
   * @return {string}
   */
  var UTF8ToString = (ptr, maxBytesToRead, ignoreNul) => {
      assert(typeof ptr == 'number', `UTF8ToString expects a number (got ${typeof ptr})`);
      return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead, ignoreNul) : '';
    };
  
  var strError = (errno) => UTF8ToString(_strerror(errno));
  
  var ERRNO_CODES = {
      'EPERM': 63,
      'ENOENT': 44,
      'ESRCH': 71,
      'EINTR': 27,
      'EIO': 29,
      'ENXIO': 60,
      'E2BIG': 1,
      'ENOEXEC': 45,
      'EBADF': 8,
      'ECHILD': 12,
      'EAGAIN': 6,
      'EWOULDBLOCK': 6,
      'ENOMEM': 48,
      'EACCES': 2,
      'EFAULT': 21,
      'ENOTBLK': 105,
      'EBUSY': 10,
      'EEXIST': 20,
      'EXDEV': 75,
      'ENODEV': 43,
      'ENOTDIR': 54,
      'EISDIR': 31,
      'EINVAL': 28,
      'ENFILE': 41,
      'EMFILE': 33,
      'ENOTTY': 59,
      'ETXTBSY': 74,
      'EFBIG': 22,
      'ENOSPC': 51,
      'ESPIPE': 70,
      'EROFS': 69,
      'EMLINK': 34,
      'EPIPE': 64,
      'EDOM': 18,
      'ERANGE': 68,
      'ENOMSG': 49,
      'EIDRM': 24,
      'ECHRNG': 106,
      'EL2NSYNC': 156,
      'EL3HLT': 107,
      'EL3RST': 108,
      'ELNRNG': 109,
      'EUNATCH': 110,
      'ENOCSI': 111,
      'EL2HLT': 112,
      'EDEADLK': 16,
      'ENOLCK': 46,
      'EBADE': 113,
      'EBADR': 114,
      'EXFULL': 115,
      'ENOANO': 104,
      'EBADRQC': 103,
      'EBADSLT': 102,
      'EDEADLOCK': 16,
      'EBFONT': 101,
      'ENOSTR': 100,
      'ENODATA': 116,
      'ETIME': 117,
      'ENOSR': 118,
      'ENONET': 119,
      'ENOPKG': 120,
      'EREMOTE': 121,
      'ENOLINK': 47,
      'EADV': 122,
      'ESRMNT': 123,
      'ECOMM': 124,
      'EPROTO': 65,
      'EMULTIHOP': 36,
      'EDOTDOT': 125,
      'EBADMSG': 9,
      'ENOTUNIQ': 126,
      'EBADFD': 127,
      'EREMCHG': 128,
      'ELIBACC': 129,
      'ELIBBAD': 130,
      'ELIBSCN': 131,
      'ELIBMAX': 132,
      'ELIBEXEC': 133,
      'ENOSYS': 52,
      'ENOTEMPTY': 55,
      'ENAMETOOLONG': 37,
      'ELOOP': 32,
      'EOPNOTSUPP': 138,
      'EPFNOSUPPORT': 139,
      'ECONNRESET': 15,
      'ENOBUFS': 42,
      'EAFNOSUPPORT': 5,
      'EPROTOTYPE': 67,
      'ENOTSOCK': 57,
      'ENOPROTOOPT': 50,
      'ESHUTDOWN': 140,
      'ECONNREFUSED': 14,
      'EADDRINUSE': 3,
      'ECONNABORTED': 13,
      'ENETUNREACH': 40,
      'ENETDOWN': 38,
      'ETIMEDOUT': 73,
      'EHOSTDOWN': 142,
      'EHOSTUNREACH': 23,
      'EINPROGRESS': 26,
      'EALREADY': 7,
      'EDESTADDRREQ': 17,
      'EMSGSIZE': 35,
      'EPROTONOSUPPORT': 66,
      'ESOCKTNOSUPPORT': 137,
      'EADDRNOTAVAIL': 4,
      'ENETRESET': 39,
      'EISCONN': 30,
      'ENOTCONN': 53,
      'ETOOMANYREFS': 141,
      'EUSERS': 136,
      'EDQUOT': 19,
      'ESTALE': 72,
      'ENOTSUP': 138,
      'ENOMEDIUM': 148,
      'EILSEQ': 25,
      'EOVERFLOW': 61,
      'ECANCELED': 11,
      'ENOTRECOVERABLE': 56,
      'EOWNERDEAD': 62,
      'ESTRPIPE': 135,
    };
  
  var asyncLoad = async (url) => {
      var arrayBuffer = await readAsync(url);
      assert(arrayBuffer, `Loading data file "${url}" failed (no arrayBuffer).`);
      return new Uint8Array(arrayBuffer);
    };
  
  
  var FS_createDataFile = (...args) => FS.createDataFile(...args);
  
  var getUniqueRunDependency = (id) => {
      var orig = id;
      while (1) {
        if (!runDependencyTracking[id]) return id;
        id = orig + Math.random();
      }
    };
  
  var dependenciesPromise = null;
  var resolveRunDependencies = async () => dependenciesPromise;
  var runDependencies = 0;
  
  
  var dependenciesPromiseResolve = null;
  
  var runDependencyTracking = {
  };
  
  var runDependencyWatcher = null;
  var removeRunDependency = (id) => {
      runDependencies--;
  
      Module['monitorRunDependencies']?.(runDependencies);
  
      assert(id, 'removeRunDependency requires an ID');
      assert(runDependencyTracking[id]);
      delete runDependencyTracking[id];
      if (!runDependencies) {
        if (runDependencyWatcher !== null) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
        }
        dependenciesPromiseResolve();
      }
    };
  
  
  
  
  var addRunDependency = (id) => {
      if (!runDependencies) {
        dependenciesPromise = new Promise((resolve) => dependenciesPromiseResolve = resolve);
      }
      runDependencies++;
  
      Module['monitorRunDependencies']?.(runDependencies);
  
      assert(id, 'addRunDependency requires an ID')
      assert(!runDependencyTracking[id]);
      runDependencyTracking[id] = 1;
      if (runDependencyWatcher === null && globalThis.setInterval) {
        // Check for missing dependencies every few seconds
        runDependencyWatcher = setInterval(() => {
          if (ABORT) {
            clearInterval(runDependencyWatcher);
            runDependencyWatcher = null;
            return;
          }
          var shown = false;
          for (var dep in runDependencyTracking) {
            if (!shown) {
              shown = true;
              err('still waiting on run dependencies:');
            }
            err(`dependency: ${dep}`);
          }
          if (shown) {
            err('(end of list)');
          }
        }, 10000);
        // Prevent this timer from keeping the runtime alive if nothing
        // else is.
        runDependencyWatcher.unref?.()
      }
    };
  
  
  var preloadPlugins = [];
  var FS_handledByPreloadPlugin = async (byteArray, fullname) => {
      // Ensure plugins are ready.
      if (typeof Browser != 'undefined') Browser.init();
  
      for (var plugin of preloadPlugins) {
        if (plugin['canHandle'](fullname)) {
          assert(plugin['handle'].constructor.name === 'AsyncFunction', 'Filesystem plugin handlers must be async functions (See #24914)')
          return plugin['handle'](byteArray, fullname);
        }
      }
      // If no plugin handled this file then return the original/unmodified
      // byteArray.
      return byteArray;
    };
  var FS_preloadFile = async (parent, name, url, canRead, canWrite, dontCreateFile, canOwn, preFinish) => {
      // TODO we should allow people to just pass in a complete filename instead
      // of parent and name being that we just join them anyways
      var fullname = name ? PATH_FS.resolve(PATH.join2(parent, name)) : parent;
      var dep = getUniqueRunDependency(`cp ${fullname}`); // might have several active requests for the same fullname
      addRunDependency(dep);
  
      try {
        var byteArray = url;
        if (typeof url == 'string') {
          byteArray = await asyncLoad(url);
        }
  
        byteArray = await FS_handledByPreloadPlugin(byteArray, fullname);
        preFinish?.();
        if (!dontCreateFile) {
          FS_createDataFile(parent, name, byteArray, canRead, canWrite, canOwn);
        }
      } finally {
        removeRunDependency(dep);
      }
    };
  var FS_createPreloadedFile = (parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) => {
      FS_preloadFile(parent, name, url, canRead, canWrite, dontCreateFile, canOwn, preFinish).then(onload).catch(onerror);
    };
  
  var FS = {
  root:null,
  mounts:[],
  devices:{
  },
  streams:[],
  nextInode:1,
  nameTable:null,
  currentPath:"/",
  initialized:false,
  ignorePermissions:true,
  filesystems:null,
  syncFSRequests:0,
  ErrnoError:class extends Error {
        name = 'ErrnoError';
        // We set the `name` property to be able to identify `FS.ErrnoError`
        // - the `name` is a standard ECMA-262 property of error objects. Kind of good to have it anyway.
        // - when using PROXYFS, an error can come from an underlying FS
        // as different FS objects have their own FS.ErrnoError each,
        // the test `err instanceof FS.ErrnoError` won't detect an error coming from another filesystem, causing bugs.
        // we'll use the reliable test `err.name == "ErrnoError"` instead
        constructor(errno) {
          super(runtimeInitialized ? strError(errno) : '');
          this.errno = errno;
          for (var key in ERRNO_CODES) {
            if (ERRNO_CODES[key] === errno) {
              this.code = key;
              break;
            }
          }
        }
      },
  FSStream:class {
        shared = {};
        get object() {
          return this.node;
        }
        set object(val) {
          this.node = val;
        }
        get isRead() {
          return (this.flags & 2097155) !== 1;
        }
        get isWrite() {
          return (this.flags & 2097155) !== 0;
        }
        get isAppend() {
          return (this.flags & 1024);
        }
        get flags() {
          return this.shared.flags;
        }
        set flags(val) {
          this.shared.flags = val;
        }
        get position() {
          return this.shared.position;
        }
        set position(val) {
          this.shared.position = val;
        }
      },
  FSNode:class {
        node_ops = {};
        stream_ops = {};
        readMode = 292 | 73;
        writeMode = 146;
        mounted = null;
        constructor(parent, name, mode, rdev) {
          if (!parent) {
            parent = this;  // root node sets parent to itself
          }
          this.parent = parent;
          this.mount = parent.mount;
          this.id = FS.nextInode++;
          this.name = name;
          this.mode = mode;
          this.rdev = rdev;
          this.atime = this.mtime = this.ctime = Date.now();
        }
        get read() {
          return (this.mode & this.readMode) === this.readMode;
        }
        set read(val) {
          val ? this.mode |= this.readMode : this.mode &= ~this.readMode;
        }
        get write() {
          return (this.mode & this.writeMode) === this.writeMode;
        }
        set write(val) {
          val ? this.mode |= this.writeMode : this.mode &= ~this.writeMode;
        }
        get isFolder() {
          return FS.isDir(this.mode);
        }
        get isDevice() {
          return FS.isChrdev(this.mode);
        }
        // The per-inode readiness wait-queue. The node carries a Set of listener
        // entries {cb}; producers (SOCKFS, PIPEFS) call notifyListeners on a
        // readiness transition, and poll()/epoll consume it. It lives on the node
        // (not the fd) so dup'd fds share one queue. Only nodes that derive real
        // readiness (sockets, pipes, and an epoll's own node) ever use this -
        // always-ready types (regular files, ttys) never register or notify.
        addListener(cb, exclusive = false) {
          var entry = {cb, exclusive};
          var listeners = (this.listeners ??= new Set());
          listeners.add(entry);
          return {listeners, entry};
        }
        notifyListeners(flags) {
          // Iterates the set without copying, which is safe ONLY under a
          // load-bearing contract that every internal listener must honour:
          //   1. A listener must not run user code synchronously (a poll waiter only
          //      resolves a Promise; an epoll registration only re-lists +
          //      re-notifies; the epoll callback only schedules a tick). User code
          //      runs on a later tick, never inside this loop.
          //   2. A listener may delete entries only from ITS OWN waiter, never from
          //      a sibling node's set that may be mid-iteration. (Deleting an entry
          //      of the set being iterated here is fine - a Set tolerates removal of
          //      a not-yet-visited entry mid-iteration; mutating a *different* node's
          //      set is fine because that set is not being iterated.)
          // Violating either gives silently skipped wakeups that are near-impossible
          // to reproduce. Any new producer/listener must preserve it.
          if (!this.listeners) return;
          // Fire every non-exclusive listener. Among EPOLLEXCLUSIVE registrations
          // (one fd watched by several epolls) wake only one, rotating round-robin
          // per node, to avoid a thundering herd. (Only epoll registrations are ever
          // exclusive; poll waiters and a node's own consumers are not.)
          var excl;
          for (var entry of this.listeners) {
            if (entry.exclusive) (excl ||= []).push(entry);
            else entry.cb(flags);
          }
          if (excl) {
            var i = (this.exclTurn || 0) % excl.length;
            this.exclTurn = i + 1;
            excl[i].cb(flags);
          }
        }
      },
  lookupPath(path, opts = {}) {
        if (!path) {
          throw new FS.ErrnoError(44);
        }
        opts.follow_mount ??= true
  
        if (!PATH.isAbs(path)) {
          path = FS.cwd() + '/' + path;
        }
  
        // limit max consecutive symlinks to SYMLOOP_MAX.
        linkloop: for (var nlinks = 0; nlinks < 40; nlinks++) {
          // split the absolute path
          var parts = path.split('/').filter((p) => !!p);
  
          // start at the root
          var current = FS.root;
          var current_path = '/';
  
          for (var i = 0; i < parts.length; i++) {
            var islast = (i === parts.length-1);
            if (islast && opts.parent) {
              // stop resolving
              break;
            }
  
            if (parts[i] === '.') {
              continue;
            }
  
            if (parts[i] === '..') {
              current_path = PATH.dirname(current_path);
              if (FS.isRoot(current)) {
                path = current_path + '/' + parts.slice(i + 1).join('/');
                // We're making progress here, don't let many consecutive ..'s
                // lead to ELOOP
                nlinks--;
                continue linkloop;
              } else {
                current = current.parent;
              }
              continue;
            }
  
            current_path = PATH.join2(current_path, parts[i]);
            try {
              current = FS.lookupNode(current, parts[i]);
            } catch (e) {
              // if noent_okay is true, suppress a ENOENT in the last component
              // and return an object with an undefined node. This is needed for
              // resolving symlinks in the path when creating a file.
              if ((e?.errno === 44) && islast && opts.noent_okay) {
                return { path: current_path };
              }
              throw e;
            }
  
            // jump to the mount's root node if this is a mountpoint
            if (FS.isMountpoint(current) && (!islast || opts.follow_mount)) {
              current = current.mounted.root;
            }
  
            // by default, lookupPath will not follow a symlink if it is the final path component.
            // setting opts.follow = true will override this behavior.
            if (FS.isLink(current.mode) && (!islast || opts.follow)) {
              if (!current.node_ops.readlink) {
                throw new FS.ErrnoError(52);
              }
              var link = current.node_ops.readlink(current);
              if (!PATH.isAbs(link)) {
                link = PATH.dirname(current_path) + '/' + link;
              }
              path = link + '/' + parts.slice(i + 1).join('/');
              continue linkloop;
            }
          }
          return { path: current_path, node: current };
        }
        throw new FS.ErrnoError(32);
      },
  getPath(node) {
        var path;
        while (true) {
          if (FS.isRoot(node)) {
            var mount = node.mount.mountpoint;
            if (!path) return mount;
            return mount[mount.length-1] !== '/' ? `${mount}/${path}` : mount + path;
          }
          path = path ? `${node.name}/${path}` : node.name;
          node = node.parent;
        }
      },
  hashName(parentid, name) {
        var hash = 0;
  
        for (var i = 0; i < name.length; i++) {
          hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
        }
        return ((parentid + hash) >>> 0) % FS.nameTable.length;
      },
  hashAddNode(node) {
        var hash = FS.hashName(node.parent.id, node.name);
        node.name_next = FS.nameTable[hash];
        FS.nameTable[hash] = node;
      },
  hashRemoveNode(node) {
        var hash = FS.hashName(node.parent.id, node.name);
        if (FS.nameTable[hash] === node) {
          FS.nameTable[hash] = node.name_next;
        } else {
          var current = FS.nameTable[hash];
          while (current) {
            if (current.name_next === node) {
              current.name_next = node.name_next;
              break;
            }
            current = current.name_next;
          }
        }
      },
  lookupNode(parent, name) {
        var errCode = FS.mayLookup(parent);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        var hash = FS.hashName(parent.id, name);
        for (var node = FS.nameTable[hash]; node; node = node.name_next) {
          var nodeName = node.name;
          if (node.parent.id === parent.id && nodeName === name) {
            return node;
          }
        }
        // if we failed to find it in the cache, call into the VFS
        return FS.lookup(parent, name);
      },
  createNode(parent, name, mode, rdev) {
        assert(typeof parent == 'object')
        var node = new FS.FSNode(parent, name, mode, rdev);
  
        FS.hashAddNode(node);
  
        return node;
      },
  destroyNode(node) {
        FS.hashRemoveNode(node);
      },
  isRoot(node) {
        return node === node.parent;
      },
  isMountpoint(node) {
        return !!node.mounted;
      },
  isFile(mode) {
        return (mode & 61440) === 32768;
      },
  isDir(mode) {
        return (mode & 61440) === 16384;
      },
  isLink(mode) {
        return (mode & 61440) === 40960;
      },
  isChrdev(mode) {
        return (mode & 61440) === 8192;
      },
  isBlkdev(mode) {
        return (mode & 61440) === 24576;
      },
  isFIFO(mode) {
        return (mode & 61440) === 4096;
      },
  isSocket(mode) {
        return (mode & 49152) === 49152;
      },
  flagsToPermissionString(flag) {
        var perms = ['r', 'w', 'rw'][flag & 3];
        if ((flag & 512)) {
          perms += 'w';
        }
        return perms;
      },
  nodePermissions(node, perms) {
        if (FS.ignorePermissions) {
          return 0;
        }
        // return 0 if any user, group or owner bits are set.
        if (perms.includes('r') && !(node.mode & 292)) {
          return 2;
        }
        if (perms.includes('w') && !(node.mode & 146)) {
          return 2;
        }
        if (perms.includes('x') && !(node.mode & 73)) {
          return 2;
        }
        return 0;
      },
  mayLookup(dir) {
        if (!FS.isDir(dir.mode)) return 54;
        var errCode = FS.nodePermissions(dir, 'x');
        if (errCode) return errCode;
        if (!dir.node_ops.lookup) return 2;
        return 0;
      },
  mayCreate(dir, name) {
        if (!FS.isDir(dir.mode)) {
          return 54;
        }
        try {
          var node = FS.lookupNode(dir, name);
          return 20;
        } catch (e) {
        }
        return FS.nodePermissions(dir, 'wx');
      },
  mayDelete(dir, name, isdir) {
        var node;
        try {
          node = FS.lookupNode(dir, name);
        } catch (e) {
          return e.errno;
        }
        var errCode = FS.nodePermissions(dir, 'wx');
        if (errCode) {
          return errCode;
        }
        if (isdir) {
          if (!FS.isDir(node.mode)) {
            return 54;
          }
          if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
            return 10;
          }
        } else if (FS.isDir(node.mode)) {
          return 31;
        }
        return 0;
      },
  mayOpen(node, flags) {
        if (!node) {
          return 44;
        }
        if (FS.isLink(node.mode)) {
          return 32;
        }
        var mode = FS.flagsToPermissionString(flags);
        if (FS.isDir(node.mode)) {
          // opening for write
          // TODO: check for O_SEARCH? (== search for dir only)
          if (mode !== 'r' || (flags & (512 | 64))) {
            return 31;
          }
        }
        return FS.nodePermissions(node, mode);
      },
  checkOpExists(op, err) {
        if (!op) {
          throw new FS.ErrnoError(err);
        }
        return op;
      },
  MAX_OPEN_FDS:4096,
  nextfd() {
        for (var fd = 0; fd <= FS.MAX_OPEN_FDS; fd++) {
          if (!FS.streams[fd]) {
            return fd;
          }
        }
        throw new FS.ErrnoError(33);
      },
  getStreamChecked(fd) {
        var stream = FS.getStream(fd);
        if (!stream) {
          throw new FS.ErrnoError(8);
        }
        return stream;
      },
  getStream:(fd) => FS.streams[fd],
  createStream(stream, fd = -1) {
        assert(fd >= -1);
  
        // clone it, so we can return an instance of FSStream
        stream = Object.assign(new FS.FSStream(), stream);
        if (fd == -1) {
          fd = FS.nextfd();
        }
        stream.fd = fd;
        FS.streams[fd] = stream;
        return stream;
      },
  closeStream(fd) {
        FS.streams[fd] = null;
      },
  dupStream(origStream, fd = -1) {
        var stream = FS.createStream(origStream, fd);
        stream.stream_ops?.dup?.(stream);
        return stream;
      },
  doSetAttr(stream, node, attr) {
        var setattr = stream?.stream_ops.setattr;
        var arg = setattr ? stream : node;
        setattr ??= node.node_ops.setattr;
        FS.checkOpExists(setattr, 63)
        try {
          setattr(arg, attr);
        } catch (e) {
          if (e instanceof RangeError) {
            throw new FS.ErrnoError(22);
          }
          throw e;
        }
      },
  chrdev_stream_ops:{
  open(stream) {
          var device = FS.getDevice(stream.node.rdev);
          // override node's stream ops with the device's
          stream.stream_ops = device.stream_ops;
          // forward the open call
          stream.stream_ops.open?.(stream);
        },
  llseek() {
          throw new FS.ErrnoError(70);
        },
  },
  major:(dev) => ((dev) >> 8),
  minor:(dev) => ((dev) & 0xff),
  makedev:(ma, mi) => ((ma) << 8 | (mi)),
  registerDevice(dev, ops) {
        FS.devices[dev] = { stream_ops: ops };
      },
  getDevice:(dev) => FS.devices[dev],
  getMounts(mount) {
        var mounts = [];
        var check = [mount];
  
        while (check.length) {
          var m = check.pop();
  
          mounts.push(m);
  
          check.push(...m.mounts);
        }
  
        return mounts;
      },
  syncfs(populate, callback) {
        if (typeof populate == 'function') {
          callback = populate;
          populate = false;
        }
  
        FS.syncFSRequests++;
  
        if (FS.syncFSRequests > 1) {
          err(`warning: ${FS.syncFSRequests} FS.syncfs operations in flight at once, probably just doing extra work`);
        }
  
        var mounts = FS.getMounts(FS.root.mount);
        var completed = 0;
  
        function doCallback(errCode) {
          assert(FS.syncFSRequests > 0);
          FS.syncFSRequests--;
          return callback(errCode);
        }
  
        function done(errCode) {
          if (errCode) {
            if (!done.errored) {
              done.errored = true;
              return doCallback(errCode);
            }
            return;
          }
          if (++completed >= mounts.length) {
            doCallback(null);
          }
        };
  
        // sync all mounts
        for (var mount of mounts) {
          if (mount.type.syncfs) {
            mount.type.syncfs(mount, populate, done);
          } else {
            done(null);
          }
        }
      },
  mount(type, opts, mountpoint) {
        if (typeof type == 'string') {
          // The filesystem was not included, and instead we have an error
          // message stored in the variable.
          throw type;
        }
        var root = mountpoint === '/';
        var pseudo = !mountpoint;
        var node;
  
        if (root && FS.root) {
          throw new FS.ErrnoError(10);
        } else if (!root && !pseudo) {
          var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
  
          mountpoint = lookup.path;  // use the absolute path
          node = lookup.node;
  
          if (FS.isMountpoint(node)) {
            throw new FS.ErrnoError(10);
          }
  
          if (!FS.isDir(node.mode)) {
            throw new FS.ErrnoError(54);
          }
        }
  
        var mount = {
          type,
          opts,
          mountpoint,
          mounts: []
        };
  
        // create a root node for the fs
        var mountRoot = type.mount(mount);
        mountRoot.mount = mount;
        mount.root = mountRoot;
  
        if (root) {
          FS.root = mountRoot;
        } else if (node) {
          // set as a mountpoint
          node.mounted = mount;
  
          // add the new mount to the current mount's children
          if (node.mount) {
            node.mount.mounts.push(mount);
          }
        }
  
        return mountRoot;
      },
  unmount(mountpoint) {
        var lookup = FS.lookupPath(mountpoint, { follow_mount: false });
  
        if (!FS.isMountpoint(lookup.node)) {
          throw new FS.ErrnoError(28);
        }
  
        // destroy the nodes for this mount, and all its child mounts
        var node = lookup.node;
        var mount = node.mounted;
        var mounts = FS.getMounts(mount);
  
        for (var [hash, current] of Object.entries(FS.nameTable)) {
          while (current) {
            var next = current.name_next;
  
            if (mounts.includes(current.mount)) {
              FS.destroyNode(current);
            }
  
            current = next;
          }
        }
  
        // no longer a mountpoint
        node.mounted = null;
  
        // remove this mount from the child mounts
        var idx = node.mount.mounts.indexOf(mount);
        assert(idx !== -1);
        node.mount.mounts.splice(idx, 1);
      },
  lookup(parent, name) {
        return parent.node_ops.lookup(parent, name);
      },
  mknod(path, mode, dev) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        var name = PATH.basename(path);
        if (!name) {
          throw new FS.ErrnoError(28);
        }
        if (name === '.' || name === '..') {
          throw new FS.ErrnoError(20);
        }
        var errCode = FS.mayCreate(parent, name);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        if (!parent.node_ops.mknod) {
          throw new FS.ErrnoError(63);
        }
        return parent.node_ops.mknod(parent, name, mode, dev);
      },
  statfs(path) {
        return FS.statfsNode(FS.lookupPath(path, {follow: true}).node);
      },
  statfsStream(stream) {
        // We keep a separate statfsStream function because noderawfs overrides
        // it. In noderawfs, stream.node is sometimes null. Instead, we need to
        // look at stream.path.
        return FS.statfsNode(stream.node);
      },
  statfsNode(node) {
        // NOTE: None of the defaults here are true. We're just returning safe and
        //       sane values. Currently nodefs and rawfs replace these defaults,
        //       other file systems leave them alone.
        var rtn = {
          bsize: 4096,
          frsize: 4096,
          blocks: 1e6,
          bfree: 5e5,
          bavail: 5e5,
          files: FS.nextInode,
          ffree: FS.nextInode - 1,
          fsid: 42,
          flags: 2,
          namelen: 255,
        };
  
        if (node.node_ops.statfs) {
          Object.assign(rtn, node.node_ops.statfs(node.mount.opts.root));
        }
        return rtn;
      },
  create(path, mode = 0o666) {
        mode &= 4095;
        mode |= 32768;
        return FS.mknod(path, mode, 0);
      },
  mkdir(path, mode = 0o777) {
        mode &= 511 | 512;
        mode |= 16384;
        return FS.mknod(path, mode, 0);
      },
  mkdirTree(path, mode) {
        var dirs = path.split('/');
        var d = '';
        for (var dir of dirs) {
          if (!dir) continue;
          if (d || PATH.isAbs(path)) d += '/';
          d += dir;
          try {
            FS.mkdir(d, mode);
          } catch(e) {
            if (e.errno != 20) throw e;
          }
        }
      },
  mkdev(path, mode, dev) {
        if (typeof dev == 'undefined') {
          dev = mode;
          mode = 0o666;
        }
        mode |= 8192;
        return FS.mknod(path, mode, dev);
      },
  symlink(oldpath, newpath) {
        if (!PATH_FS.resolve(oldpath)) {
          throw new FS.ErrnoError(44);
        }
        var lookup = FS.lookupPath(newpath, { parent: true });
        var parent = lookup.node;
        if (!parent) {
          throw new FS.ErrnoError(44);
        }
        var newname = PATH.basename(newpath);
        var errCode = FS.mayCreate(parent, newname);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        if (!parent.node_ops.symlink) {
          throw new FS.ErrnoError(63);
        }
        return parent.node_ops.symlink(parent, newname, oldpath);
      },
  link(oldpath, newpath, flags) {
        var lookup = FS.lookupPath(newpath, { parent: true });
        var parent = lookup.node;
        if (!parent) {
          throw new FS.ErrnoError(44);
        }
        var newname = PATH.basename(newpath);
        var errCode = FS.mayCreate(parent, newname);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        // Hardlinks are only supported by filesystem backends that provide a
        // `link` node op (e.g. NODERAWFS backed by the host). NODEFS omits it:
        // a host hardlink cannot be confined to the mount root.
        if (!parent.node_ops.link) {
          throw new FS.ErrnoError(34);
        }
        return parent.node_ops.link(parent, newname, oldpath, flags);
      },
  rename(old_path, new_path) {
        var old_dirname = PATH.dirname(old_path);
        var new_dirname = PATH.dirname(new_path);
        var old_name = PATH.basename(old_path);
        var new_name = PATH.basename(new_path);
        // parents must exist
        var lookup, old_dir, new_dir;
  
        // let the errors from non existent directories percolate up
        lookup = FS.lookupPath(old_path, { parent: true });
        old_dir = lookup.node;
        lookup = FS.lookupPath(new_path, { parent: true });
        new_dir = lookup.node;
  
        if (!old_dir || !new_dir) throw new FS.ErrnoError(44);
        // need to be part of the same mount
        if (old_dir.mount !== new_dir.mount) {
          throw new FS.ErrnoError(75);
        }
        // source must exist
        var old_node = FS.lookupNode(old_dir, old_name);
        // old path should not be an ancestor of the new path
        var relative = PATH_FS.relative(old_path, new_dirname);
        if (relative.charAt(0) !== '.') {
          throw new FS.ErrnoError(28);
        }
        // new path should not be an ancestor of the old path
        relative = PATH_FS.relative(new_path, old_dirname);
        if (relative.charAt(0) !== '.') {
          throw new FS.ErrnoError(55);
        }
        // see if the new path already exists
        var new_node;
        try {
          new_node = FS.lookupNode(new_dir, new_name);
        } catch (e) {
          // not fatal
        }
        // early out if nothing needs to change
        if (old_node === new_node) {
          return;
        }
        // we'll need to delete the old entry
        var isdir = FS.isDir(old_node.mode);
        var errCode = FS.mayDelete(old_dir, old_name, isdir);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        // need delete permissions if we'll be overwriting.
        // need create permissions if new doesn't already exist.
        errCode = new_node ?
          FS.mayDelete(new_dir, new_name, isdir) :
          FS.mayCreate(new_dir, new_name);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        if (!old_dir.node_ops.rename) {
          throw new FS.ErrnoError(63);
        }
        if (FS.isMountpoint(old_node) || (new_node && FS.isMountpoint(new_node))) {
          throw new FS.ErrnoError(10);
        }
        // if we are going to change the parent, check write permissions
        if (new_dir !== old_dir) {
          errCode = FS.nodePermissions(old_dir, 'w');
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
        }
        // remove the node from the lookup hash
        FS.hashRemoveNode(old_node);
        // do the underlying fs rename
        try {
          old_dir.node_ops.rename(old_node, new_dir, new_name);
          // update old node (we do this here to avoid each backend
          // needing to)
          old_node.parent = new_dir;
        } catch (e) {
          throw e;
        } finally {
          // add the node back to the hash (in case node_ops.rename
          // changed its name)
          FS.hashAddNode(old_node);
        }
      },
  rmdir(path) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        var name = PATH.basename(path);
        var node = FS.lookupNode(parent, name);
        var errCode = FS.mayDelete(parent, name, true);
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        if (!parent.node_ops.rmdir) {
          throw new FS.ErrnoError(63);
        }
        if (FS.isMountpoint(node)) {
          throw new FS.ErrnoError(10);
        }
        parent.node_ops.rmdir(parent, name);
        FS.destroyNode(node);
      },
  readdir(path) {
        var lookup = FS.lookupPath(path, { follow: true });
        var node = lookup.node;
        var readdir = FS.checkOpExists(node.node_ops.readdir, 54);
        return readdir(node);
      },
  unlink(path) {
        var lookup = FS.lookupPath(path, { parent: true });
        var parent = lookup.node;
        if (!parent) {
          throw new FS.ErrnoError(44);
        }
        var name = PATH.basename(path);
        var node = FS.lookupNode(parent, name);
        var errCode = FS.mayDelete(parent, name, false);
        if (errCode) {
          // According to POSIX, we should map EISDIR to EPERM, but
          // we instead do what Linux does (and we must, as we use
          // the musl linux libc).
          throw new FS.ErrnoError(errCode);
        }
        if (!parent.node_ops.unlink) {
          throw new FS.ErrnoError(63);
        }
        if (FS.isMountpoint(node)) {
          throw new FS.ErrnoError(10);
        }
        parent.node_ops.unlink(parent, name);
        FS.destroyNode(node);
      },
  readlink(path) {
        var lookup = FS.lookupPath(path);
        var link = lookup.node;
        if (!link) {
          throw new FS.ErrnoError(44);
        }
        if (!link.node_ops.readlink) {
          throw new FS.ErrnoError(28);
        }
        return link.node_ops.readlink(link);
      },
  stat(path, dontFollow) {
        var lookup = FS.lookupPath(path, { follow: !dontFollow });
        var node = lookup.node;
        var getattr = FS.checkOpExists(node.node_ops.getattr, 63);
        return getattr(node);
      },
  fstat(fd) {
        var stream = FS.getStreamChecked(fd);
        var node = stream.node;
        var getattr = stream.stream_ops.getattr;
        var arg = getattr ? stream : node;
        getattr ??= node.node_ops.getattr;
        FS.checkOpExists(getattr, 63)
        return getattr(arg);
      },
  lstat(path) {
        return FS.stat(path, true);
      },
  doChmod(stream, node, mode, dontFollow) {
        FS.doSetAttr(stream, node, {
          mode: (mode & 4095) | (node.mode & ~4095),
          ctime: Date.now(),
          dontFollow
        });
      },
  chmod(path, mode, dontFollow) {
        var node;
        if (typeof path == 'string') {
          var lookup = FS.lookupPath(path, { follow: !dontFollow });
          node = lookup.node;
        } else {
          node = path;
        }
        FS.doChmod(null, node, mode, dontFollow);
      },
  lchmod(path, mode) {
        FS.chmod(path, mode, true);
      },
  fchmod(fd, mode) {
        var stream = FS.getStreamChecked(fd);
        FS.doChmod(stream, stream.node, mode, false);
      },
  doChown(stream, node, dontFollow) {
        FS.doSetAttr(stream, node, {
          timestamp: Date.now(),
          dontFollow
          // we ignore the uid / gid for now
        });
      },
  chown(path, uid, gid, dontFollow) {
        var node;
        if (typeof path == 'string') {
          var lookup = FS.lookupPath(path, { follow: !dontFollow });
          node = lookup.node;
        } else {
          node = path;
        }
        FS.doChown(null, node, dontFollow);
      },
  lchown(path, uid, gid) {
        FS.chown(path, uid, gid, true);
      },
  fchown(fd, uid, gid) {
        var stream = FS.getStreamChecked(fd);
        FS.doChown(stream, stream.node, false);
      },
  doTruncate(stream, node, len) {
        if (FS.isDir(node.mode)) {
          throw new FS.ErrnoError(31);
        }
        if (!FS.isFile(node.mode)) {
          throw new FS.ErrnoError(28);
        }
        var errCode = FS.nodePermissions(node, 'w');
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        FS.doSetAttr(stream, node, {
          size: len,
          timestamp: Date.now()
        });
      },
  truncate(path, len) {
        if (len < 0) {
          throw new FS.ErrnoError(28);
        }
        var node;
        if (typeof path == 'string') {
          var lookup = FS.lookupPath(path, { follow: true });
          node = lookup.node;
        } else {
          node = path;
        }
        FS.doTruncate(null, node, len);
      },
  ftruncate(fd, len) {
        var stream = FS.getStreamChecked(fd);
        if (len < 0 || (stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(28);
        }
        FS.doTruncate(stream, stream.node, len);
      },
  utime(path, atime, mtime, dontFollow) {
        var lookup = FS.lookupPath(path, { follow: !dontFollow });
        FS.doSetAttr(null, lookup.node, {
          atime: atime,
          mtime: mtime,
          dontFollow
        });
      },
  open(path, flags, mode = 0o666) {
        if (path === '') {
          throw new FS.ErrnoError(44);
        }
        flags = FS_modeStringToFlags(flags);
        if ((flags & 64)) {
          mode = (mode & 4095) | 32768;
        } else {
          mode = 0;
        }
        var node;
        var isDirPath;
        if (typeof path == 'object') {
          node = path;
        } else {
          isDirPath = path.endsWith('/');
          // noent_okay makes it so that if the final component of the path
          // doesn't exist, lookupPath returns `node: undefined`. `path` will be
          // updated to point to the target of all symlinks.
          var lookup = FS.lookupPath(path, {
            follow: !(flags & 131072),
            noent_okay: true
          });
          node = lookup.node;
          path = lookup.path;
        }
        // perhaps we need to create the node
        var created = false;
        if ((flags & 64)) {
          if (node) {
            // if O_CREAT and O_EXCL are set, error out if the node already exists
            if ((flags & 128)) {
              throw new FS.ErrnoError(20);
            }
          } else if (isDirPath) {
            throw new FS.ErrnoError(31);
          } else {
            // node doesn't exist, try to create it
            // Ignore the permission bits here to ensure we can `open` this new
            // file below. We use chmod below to apply the permissions once the
            // file is open.
            node = FS.mknod(path, mode | 0o777, 0);
            created = true;
          }
        }
        if (!node) {
          throw new FS.ErrnoError(44);
        }
        // can't truncate a device
        if (FS.isChrdev(node.mode)) {
          flags &= ~512;
        }
        // if asked only for a directory, then this must be one
        if ((flags & 65536) && !FS.isDir(node.mode)) {
          throw new FS.ErrnoError(54);
        }
        // check permissions, if this is not a file we just created now (it is ok to
        // create and write to a file with read-only permissions; it is read-only
        // for later use)
        if (!created) {
          var errCode = FS.mayOpen(node, flags);
          if (errCode) {
            throw new FS.ErrnoError(errCode);
          }
        }
        // do truncation if necessary
        if ((flags & 512) && !created) {
          FS.truncate(node, 0);
        }
        // we've already handled these, don't pass down to the underlying vfs
        flags &= ~(128 | 512 | 131072);
  
        // register the stream with the filesystem
        var stream = FS.createStream({
          node,
          path: FS.getPath(node),  // we want the absolute path to the node
          flags,
          seekable: true,
          position: 0,
          stream_ops: node.stream_ops,
          // used by the file family libc calls (fopen, fwrite, ferror, etc.)
          ungotten: [],
          error: false
        });
        // call the new stream's open function
        if (stream.stream_ops.open) {
          stream.stream_ops.open(stream);
        }
        if (created) {
          FS.chmod(node, mode & 0o777);
        }
        return stream;
      },
  close(stream) {
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if (stream.getdents) stream.getdents = null; // free readdir state
        // The fd is going away: wake anything waiting on it (poll/epoll) with
        // POLLNVAL so a blocking wait unblocks and an epoll registration is evicted
        // on its next derive. Only sockets/pipes/epoll ever carry a wait-queue, so
        // for every other stream (incl. nodeless noderawfs stdio) this is a no-op.
        stream.node?.notifyListeners(32);
        try {
          if (stream.stream_ops.close) {
            stream.stream_ops.close(stream);
          }
        } catch (e) {
          throw e;
        } finally {
          FS.closeStream(stream.fd);
        }
        stream.fd = null;
      },
  isClosed(stream) {
        return stream.fd === null;
      },
  llseek(stream, offset, whence) {
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if (!stream.seekable || !stream.stream_ops.llseek) {
          throw new FS.ErrnoError(70);
        }
        if (whence != 0 && whence != 1 && whence != 2) {
          throw new FS.ErrnoError(28);
        }
        stream.position = stream.stream_ops.llseek(stream, offset, whence);
        stream.ungotten = [];
        return stream.position;
      },
  read(stream, buffer, offset, length, position) {
        assert(offset >= 0);
        if (length < 0 || position < 0) {
          throw new FS.ErrnoError(28);
        }
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if ((stream.flags & 2097155) === 1) {
          throw new FS.ErrnoError(8);
        }
        if (FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(31);
        }
        if (!stream.stream_ops.read) {
          throw new FS.ErrnoError(28);
        }
        var seeking = typeof position != 'undefined';
        if (!seeking) {
          position = stream.position;
        } else if (!stream.seekable) {
          throw new FS.ErrnoError(70);
        }
        var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);
        if (!seeking) stream.position += bytesRead;
        return bytesRead;
      },
  write(stream, buffer, offset, length, position, canOwn) {
        assert(offset >= 0);
        assert(buffer.subarray, 'FS.write expects a TypedArray');
        if (length < 0 || position < 0) {
          throw new FS.ErrnoError(28);
        }
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8);
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(8);
        }
        if (FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(31);
        }
        if (!stream.stream_ops.write) {
          throw new FS.ErrnoError(28);
        }
        if (stream.seekable && stream.flags & 1024) {
          // seek to the end before writing in append mode
          FS.llseek(stream, 0, 2);
        }
        var seeking = typeof position != 'undefined';
        if (!seeking) {
          position = stream.position;
        } else if (!stream.seekable) {
          throw new FS.ErrnoError(70);
        }
        var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);
        if (!seeking) stream.position += bytesWritten;
        return bytesWritten;
      },
  mmap(stream, length, position, prot, flags) {
        // User requests writing to file (prot & PROT_WRITE != 0).
        // Checking if we have permissions to write to the file unless
        // MAP_PRIVATE flag is set. According to POSIX spec it is possible
        // to write to file opened in read-only mode with MAP_PRIVATE flag,
        // as all modifications will be visible only in the memory of
        // the current process.
        if ((prot & 2) !== 0
            && (flags & 2) === 0
            && (stream.flags & 2097155) !== 2) {
          throw new FS.ErrnoError(2);
        }
        if ((stream.flags & 2097155) === 1) {
          throw new FS.ErrnoError(2);
        }
        if (!stream.stream_ops.mmap) {
          throw new FS.ErrnoError(43);
        }
        if (!length) {
          throw new FS.ErrnoError(28);
        }
        return stream.stream_ops.mmap(stream, length, position, prot, flags);
      },
  msync(stream, buffer, offset, length, mmapFlags) {
        assert(offset >= 0);
        if (!stream.stream_ops.msync) {
          return 0;
        }
        return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags);
      },
  ioctl(stream, cmd, arg) {
        if (!stream.stream_ops.ioctl) {
          throw new FS.ErrnoError(59);
        }
        return stream.stream_ops.ioctl(stream, cmd, arg);
      },
  readFile(path, opts = {}) {
        opts.flags = opts.flags ?? 0;
        opts.encoding = opts.encoding ?? 'binary';
        if (opts.encoding !== 'utf8' && opts.encoding !== 'binary') {
          abort(`Invalid encoding type "${opts.encoding}"`);
        }
        var stream = FS.open(path, opts.flags);
        var stat = FS.stat(path);
        var length = stat.size;
        var buf = new Uint8Array(length);
        FS.read(stream, buf, 0, length, 0);
        if (opts.encoding === 'utf8') {
          buf = UTF8ArrayToString(buf);
        }
        FS.close(stream);
        return buf;
      },
  writeFile(path, data, opts = {}) {
        opts.flags = opts.flags ?? 577;
        var stream = FS.open(path, opts.flags, opts.mode);
        data = FS_fileDataToTypedArray(data);
        FS.write(stream, data, 0, data.byteLength, undefined, opts.canOwn);
        FS.close(stream);
      },
  cwd:() => FS.currentPath,
  chdir(path) {
        var lookup = FS.lookupPath(path, { follow: true });
        if (lookup.node === null) {
          throw new FS.ErrnoError(44);
        }
        if (!FS.isDir(lookup.node.mode)) {
          throw new FS.ErrnoError(54);
        }
        var errCode = FS.nodePermissions(lookup.node, 'x');
        if (errCode) {
          throw new FS.ErrnoError(errCode);
        }
        FS.currentPath = lookup.path;
      },
  createDefaultDirectories() {
        FS.mkdir('/tmp');
        FS.mkdir('/home');
        FS.mkdir('/home/web_user');
      },
  createDefaultDevices() {
        // create /dev
        FS.mkdir('/dev');
        // setup /dev/null
        FS.registerDevice(FS.makedev(1, 3), {
          read: () => 0,
          write: (stream, buffer, offset, length, pos) => length,
          llseek: () => 0,
        });
        FS.mkdev('/dev/null', FS.makedev(1, 3));
        // setup /dev/tty and /dev/tty1
        // stderr needs to print output using err() rather than out()
        // so we register a second tty just for it.
        TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
        TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
        FS.mkdev('/dev/tty', FS.makedev(5, 0));
        FS.mkdev('/dev/tty1', FS.makedev(6, 0));
        // setup /dev/[u]random
        // use a buffer to avoid overhead of individual crypto calls per byte
        var randomBuffer = new Uint8Array(1024), randomLeft = 0;
        var randomByte = () => {
          if (randomLeft === 0) {
            randomFill(randomBuffer);
            randomLeft = randomBuffer.byteLength;
          }
          return randomBuffer[--randomLeft];
        };
        FS.createDevice('/dev', 'random', randomByte);
        FS.createDevice('/dev', 'urandom', randomByte);
        // we're not going to emulate the actual shm device,
        // just create the tmp dirs that reside in it commonly
        FS.mkdir('/dev/shm');
        FS.mkdir('/dev/shm/tmp');
      },
  createSpecialDirectories() {
        // create /proc/self/fd which allows /proc/self/fd/6 => readlink gives the
        // name of the stream for fd 6 (see test_unistd_ttyname)
        FS.mkdir('/proc');
        var proc_self = FS.mkdir('/proc/self');
        FS.mkdir('/proc/self/fd');
        FS.mount({
          mount() {
            var node = FS.createNode(proc_self, 'fd', 16895, 73);
            node.stream_ops = {
              llseek: MEMFS.stream_ops.llseek,
            };
            node.node_ops = {
              lookup(parent, name) {
                var fd = +name;
                var stream = FS.getStreamChecked(fd);
                var ret = {
                  parent: null,
                  mount: { mountpoint: 'fake' },
                  node_ops: { readlink: () => stream.path },
                  id: fd + 1,
                };
                ret.parent = ret; // make it look like a simple root node
                return ret;
              },
              readdir() {
                return Array.from(FS.streams.entries())
                  .filter(([k, v]) => v)
                  .map(([k, v]) => k.toString());
              }
            };
            return node;
          }
        }, {}, '/proc/self/fd');
      },
  createStandardStreams(input, output, error) {
        // TODO deprecate the old functionality of a single
        // input / output callback and that utilizes FS.createDevice
        // and instead require a unique set of stream ops
  
        // by default, we symlink the standard streams to the
        // default tty devices. however, if the standard streams
        // have been overwritten we create a unique device for
        // them instead.
        if (input) {
          FS.createDevice('/dev', 'stdin', input);
        } else {
          FS.symlink('/dev/tty', '/dev/stdin');
        }
        if (output) {
          FS.createDevice('/dev', 'stdout', null, output);
        } else {
          FS.symlink('/dev/tty', '/dev/stdout');
        }
        if (error) {
          FS.createDevice('/dev', 'stderr', null, error);
        } else {
          FS.symlink('/dev/tty1', '/dev/stderr');
        }
  
        // open default streams for the stdin, stdout and stderr devices
        var stdin = FS.open('/dev/stdin', 0);
        var stdout = FS.open('/dev/stdout', 1);
        var stderr = FS.open('/dev/stderr', 1);
        assert(stdin.fd === 0, `invalid handle for stdin (${stdin.fd})`);
        assert(stdout.fd === 1, `invalid handle for stdout (${stdout.fd})`);
        assert(stderr.fd === 2, `invalid handle for stderr (${stderr.fd})`);
      },
  staticInit() {
        FS.nameTable = new Array(4096);
  
        FS.mount(MEMFS, {}, '/');
  
        FS.createDefaultDirectories();
        FS.createDefaultDevices();
        FS.createSpecialDirectories();
  
        FS.filesystems = {
          'MEMFS': MEMFS,
        };
      },
  init(input, output, error) {
        assert(!FS.initialized, 'FS.init was previously called. If you want to initialize later with custom parameters, remove any earlier calls (note that one is automatically added to the generated code)');
        FS.initialized = true;
  
        // Allow Module.stdin etc. to provide defaults, if none explicitly passed to us here
        input ??= Module['stdin'];
        output ??= Module['stdout'];
        error ??= Module['stderr'];
  
        FS.createStandardStreams(input, output, error);
      },
  quit() {
        FS.initialized = false;
        // force-flush all streams, so we get musl std streams printed out
        _fflush(0);
        // close all of our streams
        for (var stream of FS.streams) {
          if (stream) {
            FS.close(stream);
          }
        }
      },
  findObject(path, dontResolveLastLink) {
        var ret = FS.analyzePath(path, dontResolveLastLink);
        if (!ret.exists) {
          return null;
        }
        return ret.object;
      },
  analyzePath(path, dontResolveLastLink) {
        // operate from within the context of the symlink's target
        try {
          var lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
          path = lookup.path;
        } catch (e) {
        }
        var ret = {
          isRoot: false, exists: false, error: 0, name: null, path: null, object: null,
          parentExists: false, parentPath: null, parentObject: null
        };
        try {
          var lookup = FS.lookupPath(path, { parent: true });
          ret.parentExists = true;
          ret.parentPath = lookup.path;
          ret.parentObject = lookup.node;
          ret.name = PATH.basename(path);
          lookup = FS.lookupPath(path, { follow: !dontResolveLastLink });
          ret.exists = true;
          ret.path = lookup.path;
          ret.object = lookup.node;
          ret.name = lookup.node.name;
          ret.isRoot = lookup.path === '/';
        } catch (e) {
          ret.error = e.errno;
        };
        return ret;
      },
  createPath(parent, path, canRead, canWrite) {
        parent = typeof parent == 'string' ? parent : FS.getPath(parent);
        var parts = path.split('/').reverse();
        while (parts.length) {
          var part = parts.pop();
          if (!part) continue;
          var current = PATH.join2(parent, part);
          try {
            FS.mkdir(current);
          } catch (e) {
            if (e.errno != 20) throw e;
          }
          parent = current;
        }
        return current;
      },
  createFile(parent, name, properties, canRead, canWrite) {
        var path = PATH.join2(typeof parent == 'string' ? parent : FS.getPath(parent), name);
        var mode = FS_getMode(canRead, canWrite);
        return FS.create(path, mode);
      },
  createDataFile(parent, name, data, canRead, canWrite, canOwn) {
        var path = name;
        if (parent) {
          parent = typeof parent == 'string' ? parent : FS.getPath(parent);
          path = name ? PATH.join2(parent, name) : parent;
        }
        var mode = FS_getMode(canRead, canWrite);
        var node = FS.create(path, mode);
        if (data) {
          data = FS_fileDataToTypedArray(data);
          // make sure we can write to the file
          FS.chmod(node, mode | 146);
          var stream = FS.open(node, 577);
          FS.write(stream, data, 0, data.length, 0, canOwn);
          FS.close(stream);
          FS.chmod(node, mode);
        }
      },
  createDevice(parent, name, input, output) {
        var path = PATH.join2(typeof parent == 'string' ? parent : FS.getPath(parent), name);
        var mode = FS_getMode(!!input, !!output);
        FS.createDevice.major ??= 64;
        var dev = FS.makedev(FS.createDevice.major++, 0);
        // Create a fake device that a set of stream ops to emulate
        // the old behavior.
        FS.registerDevice(dev, {
          open(stream) {
            stream.seekable = false;
          },
          close(stream) {
            // flush any pending line data
            if (output?.buffer?.length) {
              output(10);
            }
          },
          read(stream, buffer, offset, length, pos /* ignored */) {
            var bytesRead = 0;
            for (var i = 0; i < length; i++) {
              var result;
              try {
                result = input();
              } catch (e) {
                throw new FS.ErrnoError(29);
              }
              if (result === undefined && bytesRead === 0) {
                throw new FS.ErrnoError(6);
              }
              if (result === null || result === undefined) break;
              bytesRead++;
              buffer[offset+i] = result;
            }
            if (bytesRead) {
              stream.node.atime = Date.now();
            }
            return bytesRead;
          },
          write(stream, buffer, offset, length, pos) {
            for (var i = 0; i < length; i++) {
              try {
                output(buffer[offset+i]);
              } catch (e) {
                throw new FS.ErrnoError(29);
              }
            }
            if (length) {
              stream.node.mtime = stream.node.ctime = Date.now();
            }
            return i;
          }
        });
        return FS.mkdev(path, mode, dev);
      },
  forceLoadFile(obj) {
        if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;
        if (globalThis.XMLHttpRequest) {
          abort('Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.');
        } else { // Command-line.
          try {
            obj.contents = readBinary(obj.url);
          } catch (e) {
            throw new FS.ErrnoError(29);
          }
        }
      },
  createLazyFile(parent, name, url, canRead, canWrite) {
        // Lazy chunked Uint8Array (implements get and length from Uint8Array).
        // Actual getting is abstracted away for eventual reuse.
        class LazyUint8Array {
          lengthKnown = false;
          chunks = []; // Loaded chunks. Index is the chunk number
          get(idx) {
            if (idx > this.length-1 || idx < 0) {
              return undefined;
            }
            var chunkOffset = idx % this.chunkSize;
            var chunkNum = (idx / this.chunkSize)|0;
            return this.getter(chunkNum)[chunkOffset];
          }
          setDataGetter(getter) {
            this.getter = getter;
          }
          cacheLength() {
            // Find length
            var xhr = new XMLHttpRequest();
            xhr.open('HEAD', url, false);
            xhr.send(null);
            if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) abort(`Couldn't load ${url}. Status: ${xhr.status}`);
            var datalength = Number(xhr.getResponseHeader('Content-length'));
            var header;
            var hasByteServing = (header = xhr.getResponseHeader('Accept-Ranges')) && header === 'bytes';
            var usesGzip = (header = xhr.getResponseHeader('Content-Encoding')) && header === 'gzip';
  
            var chunkSize = 1024*1024; // Chunk size in bytes
  
            if (!hasByteServing) chunkSize = datalength;
  
            // Function to get a range from the remote URL.
            var doXHR = (from, to) => {
              if (from > to) abort(`invalid range (${from}, ${to}) or no bytes requested!`);
              if (to > datalength-1) abort(`only ${datalength} bytes available! programmer error!`);
  
              // TODO: Use mozResponseArrayBuffer, responseStream, etc. if available.
              var xhr = new XMLHttpRequest();
              xhr.open('GET', url, false);
              if (datalength !== chunkSize) xhr.setRequestHeader('Range', `bytes=${from}-${to}`);
  
              // Some hints to the browser that we want binary data.
              xhr.responseType = 'arraybuffer';
              if (xhr.overrideMimeType) {
                xhr.overrideMimeType('text/plain; charset=x-user-defined');
              }
  
              xhr.send(null);
              if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) abort(`Couldn't load ${url}. Status: ${xhr.status}`);
              if (xhr.response !== undefined) {
                return new Uint8Array(/** @type{Array<number>} */(xhr.response || []));
              }
              return intArrayFromString(xhr.responseText ?? '', true);
            };
            var lazyArray = this;
            lazyArray.setDataGetter((chunkNum) => {
              var start = chunkNum * chunkSize;
              var end = (chunkNum+1) * chunkSize - 1; // including this byte
              end = Math.min(end, datalength-1); // if datalength-1 is selected, this is the last block
              if (typeof lazyArray.chunks[chunkNum] == 'undefined') {
                lazyArray.chunks[chunkNum] = doXHR(start, end);
              }
              if (typeof lazyArray.chunks[chunkNum] == 'undefined') abort('doXHR failed!');
              return lazyArray.chunks[chunkNum];
            });
  
            if (usesGzip || !datalength) {
              // if the server uses gzip or doesn't supply the length, we have to download the whole file to get the (uncompressed) length
              chunkSize = datalength = 1; // this will force getter(0)/doXHR do download the whole file
              datalength = this.getter(0).length;
              chunkSize = datalength;
              out('LazyFiles on gzip forces download of the whole file when length is accessed');
            }
  
            this._length = datalength;
            this._chunkSize = chunkSize;
            this.lengthKnown = true;
          }
          get length() {
            if (!this.lengthKnown) {
              this.cacheLength();
            }
            return this._length;
          }
          get chunkSize() {
            if (!this.lengthKnown) {
              this.cacheLength();
            }
            return this._chunkSize;
          }
        }
  
        if (globalThis.XMLHttpRequest) {
          if (!ENVIRONMENT_IS_WORKER) abort('Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc');
          var lazyArray = new LazyUint8Array();
          var properties = { isDevice: false, contents: lazyArray };
        } else {
          var properties = { isDevice: false, url: url };
        }
  
        var node = FS.createFile(parent, name, properties, canRead, canWrite);
        // This is a total hack, but I want to get this lazy file code out of the
        // core of MEMFS. If we want to keep this lazy file concept I feel it should
        // be its own thin LAZYFS proxying calls to MEMFS.
        if (properties.contents) {
          node.contents = properties.contents;
        } else if (properties.url) {
          node.contents = null;
          node.url = properties.url;
        }
        // Add a function that defers querying the file size until it is asked the first time.
        Object.defineProperties(node, {
          usedBytes: {
            get: function() { return this.contents.length; }
          }
        });
        // override each stream op with one that tries to force load the lazy file first
        var stream_ops = {};
        for (const [key, fn] of Object.entries(node.stream_ops)) {
          stream_ops[key] = (...args) => {
            FS.forceLoadFile(node);
            return fn(...args);
          };
        }
        function writeChunks(stream, buffer, offset, length, position) {
          var contents = stream.node.contents;
          if (position >= contents.length)
            return 0;
          var size = Math.min(contents.length - position, length);
          assert(size >= 0);
          if (contents.slice) { // normal array
            for (var i = 0; i < size; i++) {
              buffer[offset + i] = contents[position + i];
            }
          } else {
            for (var i = 0; i < size; i++) { // LazyUint8Array from sync binary XHR
              buffer[offset + i] = contents.get(position + i);
            }
          }
          return size;
        }
        // use a custom read function
        stream_ops.read = (stream, buffer, offset, length, position) => {
          FS.forceLoadFile(node);
          return writeChunks(stream, buffer, offset, length, position)
        };
        // use a custom mmap function
        stream_ops.mmap = (stream, length, position, prot, flags) => {
          FS.forceLoadFile(node);
          var ptr = mmapAlloc(length);
          if (!ptr) {
            throw new FS.ErrnoError(48);
          }
          writeChunks(stream, HEAP8, ptr, length, position);
          return { ptr, allocated: true };
        };
        node.stream_ops = stream_ops;
        return node;
      },
  };
  
  
  
  
  var SYSCALLS = {
  currentUmask:18,
  calculateAt(dirfd, path, allowEmpty) {
        if (PATH.isAbs(path)) {
          return path;
        }
        // relative path
        var dir;
        if (dirfd === -100) {
          dir = FS.cwd();
        } else {
          var dirstream = SYSCALLS.getStreamFromFD(dirfd);
          dir = dirstream.path;
        }
        if (path.length == 0) {
          if (!allowEmpty) {
            throw new FS.ErrnoError(44);;
          }
          return dir;
        }
        return dir + '/' + path;
      },
  writeStat(buf, stat) {
        HEAPU32[((buf)>>2)] = stat.dev;
        HEAPU32[(((buf)+(4))>>2)] = stat.mode;
        HEAPU32[(((buf)+(8))>>2)] = stat.nlink;
        HEAPU32[(((buf)+(12))>>2)] = stat.uid;
        HEAPU32[(((buf)+(16))>>2)] = stat.gid;
        HEAPU32[(((buf)+(20))>>2)] = stat.rdev;
        (tempI64 = [stat.size>>>0,(tempDouble = stat.size,(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? (+(Math.floor((tempDouble)/4294967296.0)))>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)], HEAP32[(((buf)+(24))>>2)] = tempI64[0],HEAP32[(((buf)+(28))>>2)] = tempI64[1]);
        HEAP32[(((buf)+(32))>>2)] = 4096;
        HEAP32[(((buf)+(36))>>2)] = stat.blocks;
        var atime = stat.atime.getTime();
        var mtime = stat.mtime.getTime();
        var ctime = stat.ctime.getTime();
        (tempI64 = [Math.floor(atime / 1000)>>>0,(tempDouble = Math.floor(atime / 1000),(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? (+(Math.floor((tempDouble)/4294967296.0)))>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)], HEAP32[(((buf)+(40))>>2)] = tempI64[0],HEAP32[(((buf)+(44))>>2)] = tempI64[1]);
        HEAPU32[(((buf)+(48))>>2)] = (atime % 1000) * 1000 * 1000;
        (tempI64 = [Math.floor(mtime / 1000)>>>0,(tempDouble = Math.floor(mtime / 1000),(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? (+(Math.floor((tempDouble)/4294967296.0)))>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)], HEAP32[(((buf)+(56))>>2)] = tempI64[0],HEAP32[(((buf)+(60))>>2)] = tempI64[1]);
        HEAPU32[(((buf)+(64))>>2)] = (mtime % 1000) * 1000 * 1000;
        (tempI64 = [Math.floor(ctime / 1000)>>>0,(tempDouble = Math.floor(ctime / 1000),(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? (+(Math.floor((tempDouble)/4294967296.0)))>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)], HEAP32[(((buf)+(72))>>2)] = tempI64[0],HEAP32[(((buf)+(76))>>2)] = tempI64[1]);
        HEAPU32[(((buf)+(80))>>2)] = (ctime % 1000) * 1000 * 1000;
        (tempI64 = [stat.ino>>>0,(tempDouble = stat.ino,(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? (+(Math.floor((tempDouble)/4294967296.0)))>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)], HEAP32[(((buf)+(88))>>2)] = tempI64[0],HEAP32[(((buf)+(92))>>2)] = tempI64[1]);
        return 0;
      },
  writeStatFs(buf, stats) {
        HEAPU32[(((buf)+(4))>>2)] = stats.bsize;
        HEAPU32[(((buf)+(60))>>2)] = stats.bsize;
        (tempI64 = [stats.blocks>>>0,(tempDouble = stats.blocks,(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? (+(Math.floor((tempDouble)/4294967296.0)))>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)], HEAP32[(((buf)+(8))>>2)] = tempI64[0],HEAP32[(((buf)+(12))>>2)] = tempI64[1]);
        (tempI64 = [stats.bfree>>>0,(tempDouble = stats.bfree,(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? (+(Math.floor((tempDouble)/4294967296.0)))>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)], HEAP32[(((buf)+(16))>>2)] = tempI64[0],HEAP32[(((buf)+(20))>>2)] = tempI64[1]);
        (tempI64 = [stats.bavail>>>0,(tempDouble = stats.bavail,(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? (+(Math.floor((tempDouble)/4294967296.0)))>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)], HEAP32[(((buf)+(24))>>2)] = tempI64[0],HEAP32[(((buf)+(28))>>2)] = tempI64[1]);
        (tempI64 = [stats.files>>>0,(tempDouble = stats.files,(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? (+(Math.floor((tempDouble)/4294967296.0)))>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)], HEAP32[(((buf)+(32))>>2)] = tempI64[0],HEAP32[(((buf)+(36))>>2)] = tempI64[1]);
        (tempI64 = [stats.ffree>>>0,(tempDouble = stats.ffree,(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? (+(Math.floor((tempDouble)/4294967296.0)))>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)], HEAP32[(((buf)+(40))>>2)] = tempI64[0],HEAP32[(((buf)+(44))>>2)] = tempI64[1]);
        HEAPU32[(((buf)+(48))>>2)] = stats.fsid;
        HEAPU32[(((buf)+(64))>>2)] = stats.flags;  // ST_NOSUID
        HEAPU32[(((buf)+(56))>>2)] = stats.namelen;
      },
  doMsync(addr, stream, len, flags, offset) {
        if (!FS.isFile(stream.node.mode)) {
          throw new FS.ErrnoError(43);
        }
        if (flags & 2) {
          // MAP_PRIVATE calls need not to be synced back to underlying fs
          return 0;
        }
        var buffer = HEAPU8.subarray(addr, addr + len);
        FS.msync(stream, buffer, offset, len, flags);
      },
  getStreamFromFD(fd) {
        var stream = FS.getStreamChecked(fd);
        return stream;
      },
  varargs:undefined,
  getStr(ptr) {
        var ret = UTF8ToString(ptr);
        return ret;
      },
  };
  
  /** @type {!Int16Array} */
  var HEAP16;
  function ___syscall_fcntl64(fd, cmd, varargs) {
  SYSCALLS.varargs = varargs;
  try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      switch (cmd) {
        case 0: {
          var arg = syscallGetVarargI();
          if (arg < 0) {
            return -28;
          }
          while (FS.streams[arg]) {
            arg++;
          }
          var newStream;
          newStream = FS.dupStream(stream, arg);
          return newStream.fd;
        }
        case 1:
        case 2:
          return 0;  // FD_CLOEXEC makes no sense for a single process.
        case 3:
          return stream.flags;
        case 4: {
          var arg = syscallGetVarargI();
          var mask = 289792;
          stream.flags = (stream.flags & ~mask) | (arg & mask);
          return 0;
        }
        case 12: {
          var arg = syscallGetVarargP();
          var offset = 0;
          // We're always unlocked.
          HEAP16[(((arg)+(offset))>>1)] = 2;
          return 0;
        }
        case 13:
        case 14:
          // Pretend that the locking is successful. These are process-level locks,
          // and Emscripten programs are a single process. If we supported linking a
          // filesystem between programs, we'd need to do more here.
          // See https://github.com/emscripten-core/emscripten/issues/23697
          return 0;
      }
      return -28;
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return -e.errno;
  }
  }
  

  
  
  
  
  function ___syscall_ioctl(fd, op, varargs) {
  SYSCALLS.varargs = varargs;
  try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      switch (op) {
        case 21509: {
          if (!stream.tty) return -59;
          return 0;
        }
        case 21505: {
          if (!stream.tty) return -59;
          if (stream.tty.ops.ioctl_tcgets) {
            var termios = stream.tty.ops.ioctl_tcgets(stream);
            var argp = syscallGetVarargP();
            HEAP32[((argp)>>2)] = termios.c_iflag || 0;
            HEAP32[(((argp)+(4))>>2)] = termios.c_oflag || 0;
            HEAP32[(((argp)+(8))>>2)] = termios.c_cflag || 0;
            HEAP32[(((argp)+(12))>>2)] = termios.c_lflag || 0;
            for (var i = 0; i < 32; i++) {
              HEAP8[(argp + i)+(17)] = termios.c_cc[i] || 0;
            }
            return 0;
          }
          return 0;
        }
        case 21510:
        case 21511:
        case 21512: {
          if (!stream.tty) return -59;
          return 0; // no-op, not actually adjusting terminal settings
        }
        case 21506:
        case 21507:
        case 21508: {
          if (!stream.tty) return -59;
          if (stream.tty.ops.ioctl_tcsets) {
            var argp = syscallGetVarargP();
            var c_iflag = HEAP32[((argp)>>2)];
            var c_oflag = HEAP32[(((argp)+(4))>>2)];
            var c_cflag = HEAP32[(((argp)+(8))>>2)];
            var c_lflag = HEAP32[(((argp)+(12))>>2)];
            var c_cc = []
            for (var i = 0; i < 32; i++) {
              c_cc.push(HEAP8[(argp + i)+(17)]);
            }
            return stream.tty.ops.ioctl_tcsets(stream.tty, op, { c_iflag, c_oflag, c_cflag, c_lflag, c_cc });
          }
          return 0; // no-op, not actually adjusting terminal settings
        }
        case 21519: {
          if (!stream.tty) return -59;
          var argp = syscallGetVarargP();
          HEAP32[((argp)>>2)] = 0;
          return 0;
        }
        case 21520: {
          if (!stream.tty) return -59;
          return -28; // not supported
        }
        case 21537:
        case 21531: {
          var argp = syscallGetVarargP();
          return FS.ioctl(stream, op, argp);
        }
        case 21523: {
          // TODO: in theory we should write to the winsize struct that gets
          // passed in, but for now musl doesn't read anything on it
          if (!stream.tty) return -59;
          if (stream.tty.ops.ioctl_tiocgwinsz) {
            var winsize = stream.tty.ops.ioctl_tiocgwinsz(stream.tty);
            var argp = syscallGetVarargP();
            HEAP16[((argp)>>1)] = winsize[0];
            HEAP16[(((argp)+(2))>>1)] = winsize[1];
          }
          return 0;
        }
        case 21524: {
          // TODO: technically, this ioctl call should change the window size.
          // but, since emscripten doesn't have any concept of a terminal window
          // yet, we'll just silently throw it away as we do TIOCGWINSZ
          if (!stream.tty) return -59;
          return 0;
        }
        case 21515: {
          if (!stream.tty) return -59;
          return 0;
        }
        default: return -28; // not supported
      }
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return -e.errno;
  }
  }
  

  
  function ___syscall_openat(dirfd, path, flags, varargs) {
  SYSCALLS.varargs = varargs;
  try {
  
      path = SYSCALLS.getStr(path);
      path = SYSCALLS.calculateAt(dirfd, path);
      var mode = varargs ? syscallGetVarargI() : 0;
      if (flags & 64) {
        mode &= ~SYSCALLS.currentUmask;
      }
      return FS.open(path, flags, mode).fd;
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return -e.errno;
  }
  }
  

  var __abort_js = () =>
      abort('native code called abort()');

  var getHeapMax = () =>
      // Stay one Wasm page short of 4GB: while e.g. Chrome is able to allocate
      // full 4GB Wasm memories, the size will wrap back to 0 bytes in Wasm side
      // for any code that deals with heap sizes, which would require special
      // casing all heap size related code to treat 0 specially.
      2147483648;
  
  var alignMemory = (size, alignment) => {
      assert(alignment, 'alignment argument is required');
      return Math.ceil(size / alignment) * alignment;
    };
  
  var growMemory = (size) => {
      var oldHeapSize = wasmMemory.buffer.byteLength;
      var pages = ((size - oldHeapSize + 65535) / 65536) | 0;
      try {
        // round size grow request up to wasm page size (fixed 64KB per spec)
        wasmMemory.grow(pages); // .grow() takes a delta compared to the previous size
        updateMemoryViews();
        return 1 /*success*/;
      } catch(e) {
        err(`growMemory: Attempted to grow heap from ${oldHeapSize} bytes to ${size} bytes, but got error: ${e}`);
      }
      // implicit 0 return to save code size (caller will cast 'undefined' into 0
      // anyhow)
    };
  
  var _emscripten_resize_heap = (requestedSize) => {
      var oldSize = HEAPU8.length;
      // With CAN_ADDRESS_2GB or MEMORY64, pointers are already unsigned.
      requestedSize >>>= 0;
      // With multithreaded builds, races can happen (another thread might increase the size
      // in between), so return a failure, and let the caller retry.
      assert(requestedSize > oldSize);
  
      // Memory resize rules:
      // 1.  Always increase heap size to at least the requested size, rounded up
      //     to next page multiple.
      // 2a. If MEMORY_GROWTH_LINEAR_STEP == -1, excessively resize the heap
      //     geometrically: increase the heap size according to
      //     MEMORY_GROWTH_GEOMETRIC_STEP factor (default +20%), At most
      //     overreserve by MEMORY_GROWTH_GEOMETRIC_CAP bytes (default 96MB).
      // 2b. If MEMORY_GROWTH_LINEAR_STEP != -1, excessively resize the heap
      //     linearly: increase the heap size by at least
      //     MEMORY_GROWTH_LINEAR_STEP bytes.
      // 3.  Max size for the heap is capped at 2048MB-WASM_PAGE_SIZE, or by
      //     MAXIMUM_MEMORY, or by ASAN limit, depending on which is smallest
      // 4.  If we were unable to allocate as much memory, it may be due to
      //     over-eager decision to excessively reserve due to (3) above.
      //     Hence if an allocation fails, cut down on the amount of excess
      //     growth, in an attempt to succeed to perform a smaller allocation.
  
      // A limit is set for how much we can grow. We should not exceed that
      // (the wasm binary specifies it, so if we tried, we'd fail anyhow).
      var maxHeapSize = getHeapMax();
      if (requestedSize > maxHeapSize) {
        err(`Cannot enlarge memory, requested ${requestedSize} bytes, but the limit is ${maxHeapSize} bytes!`);
        return false;
      }
  
      // Loop through potential heap size increases. If we attempt a too eager
      // reservation that fails, cut down on the attempted size and reserve a
      // smaller bump instead. (max 3 times, chosen somewhat arbitrarily)
      for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
        var overGrownHeapSize = oldSize * (1 + 0.2 / cutDown); // ensure geometric growth
        // but limit overreserving (default to capping at +96MB overgrowth at most)
        overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296 );
  
        var newSize = Math.min(maxHeapSize, alignMemory(Math.max(requestedSize, overGrownHeapSize), 65536));
  
        var replacement = growMemory(newSize);
        if (replacement) {
          err('Warning: Enlarging memory arrays, this is not fast! ' + [oldSize, newSize]);
  
          return true;
        }
      }
      err(`Failed to grow the heap from ${oldSize} bytes to ${newSize} bytes, not enough memory!`);
      return false;
    };

  function _fd_close(fd) {
  try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      FS.close(stream);
      return 0;
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return e.errno;
  }
  }
  

  
  /** @param {number=} offset */
  var doReadv = (stream, iov, iovcnt, offset) => {
      var ret = 0;
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAPU32[((iov)>>2)];
        var len = HEAPU32[(((iov)+(4))>>2)];
        iov += 8;
        try {
          var curr = FS.read(stream, HEAP8, ptr, len, offset);
        } catch (e) {
          // On a non-blocking stream a subsequent read may would-block after we
          // already gathered data. POSIX readv is a single gather-read: return
          // what we have rather than failing the whole call.
          if (ret > 0 && e instanceof FS.ErrnoError &&
              (e.errno == 6 || e.errno == 6)) {
            break;
          }
          throw e;
        }
        if (curr < 0) return -1;
        ret += curr;
        if (curr < len) break; // nothing more to read
        if (typeof offset != 'undefined') {
          offset += curr;
        }
      }
      return ret;
    };
  
  
  function _fd_read(fd, iov, iovcnt, pnum) {
  try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      var num = doReadv(stream, iov, iovcnt);
      HEAPU32[((pnum)>>2)] = num;
      return 0;
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return e.errno;
  }
  }
  

  
  var convertI32PairToI53Checked = (lo, hi) => {
      assert(lo == (lo >>> 0) || lo == (lo|0)); // lo should either be a i32 or a u32
      assert(hi === (hi|0));                    // hi should be a i32
      return ((hi + 0x200000) >>> 0 < 0x400001 - !!lo) ? (lo >>> 0) + hi * 4294967296 : NaN;
    };
  
  function _fd_seek(fd,offset_low, offset_high,whence,newOffset) {
    var offset = convertI32PairToI53Checked(offset_low, offset_high);
  
  
  try {
  
      if (isNaN(offset)) return 22;
      var stream = SYSCALLS.getStreamFromFD(fd);
      FS.llseek(stream, offset, whence);
      (tempI64 = [stream.position>>>0,(tempDouble = stream.position,(+(Math.abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? (+(Math.floor((tempDouble)/4294967296.0)))>>>0 : (~~((+(Math.ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)], HEAP32[((newOffset)>>2)] = tempI64[0],HEAP32[(((newOffset)+(4))>>2)] = tempI64[1]);
      if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null; // reset readdir state
      return 0;
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return e.errno;
  }
  ;
  }

  
  
  /** @param {number=} offset */
  var doWritev = (stream, iov, iovcnt, offset) => {
      // Gather all iovecs into one contiguous buffer and issue a single
      // FS.write, matching POSIX writev's single gather-write semantics (as
      // __syscall_sendmsg already does). Per-iovec writes fragment a stream
      // socket send into multiple segments, breaking stream byte semantics.
      if (iovcnt == 1) {
        // Single iovec: write directly from HEAP8, no gather buffer needed.
        return FS.write(stream, HEAP8, HEAPU32[((iov)>>2)], HEAPU32[(((iov)+(4))>>2)], offset);
      }
      var total = 0;
      for (var i = 0, p = iov; i < iovcnt; i++, p += 8) {
        total += HEAPU32[(((p)+(4))>>2)];
      }
      var view = new Uint8Array(total);
      var voff = 0;
      for (var i = 0; i < iovcnt; i++, iov += 8) {
        var ptr = HEAPU32[((iov)>>2)];
        var len = HEAPU32[(((iov)+(4))>>2)];
        view.set(HEAPU8.subarray(ptr, ptr + len), voff);
        voff += len;
      }
      return FS.write(stream, view, 0, total, offset);
    };
  
  
  function _fd_write(fd, iov, iovcnt, pnum) {
  try {
  
      var stream = SYSCALLS.getStreamFromFD(fd);
      var num = doWritev(stream, iov, iovcnt);
      HEAPU32[((pnum)>>2)] = num;
      return 0;
    } catch (e) {
    if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
    return e.errno;
  }
  }
  

  var getCFunc = (ident) => {
      var func = Module['_' + ident]; // closure exported function
      assert(func, `Cannot call unknown function ${ident}, make sure it is exported`);
      return func;
    };
  
  var writeArrayToMemory = (array, buffer) => {
      assert(array.length >= 0, 'writeArrayToMemory array must have a length (should be an array or typed array)')
      HEAP8.set(array, buffer);
    };
  
  
  
  var stringToUTF8 = (str, outPtr, maxBytesToWrite) => {
      assert(typeof maxBytesToWrite == 'number', 'stringToUTF8 requires a third parameter that specifies the length of the output buffer');
      return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
    };
  
  var stackAlloc = (sz) => __emscripten_stack_alloc(sz);
  var stringToUTF8OnStack = (str) => {
      var size = lengthBytesUTF8(str) + 1;
      var ret = stackAlloc(size);
      stringToUTF8(str, ret, size);
      return ret;
    };
  
  
  
  
  
    /**
   * @param {string|null=} returnType
   * @param {Array=} argTypes
   * @param {Array=} args
   * @param {Object=} opts
   */
  var ccall = (ident, returnType, argTypes, args, opts) => {
      // For fast lookup of conversion functions
      var toC = {
        'string': (str) => {
          var ret = 0;
          if (str !== null && str !== undefined && str !== 0) { // null string
            ret = stringToUTF8OnStack(str);
          }
          return ret;
        },
        'array': (arr) => {
          var ret = stackAlloc(arr.length);
          writeArrayToMemory(arr, ret);
          return ret;
        }
      };
  
      function convertReturnValue(ret) {
        if (returnType === 'string') {
          return UTF8ToString(ret);
        }
        if (returnType === 'boolean') return Boolean(ret);
        return ret;
      }
  
      var func = getCFunc(ident);
      var cArgs = [];
      var stack = 0;
      assert(returnType !== 'array', 'return type should not be "array"');
      if (args) {
        for (var i = 0; i < args.length; i++) {
          var converter = toC[argTypes[i]];
          if (converter) {
            if (stack === 0) stack = stackSave();
            cArgs[i] = converter(args[i]);
          } else {
            cArgs[i] = args[i];
          }
        }
      }
      var ret = func(...cArgs);
      function onDone(ret) {
        if (stack !== 0) stackRestore(stack);
        return convertReturnValue(ret);
      }
  
      ret = onDone(ret);
      return ret;
    };

  
    /**
   * @param {string=} returnType
   * @param {Array=} argTypes
   * @param {Object=} opts
   */
  var cwrap = (ident, returnType, argTypes, opts) => {
      return (...args) => ccall(ident, returnType, argTypes, args, opts);
    };

  
  
  
  
  
  /** @type {!Float32Array} */
  var HEAPF32;
  
  /** @type {!Float64Array} */
  var HEAPF64;
  
    /**
   * @param {number} ptr
   * @param {string} type
   */
  function getValue(ptr, type = 'i8') {
    if (type.endsWith('*')) type = '*';
    switch (type) {
      case 'i1': return HEAP8[ptr];
      case 'i8': return HEAP8[ptr];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': abort('to do getValue(i64) use WASM_BIGINT');
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      case '*': return HEAPU32[((ptr)>>2)];
      default: abort(`invalid type for getValue: ${type}`);
    }
  }

  
  
  
  
  
  
  
    /**
   * @param {number} ptr
   * @param {number} value
   * @param {string} type
   */
  function setValue(ptr, value, type = 'i8') {
    if (type.endsWith('*')) type = '*';
    switch (type) {
      case 'i1': HEAP8[ptr] = value; break;
      case 'i8': HEAP8[ptr] = value; break;
      case 'i16': HEAP16[((ptr)>>1)] = value; break;
      case 'i32': HEAP32[((ptr)>>2)] = value; break;
      case 'i64': abort('to do setValue(i64) use WASM_BIGINT');
      case 'float': HEAPF32[((ptr)>>2)] = value; break;
      case 'double': HEAPF64[((ptr)>>3)] = value; break;
      case '*': HEAPU32[((ptr)>>2)] = value; break;
      default: abort(`invalid type for setValue: ${type}`);
    }
  }







  var wasmTableMirror = [];
  
  
  var getWasmTableEntry = (funcPtr) => {
      var func = wasmTableMirror[funcPtr];
      if (!func) {
        /** @suppress {checkTypes} */
        wasmTableMirror[funcPtr] = func = wasmTable.get(funcPtr);
      }
      /** @suppress {checkTypes} */
      assert(wasmTable.get(funcPtr) == func, 'table mirror is out of date');
      return func;
    };
  
  var updateTableMap = (offset, count) => {
      if (functionsInTableMap) {
        for (var i = offset; i < offset + count; i++) {
          var item = getWasmTableEntry(i);
          // Ignore null values.
          if (item) {
            functionsInTableMap.set(item, i);
          }
        }
      }
    };
  
  var functionsInTableMap;
  
  var getFunctionAddress = (func) => {
      // First, create the map if this is the first use.
      if (!functionsInTableMap) {
        functionsInTableMap = new WeakMap();
        updateTableMap(0, wasmTable.length);
      }
      return functionsInTableMap.get(func) || 0;
    };
  
  
  var freeTableIndexes = [];
  
  var getEmptyTableSlot = () => {
      // Reuse a free index if there is one, otherwise grow.
      if (freeTableIndexes.length) {
        return freeTableIndexes.pop();
      }
      try {
        // Grow the table
        return wasmTable['grow'](1);
      } catch (err) {
        if (!(err instanceof RangeError)) {
          throw err;
        }
        abort('Unable to grow wasm table. Set ALLOW_TABLE_GROWTH.');
      }
    };
  
  
  var setWasmTableEntry = (idx, func) => {
      /** @suppress {checkTypes} */
      wasmTable.set(idx, func);
      // With ABORT_ON_WASM_EXCEPTIONS wasmTable.get is overridden to return wrapped
      // functions so we need to call it here to retrieve the potential wrapper correctly
      // instead of just storing 'func' directly into wasmTableMirror
      /** @suppress {checkTypes} */
      wasmTableMirror[idx] = wasmTable.get(idx);
    };
  /** @param {string=} sig */
  var addFunction = (func, sig) => {
      assert(typeof func != 'undefined');
      // Check if the function is already in the table, to ensure each function
      // gets a unique index.
      var rtn = getFunctionAddress(func);
      if (rtn) {
        return rtn;
      }
  
      // It's not in the table, add it now.
  
      var ret = getEmptyTableSlot();
  
      setWasmTableEntry(ret, func);
  
      functionsInTableMap.set(func, ret);
  
      return ret;
    };



  FS.createPreloadedFile = FS_createPreloadedFile;
  FS.preloadFile = FS_preloadFile;
  FS.staticInit();;
// End JS library code

// include: postlibrary.js
// This file is included after the automatically-generated JS library code
// but before the wasm module is created.

{

  // Begin ATMODULES hooks
  if (Module['noExitRuntime']) noExitRuntime = Module['noExitRuntime'];

if (Module['print']) out = Module['print'];
if (Module['printErr']) err = Module['printErr'];
  // End ATMODULES hooks

  checkIncomingModuleAPI();

  if (Module['arguments']) programArgs = Module['arguments'];
  if (Module['thisProgram']) thisProgram = Module['thisProgram'];

  // Assertions on removed incoming Module JS APIs.
  assert(typeof Module['memoryInitializerPrefixURL'] == 'undefined', 'Module.memoryInitializerPrefixURL option was removed, use Module.locateFile instead');
  assert(typeof Module['pthreadMainPrefixURL'] == 'undefined', 'Module.pthreadMainPrefixURL option was removed, use Module.locateFile instead');
  assert(typeof Module['cdInitializerPrefixURL'] == 'undefined', 'Module.cdInitializerPrefixURL option was removed, use Module.locateFile instead');
  assert(typeof Module['filePackagePrefixURL'] == 'undefined', 'Module.filePackagePrefixURL option was removed, use Module.locateFile instead');
  assert(typeof Module['read'] == 'undefined', 'Module.read option was removed');
  assert(typeof Module['readAsync'] == 'undefined', 'Module.readAsync option was removed (modify readAsync in JS)');
  assert(typeof Module['readBinary'] == 'undefined', 'Module.readBinary option was removed (modify readBinary in JS)');
  assert(typeof Module['setWindowTitle'] == 'undefined', 'Module.setWindowTitle option was removed (modify emscripten_set_window_title in JS)');
  assert(typeof Module['TOTAL_MEMORY'] == 'undefined', 'Module.TOTAL_MEMORY has been renamed Module.INITIAL_MEMORY');
  assert(typeof Module['ENVIRONMENT'] == 'undefined', 'Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -sENVIRONMENT=web or -sENVIRONMENT=node)');
  assert(typeof Module['STACK_SIZE'] == 'undefined', 'STACK_SIZE can no longer be set at runtime.  Use -sSTACK_SIZE at link time')
  // If memory is defined in wasm, the user can't provide it, or set INITIAL_MEMORY
  assert(typeof Module['wasmMemory'] == 'undefined', 'Use of `wasmMemory` detected.  Use -sIMPORTED_MEMORY to define wasmMemory externally');
  assert(typeof Module['INITIAL_MEMORY'] == 'undefined', 'Detected runtime INITIAL_MEMORY setting.  Use -sIMPORTED_MEMORY to define wasmMemory dynamically');

  var preInit = Module['preInit'];
  if (preInit) {
    if (typeof preInit == 'function') Module['preInit'] = preInit = [preInit];
    // Written as a loop so that preInit functions that themselves add more
    // preInit functions.  Is this actually needed?
    while (preInit.length > 0) {
      preInit.shift()();
    }
  }
  consumedModuleProp('preInit');
}

// Begin runtime exports
  Module['ccall'] = ccall;
  Module['cwrap'] = cwrap;
  Module['addFunction'] = addFunction;
  Module['setValue'] = setValue;
  Module['getValue'] = getValue;
  Module['PATH'] = PATH;
  Module['UTF8ToString'] = UTF8ToString;
  Module['stringToUTF8'] = stringToUTF8;
  Module['lengthBytesUTF8'] = lengthBytesUTF8;
  Module['FS'] = FS;
  var missingLibrarySymbols = [
  'writeI53ToI64',
  'writeI53ToI64Clamped',
  'writeI53ToI64Signaling',
  'writeI53ToU64Clamped',
  'writeI53ToU64Signaling',
  'readI53FromI64',
  'readI53FromU64',
  'convertI32PairToI53',
  'convertU32PairToI53',
  'getTempRet0',
  'setTempRet0',
  'createNamedFunction',
  'zeroMemory',
  'exitJS',
  'withStackSave',
  'inetPton4',
  'inetNtop4',
  'inetPton6',
  'inetNtop6',
  'readSockaddr',
  'writeSockaddr',
  'readEmAsmArgs',
  'jstoi_q',
  'getExecutableName',
  'autoResumeAudioContext',
  'dynCallLegacy',
  'getDynCaller',
  'dynCall',
  'handleException',
  'keepRuntimeAlive',
  'runtimeKeepalivePush',
  'runtimeKeepalivePop',
  'callUserCallback',
  'maybeExit',
  'asmjsMangle',
  'HandleAllocator',
  'addOnInit',
  'addOnPostCtor',
  'addOnPreMain',
  'addOnExit',
  'STACK_SIZE',
  'STACK_ALIGN',
  'POINTER_SIZE',
  'ASSERTIONS',
  'removeFunction',
  'intArrayToString',
  'AsciiToString',
  'stringToAscii',
  'UTF16ToString',
  'stringToUTF16',
  'lengthBytesUTF16',
  'UTF32ToString',
  'stringToUTF32',
  'lengthBytesUTF32',
  'stringToNewUTF8',
  'registerKeyEventCallback',
  'maybeCStringToJsString',
  'findEventTarget',
  'getBoundingClientRect',
  'fillMouseEventData',
  'registerMouseEventCallback',
  'registerWheelEventCallback',
  'registerUiEventCallback',
  'registerFocusEventCallback',
  'fillDeviceOrientationEventData',
  'registerDeviceOrientationEventCallback',
  'fillDeviceMotionEventData',
  'registerDeviceMotionEventCallback',
  'screenOrientation',
  'fillOrientationChangeEventData',
  'registerOrientationChangeEventCallback',
  'fillFullscreenChangeEventData',
  'registerFullscreenChangeEventCallback',
  'callCanvasResizedCallback',
  'JSEvents_requestFullscreen',
  'JSEvents_resizeCanvasForFullscreen',
  'registerRestoreOldStyle',
  'hideEverythingExceptGivenElement',
  'restoreHiddenElements',
  'setLetterbox',
  'currentFullscreenStrategy',
  'softFullscreenResizeWebGLRenderTarget',
  'doRequestFullscreen',
  'fillPointerlockChangeEventData',
  'registerPointerlockChangeEventCallback',
  'registerPointerlockErrorEventCallback',
  'requestPointerLock',
  'fillVisibilityChangeEventData',
  'registerVisibilityChangeEventCallback',
  'registerTouchEventCallback',
  'fillGamepadEventData',
  'registerGamepadEventCallback',
  'registerBeforeUnloadEventCallback',
  'fillBatteryEventData',
  'registerBatteryEventCallback',
  'setCanvasElementSize',
  'getCanvasElementSize',
  'jsStackTrace',
  'getCallstack',
  'convertPCtoSourceLocation',
  'getEnvStrings',
  'checkWasiClock',
  'wasiRightsToMuslOFlags',
  'wasiOFlagsToMuslOFlags',
  'safeSetTimeout',
  'setImmediateWrapped',
  'safeRequestAnimationFrame',
  'clearImmediateWrapped',
  'registerPostMainLoop',
  'registerPreMainLoop',
  'getPromise',
  'makePromise',
  'addPromise',
  'idsToPromises',
  'makePromiseCallback',
  'ExceptionInfo',
  'findMatchingCatch',
  'incrementUncaughtExceptionCount',
  'decrementUncaughtExceptionCount',
  'Browser_asyncPrepareDataCounter',
  'isLeapYear',
  'ydayFromDate',
  'arraySum',
  'addDays',
  'getSocketFromFD',
  'getSocketAddress',
  'FS_mkdirTree',
  '_setNetworkCallback',
  'heapObjectForWebGLType',
  'toTypedArrayIndex',
  'webgl_enable_ANGLE_instanced_arrays',
  'webgl_enable_OES_vertex_array_object',
  'webgl_enable_WEBGL_draw_buffers',
  'webgl_enable_WEBGL_multi_draw',
  'webgl_enable_EXT_polygon_offset_clamp',
  'webgl_enable_EXT_clip_control',
  'webgl_enable_WEBGL_polygon_mode',
  'emscriptenWebGLGet',
  'computeUnpackAlignedImageSize',
  'colorChannelsInGlTextureFormat',
  'emscriptenWebGLGetTexPixelData',
  'emscriptenWebGLGetUniform',
  'webglGetProgramUniformLocation',
  'webglGetUniformLocation',
  'webglPrepareUniformLocationsBeforeFirstUse',
  'webglGetLeftBracePos',
  'emscriptenWebGLGetVertexAttrib',
  '__glGetActiveAttribOrUniform',
  'writeGLArray',
  'registerWebGlEventCallback',
  'runAndAbortIfError',
  'writeStringToMemory',
  'writeAsciiToMemory',
  'allocateUTF8',
  'allocateUTF8OnStack',
  'demangle',
  'stackTrace',
  'getNativeTypeSize',
];
missingLibrarySymbols.forEach(missingLibrarySymbol)

  var unexportedSymbols = [
  'run',
  'out',
  'err',
  'callMain',
  'abort',
  'wasmExports',
  'writeStackCookie',
  'checkStackCookie',
  'convertI32PairToI53Checked',
  'HEAP8',
  'HEAPU16',
  'HEAPU32',
  'HEAPF32',
  'HEAPF64',
  'stackSave',
  'stackRestore',
  'stackAlloc',
  'ptrToString',
  'getHeapMax',
  'growMemory',
  'ENV',
  'ERRNO_CODES',
  'strError',
  'DNS',
  'Protocols',
  'Sockets',
  'timers',
  'warnOnce',
  'readEmAsmArgsArray',
  'asyncLoad',
  'alignMemory',
  'mmapAlloc',
  'wasmTable',
  'wasmMemory',
  'getUniqueRunDependency',
  'noExitRuntime',
  'addRunDependency',
  'removeRunDependency',
  'addOnPreRun',
  'addOnPostRun',
  'freeTableIndexes',
  'functionsInTableMap',
  'getEmptyTableSlot',
  'updateTableMap',
  'getFunctionAddress',
  'PATH_FS',
  'UTF8Decoder',
  'UTF8ArrayToString',
  'stringToUTF8Array',
  'intArrayFromString',
  'UTF16Decoder',
  'stringToUTF8OnStack',
  'writeArrayToMemory',
  'JSEvents',
  'specialHTMLTargets',
  'findCanvasEventTarget',
  'restoreOldWindowedStyle',
  'UNWIND_CACHE',
  'ExitStatus',
  'doReadv',
  'doWritev',
  'initRandomFill',
  'randomFill',
  'emSetImmediate',
  'emClearImmediate_deps',
  'emClearImmediate',
  'promiseMap',
  'uncaughtExceptionCount',
  'exceptionCaught',
  'Browser',
  'requestFullscreen',
  'setCanvasSize',
  'getUserMedia',
  'createContext',
  'getPreloadedImageData__data',
  'wget',
  'MONTH_DAYS_REGULAR',
  'MONTH_DAYS_LEAP',
  'MONTH_DAYS_REGULAR_CUMULATIVE',
  'MONTH_DAYS_LEAP_CUMULATIVE',
  'SYSCALLS',
  'preloadPlugins',
  'FS_createPreloadedFile',
  'FS_preloadFile',
  'FS_modeStringToFlags',
  'FS_getMode',
  'FS_fileDataToTypedArray',
  'FS_stdin_getChar_buffer',
  'FS_stdin_getChar',
  'FS_unlink',
  'FS_createPath',
  'FS_createDevice',
  'FS_readFile',
  'FS_root',
  'FS_mounts',
  'FS_devices',
  'FS_streams',
  'FS_nextInode',
  'FS_nameTable',
  'FS_currentPath',
  'FS_initialized',
  'FS_ignorePermissions',
  'FS_filesystems',
  'FS_syncFSRequests',
  'FS_lookupPath',
  'FS_getPath',
  'FS_hashName',
  'FS_hashAddNode',
  'FS_hashRemoveNode',
  'FS_lookupNode',
  'FS_createNode',
  'FS_destroyNode',
  'FS_isRoot',
  'FS_isMountpoint',
  'FS_isFile',
  'FS_isDir',
  'FS_isLink',
  'FS_isChrdev',
  'FS_isBlkdev',
  'FS_isFIFO',
  'FS_isSocket',
  'FS_flagsToPermissionString',
  'FS_nodePermissions',
  'FS_mayLookup',
  'FS_mayCreate',
  'FS_mayDelete',
  'FS_mayOpen',
  'FS_checkOpExists',
  'FS_nextfd',
  'FS_getStreamChecked',
  'FS_getStream',
  'FS_createStream',
  'FS_closeStream',
  'FS_dupStream',
  'FS_doSetAttr',
  'FS_chrdev_stream_ops',
  'FS_major',
  'FS_minor',
  'FS_makedev',
  'FS_registerDevice',
  'FS_getDevice',
  'FS_getMounts',
  'FS_syncfs',
  'FS_mount',
  'FS_unmount',
  'FS_lookup',
  'FS_mknod',
  'FS_statfs',
  'FS_statfsStream',
  'FS_statfsNode',
  'FS_create',
  'FS_mkdir',
  'FS_mkdev',
  'FS_symlink',
  'FS_link',
  'FS_rename',
  'FS_rmdir',
  'FS_readdir',
  'FS_readlink',
  'FS_stat',
  'FS_fstat',
  'FS_lstat',
  'FS_doChmod',
  'FS_chmod',
  'FS_lchmod',
  'FS_fchmod',
  'FS_doChown',
  'FS_chown',
  'FS_lchown',
  'FS_fchown',
  'FS_doTruncate',
  'FS_truncate',
  'FS_ftruncate',
  'FS_utime',
  'FS_open',
  'FS_close',
  'FS_isClosed',
  'FS_llseek',
  'FS_read',
  'FS_write',
  'FS_mmap',
  'FS_msync',
  'FS_ioctl',
  'FS_writeFile',
  'FS_cwd',
  'FS_chdir',
  'FS_createDefaultDirectories',
  'FS_createDefaultDevices',
  'FS_createSpecialDirectories',
  'FS_createStandardStreams',
  'FS_staticInit',
  'FS_init',
  'FS_quit',
  'FS_findObject',
  'FS_analyzePath',
  'FS_createFile',
  'FS_createDataFile',
  'FS_forceLoadFile',
  'FS_createLazyFile',
  'MEMFS',
  'TTY',
  'PIPEFS',
  'SOCKFS',
  'tempFixedLengthArray',
  'miniTempWebGLFloatBuffers',
  'miniTempWebGLIntBuffers',
  'GL',
  'AL',
  'GLUT',
  'EGL',
  'GLEW',
  'IDBStore',
  'SDL',
  'SDL_gfx',
  'print',
  'printErr',
  'jstoi_s',
];
unexportedSymbols.forEach(unexportedRuntimeSymbol);

  // End runtime exports
  // Begin JS library exports
  // End JS library exports

// end include: postlibrary.js

function checkIncomingModuleAPI() {
  ignoredModuleProp('fetchSettings');
  ignoredModuleProp('logReadFiles');
  ignoredModuleProp('loadSplitModule');
  ignoredModuleProp('onMalloc');
  ignoredModuleProp('onRealloc');
  ignoredModuleProp('onFree');
  ignoredModuleProp('onSbrkGrow');
  ignoredModuleProp('onCOSCacheHit');
  ignoredModuleProp('onCOSCacheMiss');
  ignoredModuleProp('onCOSStore');
  ignoredModuleProp('GL_MAX_TEXTURE_IMAGE_UNITS');
  ignoredModuleProp('SDL_canPlayWithWebAudio');
  ignoredModuleProp('SDL_numSimultaneouslyQueuedBuffers');
  ignoredModuleProp('freePreloadedMediaOnUse');
  ignoredModuleProp('preinitializedWebGLContext');
  ignoredModuleProp('keyboardListeningElement');
  ignoredModuleProp('doNotCaptureKeyboard');
  ignoredModuleProp('extraStackTrace');
  ignoredModuleProp('preloadPlugins');
  ignoredModuleProp('preMainLoop');
  ignoredModuleProp('postMainLoop');
  ignoredModuleProp('forcedAspectRatio');
  ignoredModuleProp('mainScriptUrlOrBlob');
  ignoredModuleProp('onFullScreen');
  ignoredModuleProp('INITIAL_MEMORY');
  ignoredModuleProp('wasmMemory');
  ignoredModuleProp('wasmBinary');
}

// Imports from the Wasm binary.
var _malloc = Module['_malloc'] = makeInvalidEarlyAccess('_malloc');
var _free = Module['_free'] = makeInvalidEarlyAccess('_free');
var _mid_song_start = Module['_mid_song_start'] = makeInvalidEarlyAccess('_mid_song_start');
var _mid_song_seek = Module['_mid_song_seek'] = makeInvalidEarlyAccess('_mid_song_seek');
var _mid_song_get_total_time = Module['_mid_song_get_total_time'] = makeInvalidEarlyAccess('_mid_song_get_total_time');
var _mid_song_get_time = Module['_mid_song_get_time'] = makeInvalidEarlyAccess('_mid_song_get_time');
var _mid_song_read_wave = Module['_mid_song_read_wave'] = makeInvalidEarlyAccess('_mid_song_read_wave');
var _mid_song_set_volume = Module['_mid_song_set_volume'] = makeInvalidEarlyAccess('_mid_song_set_volume');
var _mid_note_on = Module['_mid_note_on'] = makeInvalidEarlyAccess('_mid_note_on');
var _mid_note_off = Module['_mid_note_off'] = makeInvalidEarlyAccess('_mid_note_off');
var _mid_send_event = Module['_mid_send_event'] = makeInvalidEarlyAccess('_mid_send_event');
var _mid_song_resend_active_notes = Module['_mid_song_resend_active_notes'] = makeInvalidEarlyAccess('_mid_song_resend_active_notes');
var _mid_song_get_controller_value_at_tick = Module['_mid_song_get_controller_value_at_tick'] = makeInvalidEarlyAccess('_mid_song_get_controller_value_at_tick');
var _mid_istream_seek = Module['_mid_istream_seek'] = makeInvalidEarlyAccess('_mid_istream_seek');
var _mid_init_no_config = Module['_mid_init_no_config'] = makeInvalidEarlyAccess('_mid_init_no_config');
var _mid_exit = Module['_mid_exit'] = makeInvalidEarlyAccess('_mid_exit');
var _mid_init = Module['_mid_init'] = makeInvalidEarlyAccess('_mid_init');
var _mid_song_load = Module['_mid_song_load'] = makeInvalidEarlyAccess('_mid_song_load');
var _mid_song_free = Module['_mid_song_free'] = makeInvalidEarlyAccess('_mid_song_free');
var _mid_song_create = Module['_mid_song_create'] = makeInvalidEarlyAccess('_mid_song_create');
var _mid_song_set_event_callback = Module['_mid_song_set_event_callback'] = makeInvalidEarlyAccess('_mid_song_set_event_callback');
var _mid_set_debug_msg_callback = Module['_mid_set_debug_msg_callback'] = makeInvalidEarlyAccess('_mid_set_debug_msg_callback');
var _mid_get_version = Module['_mid_get_version'] = makeInvalidEarlyAccess('_mid_get_version');
var _mid_song_get_patch_names = Module['_mid_song_get_patch_names'] = makeInvalidEarlyAccess('_mid_song_get_patch_names');
var _mid_song_get_required_patches = Module['_mid_song_get_required_patches'] = makeInvalidEarlyAccess('_mid_song_get_required_patches');
var _mid_song_get_current_tick = Module['_mid_song_get_current_tick'] = makeInvalidEarlyAccess('_mid_song_get_current_tick');
var _mid_song_load_program = Module['_mid_song_load_program'] = makeInvalidEarlyAccess('_mid_song_load_program');
var _mid_dlspatches_load = Module['_mid_dlspatches_load'] = makeInvalidEarlyAccess('_mid_dlspatches_load');
var _mid_dlspatches_free = Module['_mid_dlspatches_free'] = makeInvalidEarlyAccess('_mid_dlspatches_free');
var _mid_song_load_dls = Module['_mid_song_load_dls'] = makeInvalidEarlyAccess('_mid_song_load_dls');
var _mid_istream_open_mem = Module['_mid_istream_open_mem'] = makeInvalidEarlyAccess('_mid_istream_open_mem');
var _mid_istream_close = Module['_mid_istream_close'] = makeInvalidEarlyAccess('_mid_istream_close');
var _fflush = makeInvalidEarlyAccess('_fflush');
var _emscripten_stack_get_end = makeInvalidEarlyAccess('_emscripten_stack_get_end');
var _emscripten_stack_get_base = makeInvalidEarlyAccess('_emscripten_stack_get_base');
var _strerror = makeInvalidEarlyAccess('_strerror');
var ___get_temp_ret = makeInvalidEarlyAccess('___get_temp_ret');
var ___set_temp_ret = makeInvalidEarlyAccess('___set_temp_ret');
var _emscripten_stack_init = makeInvalidEarlyAccess('_emscripten_stack_init');
var _emscripten_stack_get_free = makeInvalidEarlyAccess('_emscripten_stack_get_free');
var __emscripten_stack_restore = makeInvalidEarlyAccess('__emscripten_stack_restore');
var __emscripten_stack_alloc = makeInvalidEarlyAccess('__emscripten_stack_alloc');
var _emscripten_stack_get_current = makeInvalidEarlyAccess('_emscripten_stack_get_current');
var dynCall_jiji = makeInvalidEarlyAccess('dynCall_jiji');
var memory = makeInvalidEarlyAccess('memory');
var __indirect_function_table = makeInvalidEarlyAccess('__indirect_function_table');
var wasmMemory = makeInvalidEarlyAccess('wasmMemory');
var wasmTable = makeInvalidEarlyAccess('wasmTable');

function assignWasmExports(wasmExports) {
  assert(typeof wasmExports['malloc'] != 'undefined', 'missing Wasm export: malloc');
  assert(typeof wasmExports['free'] != 'undefined', 'missing Wasm export: free');
  assert(typeof wasmExports['mid_song_start'] != 'undefined', 'missing Wasm export: mid_song_start');
  assert(typeof wasmExports['mid_song_seek'] != 'undefined', 'missing Wasm export: mid_song_seek');
  assert(typeof wasmExports['mid_song_get_total_time'] != 'undefined', 'missing Wasm export: mid_song_get_total_time');
  assert(typeof wasmExports['mid_song_get_time'] != 'undefined', 'missing Wasm export: mid_song_get_time');
  assert(typeof wasmExports['mid_song_read_wave'] != 'undefined', 'missing Wasm export: mid_song_read_wave');
  assert(typeof wasmExports['mid_song_set_volume'] != 'undefined', 'missing Wasm export: mid_song_set_volume');
  assert(typeof wasmExports['mid_note_on'] != 'undefined', 'missing Wasm export: mid_note_on');
  assert(typeof wasmExports['mid_note_off'] != 'undefined', 'missing Wasm export: mid_note_off');
  assert(typeof wasmExports['mid_send_event'] != 'undefined', 'missing Wasm export: mid_send_event');
  assert(typeof wasmExports['mid_song_resend_active_notes'] != 'undefined', 'missing Wasm export: mid_song_resend_active_notes');
  assert(typeof wasmExports['mid_song_get_controller_value_at_tick'] != 'undefined', 'missing Wasm export: mid_song_get_controller_value_at_tick');
  assert(typeof wasmExports['mid_istream_seek'] != 'undefined', 'missing Wasm export: mid_istream_seek');
  assert(typeof wasmExports['mid_init_no_config'] != 'undefined', 'missing Wasm export: mid_init_no_config');
  assert(typeof wasmExports['mid_exit'] != 'undefined', 'missing Wasm export: mid_exit');
  assert(typeof wasmExports['mid_init'] != 'undefined', 'missing Wasm export: mid_init');
  assert(typeof wasmExports['mid_song_load'] != 'undefined', 'missing Wasm export: mid_song_load');
  assert(typeof wasmExports['mid_song_free'] != 'undefined', 'missing Wasm export: mid_song_free');
  assert(typeof wasmExports['mid_song_create'] != 'undefined', 'missing Wasm export: mid_song_create');
  assert(typeof wasmExports['mid_song_set_event_callback'] != 'undefined', 'missing Wasm export: mid_song_set_event_callback');
  assert(typeof wasmExports['mid_set_debug_msg_callback'] != 'undefined', 'missing Wasm export: mid_set_debug_msg_callback');
  assert(typeof wasmExports['mid_get_version'] != 'undefined', 'missing Wasm export: mid_get_version');
  assert(typeof wasmExports['mid_song_get_patch_names'] != 'undefined', 'missing Wasm export: mid_song_get_patch_names');
  assert(typeof wasmExports['mid_song_get_required_patches'] != 'undefined', 'missing Wasm export: mid_song_get_required_patches');
  assert(typeof wasmExports['mid_song_get_current_tick'] != 'undefined', 'missing Wasm export: mid_song_get_current_tick');
  assert(typeof wasmExports['mid_song_load_program'] != 'undefined', 'missing Wasm export: mid_song_load_program');
  assert(typeof wasmExports['mid_dlspatches_load'] != 'undefined', 'missing Wasm export: mid_dlspatches_load');
  assert(typeof wasmExports['mid_dlspatches_free'] != 'undefined', 'missing Wasm export: mid_dlspatches_free');
  assert(typeof wasmExports['mid_song_load_dls'] != 'undefined', 'missing Wasm export: mid_song_load_dls');
  assert(typeof wasmExports['mid_istream_open_mem'] != 'undefined', 'missing Wasm export: mid_istream_open_mem');
  assert(typeof wasmExports['mid_istream_close'] != 'undefined', 'missing Wasm export: mid_istream_close');
  assert(typeof wasmExports['fflush'] != 'undefined', 'missing Wasm export: fflush');
  assert(typeof wasmExports['emscripten_stack_get_end'] != 'undefined', 'missing Wasm export: emscripten_stack_get_end');
  assert(typeof wasmExports['emscripten_stack_get_base'] != 'undefined', 'missing Wasm export: emscripten_stack_get_base');
  assert(typeof wasmExports['strerror'] != 'undefined', 'missing Wasm export: strerror');
  assert(typeof wasmExports['__get_temp_ret'] != 'undefined', 'missing Wasm export: __get_temp_ret');
  assert(typeof wasmExports['__set_temp_ret'] != 'undefined', 'missing Wasm export: __set_temp_ret');
  assert(typeof wasmExports['emscripten_stack_init'] != 'undefined', 'missing Wasm export: emscripten_stack_init');
  assert(typeof wasmExports['emscripten_stack_get_free'] != 'undefined', 'missing Wasm export: emscripten_stack_get_free');
  assert(typeof wasmExports['_emscripten_stack_restore'] != 'undefined', 'missing Wasm export: _emscripten_stack_restore');
  assert(typeof wasmExports['_emscripten_stack_alloc'] != 'undefined', 'missing Wasm export: _emscripten_stack_alloc');
  assert(typeof wasmExports['emscripten_stack_get_current'] != 'undefined', 'missing Wasm export: emscripten_stack_get_current');
  assert(typeof wasmExports['dynCall_jiji'] != 'undefined', 'missing Wasm export: dynCall_jiji');
  assert(typeof wasmExports['memory'] != 'undefined', 'missing Wasm export: memory');
  assert(typeof wasmExports['__indirect_function_table'] != 'undefined', 'missing Wasm export: __indirect_function_table');
  _malloc = Module['_malloc'] = createExportWrapper('malloc', wasmExports['malloc'], 1);
  _free = Module['_free'] = createExportWrapper('free', wasmExports['free'], 1);
  _mid_song_start = Module['_mid_song_start'] = createExportWrapper('mid_song_start', wasmExports['mid_song_start'], 1);
  _mid_song_seek = Module['_mid_song_seek'] = createExportWrapper('mid_song_seek', wasmExports['mid_song_seek'], 2);
  _mid_song_get_total_time = Module['_mid_song_get_total_time'] = createExportWrapper('mid_song_get_total_time', wasmExports['mid_song_get_total_time'], 1);
  _mid_song_get_time = Module['_mid_song_get_time'] = createExportWrapper('mid_song_get_time', wasmExports['mid_song_get_time'], 1);
  _mid_song_read_wave = Module['_mid_song_read_wave'] = createExportWrapper('mid_song_read_wave', wasmExports['mid_song_read_wave'], 4);
  _mid_song_set_volume = Module['_mid_song_set_volume'] = createExportWrapper('mid_song_set_volume', wasmExports['mid_song_set_volume'], 2);
  _mid_note_on = Module['_mid_note_on'] = createExportWrapper('mid_note_on', wasmExports['mid_note_on'], 11);
  _mid_note_off = Module['_mid_note_off'] = createExportWrapper('mid_note_off', wasmExports['mid_note_off'], 3);
  _mid_send_event = Module['_mid_send_event'] = createExportWrapper('mid_send_event', wasmExports['mid_send_event'], 5);
  _mid_song_resend_active_notes = Module['_mid_song_resend_active_notes'] = createExportWrapper('mid_song_resend_active_notes', wasmExports['mid_song_resend_active_notes'], 1);
  _mid_song_get_controller_value_at_tick = Module['_mid_song_get_controller_value_at_tick'] = createExportWrapper('mid_song_get_controller_value_at_tick', wasmExports['mid_song_get_controller_value_at_tick'], 4);
  _mid_istream_seek = Module['_mid_istream_seek'] = createExportWrapper('mid_istream_seek', wasmExports['mid_istream_seek'], 3);
  _mid_init_no_config = Module['_mid_init_no_config'] = createExportWrapper('mid_init_no_config', wasmExports['mid_init_no_config'], 0);
  _mid_exit = Module['_mid_exit'] = createExportWrapper('mid_exit', wasmExports['mid_exit'], 0);
  _mid_init = Module['_mid_init'] = createExportWrapper('mid_init', wasmExports['mid_init'], 1);
  _mid_song_load = Module['_mid_song_load'] = createExportWrapper('mid_song_load', wasmExports['mid_song_load'], 2);
  _mid_song_free = Module['_mid_song_free'] = createExportWrapper('mid_song_free', wasmExports['mid_song_free'], 1);
  _mid_song_create = Module['_mid_song_create'] = createExportWrapper('mid_song_create', wasmExports['mid_song_create'], 1);
  _mid_song_set_event_callback = Module['_mid_song_set_event_callback'] = createExportWrapper('mid_song_set_event_callback', wasmExports['mid_song_set_event_callback'], 2);
  _mid_set_debug_msg_callback = Module['_mid_set_debug_msg_callback'] = createExportWrapper('mid_set_debug_msg_callback', wasmExports['mid_set_debug_msg_callback'], 1);
  _mid_get_version = Module['_mid_get_version'] = createExportWrapper('mid_get_version', wasmExports['mid_get_version'], 0);
  _mid_song_get_patch_names = Module['_mid_song_get_patch_names'] = createExportWrapper('mid_song_get_patch_names', wasmExports['mid_song_get_patch_names'], 1);
  _mid_song_get_required_patches = Module['_mid_song_get_required_patches'] = createExportWrapper('mid_song_get_required_patches', wasmExports['mid_song_get_required_patches'], 1);
  _mid_song_get_current_tick = Module['_mid_song_get_current_tick'] = createExportWrapper('mid_song_get_current_tick', wasmExports['mid_song_get_current_tick'], 1);
  _mid_song_load_program = Module['_mid_song_load_program'] = createExportWrapper('mid_song_load_program', wasmExports['mid_song_load_program'], 4);
  _mid_dlspatches_load = Module['_mid_dlspatches_load'] = createExportWrapper('mid_dlspatches_load', wasmExports['mid_dlspatches_load'], 1);
  _mid_dlspatches_free = Module['_mid_dlspatches_free'] = createExportWrapper('mid_dlspatches_free', wasmExports['mid_dlspatches_free'], 1);
  _mid_song_load_dls = Module['_mid_song_load_dls'] = createExportWrapper('mid_song_load_dls', wasmExports['mid_song_load_dls'], 3);
  _mid_istream_open_mem = Module['_mid_istream_open_mem'] = createExportWrapper('mid_istream_open_mem', wasmExports['mid_istream_open_mem'], 2);
  _mid_istream_close = Module['_mid_istream_close'] = createExportWrapper('mid_istream_close', wasmExports['mid_istream_close'], 1);
  _fflush = createExportWrapper('fflush', wasmExports['fflush'], 1);
  _emscripten_stack_get_end = wasmExports['emscripten_stack_get_end'];
  _emscripten_stack_get_base = wasmExports['emscripten_stack_get_base'];
  _strerror = createExportWrapper('strerror', wasmExports['strerror'], 1);
  ___get_temp_ret = createExportWrapper('__get_temp_ret', wasmExports['__get_temp_ret'], 0);
  ___set_temp_ret = createExportWrapper('__set_temp_ret', wasmExports['__set_temp_ret'], 1);
  _emscripten_stack_init = wasmExports['emscripten_stack_init'];
  _emscripten_stack_get_free = wasmExports['emscripten_stack_get_free'];
  __emscripten_stack_restore = wasmExports['_emscripten_stack_restore'];
  __emscripten_stack_alloc = wasmExports['_emscripten_stack_alloc'];
  _emscripten_stack_get_current = wasmExports['emscripten_stack_get_current'];
  dynCall_jiji = createExportWrapper('dynCall_jiji', wasmExports['dynCall_jiji'], 5);
  memory = wasmMemory = wasmExports['memory'];
  __indirect_function_table = wasmTable = wasmExports['__indirect_function_table'];
}

var wasmImports = {
  /** @export */
  __syscall_fcntl64: ___syscall_fcntl64,
  /** @export */
  __syscall_ioctl: ___syscall_ioctl,
  /** @export */
  __syscall_openat: ___syscall_openat,
  /** @export */
  _abort_js: __abort_js,
  /** @export */
  emscripten_resize_heap: _emscripten_resize_heap,
  /** @export */
  fd_close: _fd_close,
  /** @export */
  fd_read: _fd_read,
  /** @export */
  fd_seek: _fd_seek,
  /** @export */
  fd_write: _fd_write
};


// include: postamble.js
// === Auto-generated postamble setup entry stuff ===

var calledRun;

function stackCheckInit() {
  // This is normally called automatically during __wasm_call_ctors but need to
  // get these values before even running any of the ctors so we call it redundantly
  // here.
  _emscripten_stack_init();
  // TODO(sbc): Move writeStackCookie to native to to avoid this.
  writeStackCookie();
}

async function run() {
  assert(!calledRun);
  calledRun = true;

  stackCheckInit();

  preRun();

  if (runDependencies) {
    await resolveRunDependencies();
  }

  var setStatus = Module['setStatus'];
  if (setStatus) {
    setStatus('Running...');
    // Yield to the event loop to allow the browser to paint "Running..."
    await new Promise((resolve) => setTimeout(resolve, 1));
    // Then we want to clear the status text, but only after the rest of this function runs.
    setTimeout(setStatus, 1, '');
  }

  if (ABORT) return;

  initRuntime();

  Module['onRuntimeInitialized']?.();
  consumedModuleProp('onRuntimeInitialized');

  assert(!Module['_main'], 'compiled without a main, but one is present. if you added it from JS, use Module["onRuntimeInitialized"]');

  postRun();
}

function checkUnflushedContent() {
  // Compiler settings do not allow exiting the runtime, so flushing
  // the streams is not possible. but in ASSERTIONS mode we check
  // if there was something to flush, and if so tell the user they
  // should request that the runtime be exitable.
  // Normally we would not even include flush() at all, but in ASSERTIONS
  // builds we do so just for this check, and here we see if there is any
  // content to flush, that is, we check if there would have been
  // something a non-ASSERTIONS build would have not seen.
  // How we flush the streams depends on whether we are in SYSCALLS_REQUIRE_FILESYSTEM=0
  // mode (which has its own special function for this; otherwise, all
  // the code is inside libc)
  var oldOut = out;
  var oldErr = err;
  var has = false;
  out = err = (x) => {
    has = true;
  }
  try { // it doesn't matter if it fails
    _fflush(0);
    // also flush in the JS FS layer
    for (var name of ['stdout', 'stderr']) {
      var info = FS.analyzePath('/dev/' + name);
      if (!info) return;
      var stream = info.object;
      var rdev = stream.rdev;
      var tty = TTY.ttys[rdev];
      if (tty?.output?.length) {
        has = true;
      }
    }
  } catch(e) {}
  out = oldOut;
  err = oldErr;
  if (has) {
    warnOnce('stdio streams had content in them that was not flushed. you should set EXIT_RUNTIME to 1 (see the Emscripten FAQ), or make sure to emit a newline when you printf etc.');
  }
}

var wasmExports;

// With async instantation wasmExports is assigned asynchronously when the
// instance is received.
createWasm().then(() => run());

// end include: postamble.js

