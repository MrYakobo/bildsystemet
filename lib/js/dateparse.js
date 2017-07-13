var fs = require('fs');
var exif = require('exif-parser')
var db = require('./db-connect');
var exec = require('child_process').exec;
var readline = require('readline');
var moment = require('moment')
var colors = require('colors');
var Table = require('cli-table');

moment.defaultFormat = 'D MMMM YYYY HH:mm:ss Z'
moment.locale('sv')

exports.parse = function () {
    db.query('SELECT DISTINCT cameramodel FROM table2').then((res) => {
        iterate(res.rows, 0);
    })
}

var rl = readline.createInterface(process.stdin, process.stdout);

function iterate(arr, i) {
    var model = arr[i].cameramodel;
    if (model == null) {
        iterate(arr, i + 1);
    } else {
        db.query(`SELECT from method WHERE cameramodel='${model}'`).then((res) => {
            if (res.rows.length === 0) {
                var sql = `SELECT filepath FROM table2 WHERE cameramodel='${model}' LIMIT 1`;
                // console.log(sql)
                db.query(sql).then((res) => {
                    var amount = 7;
                    var file = res.rows[0].filepath;
                    exec(`explorer "${file}"`);
                    console.log(model);
                    // console.log(file);
                    var times = {};
                    //runs in parallell
                    //checks exif, mtime and imagemagick
                    fs.open(file, 'r', function (status, fd) {
                        if (status)
                            throw status;
                        const l = Math.pow(2, 16);
                        var buffer = new Buffer(l);

                        fs.read(fd, buffer, 0, l, 0, function (err, num) {
                            var parser = exif.create(buffer);
                            parser.enableImageSize(false)
                            parser.enablePointers(true)

                            try {
                                var result = parser.parse();
                                //if measured in seconds
                                if (result.tags.DateTimeOriginal == null) {
                                    amount--;
                                    push()
                                } else {
                                    var m = String(result.tags.DateTimeOriginal).length < 13 ? 1000 : 1;
                                    push("exif1", moment(result.tags.DateTimeOriginal * m, 'x').format());
                                }
                                if (result.tags.CreateDate == null) {
                                    amount--;
                                    push()
                                } else {
                                    m = String(result.tags.CreateDate).length < 13 ? 1000 : 1;
                                    push("exif2", moment(result.tags.CreateDate * m, 'x').format())
                                }
                                if (result.tags.ModifyDate == null) {
                                    amount--;
                                    push()
                                } else {
                                    push("exif3", moment(result.tags.ModifyDate, ['YYYY:MM:DD hh:mm:ss', 'X', 'x']).format());
                                }

                            } catch (e) {
                                throw e;
                            }
                        })
                    })
                    fs.stat(file, function (err, stats) {
                        if (err)
                            throw err;
                        push("mtime", moment(stats.mtime).format());
                    })

                    exec(`magick identify -format %[date:create],%[date:modify] \"${file}\"`, (err, meta, stderr) => {
                        if (err || stderr)
                            throw err;
                        var create = moment(meta.split(',')[0]).format();
                        var modify = moment(meta.split(',')[1]).format();

                        // var smallest = create < modify ? create : modify;
                        push("im1", create)
                        push("im2", modify)
                    })

                    var filenameparse = moment(file.replace(/IMG_|_|.jpg/g,''),('YYYYMMDDHHmmss'));
                    if(filenameparse.isValid()){
                        push('filename',filenameparse.local().format())
                    }
                    else{
                        amount--;
                        push()
                    }

                    function push(key, val) {
                        if (typeof (key) !== 'undefined') {
                            times[key] = val;

                            if (Object.keys(times).length === amount) {
                                var table = new Table({
                                    head: ['Method'.white, 'Time'.white],
                                    colWidths: [30, 50]
                                });
                                for (var key in times) {
                                    table.push([key, times[key]])
                                }
                                console.log(table.toString())

                                rl.question('Which dates are correct?\n> ', (line) => {
                                    fs.writeFileSync('log.json', line)

                                    if (line === "end") {
                                        process.exit();
                                    } else if (line === '') {
                                        console.log(`Registered ${model} as inconsistent.`)
                                        iterate(arr, i + 1);
                                    } else {
                                        var valid = line.split(' ');
                                        var a = Object.keys(times);

                                        var finalsql = "";

                                        valid.forEach(function (v) {
                                            finalsql += `INSERT INTO method (cameramodel, method) VALUES ('${model}','${v}');`;
                                        })

                                        db.query(finalsql).then(() => {
                                            if (i < arr.length) {
                                                iterate(arr, i + 1)
                                            } else {
                                                console.log('Done!')
                                            }
                                        }, (err) => {
                                            throw err
                                        });
                                    }
                                    rl.close();
                                });
                            }
                        }
                    }
                })
            } else {
                iterate(arr, i + 1);
            }
        })

    }
}