// Probably rename this later lololol
// This file relies on jQuery (for now...)
// Starting inspiration:
// http://www.williammalone.com/articles/create-html5-canvas-javascript-drawing-app/

/*
THOUGHTS FOR EVENTUALLY:
    Should be option to EITHER set the canvas dimensions yourself or have them taken from the video?
*/
// TODO this should really be declared inside document.ready, but that makes
// things a pain in the ASS to debug.
var itree;

$(document).ready(function() {
    // TODO this should probably change in response to the actual dimensions of the video, and
    // ideally scale with the page--though resizing canvases may be a bit of a challenge, we'll see.
    var videoWidth = 500;
    var videoHeight = 350;
    var numVideoChunks = 5; // TODO similarly, this should probably change with the SIZE of the vid...
    var videoSelected = false;
    var penSelected = false; // TODO this variable isn't checked yet, only set...
    document.querySelector('#vidUpload').value = ''; // Forcibly clear file input on load
    var strokeDuration = 3; // TODO this should be set via textarea
    var bgColor = '#ffffff'; // TODO should be settable by button?

    var penColor = document.getElementById('penColor');
    var penSize = document.getElementById('penSize');

    $('#strokeDuration').change(function() {
        // this.value will be a string by default! That was an irritating bug,
        // let me tell you.
        var n = Number(this.value);
        if (!isNaN(n) && isFinite(n)) {
            strokeDuration = n;
        }
    });

    $('#penSize').change(function() { // Make sure pensize is always a number...
        if (isNaN(this.value)) {
            // Strip non-numeric or decimal characters
            // TODO won't fix getting NaN because of more than one decimal
            // I don't think that will do anything horrible to your browser though?
            // ...Probably.
            this.value = this.value.replace(/[^\d.]/g,'');
        }
    });

    var videoDiv = document.querySelector('#videoDiv'),
        video = document.createElement('video'),
        drawDiv = document.querySelector('#drawDiv'),
        drawCanvas = document.createElement('canvas'),
        drawCtx = drawCanvas.getContext('2d');

    /******
    INITIAL VIDEO STUFF
    ******/
    // TODO it's weird that I create this before a video is selected, isn't it
    video.controls = true;
    video.autoplay = true;
    video.setAttribute('width', videoWidth); // Do I want/need to do this with setAttribute?
    video.setAttribute('height', videoHeight);
    video.setAttribute('id', 'video');
    videoDiv.appendChild(video);

    var processVideo = function(file) {
        var dataURL = URL.createObjectURL(file);
        video.src = dataURL;
        // Can only access duration once metadata has loaded
        video.addEventListener('loadedmetadata', function() {
            // Create interval tree to store ink mark durations, centered at the
            // middle of the video
            var center = video.duration / 2;
            itree = new IntervalTree(center);

            // Scale canvas and video element to <500px wide at native aspect ratio
            var intrinsicWidth = video.videoWidth;
            var intrinsicHeight = video.videoHeight;
            if (intrinsicWidth > 500) {
                var scale = 500/intrinsicWidth;
                intrinsicWidth = 500;
                intrinsicHeight = intrinsicHeight * scale;
            }
            video.width = intrinsicWidth; // Do I want/need to do this with setAttribute?
            video.height = intrinsicHeight;

            canvas.height = intrinsicHeight;
            canvas.style.height = intrinsicHeight;
            canvas.width = intrinsicWidth;
            canvas.style.width = intrinsicWidth;

            videoSelected = true; // Prevent interaction until the event fires
        });
    }

    var playVideo = function(file) {
        if (video.canPlayType(file.type) != "") {
            //console.log("wahoo");
            processVideo(file);
            // video element is autoplay, so playback should start as soon as data is available
        } else {
            // TODO: some error messages.
            //console.log("ohno");
        }
    }

    // TODO do I really want to do this with jQuery?
    $("#vidUpload").change(function() {
        playVideo(this.files[0]);
    });

    // TODO none of these seem to actually work except for on playing
    $("#video").on('playing', function() {
        // TODO disable drawing
        timerCallback();
    });
    $("#video").on('seeked', timerCallback);
    $("#video").on('seeking', timerCallback);
    $("#video").on('timeupdate', timerCallback);

    /******
    INITIAL CANVAS STUFF
    ******/
    // TODO do I want/need to set these with setAttribute?
    drawCanvas.setAttribute('width', videoWidth);
    drawCanvas.setAttribute('height', videoHeight);
    drawCanvas.setAttribute('id', 'canvas');
    drawDiv.appendChild(drawCanvas);

    if(window.G_vmlCanvasManager) {
        // I think excanvas needs this. Haven't done much IE testing tbh
        drawCanvas = G_vmlCanvasManager.initElement(drawCanvas);
    }

    // strokes is a UUID-keyed dict holding objects of the form {x:[int], y:[int]}
    // TODO something should probably happen with these if a new video is selected.
    // Delete them? Try to map ones within video range onto new video? Hrrrmmmm.
    var strokes = {};
    var clickX = [];
    var clickY = [];
    var paint = false;


    function addClick(x, y) {
        if (!videoSelected || !penSelected) return; // HACK

        clickX.push(x);
        clickY.push(y);
    }

    function redraw() {
        if (!videoSelected) return; // HACK

        if (document.querySelector('#drawVideo').checked) {
            drawCtx.drawImage(video, 0, 0, video.width, video.height);
        } else {
            // TODO should I do clearRect first? the canvas doesn't get, like,
            // cluttered by things that are hidden, right? that'd be dumb
            // drawCtx.clearRect(0, 0, drawCtx.canvas.width, drawCtx.canvas.height);
            drawCtx.fillStyle = bgColor; // TODO maybe restore this? not like I use it...
            drawCtx.fillRect(0, 0, videoWidth, videoHeight);
        }

        var currStrokes = itree.pointSearch(video.currentTime);

        currStrokes.forEach(function(s) {
            drawStroke(strokes[s.id], drawCtx);
        });

        // I realized it was no longer drawing the path WHILE you make it, because
        // it doesn't get saved to strokes until you lift the mouse...
        // So, we just draw clickX and clickY too. Maybe a better way to do this...
        var strokeInProgress = {
            x: clickX,
            y: clickY,
            color: penColor.value,
            size: Number(penSize.value)
        }
        drawStroke(strokeInProgress, drawCtx);
    }

    $("#canvas").mousedown(function(e) {
        if (!videoSelected || !penSelected) return; // HACK

        var mouseX = e.pageX - this.offsetLeft;
        var mouseY = e.pageY - this.offsetTop;

        paint = true;
        addClick(mouseX, mouseY);
        redraw();
    });

    $("#canvas").mousemove(function(e) {
        if (!videoSelected || !penSelected) return; // HACK

        // TODO would recording marks sliiightly less often give less jittery lines?
        // test at multiple levels
        if(paint) {
            addClick(e.pageX - this.offsetLeft, e.pageY - this.offsetTop);
            // TODO is there a way to do this that's less stupid than redrawing every mousemove?
            redraw();
        }
    });

    function drawStroke(stroke, context) {
        if (!videoSelected) return; // HACK

        context.strokeStyle = stroke.color;
        drawCtx.lineJoin = "round";
        context.lineWidth = stroke.size;

        for (var i=0; i < stroke.x.length; ++i) {
            context.beginPath();
            if(i) { // avoids array underflow because 0 is falsy
                context.moveTo(stroke.x[i-1], stroke.y[i-1]);
            } else {
                // If i == 0, we stay at the current point
                // and "stroke" only that last (point) segment.
                context.moveTo(stroke.x[i], stroke.y[i]);
            }
            context.lineTo(stroke.x[i], stroke.y[i]);
            context.closePath();
            context.stroke(); // Is there really a need to stroke all of these? Does that make a difference?
            // It seems like you could just do a lot of lineTos and then stroke at the end of the mark...
        }
    }

    function saveStroke() {
        if (!videoSelected || !penSelected) return; // HACK?
        if (!paint) return; // Also kind of a hack, it's really dumb for this function to fire at all if you aren't drawing anything

        paint = false;
        var key = UUID.generate();

        // Cursory collision-checking?
        while(strokes[key]) {
            console.log("This should not happen, really.");
            key = UUID.generate();
        }

        var stroke = {};
        stroke.y = clickY.slice();
        stroke.x = clickX.slice();
        stroke.color = penColor.value;
        stroke.size = Number(penSize.value);

        strokes[key] = stroke; // Store stroke data with key
        var startTime = video.currentTime;
        // Don't really want intervals that extend past the end of the video
        var endTime = Math.min(startTime + strokeDuration, video.duration);

        itree.add(startTime, endTime, key); // associate interval with key
        clickY = [];
        clickX = [];
        redraw();
    }

    $("#canvas").mouseup(function(e) {
        if (!videoSelected) return; // HACK

        saveStroke();
    });

    $("#canvas").mouseleave(function(e) {
        if (!videoSelected) return; // HACK

        saveStroke();
    });

    /******
    INITIAL OVERLAY STUFF
    ******/
    function timerCallback() {
        if (video.paused || video.ended) {
            return;
        }
        redraw();
        // TODO is this a good rate?
        setTimeout(timerCallback, 20);
    }

    function initializeButtons() {
        /*
        ######CLEAR BUTTONS######
        */
        // TODO clean this up...

document.querySelector('button[name="clearAll"]').addEventListener('click', clearAllMarks);

document.querySelector('button[name="clearCurrent"]').addEventListener('click', clearCurrentFrame);

        function clearCurrentFrame() {
            var currStrokes = itree.pointSearch(video.currentTime);
            currStrokes.forEach(function(s) {
                console.log("removing stroke "+s.id);
                itree.remove(s.id);
                delete strokes[s.id];
            });
            redraw();
        }

        function clearAllMarks() {
            console.log("wipin' it all!");
            // reset interval tree
            itree = new IntervalTree(video.duration / 2);
            // clear stroke data
            strokes = {};
            redraw();
        }

        // TODO add functions for clear all ending before current and
        // clear all starting after current

        /*
        ######COLOR BUTTONS######
        */
        var palette = [ '#ffffff', '#000000', '#ff0000', '#ff8000', '#ffff00',
                        '#008000', '#0000ff', '#4b0082', '#9400d3' ];
        var colorMenu = document.getElementById('colorList');
        for (var color of palette) {
            var colorButton = document.createElement('button'),
                listItem = document.createElement('li');
            colorButton.value = color;
            colorButton.title = color;
            colorButton.className = 'colorButton';
            colorButton.style.backgroundColor = color;
            listItem.appendChild(colorButton);
            colorMenu.appendChild(listItem);
        }

        // TODO should this be declared elsewhere?

        colorMenu.addEventListener('click', function(e) {
            // elem.classList is unsupported in IE < 10
            if (e.target && e.target.classList.contains('colorButton')) {
                penColor.value = e.target.value;
            }
        });

        /*
        ######PEN BUTTON######
        */
        var penButton = document.querySelector('#penButton');
        // TODO this should be a separate function, we want to be able to set
        // pen selected status via other events.
        function setDrawing(enabled) {
            if (enabled) {
                penButton.value = 'ON';
                penButton.innerHTML = '&#x270E;'; // lower right pencil (held)
                penButton.title = "Stop drawing";
                penSelected = true;
            } else {
                penButton.value = 'OFF';
                penButton.innerHTML = '&#x270F;'; // pencil (horizontal)
                penButton.title = "Begin drawing";
                penSelected = false;
            }
        }

        penButton.addEventListener('click', function() {
            if (penButton.value == 'OFF') {
                setDrawing(true);
                video.pause(); // Can't draw while video is playing
            } else {
                setDrawing(false);
            }
        });

        $('#video').on('playing', function() {
            setDrawing(false); // Can't draw while video is playing
        });

        /*
        ######SIZE BUTTONS######
        */
        var sizes = [3, 7, 11, 15]
        var sizeMenu = document.getElementById('sizeList');
        for (var size of sizes) {
            var sizeButton = document.createElement('button'),
                listItem = document.createElement('li');
            sizeButton.value = size;
            sizeButton.title = size + 'px';
            sizeButton.className = 'sizeButton';
            sizeButton.innerHTML = size + 'px';
            listItem.appendChild(sizeButton);
            sizeMenu.appendChild(listItem);
        }

        sizeMenu.addEventListener('click', function(e) {
            // elem.classList is unsupported in IE < 10
            if (e.target && e.target.classList.contains('sizeButton')) {
                penSize.value = e.target.value;
            }
        });
    }
    initializeButtons(); // TODO this should be called elsewhere!
});
