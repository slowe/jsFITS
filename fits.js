/*
 * Javascript FITS Reader 0.1
 * Copyright (c) 2010 Stuart Lowe http://lcogt.net/
 *
 * Licensed under the MPL http://www.mozilla.org/MPL/MPL-1.1.txt
 *
 * Requires Jacob Seidelin's binaryajax.js from http://www.nihilogic.dk/labs/exif/
 */

function FITS(input){
	this.src = (input) ? input : "";
	this.img = { complete: false };
	this.xmp = "";	// Will hold the XMP string (for test purposes)
	this.avmdata = false;
	this.tags = {};
	this.stretch = "linear";
	this.onload = "";
}

// Change the source file (you'll need to do a .load() afterwards)
FITS.prototype.changeSource = function(input){
	this.src = (input) ? input : this.src;
}

// Loads the FITS file using an ajax request. To call your own function after
// the FITS file is loaded, you should either provide a callback directly or have
// already set the onload function.
FITS.prototype.load = function(fnCallback){
	if(this.src){
		var _obj = this;
		BinaryAjax(
			_obj.src,
			function(oHTTP) {
				var i = _obj.readFITSHeader(oHTTP.binaryResponse);
				if(_obj.header.NAXIS == 2) success = _obj.readFITSImage(oHTTP.binaryResponse,i);
				if (typeof fnCallback=="function") fnCallback(_obj);
				else if(typeof _obj.onload=="function") _obj.onload.call(_obj);
			}
		)
	}
}

if(typeof addEvent!="function"){
	function addEvent(oElement, strEvent, fncHandler){
		if (oElement.addEventListener) oElement.addEventListener(strEvent, fncHandler, false); 
		else if (oElement.attachEvent) oElement.attachEvent("on" + strEvent, fncHandler); 
	}
}

// Parse the ASCII header from the FITS file. It should be at the start.
FITS.prototype.readFITSHeader = function(oFile) {
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
		val = trim(str.substring(eq+1,str.indexOf('/')))
		if(key.length > 0){
			if(val.indexOf("'")==0){
				// It is a string
				val = val.substring(1,val.length-2)
			}else{
				if(val.indexOf('.') >= 0) val = parseFloat(val); // Floating point
				else val = parseInt(val); // Integer
			}
			// Construct an object to hold all the key/value pairs
			header[key] = val;
		}
		// Check if we have reached the end of the header
		if(str.indexOf('END') == 0) inHeader = 0;
	}

	// Set the header
	this.header = header;
	if(this.header.NAXIS==2){
		// Set some handy variables for images
		if(typeof this.header.NAXIS1=="number") this.width = this.header.NAXIS1;
		if(typeof this.header.NAXIS2=="number") this.height = this.header.NAXIS2;
	}

	// Remove any space padding
	while(iOffset < iLength && oFile.getStringAt(iOffset,1) == " ") iOffset++; 

	return iOffset;
}

// Parse the FITS image from the file
FITS.prototype.readFITSImage = function(oFile,iOffset) {
	var iLength = oFile.getLength();
	var i = 0;
	this.image = new Array(this.header.NAXIS1*this.header.NAXIS2);
	var bBigEnd = true;	// FITS is defined as big endian

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
	}else return false;
}

// Use <canvas> to draw a 2D image
FITS.prototype.drawImage = function(id,type){
	this.id = id;
	type = type || this.stretch;

	// Now we want to build the <canvas> element that will hold our image
	var el = document.getElementById(id);
	if(el!=null){
		// Look for a <canvas> with the specified ID or fall back on a <div>
		if(typeof el=="object" && el.tagName != "CANVAS"){
			// Looks like the element is a container for our <canvas>
			el.setAttribute('id',this.id+'holder');
			elcanvas = document.createElement('canvas');
			elcanvas.style.display='block';
			elcanvas.setAttribute('width',this.width);
			elcanvas.setAttribute('height',this.height);
			elcanvas.setAttribute('id',this.id);
			el.appendChild(elcanvas);
			// For excanvas we need to initialise the newly created <canvas>
			if(/*@cc_on!@*/false) el = G_vmlCanvasManager.initElement(elcanvas);
		}else{
			// Define the size of the canvas
			// Excanvas doesn't seem to attach itself to the existing
			// <canvas> so we make a new one and replace it.
			if(/*@cc_on!@*/false){
				elcanvas = document.createElement('canvas');
				elcanvas.style.display='block';
				elcanvas.setAttribute('width',this.width);
				elcanvas.setAttribute('height',this.height);
				elcanvas.setAttribute('id',this.id);
				el.parentNode.replaceChild(elcanvas,el);
				if(/*@cc_on!@*/false) el = G_vmlCanvasManager.initElement(elcanvas);
			}else{
				el.setAttribute('width',this.width);
				el.setAttribute('height',this.height);
			}
		}
	}
	el = document.getElementById(id);
	this.ctx = el.getContext("2d");
	
	// create a new batch of pixels with the same
	// dimensions as the image:
	imageData = this.ctx.createImageData(this.width, this.height);

	var pos = 0;
	
	// Now actually build the image
	this.updateImage(type);
}

// Calculate the pixel values using a defined stretch type and draw onto the canvas
FITS.prototype.updateImage = function(type){
	this.stretch = type ? type : this.stretch;
	var max = 0;
	var min = 640000;
	var mean = 0;
	var median = 0;
	var image = new Array(this.image.length)
	var j = 0;
	var i = 0;
	var count = 0;

	for(i = 0; i < this.image.length ; i++){
		mean += this.image[i];
		if(isNaN(this.image[i])) alert(this.image[i])
		if(this.image[i] > max) max = this.image[i];
		if(this.image[i] < min) min = this.image[i];
	}
	mean /= this.image.length;
	
	// Calculating the median on the whole image is time consuming. 
	// Instead, we'll extract three patches that are 100th the area
	var sorted = new Array();
	// One patch on the top edge (100th of full image)
	for(j = 0; j < Math.round(this.header.NAXIS2*0.1) ; j++) for(var i = Math.round(this.header.NAXIS1*0.45); i < Math.round(this.header.NAXIS1*0.55) ; i++) sorted[count++] = this.image[j*this.header.NAXIS1 + i];
	// A patch to the lower left of centre (100th of full image)
	for(j = Math.round(this.header.NAXIS2*0.55); j < Math.round(this.header.NAXIS2*0.65) ; j++) for(i = Math.round(this.header.NAXIS1*0.35); i < Math.round(this.header.NAXIS1*0.45) ; i++) sorted[count++] = this.image[j*this.header.NAXIS1 + i];
	// A patch to the right (100th of full image)
	for(j = Math.round(this.header.NAXIS2*0.45); j < Math.round(this.header.NAXIS2*0.55) ; j++) for(i = Math.round(this.header.NAXIS1*0.85); i < Math.round(this.header.NAXIS1*0.95) ; i++) sorted[count++] = this.image[j*this.header.NAXIS1 + i];
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
	}

	range = (upper-lower);

	//range = (max-threshold);
	for(i = 0; i < this.image.length ; i++){
		if(this.stretch=="linear") val = 255*((this.image[i]-lower)/range);
		if(this.stretch=="sqrt") val = 255*Math.sqrt((this.image[i]-lower)/range);
		if(this.stretch=="cuberoot") val = 255*Math.pow((this.image[i]-lower)/range,0.333);
		if(this.stretch=="log") val = 255*(Math.log(this.image[i])-lower)/range;
		if(this.stretch=="loglog") val = 255*(Math.log(Math.log(this.image[i]))-lower)/range;
		if(this.stretch=="sqrtlog") val = 255*(Math.sqrt(Math.log(this.image[i]))-lower)/range;
		if(isNaN(val)) val = 0;
		if(val < 0) val = 0;
		if(val > 255) val = 255;
		image[i] = val;
	}
	for(i = 0; i < this.image.length ; i++){
		col = i%this.width;
		row = Math.floor(i/this.width);
		pos = ((this.height-row)*this.width+col)*4;
		//pos = i*4;
		imageData.data[pos] = image[i];
		imageData.data[pos+1] = image[i];
		imageData.data[pos+2] = image[i];
		imageData.data[pos+3] = 0xff; // alpha
	}
	str = "";
	// put pixel data on canvas
	this.ctx.putImageData(imageData, 0, 0);
}

// Helpful function for removing spaces at the start/end of a string
function trim(s) {
	s = s.replace(/(^\s*)|(\s*$)/gi,"");	// Remove spaces at the start/end of the string
	s = s.replace(/[ ]{2,}/gi," ");	// Remove multiple spaces
	s = s.replace(/\n /,"\n");
	return s;
}