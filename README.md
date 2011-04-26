jsFITS
======

[FITS](http://fits.gsfc.nasa.gov/fits_primer.html) is the Flexible Image Transport System and is widely used in astronomy for holding observation data. There are many FITS I/O libraries available in [a variety of languages](http://fits.gsfc.nasa.gov/fits_libraries.html). This is an attempt to build a FITS library for Javascript to allow FITS files to be displayed in a modern web browser. Given that FITS files have no compression they are quite large so I imagine this library will be more useful when run locally. By displaying the image using <canvas> in the browser, it will be very easy to save a FITS image as a standard graphics file.

Dependencies
------------

For this library to work it has a few dependencies:

* [binaryajax.js](http://www.nihilogic.dk/labs/binaryajax/binaryajax.js) -- this does the XMLHttpRequest and the bit extraction. It is created by Jacob Seidelin and is only about 6.2 kB;
* [excanvas.js](http://code.google.com/p/explorercanvas/) -- this is used to allow canvas support on Internet Explorer;
* [jquery.js](http://jquery.com/) -- not used a great deal and I'll try to remove the need for it.


Limitations
-----------
Due to web browser cross-domain security issues, any FITS file you want to read must be hosted on the same domain as the code.


Usage
-----
You need to include the appropriate Javascript files:

	<script src="jquery-1.4.2.js"></script>
	<script src="binaryajax.js"></script>
	<script src="fits.js"></script>
	<script src="excanvas.js"></script>

Following those you can define your FITS object:

	var fits = new FITS("l_e_20110215_205_1_1_1.fits");

Now you need to load the FITS file and provide a function that will be called once loaded:

	fits.load(loaded);

	function loaded(obj){
		// The FITS header keywords are stored in obj.header
		// e.g. NAXIS = obj.header.NAXIS
		//      OBSID = obj.header.OBSID
		//      BITPIX = obj.header.BITPIX

		// Now we draw the image.
		// The first argument is the id of the page element
		// The second argument is the type of stretch to apply
		// e.g. linear, sqrt, cuberoot, log, sqrtlog, loglog
		obj.drawImage('FITSimage','cuberoot');
	}


FITS files
----------
Some example FITS files (from the [Las Cumbres Observatory Global Telescope Network](http://lcogt.net/)) can be found at:

* [M51](http://ari-archive.lcogt.net/data/webfiles/1298221795/l_e_20110215_205_1_1_1.fits) (taken with Faulkes Telescope North operated by LCOGT),
* [M108](http://ari-archive.lcogt.net/data/webfiles/1298260631/l_e_20110215_203_1_1_1.fits) (taken with Faulkes Telescope North operated by LCOGT).

Author
------
Stuart Lowe works for the [Las Cumbres Observatory Global Telescope](http://lcogt.net/). LCOGT is a private operating foundation, building a global network of telescopes for professional research and citizen investigations.
