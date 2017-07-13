var fs = require('fs')
var recursive = require('recursive-readdir');
var exif = require('exif-parser')
var path = require('path');
var magick = require('./helpers/magick')
var moment = require('moment');
const primarytable = 'table2';
var exec = require('child_process').exec;
var notify = require('./helpers/notify')

function ignore(file, stats) {
    return !stats.isDirectory() && path.extname(file).toLowerCase() !== ".jpg" && path.extname(file).toLowerCase() !== '.jpeg';
}

const appdata = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + 'Library/Preferences' : '/var/local')

// const options = commandLineArgs(optionDefinitions)
options = {
    cache: 'KAMERABILDER'
}
//Ctrl+C event
process.on('SIGINT', function () {
    console.log('SIGINT detected.')
    // console.log(`i=${i}`);
    writeSQL();
});

process.on('uncaughtException', function (err) {
    console.log('Warning: Empty jpg file encountered.');
    errors.push(err);
    i++;
    iterate();
})

//Global counter
var i = 0;
//Takes counter from command args
if (process.argv[2] != null) {
    i = parseInt(process.argv[2]);
} else {
    try {
        i = parseInt(fs.readFileSync(`${appdata}/i.txt`, 'utf8'));
    } catch (err) {
        i = 0;
    }
}

var files = [];
//total sql
var sql = "";

var db = require('./helpers/db-connect');
var ProgressBar = require('progress')
var bar;

fs.readFile('cache.json', (err, _files) => {
    if (err) {
        //cache.json can't be read.
        if (options.cache != null) {
            console.log(`Couldn't find any cache. Now creating cache.json.`);
            recursive(options.cache, [ignore], (err1, __files) => {
                console.log(__files.length);
                if (err1) {
                    throw new Error(`Could not find the provided directory '${options.cache}'.`)
                }
                files = __files;
                fs.writeFile('cache.json', JSON.stringify(files), (err2) => {
                    if (err2) {
                        throw new Error('Could not write cache.json to disk.')
                    }
                })
                bar = new ProgressBar('Indexing... [:bar] :total total', {
                    total: files.length,
                    width: 100
                });
                bar.tick(i);
                iterate();
            })
        } else if (options.noCache) {

        }

    } else {
        files = JSON.parse(_files);
        bar = new ProgressBar('Indexing... [:bar] :percent :total total', {
            total: files.length,
            width: 100
        });
        bar.tick(i);
        iterate();
    }
});

var timeStart = Date.now();
var globalStart = Date.now();

var errors = [];

function iterate() {
    file = files[i];

    if (fs.statSync(file).size === 0) {
        errors.push('Empty file encountered: ' + file)
        i++;
        bar.tick();
        iterate();
    } else {
        fs.open(file, 'r', function (status, fd) {
            if (status) {
                console.log(`Error opening file: ` + status.message);
                i++;
                bar.tick();
                iterate();
            } else {
                const l = Math.pow(2, 16);
                var buffer = new Buffer(l);

                fs.read(fd, buffer, 0, l, 0, function (err, num) {
                    if (err) {
                        console.log(err);
                        // process.exit();
                    }
                    var parser = exif.create(buffer);
                    parser.enableImageSize(false)
                    parser.enablePointers(true)
                    try {
                        var result = parser.parse();

                        var d = moment(fs.statSync(file).mtime).format('x');
                        callback();

                        var callback = function () {
                            var date = `to_timestamp(${d})`;

                            var lat = result.tags.GPSLatitude;
                            if (result.tags.GPSLatitudeRef == "S")
                                lat = `-${lat}`;

                            var long = result.tags.GPSLongitude;
                            if (result.tags.GPSLongitudeRef == "W")
                                long = `-${long}`;

                            var location = null;
                            if (typeof (lat) != 'undefined' && typeof (long) != 'undefined') {
                                location = `${lat},${long}`;
                            }

                            var data = [
                                file,
                                date,
                                result.tags.FocalLength,
                                result.tags.ApertureValue,
                                result.tags.ISO,
                                result.tags.LensModel,
                                location,
                                result.tags.Model
                            ];

                            var s = "";
                            data.forEach(function (element, i) {
                                if (typeof (element) === 'undefined' || element == null)
                                    s += `null,`;
                                else if (i == 1)
                                    s += `${element},`;
                                else {
                                    s += `'${element}',`;
                                }
                            });
                            s = s.substring(0, s.length - 1);
                            sql += `INSERT INTO ${primarytable} (filepath,date,focallength,aperture,iso,lensmodel,location,cameramodel) VALUES (${s});`;

                            fs.close(fd, () => {
                                //if finished
                                if (i === files.length - 1) {
                                    writeSQL();
                                    notify.send('Finished indexing!')
                                }
                                //else, keep on iterating
                                else {
                                    i++
                                    bar.tick();
                                    iterate();
                                }
                            });
                        }
                        //if exif tells us that the photo was taken earlier than the millennium, we need to further investigate
                        if (moment(d, 'X').isBefore('2000-01-01', 'year')) {
                            exec(`magick identify -format %[date:create],%[date:modify] \"${file}\"`, (err, meta) => {
                                if (err)
                                    console.log(err);

                                var create = moment(meta.split(',')[0]).valueOf();
                                var modify = moment(meta.split(',')[1]).valueOf();

                                var smallest = create < modify ? create : modify;

                                d = smallest;
                                callback();
                            })
                        } else {
                            callback();
                        }
                    } catch (err1) {
                        errors.push(file);
                        i++;
                        bar.tick();
                        iterate();
                    }
                });
            }
        });
    }
}

function writeSQL() {
    var savedFiles = 0;

    var saveExit = function () {
        savedFiles++;
        if (savedFiles === 2) {
            process.exit();
        }
    }
    fs.writeFile('outputsql.sql', sql, (err) => {
        if (err) {
            console.log(err);
        } else {
            console.log('Wrote generated SQL to outputsql.sql.');
        }
        saveExit();
    });
    console.log(`Process terminated. These files were skipped due to invalid EXIF-data:\n${errors.join('\n')}`);
    fs.writeFile(`${appdata}/i.txt`, i, (err) => {
        if (err) {
            console.log(err)
        } else {
            if (i != files.length - 1)
                console.log(`Cached your iteration value (${i}) in ${appdata}\\i.txt; it will be loaded upon next iteration automatically.`);
            else
                console.log('Done!');
        }
        saveExit();
    });
}