var fs = require('fs')
var express = require('express')
var app = express();
var expressWs = require('express-ws')(app);

//public directories
var public = ['KAMERABILDER', '.thumbnails', 'helpers']
public.forEach(function (e) {
    e = "/" + e;
    app.use(e, express.static(__dirname + e));
});
app.get('/', function (req, res) {
    res.setHeader('Content-Type', 'text/html')
    var html = fs.readFileSync('./helpers/duplicates.html')
    res.send(html.toString());
})

process.on('SIGINT',()=>{
    fs.writeFileSync('alikes.json', JSON.stringify(alikes), 'utf8');
    process.exit();
})
var stop = false;
var alikes = [];

app.ws('/socket', (ws, req) => {
    ws.on('message', (msg) => {
        console.log(msg);
        if (msg === 'stop') {
            stop = true;
            process.exit();
            console.log('Stopping iteration...')
        } else {
            ws.send(msg);
            db.query(sql).then((data) => {
                data.rows.forEach((row) => {
                    var match = r.exec(row.filepath);
                    try {
                        var path = match[1];
                        var file = match[2];
                    } catch (e) {

                    }

                    data.rows.forEach((row2) => {
                            if (stop) throw "";
                            else {
                                var match2 = r.exec(row2.filepath);
                                try {
                                    var path2 = match2[1];
                                    var file2 = match2[2];
                                } catch (e) {

                                }
                                // console.log(`${path}:${path2}`)
                                if (file === file2 && path !== path2) {
                                    //found a copy of a file in another folder!
                                    // ws.send(`<img src="${row.filepath}"><img src="${row2.filepath}">`);
                                    // ws.send('pair');
                                    alikes.push([row.filepath, row2.filepath]);
                                    console.log(alikes.length + ":" + data.rows.length);
                                    // console.log(`Pair: ${row.filepath}:${row2.filepath}`);
                                    // console.log(`${file} == ${file2}`)
                                    // console.log(`${path} != ${path2}`)
                                }
                            }
                        })
                })
                // var iterate = function (arr, i) {
                //     ws.send(arr[i]);
                //     setTimeout(iterate(arr, i + 1), 10);
                // }
                // iterate(alikes, 0);
            })
        }
    })
})


var db = require('./helpers/db-connect');

var str = "";
var r = /(.*?)\\(\w*?\.JPG)/i;
// var sql = "select * from (SELECT id, ROW_NUMBER() OVER (PARTITION BY date, focallength, aperture, iso, lensmodel, location, cameramodel, rating ORDER BY id asc) AS Row FROM table2) dups where dups.Row > 1";

// var sql = 'SELECT date, focallength, aperture, iso, lensmodel, location, cameramodel, rating, COUNT(*) FROM table2 GROUP BY date, focallength, aperture, iso, lensmodel, location, cameramodel, rating HAVING COUNT(*) > 1;';

var sql = 'SELECT id,filepath FROM table2 WHERE id IN (SELECT id FROM (SELECT id, ROW_NUMBER() OVER (partition BY date, focallength, aperture, iso, lensmodel, location, cameramodel, rating ORDER BY id) AS rnum FROM table2) t WHERE t.rnum > 1);'

//gets rows that have the same exif, and if dates and all that good stuff is fixed, then this returns duplicates. Sadly, the dates are not 100% correct, so I look at filepaths instead (meaning that if two seemingly identical pictures are present in two folders, one should be deleted)

app.listen(8080, function () {
    console.log('8080');
})