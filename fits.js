/*
 * Javascript FITS Reader 0.2
 * Copyright (c) 2010 Stuart Lowe http://lcogt.net/
 *
 * Licensed under the MPL http://www.mozilla.org/MPL/MPL-1.1.txt
 *
 */

function FITS(input) {
  this.src = typeof input == "string" ? input : "";
  this.img = { complete: false };
  this.xmp = ""; // Will hold the XMP string (for test purposes)
  this.avmdata = false;
  this.tags = {};
  this.stretch = "linear";
  this.color = "gray";
  this.depth = 0;
  this.z = 0;
  this.scaleCutoff = 0.999;
  this.events = { load: "", click: "", mousemove: "" }; // Let's define some events
  this.data = { load: "", click: "", mousemove: "" }; // Let's define some event data
  this.stretchFunctions = {
    linear: stretchLinear,
    sqrt: stretchSqrt,
    cuberoot: stretchCuberoot,
    log: stretchLog,
    loglog: stretchLoglog,
    sqrtlog: stretchSqrtlog,
  };
  // Colour scales defined by SAOImage
  this.colormaps = {
    blackbody: colormapHeat,
    heat: colormapHeat,
    A: colormapA,
    B: colormapB,
    gray: colormapGray,
  };
}

// Loads the FITS file using an ajax request. To call your own function after
// the FITS file is loaded, you should either provide a callback directly or have
// already set the load function.
FITS.prototype.load = function (source, fnCallback) {
  if (typeof source == "string") this.src = source;
  if (typeof this.src == "string") {
    this.image = null;
    var _obj = this;
    if (typeof fnCallback == "function") _obj.bind("load", fnCallback);
    oReq = new XMLHttpRequest();
    oReq.open("GET", _obj.src, true);
    oReq.responseType = "blob";

    oReq.onload = function (oEvent) {
      _obj.readFITSHeader(oReq.response).then((headerOffset) => {
        if (_obj.header.NAXIS >= 2) {
          _obj.readFITSImage(oReq.response, headerOffset).then((success) => {
            _obj.triggerEvent("load");
          });
        }
      });
    };
    oReq.send();
  }
  return this;
};

// Parse the ASCII header from the FITS file. It should be at the start.
FITS.prototype.readFITSHeader = function (blob) {
  let iLength = blob.size;
  let iOffset = 0;
  let header = {};
  let inHeader = true;
  const headerUnitChars = 80;

  return blob.text().then((asText) => {
    while (iOffset < iLength && inHeader) {
      let headerUnit = asText.slice(iOffset, iOffset + headerUnitChars);
      let hdu = headerUnit.split(/[=\/]/);
      let key = hdu[0];
      let val = hdu[1];
      if (key.length > 0 && val) {
        val = val.trim();
        if (val.startsWith("'")) {
          val = val.replace(/'/g, "").trim();
          if (val.match(/\d+-\d+-\d+T.+/g)) {
            val = Date.parse(val);
          }
        } else if (val.match(/^[TF]$/)) {
          val = val.includes("T");
        } else if (val.includes(".")) {
          val = parseFloat(val);
        } else {
          val = parseInt(val);
        }
        header[key.trim()] = val;
      }
      if (headerUnit.startsWith("END")) inHeader = false;
      iOffset += headerUnitChars;
    }

    this.header = header;
    if (this.header.NAXIS >= 2) {
      if (typeof this.header.NAXIS1 == "number")
        this.width = this.header.NAXIS1;
      if (typeof this.header.NAXIS2 == "number")
        this.height = this.header.NAXIS2;
    }

    if (this.header.NAXIS > 2 && typeof this.header.NAXIS3 == "number")
      this.depth = this.header.NAXIS3;
    else this.depth = 1;

    if (typeof this.header.BSCALE == "undefined") this.header.BSCALE = 1;
    if (typeof this.header.BZERO == "undefined") this.header.BZERO = 0;

    // Remove any space padding
    while (iOffset < iLength && asText[iOffset] === " ") iOffset++;

    console.log(header);
    return iOffset;
  });
};

// Parse the FITS image from the file
FITS.prototype.readFITSImage = function (blob, headerOffset) {
  this.z = 0;

  return blob
    .slice(headerOffset)
    .arrayBuffer()
    .then((buf) => {
      switch (this.header.BITPIX) {
        case 16:
          this.image = new Uint16Array(buf);
          if (!systemBigEndian()) {
            this.image = this.image.map(swap16);
          }
          return true;
        case -32:
          this.image = new Float32Array(buf);
          return true;
        default:
          return false;
      }
    });
};

// Use <canvas> to draw a 2D image
FITS.prototype.draw = function (id, type) {
  id = id || this.id;
  this.id = id;
  type = type || this.stretch;

  // Now we want to build the <canvas> element that will hold our image
  var el = document.getElementById(id);
  if (el != null) {
    // Look for a <canvas> with the specified ID or fall back on a <div>
    if (typeof el == "object" && el.tagName !== "CANVAS") {
      // Looks like the element is a container for our <canvas>
      el.setAttribute("id", this.id + "holder");
      var canvas = document.createElement("canvas");
      canvas.style.display = "block";
      canvas.setAttribute("width", this.width);
      canvas.setAttribute("height", this.height);
      canvas.setAttribute("id", this.id);
      el.appendChild(canvas);
    } else {
      el.setAttribute("width", this.width);
      el.setAttribute("height", this.height);
    }
    this.canvas = document.getElementById(id);
  } else this.canvas = el;
  this.ctx = this.canvas.getContext("2d");
  var _obj = this;
  // The object didn't exist before so we add a click event to it
  if (typeof this.events.click == "function")
    addEvent(this.canvas, "click", function (e) {
      _obj.clickListener(e);
    });
  if (typeof this.events.mousemove == "function")
    addEvent(this.canvas, "mousemove", function (e) {
      _obj.moveListener(e);
    });

  // create a new batch of pixels with the same
  // dimensions as the image:
  this.imageData = this.ctx.createImageData(this.width, this.height);

  this.update(type, 0);
};

// Calculate the pixel values using a defined stretch type and draw onto the canvas
FITS.prototype.update = function (inp) {
  if (typeof inp == "object") {
    this.stretch = typeof inp.stretch == "string" ? inp.stretch : this.stretch;
    if (typeof inp.index != "number" && this.z) inp.index = this.z;
    this.z = Math.max(0, Math.min(this.depth - 1, Math.abs(inp.index || 0)));
    this.color = typeof inp.color == "string" ? inp.color : this.color;
  } else {
    if (typeof inp == "string") this.stretch = inp;
  }
  if (this.image == null) return 0;

  let image = new Uint8ClampedArray(this.width * this.height);
  let frameStart = this.width * this.height * this.z;
  let min = 0;
  let frameEnd = frameStart + image.length;
  let i = 0;

  const frame = this.image.slice(frameStart, frameEnd);
  const sorted = frame.slice().sort();
  const maxPercentile = Math.ceil(image.length * this.scaleCutoff);
  const max = sorted[maxPercentile];
  while (min === 0 && i < image.length) {
    min = sorted[i++];
  }
  const range = max - min;

  for (let j = 0, i = frameStart; i < frameEnd; j++, i++) {
    let val = this.stretchFunctions[this.stretch](frame[i], min, range);
    if (isNaN(val)) val = 0;
    else if (val < 0) val = 0;
    else if (val > 255) val = 255;
    image[j] = val;
  }

  i = 0;
  for (let row = 0; row < this.height; row++) {
    for (let col = 0; col < this.width; col++) {
      let pos = ((this.height - row) * this.width + col) * 4;
      let rgb = this.colormaps[this.color](image[i]);
      //if(i < 3) console.log(c,image[i])
      this.imageData.data[pos] = rgb.r;
      this.imageData.data[pos + 1] = rgb.g;
      this.imageData.data[pos + 2] = rgb.b;
      this.imageData.data[pos + 3] = 0xff; // alpha
      i++;
    }
  }
  // put pixel data on canvas
  this.ctx.putImageData(this.imageData, 0, 0);
};

FITS.prototype.getCursor = function (e) {
  var x;
  var y;
  if (e.pageX !== undefined && e.pageY !== undefined) {
    x = e.pageX;
    y = e.pageY;
  } else {
    x =
      e.clientX +
      document.body.scrollLeft +
      document.body.scrollLeft +
      document.documentElement.scrollLeft;
    y =
      e.clientY +
      document.body.scrollTop +
      document.body.scrollTop +
      document.documentElement.scrollTop;
  }

  var target = e.target;
  while (target) {
    x -= target.offsetLeft;
    y -= target.offsetTop;
    target = target.offsetParent;
    //  alert(typeof target)
  }
  this.cursor = { x: x, y: y };
};

function stretchLinear(pixelValue, lower, range) {
  return 255 * ((pixelValue - lower) / range);
}

function stretchSqrt(pixelValue, lower, range) {
  return 255 * Math.sqrt((pixelValue - lower) / range);
}

function stretchCuberoot(pixelValue, lower, range) {
  return 255 * Math.pow((pixelValue - lower) / range, 0.333);
}

function stretchLog(pixelValue, lower, range) {
  return (255 * (Math.log(pixelValue) - lower)) / range;
}

function stretchLoglog(pixelValue, lower, range) {
  return (255 * (Math.log(Math.log(pixelValue)) - lower)) / range;
}

function stretchSqrtlog(pixelValue, lower, range) {
  return (255 * (Math.sqrt(Math.log(pixelValue)) - lower)) / range;
}

FITS.prototype.clickListener = function (e) {
  this.getCursor(e);
  this.triggerEvent("click", { x: this.cursor.x, y: this.cursor.y });
};

FITS.prototype.moveListener = function (e) {
  this.getCursor(e);
  this.triggerEvent("mousemove", { x: this.cursor.x, y: this.cursor.y });
};

FITS.prototype.bind = function (ev, data, fn) {
  if (!fn && typeof data == "function") fn = data;
  if (typeof data != "object") data = {};
  if (typeof ev != "string" || typeof fn != "function") return this;
  if (this.events[ev]) this.events[ev].push(fn);
  else this.events[ev] = [fn];
  if (this.data[ev]) this.data[ev].push(data);
  else this.data[ev] = [data];
  return this;
};
// Trigger a defined event with arguments.
FITS.prototype.triggerEvent = function (ev, args) {
  if (typeof ev != "string") return;
  if (typeof args != "object") args = {};
  //var _obj = this;
  if (typeof this.events[ev] == "object") {
    for (i = 0; i < this.events[ev].length; i++) {
      tmpargs = args;
      tmpargs.data = this.data[ev][i];
      if (typeof this.events[ev][i] == "function")
        this.events[ev][i].call(this, tmpargs);
    }
  }
};

function colormapHeat(v) {
  return {
    r: v <= 127.5 ? v * 2 : 255,
    g: v > 63.75 ? (v < 191.25 ? (v - 63.75) * 2 : 255) : 0,
    b: v > 127.5 ? (v - 127.5) * 2 : 0,
  };
}

function colormapA(v) {
  return {
    r: v <= 63.75 ? 0 : v <= 127.5 ? (v - 63.75) * 4 : 255,
    g:
      v <= 63.75
        ? v * 4
        : v <= 127.5
        ? (127.5 - v) * 4
        : v < 191.25
        ? 0
        : (v - 191.25) * 4,
    b:
      v < 31.875
        ? 0
        : v < 127.5
        ? ((v - 31.875) * 8) / 3
        : v < 191.25
        ? (191.25 - v) * 4
        : 0,
  };
}

function colormapB(v) {
  return {
    r: v <= 63.75 ? 0 : v <= 127.5 ? (v - 63.75) * 4 : 255,
    g: v <= 127.5 ? 0 : v <= 191.25 ? (v - 127.5) * 4 : 255,
    b:
      v < 63.75
        ? v * 4
        : v < 127.5
        ? (127.5 - v) * 4
        : v < 191.25
        ? 0
        : (v - 191.25) * 4,
  };
}

function colormapGray(v) {
  return { r: v, g: v, b: v };
}

// Helpful functions

// Cross-browser way to add an event
if (typeof addEvent != "function") {
  function addEvent(oElement, strEvent, fncHandler) {
    if (oElement.addEventListener)
      oElement.addEventListener(strEvent, fncHandler, false);
    else if (oElement.attachEvent)
      oElement.attachEvent("on" + strEvent, fncHandler);
  }
}

function systemBigEndian() {
  var arrayBuffer = new ArrayBuffer(2);
  var uint8Array = new Uint8Array(arrayBuffer);
  var uint16array = new Uint16Array(arrayBuffer);
  uint8Array[0] = 0xaa; // set first byte
  uint8Array[1] = 0xbb; // set second byte
  if (uint16array[0] === 0xbbaa) return false;
  if (uint16array[0] === 0xaabb) return true;
  else throw new Error("Neither big or little endian, what!?");
}

function swap16(val) {
  return ((val & 0xff) << 8) | ((val >> 8) & 0xff);
}
