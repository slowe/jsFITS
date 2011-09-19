jsFITS
======

[FITS](http://fits.gsfc.nasa.gov/fits_primer.html) is the Flexible Image Transport System and is widely used in astronomy for holding observation data. There are many FITS I/O libraries available in [a variety of languages](http://fits.gsfc.nasa.gov/fits_libraries.html). This is an attempt to build a FITS library for Javascript to allow FITS files to be displayed in a modern web browser. Given that FITS files have no compression they are quite large so I imagine this library will be more useful when run locally. By displaying the image using <canvas> in the browser, it will be very easy to save a FITS image as a standard graphics file.

Dependencies
------------

For this library to work it has two dependencies:

* [binaryajax.js](http://www.nihilogic.dk/labs/binaryajax/binaryajax.js) -- this does the XMLHttpRequest and the bit extraction. It is created by Jacob Seidelin and is only about 6.2 kB;
* [excanvas.js](http://code.google.com/p/explorercanvas/) -- this is used to allow canvas support on Internet Explorer (41.6 kB).


Limitations
-----------
Due to web browser cross-domain security issues, any FITS file you want to read must be hosted on the same domain as the code.


Usage
-----
You need to include the appropriate Javascript files:

	<script src="binaryajax.js"></script>
	<script src="excanvas.js"></script>
	<script src="fits.js"></script>

Following those you can define your FITS object:

	var fits = new FITS();

Next we define what happens on load:

	fits.bind("load",function(){

		// Display some values
		document.getElementById('bitpix').innerHTML = this.header.BITPIX;
		document.getElementById('depth').innerHTML = this.depth;
		document.getElementById('z').value = 0;

		this.draw("FITSimage")	// Draw the image to the element with id=FITSimage
	})


We can also bind some other events (which are chainable) e.g.:

	fits.bind("click",function(e){
		e.y = this.height - e.y
		var value =this.image[e.y*this.width+e.x];
		document.getElementById('status').innerHTML ='click=('+ e.x+','+e.y+')='+value;
	}).bind("mousemove",function(e){
		e.y = this.height - e.y
		var value =this.image[e.y*this.width+e.x];
		document.getElementById('status').innerHTML ='move=('+ e.x+','+e.y+')='+value;
	})
	

Finally, load the FITS file. We've already defined the load event above:

	fits.load("WFPC2u5780205r_c0fx.fits");


FITS files
----------
The example makes use of several FITS files. You can get these at:

* [M51](http://lcogt.net/en/observations/ogg/2m0a/60395) (taken with [Faulkes Telescope North](http://lco3-beta/en/observations/ogg/2m0a) operated by [LCOGT](http://lcogt.net/)),
* [M108](http://lcogt.net/en/observations/ogg/2m0a/56609) (taken with [Faulkes Telescope North](http://lco3-beta/en/observations/ogg/2m0a) operated by [LCOGT](http://lcogt.net/)).
* [NGC 2011](http://lcogt.net/en/observations/coj/2m0a/55993) (taken with [Faulkes Telescope South](http://lcogt.net/en/observations/coj/2m0a) operated by [LCOGT](http://lcogt.net/))
* [NGC 2020](http://lcogt.net/en/observations/coj/2m0a/55996) (taken with [Faulkes Telescope South](http://lcogt.net/en/observations/coj/2m0a) operated by [LCOGT](http://lcogt.net/))
* [WFPC II 800 x 800 x 4 primary array data cube containing the 4 CCD images](http://fits.gsfc.nasa.gov/cgi-bin/browse?file=/samples/WFPC2u5780205r_c0fx.fits) (trimmed to 200 x 200 and taken from http://fits.gsfc.nasa.gov/fits_samples.html)

Author
------
Stuart Lowe works for the [Las Cumbres Observatory Global Telescope](http://lcogt.net/). LCOGT is a private operating foundation, building a global network of telescopes for professional research and citizen investigations.

Some improvements have been suggested by anonymous contributors.
