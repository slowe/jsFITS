/*
 * Javascript FITS Reader 0.2
 * Copyright (c) 2010 Stuart Lowe http://lcogt.net/
 *
 * Licensed under the MPL http://www.mozilla.org/MPL/MPL-1.1.txt
 *
 * Requires Jacob Seidelin's binaryajax.js from http://www.nihilogic.dk/labs/exif/
 */

function FITS(input){
	this.src = (typeof input=="string") ? input : "";
	this.img = { complete: false };
	this.xmp = "";    // Will hold the XMP string (for test purposes)
	this.avmdata = false;
	this.tags = {};
	this.stretch = "linear";
	this.color = "gray";
	this.depth = 0;
	this.z = 0;
	this.events = {load:"",click:"",mousemove:""};	// Let's define some events
	this.data = {load:"",click:"",mousemove:""};	// Let's define some event data
}

// Loads the FITS file using an ajax request. To call your own function after
// the FITS file is loaded, you should either provide a callback directly or have
// already set the load function.
FITS.prototype.load = function(source,fnCallback){
	if(typeof source=="string") this.src = source;
	if(typeof this.src=="string"){ 
		this.image = null
		var _obj = this;
		if(typeof fnCallback=="function") _obj.bind("load",fnCallback)
		BinaryAjax(
			_obj.src,
			function(oHTTP){
				var i = _obj.readFITSHeader(oHTTP.binaryResponse);
				if(_obj.header.NAXIS >= 2) success = _obj.readFITSImage(oHTTP.binaryResponse,i);
				_obj.triggerEvent("load")
			}
		)
	}
	return this;
}

// Parse the ASCII header from the FITS file. It should be at the start.
FITS.prototype.readFITSHeader = function(oFile){
	var iLength = oFile.getLength();
	var iOffset = 0;
	var header = {};
	var key;
	var val;
	var inHeader = 1;

	while (iOffset < iLength && inHeader){
		str = oFile.getStringAt(iOffset,80)
		iOffset += 80;
		var eq = str.indexOf('=');
		key = trim(str.substring(0,eq))
		val = trim(str.substring(eq+1,Math.max(str.indexOf('/'),str.length)))
		if(key.length > 0){
			if(val.indexOf("'")==0){
				// It is a string
				val = val.substring(1,val.length-2)
			}else{
				if(val.indexOf('.') >= 0) val = parseFloat(val); // Floating point
				else val = parseInt(val); // Integer
			}
			header[key] = val;
		}
		if(str.indexOf('END') == 0) inHeader = 0;
		//console.log(header)
	}

	this.header = header;
	if(this.header.NAXIS >= 2){
		if(typeof this.header.NAXIS1=="number") this.width = this.header.NAXIS1;
		if(typeof this.header.NAXIS2=="number") this.height = this.header.NAXIS2;
	}

	if(this.header.NAXIS > 2 && typeof this.header.NAXIS3=="number") this.depth = this.header.NAXIS3;   
	else this.depth = 1;

	if(typeof this.header.BSCALE=="undefined") this.header.BSCALE = 1;
	if(typeof this.header.BZERO=="undefined") this.header.BZERO = 0;
	
	// Remove any space padding
	while(iOffset < iLength && oFile.getStringAt(iOffset,1) == " ") iOffset++;

	return iOffset;
}

// Parse the FITS image from the file
FITS.prototype.readFITSImage = function(oFile,iOffset){
	var iLength = oFile.getLength();
	var i = 0;
	this.z = 0;
	this.image = new Array(this.width*this.height*this.depth);
	var bBigEnd = (typeof this.header.BYTEORDR == "undefined");    // FITS is defined as big endian

	// BITPIX
	// 8-bit (unsigned) integer bytes
	// 16-bit (signed) integers
	// 32-bit (signed) integers
	// 32-bit single precision floating point real numbers
	// 64-bit double precision floating point real numbers
	//
	// Should actually deal with the different cases
	var p = 0;

	if(this.header.BITPIX == 16){
		i = iOffset;
		while (i < iLength){
			val = oFile.getSShortAt(i,bBigEnd);
			this.image[p++] = val*this.header.BSCALE + this.header.BZERO;
			i += 2;
		}
		return true;
	}else if(this.header.BITPIX == -32){
		i = iOffset;
		var x
		while (i < iLength){
			x = val = oFile.getLongAt(i,true); //IEEE float32 is always big-endian
			if (val != 0) val = (1.0+((val&0x007fffff)/0x0800000)) * Math.pow(2,((val&0x7f800000)>>23) - 127);
			//  val = (((0x8000000|(val&0x007fffff))/0x0800000)) * Math.pow(2,(val&0x7f800000)>>23 - 127);
			//val = (val&0x7f800000)>>23-127
			//val = val&0x07fffff

			//alert(x + ' ' + val.toSource())
			//break
			if (x < 0) val = -val;
			this.image[p++] = val*this.header.BSCALE + this.header.BZERO;

			i += 4;
		}
		return true;
	}else return false;
}

// Use <canvas> to draw a 2D image
FITS.prototype.draw = function(id,type){
	id = id || this.id;
	this.id = id;
	type = type || this.stretch;

	// Now we want to build the <canvas> element that will hold our image
	var el = document.getElementById(id);
	if(el!=null){
		// Look for a <canvas> with the specified ID or fall back on a <div>
		if(typeof el=="object" && el.tagName != "CANVAS"){
			// Looks like the element is a container for our <canvas>
			el.setAttribute('id',this.id+'holder');
			var canvas = document.createElement('canvas');
			canvas.style.display='block';
			canvas.setAttribute('width',this.width);
			canvas.setAttribute('height',this.height);
			canvas.setAttribute('id',this.id);
			el.appendChild(canvas);
			// For excanvas we need to initialise the newly created <canvas>
			if(/*@cc_on!@*/false) el = G_vmlCanvasManager.initElement(this.canvas);
		}else{
			// Define the size of the canvas
			// Excanvas doesn't seem to attach itself to the existing
			// <canvas> so we make a new one and replace it.
			if(/*@cc_on!@*/false){
				var canvas = document.createElement('canvas');
				canvas.style.display='block';
				canvas.setAttribute('width',this.width);
				canvas.setAttribute('height',this.height);
				canvas.setAttribute('id',this.id);
				el.parentNode.replaceChild(canvas,el);
				if(/*@cc_on!@*/false) el = G_vmlCanvasManager.initElement(elcanvas);
			}else{
				el.setAttribute('width',this.width);
				el.setAttribute('height',this.height);
			}   
		}
		this.canvas = document.getElementById(id);
	}else this.canvas = el;
	this.ctx = this.canvas.getContext("2d");
	var _obj = this;
	// The object didn't exist before so we add a click event to it
	if(typeof this.events.click=="function") addEvent(this.canvas,"click",function(e){ _obj.clickListener(e) });
	if(typeof this.events.mousemove=="function") addEvent(this.canvas,"mousemove",function(e){ _obj.moveListener(e) });

	// create a new batch of pixels with the same
	// dimensions as the image:
	imageData = this.ctx.createImageData(this.width, this.height);

	var pos = 0;
	this.update(type,0);
}

// Calculate the pixel values using a defined stretch type and draw onto the canvas
FITS.prototype.update = function(inp){
	if(typeof inp=="object"){
		this.stretch = (typeof inp.stretch=="string") ? inp.stretch : this.stretch; 
		if(typeof inp.index!="number" && this.z) inp.index = this.z;
		this.z = Math.max(0,Math.min(this.depth-1,Math.abs(inp.index || 0)));
		this.color = (typeof inp.color=="string") ? inp.color : this.color;
	}else{
		if(typeof inp=="string") this.stretch = inp;
	}
	if(this.image==null) return 0;

	var mean = 0;
	var median = 0;
	var image = new Array(this.width*this.height)
	var j = 0;
	var i = 0;
	var count = 0;
	var val
	var start = this.width * this.height * this.z;
	var max = this.image[start];
	var min = this.image[start];
	var stop = start + image.length;

	for(i = start; i < stop ; i++){
		val = this.image[i];
		mean += val;
		if(val > max) max = val;
		if(val < min) min = val;
	}
	mean /= this.image.length;

	// Calculating the median on the whole image is time consuming.
	// Instead, we'll extract three patches that are 100th the area
	var sorted = new Array();
	// One patch on the top edge (100th of full image)
	for(j = 0; j < Math.round(this.height*0.1) ; j++) for(var i = Math.round(this.width*0.45); i < Math.round(this.width*0.55) ; i++) sorted[count++] = this.image[start+j*this.width + i];
	// A patch to the lower left of centre (100th of full image)
	for(j = Math.round(this.height*0.55); j < Math.round(this.height*0.65) ; j++) for(i = Math.round(this.width*0.35); i < Math.round(this.width*0.45) ; i++) sorted[count++] = this.image[start+j*this.width + i];
	// A patch to the right (100th of full image)
	for(j = Math.round(this.height*0.45); j < Math.round(this.height*0.55) ; j++) for(i = Math.round(this.width*0.85); i < Math.round(this.width*0.95) ; i++) sorted[count++] = this.image[start+j*this.width + i];
	sorted.sort(function sortNumber(a,b){ return a - b; })
	median = sorted[Math.floor(sorted.length/2)];

	// Fudge factors
	if(this.stretch=="log") {
		upper = Math.log(max)
		lower = Math.log(sorted[Math.floor(sorted.length/20)]);
		if(isNaN(lower)) lower = 1;   
	}else if(this.stretch=="loglog") {
		upper = Math.log(Math.log(max))
		lower = Math.log(Math.log(sorted[Math.floor(sorted.length/20)]));
		if(isNaN(lower)) lower = 1;   
	}else if(this.stretch=="sqrtlog") {
		upper = Math.sqrt(Math.log(max))
		lower = Math.sqrt(Math.log(sorted[Math.floor(sorted.length/20)]));
		if(isNaN(lower)) lower = 1;   
	}else{
		upper = max - (max-min)*0.2;
		lower = sorted[Math.floor(sorted.length/10)];
		if (lower > upper) lower = min
	}
	range = (upper-lower);

	if(this.stretch=="linear") for(j=0, i = start; i <  stop ; j++,i++) image[j] = 255*((this.image[i]-lower)/range);
	if(this.stretch=="sqrt") for(j=0,i = start; i < stop ;j++, i++) image[j] = 255*Math.sqrt((this.image[i]-lower)/range);
	if(this.stretch=="cuberoot") for(j=0,i = start; i < stop ; j++,i++) image[j] = 255*Math.pow((this.image[i]-lower)/range,0.333);
	if(this.stretch=="log") for(j=0,i = start; i < stop ; j++,i++) image[j] = 255*(Math.log(this.image[i])-lower)/range;
	if(this.stretch=="loglog") for(j=0,i = start; i < stop ; j++,i++) image[j] = 255*(Math.log(Math.log(this.image[i]))-lower)/range;
	if(this.stretch=="sqrtlog") for(j=0,i = start; i < stop ; j++,i++) image[j] = 255*(Math.sqrt(Math.log(this.image[i]))-lower)/range;
	for(i = 0; i < image.length ; i++){
		val = image[i]
		if(isNaN(val)) image[i] = 0;
		else if(val < 0) image[i] = 0;
		else if(val > 255) image[i] = 255;
		else image[i] = val
	}

	var row = 0;
	var col = 0;
	var i=0;
	for (row=0;row<this.height; row++){
		for (col=0;col<this.width;col++){
			pos = ((this.height-row)*this.width+col)*4
			c = this.colorImage(image[i],this.color);
			//if(i < 3) console.log(c,image[i])
			imageData.data[pos] = c.r;
			imageData.data[pos+1] = c.g;
			imageData.data[pos+2] = c.b;
			imageData.data[pos+3] = 0xff; // alpha
			i++    ;
		}
	}
	str = "";
	// put pixel data on canvas
	this.ctx.putImageData(imageData, 0, 0);
}

FITS.prototype.getCursor = function(e){
	var x;
	var y;
	if (e.pageX != undefined && e.pageY != undefined){
		x = e.pageX;
		y = e.pageY;
	}else{
		x = e.clientX + document.body.scrollLeft + document.body.scrollLeft +document.documentElement.scrollLeft;
		y = e.clientY + document.body.scrollTop + document.body.scrollTop +document.documentElement.scrollTop;
	}

	var target = e.target
	while(target){
		x -= target.offsetLeft;
		y -= target.offsetTop;
		target = target.offsetParent;
		//  alert(typeof target)
	}
	this.cursor = {x:x, y:y};
}

FITS.prototype.clickListener = function(e){
	this.getCursor(e);
	this.triggerEvent("click",{x:this.cursor.x,y:this.cursor.y})
}

FITS.prototype.moveListener = function(e){
	this.getCursor(e);
	this.triggerEvent("mousemove",{x:this.cursor.x,y:this.cursor.y})
}


FITS.prototype.bind = function(ev,data,fn){
	if(!fn && typeof data == "function") fn = data;
	if(typeof data!="object") data = {};
	if(typeof ev!="string" || typeof fn!="function") return this;
	if(this.events[ev]) this.events[ev].push(fn);
	else this.events[ev] = [fn];
	if(this.data[ev]) this.data[ev].push(data);
	else this.data[ev] = [data];
	return this;
}
// Trigger a defined event with arguments.
FITS.prototype.triggerEvent = function(ev,args){
	if(typeof ev != "string") return;
	if(typeof args != "object") args = {};
	//var _obj = this;
	if(typeof this.events[ev]=="object"){
		for(i = 0 ; i < this.events[ev].length ; i++){
			tmpargs = args;
			tmpargs.data = this.data[ev][i];
			if(typeof this.events[ev][i] == "function") this.events[ev][i].call(this,tmpargs);
		}
	}
}
// Colour scales defined by SAOImage
FITS.prototype.colorImage = function(v,type){
	if(type=="blackbody" || type=="heat") return {r:((v<=127.5) ? v*2 : 255),g:((v>63.75) ? ((v<191.25) ? (v-63.75)*2 : 255) : 0),b:((v>127.5) ? (v-127.5)*2 : 0)};
	else if(type=="A") return {r:((v<=63.75) ? 0 : ((v<=127.5) ? (v-63.75)*4 : 255)),g:((v<=63.75) ? v*4 : ((v<=127.5) ? (127.5-v)*4 : ((v<191.25) ? 0: (v-191.25)*4))),b:((v<31.875) ? 0 : ((v<127.5) ? (v-31.875)*8/3 : ((v < 191.25) ? (191.25-v)*4 : 0)))};
	else if(type=="B") return {r:((v<=63.75) ? 0 : ((v<=127.5) ? (v-63.75)*4 : 255)),g:((v<=127.5) ? 0 : ((v<=191.25) ? (v-127.5)*4 : 255)),b: ((v<63.75) ? v*4 : ((v<127.5) ? (127.5-v)*4 : ((v<191.25) ? 0 : (v-191.25)*4 ))) };
	else return {r:v,g:v,b:v};
	
}

// Helpful functions

// Cross-browser way to add an event
if(typeof addEvent!="function"){
	function addEvent(oElement, strEvent, fncHandler){
		if(oElement.addEventListener) oElement.addEventListener(strEvent, fncHandler, false);
		else if(oElement.attachEvent) oElement.attachEvent("on" + strEvent, fncHandler);
	}
}

function trim(s) {
	s = s.replace(/(^\s*)|(\s*$)/gi,"");
	s = s.replace(/[ ]{2,}/gi," ");
	s = s.replace(/\n /,"\n");
	return s;
}
