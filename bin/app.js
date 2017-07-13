var express = require('express')
var app = express()
var expressWs = require('express-ws')(app);

var limit = 100;

var db = require('./helpers/db-connect')
var fs = require('fs');

var Thumbnail = require('thumbnail');
var path = require('path');
var mkdirp = require('mkdirp');
var open = require('open');
var moment = require('moment');
var ProgressBar = require('progress')
var exec = require('child_process').exec

moment.locale('sv');
/* ------ END OF IMPORT ----- */

//public directories
var public = ['KAMERABILDER', '.thumbnails', 'helpers']
public.forEach(function (e) {
    e = "/" + e;
    app.use(e, express.static(__dirname + e));
});

function montage(filename) {
    if (typeof (filename) !== 'undefined') {
        var q = 'SELECT filepath FROM table2 OFFSET floor(random()*131688) LIMIT 6';

        db.query(`SELECT filepath FROM table2 WHERE cameramodel = 'Canon EOS M' ORDER BY RANDOM() LIMIT 4`).then((data) => {
            var a = data.rows.map((x) => {
                return x.filepath
            });
            var s = (windows ? "magick " : "") + "montage ";
            a.forEach((o) => {
                s += JSON.stringify(o) + " ";
            })
            //s += `-geometry +0+0 -background white ${filename}`;
		//-geometry +0+0 -crop 600x900
            s += `-geometry 650x650+0+0 -background white ${filename}`;
            console.log(s);
            exec(s, (err, stdout, stderr) => {
                if (err) throw err;
                if (stderr) throw stderr;
		console.log(stdout);
            })
	})
}
}

// montage("helpers\\bgmontage.jpg");

function send(ws, type, content) {
    ws.send(JSON.stringify({
        type: type,
        content: content
    }))
}

//localhost
app.get('/', function (req, res) {
    res.setHeader('Content-Type', 'text/html')
    var html = fs.readFileSync('./helpers/angular.html')
    res.send(html.toString());
})

app.get('/montageGen', (req, res) => {
    montage("helpers\\montage.jpg");
    res.setHeader('Content-Type', 'text/html');
    res.send('Generated!');
})


app.get('/montage', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(`<img src='helpers/montage.jpg' style="width:100%;">`);
})
app.get('/openexplorer', function (req, res) {
    var src = req.query.src;
    console.log(req.query.src);
    console.log(src)
    if (typeof (src) == 'undefined') {
        res.send('Bad route')
    } else {
        exec(`explorer /select,"${src}"`, function (err, stdout, stderr) {
            res.send(`Opening ${src} in file manager!`);
        });
    }
})

//Start by truncating results.
db.query('TRUNCATE TABLE results;').then(() => {

}, (err) => {
    throw err;
});

//ProgressBar:
var bar;

var cancelRequest = false;
//websocket route
app.ws('/socket', (ws, req) => {
    ws.on('message', (msg) => {
        msg = JSON.parse(msg);
        if (msg.type === 'rating') {
            var r = msg.content.rating;
            var sql = `UPDATE table2 SET rating = ${r} WHERE id='${msg.content.id}'`;
            // console.log(sql);
            db.query(sql).then((data) => {
                // console.log(data);
            })
        } else if (msg.type === 'cancel') {
            cancelRequest = true;
        } else {
            //go on until a new connection sets cancelRequest to true
            cancelRequest = false;

            //if client only want to check how many rows that their query is going to make
            if (msg.type === 'count') {
                db.query(`SELECT COUNT(*) FROM (${msg.content.sql}) AS t`).then((res) => {
                    var t = res.rows[0].count.toString();
                    send(ws, 'rowCount', t)
                }, (err) => {
                    throw err;
                });
            } else {
                var sql = `SELECT date, filepath, id, rating FROM results LIMIT ` + limit;

                //if navigating, we should select from results
                if (msg.type === 'nav') {
                    sql = `${sql} OFFSET ${msg.content.offset}`
                }
                //if not navigating, truncate results and insert new rows into results.
                else {
                    sql = `TRUNCATE results;INSERT INTO results (date, filepath, id, rating) ${msg.content.sql};${sql}`;
                }
                db.query(sql).then((data) => {
                    console.log(`Query from client: ${msg.content.sql}`);
                    if (data.rows.length > 0) {
                        send(ws, 'html', "<div class='row white' style='border-radius:6px; padding-top:6px;padding-bottom:6px;'>")
                        // ws.send(data.rows.length.toString())
                        // bar = new ProgressBar('Piping result [:bar] :percent ', {
                        //     total: data.rows.length - 1,
                        //     width: 50
                        // });
                        iterate(data.rows, 0, (eachHTML) => {
                            send(ws, 'html', eachHTML)
                        });
                    } else {
                        ws.send("0");
                    }
                }, (err) => {
                    console.log('Error! ' + err);
                });
            }
        }
    })
})

function iterate(arr, i, callback, done) {
    if (cancelRequest) {
        console.log('Stopping iteration because of cancelRequest')
    } else {
        var row = arr[i];
        if (row.filepath) {
            var src = row.filepath;
            var date = row.date;
            var extension = path.extname(src) || ".JPG";
            var thumbsrc = `.thumbnails/${src.substring(0,src.length - extension.length)}-200${extension}`;
            //check for thumbnail
            fs.stat(thumbsrc, (err, stats) => {
                //call is called below
                var call = function () {
                    var a = moment(date).format('D MMMM Y');
                    if (a === 'Invalid date')
                        a = "";
                    var linkHTML = `<a href="javascript:openlink('/openexplorer?src=${src.replace(/\\/g,'\\\\')}')" target='_blank'>`;
                    linkHTML = `<a href="${src.replace(/\\/g,'\\\\')}" target="_blank" data-id="${row.id}">`;

                    // console.log(row.rating);
                    // var starHTML = "";
                    // for (var i = 1; i <= 5; i++) {
                    //     starHTML += `<i class='material-icons star' filled='${row.rating >= i}' onclick='photoRating(this)'>`;
                    // }

                    var thisHTML = `
                    <div class='col s6 l3'>
                        ${linkHTML}
                            <img src='${thumbsrc}'>
                        </a>
                        <div class='card-panel col s12'>
                            <i class="material-icons clear" onclick="photoClearStars(this)">clear</i>
                            <i class='material-icons star' filled='${row.rating >= 1}' onclick='photoRating(this)'>star_border</i>
                            <i class='material-icons star' filled='${row.rating >= 2}' onclick='photoRating(this)'>star_border</i>
                            <i class='material-icons star' filled='${row.rating >= 3}' onclick='photoRating(this)'>star_border</i>
                            <i class='material-icons star' filled='${row.rating >= 4}' onclick='photoRating(this)'>star_border</i>
                            <i class='material-icons star' filled='${row.rating >= 5}' onclick='photoRating(this)'>star_border</i>
                        </div>
                    </div>`;
                    // <p class="label blue-text" onclick="album('${moment(date).unix()}')">${a}</p>
                    // <p class="label blue-text">${a}</p>
                    // <i class='material-icons star' filled="${row.rating == '1'}" onclick='$(this).attr("filled",function(_, attr){ var s = $($(this).parent().prev("a")[0]).attr("data-id"); var r = $(this).attr("filled"); send("rating", {rating: r, id: s}); return !(attr == "true")})'>star_border</i>
                    callback(thisHTML);
                    if (i < arr.length - 1) {
                        //console.log(`${i} < ${arr.length}`)
                        // bar.tick();
                        iterate(arr, i + 1, callback, done);
                    } else {
                        //loop is done here
                        if (typeof done === 'function') {
                            done();
                            console.log('Done!');
                        }
                    }
                }
                if (err) {
                    generateThumbnail(src).then(() => {
                        call()
                    });
                } else {
                    call();
                }
            })
        } else {
            callback("Error: resource requested wasn't image.");
        }
    }
}

//generates a thumbnail for given source, returns promise with generated filename.
function generateThumbnail(source) {
    return new Promise((resolve) => {
        var parentDir = path.dirname(source);
        var thumbnail = new Thumbnail(parentDir, `.thumbnails/${parentDir}`);

        try {
            mkdirp.sync(`.thumbnails/${parentDir}`);
        } catch (ignore) {
            // Thumbnail directory already created
        }

        thumbnail.ensureThumbnail(path.basename(source), 200, null, function (err, filename) {
            // "filename" is the name of the thumb in '/path/to/thumbnails'
            if (err) {
                console.log(`Error at thumbnail creation: ${err}`)
            } else {
                resolve(filename);
            }
        });
    }, (reject) => {
        reject();
    })
}

//db-related queries
app.get('/rawquery', (req, res) => {
    if (req.query.sql == null) {
        res.send('Please enter your SQL as a GET-parameter named sql.');
    } else {
        db.query(req.query.sql).then((data) => {
            if (data.rows.length > 0) {
                res.send(JSON.stringify(data.rows))
            } else {
                res.send('No results')
            }
        }, (reject) => {
            console.log(`Reject! ${reject}`);
        });
    }
});

//Inserts distinct camermodels into a table called cameramodels. Should be rewritten on the client
app.get('/cleancameras', (req, res) => {
    db.query('SELECT DISTINCT cameramodel FROM table2').then((data) => {
        //internal iteration
        var _iterate = function (i) {
            if (i < data.rows.length) {
                console.log(`${(i/data.rows.length*100).toFixed(2)}%`);
                var model = data.rows[i].cameramodel;
                db.query(`SELECT * FROM table2 WHERE cameramodel='${model}'`).then((data2) => {
                    if (data2.rows.length > 10) {
                        var sql = `INSERT INTO cameramodels (model, amount) VALUES ('${model}',${data2.rows.length});`
                        db.query(sql).then(() => {
                            console.log(`Inserted ${model} into cameramodels`);
                            _iterate(i + 1);
                        });
                    } else {
                        console.log(`Skipped ${model} due to the amount of rows being under 10 (${data2.rows.length})`)
                        _iterate(i + 1);
                    }
                })
            } else {
                console.log('Done!');
            }
        }
        _iterate(0);
    })
})

app.get('/map', (req, res) => {
    res.send(fs.readFileSync('helpers/map.html', 'utf8'));
})

//API endpoint
app.get('/location', (req, res) => {
    db.query(`SELECT filepath,location FROM table2 WHERE location != '' LIMIT 1000;`).then((data) => {
        bar = new ProgressBar('Location [:bar] :percent ', {
            total: data.rows.length - 1,
            width: 50
        });
        var html = "";

        //generates points to be executed in browser
        var points = {}

        //if point is within 1km of another point, they should merge.
        var rows = data.rows;
        for (var i = 0; i < rows.length; i++) {
            for (var j = 0; j < rows.length; j++) {
                var d = distance(rows[i].location.split(','), rows[j].location.split(','));
                var a = JSON.stringify(rows[i].location.split(','));
                if (d < 1) {
                    (points[a] = points[a] || []).push(`<img src='${rows[i].filepath}'>`)
                } else {
                    points[a] = [`<img src='${rows[i].filepath}'>`];
                }
            }
        }
        res.send(JSON.stringify(points))
    })
})

//http://stackoverflow.com/questions/27928/calculate-distance-between-two-latitude-longitude-points-haversine-formula
function distance(pos1, pos2) {
    var lat1 = pos1[0];
    var lon1 = pos1[1];

    var lat2 = pos2[0];
    var lon2 = pos2[1];

    var p = 0.017453292519943295; // Math.PI / 180
    var c = Math.cos;
    var a = 0.5 - c((lat2 - lat1) * p) / 2 +
        c(lat1 * p) * c(lat2 * p) *
        (1 - c((lon2 - lon1) * p)) / 2;

    return 12742 * Math.asin(Math.sqrt(a)); // 2 * R; R = 6371 km
}

var windows = process.platform === 'win32';
var port = process.env.port || (windows ? 80 : 8081);

app.listen(port, function () {
    console.log(`Listening on port ${port}!`)
    //if supplied with "start"
    if (process.argv[2] === 'start') {
        open('http://localhost');
    }
})
