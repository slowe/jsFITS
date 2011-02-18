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
	this.tags = {}
}

FITS.prototype.load = function(fnCallback){
	if(this.src){
		var _obj = this;
		BinaryAjax(
			_obj.src,
			function(oHTTP) {
				var i = _obj.readFITSHeader(oHTTP.binaryResponse);
				if(_obj.header.NAXIS == 2) success = _obj.readFITSImage(oHTTP.binaryResponse,i);
				if (typeof fnCallback=="function") fnCallback(_obj);
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
			header[key] = val;
		}
		if(str.indexOf('END') == 0) inHeader = 0;
		//alert('='+key+'='+val+'=\n'+str)
		//console.log(header)
	}

	this.header = header;
	if(this.header.NAXIS==2){
		if(typeof this.header.NAXIS1=="number") this.width = this.header.NAXIS1;
		if(typeof this.header.NAXIS2=="number") this.height = this.header.NAXIS2;
	}
	// Remove any space padding
	while(iOffset < iLength && oFile.getStringAt(iOffset,1) == " ") iOffset++; 

	return iOffset;
	
}

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

FITS.prototype.drawImage = function(id,type){
	this.id = id;
	type = type || "linear";

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
	ctx = el.getContext("2d");
	
	// create a new batch of pixels with the same
	// dimensions as the image:
	imageData = ctx.createImageData(this.width, this.height);

	var pos = 0;
	image = this.scaleImage(type);

	for(i = 0; i < this.image.length ; i++){
		col = i%this.width;
		row = Math.floor(i/this.width);
		pos = ((this.height-row)*this.width+col)*4;
		//pos = i*4;
		imageData.data[pos] = image[i];
		imageData.data[pos+1] = image[i];
		imageData.data[pos+2] = image[i];
		imageData.data[pos+3] = 0xff; // alpha
	}/*
	for(y = 0; y < this.height ; y++){
		for(x = 0; x < this.width ; x++){
			pos = (y*this.width+x)*4;
			imageData.data[pos] = image[i];
			imageData.data[pos+1] = image[i];
			imageData.data[pos+2] = image[i];
			imageData.data[pos+3] = 0xff; // alpha
			i++;
		}
	}*/
	str = "";
	//for(i=0; i<2000 ; i++){
	//	str += imageData.data[i*4]+' ';
	//}
	//$('#header').html(str);
	// put pixel data on canvas
	ctx.putImageData(imageData, 0, 0);
}

FITS.prototype.scaleImage = function(type){

	var max = 0;
	var min = 640000;
	var mean = 0;
	var image = new Array(this.image.length)

	
	for(i = 0; i < this.image.length ; i++){
		mean += this.image[i];
		if(typeof this.image[i] != "number") alert(this.image[i])
		if(this.image[i] > max) max = this.image[i];
		if(this.image[i] < min) min = this.image[i];
	}

	mean /= this.image.length;

	// Display fudge factors
	upper = max - (max-min)*0.05;
	lower = mean - (mean-min)*0.005;
	range = (upper-lower);

	//range = (max-threshold);
	for(i = 0; i < this.image.length ; i++){
		if(type=="linear") val = 255*((this.image[i]-lower)/range);
		if(type=="sqrt") val = 255*Math.sqrt((this.image[i]-lower)/range);
		if(type=="cuberoot") val = 255*Math.pow((this.image[i]-lower)/range,0.333);
		if(val < 0) val = 0;
		if(val > 255) val = 255;
		image[i] = val;
	}
	return image;
}
function trim(s) {
	s = s.replace(/(^\s*)|(\s*$)/gi,"");
	s = s.replace(/[ ]{2,}/gi," ");
	s = s.replace(/\n /,"\n");
	return s;
}