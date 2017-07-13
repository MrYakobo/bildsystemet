var db = require('./helpers/db-connect');
var im = require('imagemagick');
var moment = require('moment');
var path = require('path');
var exec = require('child_process').exec;
var ProgressBar = require('progress');
// SELECT date, filepath, id FROM table2 WHERE date = '2002-12-08 00:00:00'
var sql = [
    `SELECT id,filepath FROM table2 WHERE cameramodel='R7plusf'`,
    'SELECT id,filepath FROM table2 WHERE EXTRACT(ISOYEAR FROM date)<2000;',
    `SELECT id,filepath FROM table2 WHERE cameramodel='A0001'`,
    "SELECT id,filepath FROM table2 WHERE filepath LIKE '%OnePlus%';"
];

var index = 1;
//im false: read from filename (example IMG20151010154453)
var imagemagick = true;

db.query(sql[index]).then((data) => {
    var bar = new ProgressBar('Indexing... [:bar] :percent :total', {
        total: data.rows.length,
        width: 50
    });

    var insertDate = function (id, unix, i) {
        var s = `UPDATE table2 SET date=to_timestamp(${unix}) WHERE id=${id}`;
        db.query(s).then((data) => {
            // console.log(JSON.stringify(data))
            //success!
            bar.tick();
            callback(i + 1);
        }, (err2) => {
            console.log(err2);
            callback(i + 1);
        })
    }
    var callback = function (i) {
        if (i < data.rows.length) {
            var row = data.rows[i];
            // console.log(row);
            // im.identify(['-format', `"%[date:create],%[date:modify]"`, row.filepath], function (err, meta) {
            if (imagemagick) {
                exec(`magick identify -format %[date:create],%[date:modify] \"${row.filepath}\"`, (err, meta) => {
                    if (err) {
                        throw err;

                        callback(i + 1)
                    } else {
                        // console.log(meta);
                        var create = moment(meta.split(',')[0]).unix();
                        var modify = moment(meta.split(',')[1]).unix();

                        var smallest = create < modify ? create : modify;
                        insertDate(row.id, smallest, i);
                    }
                });
            } else {
                //more efficient method than imagemagick
                var res = row.filepath.match(/\d{8}/)
                if (res) {
                    var year = res[0].substring(0, 4);
                    var month = res[0].substring(4, 6);
                    var day = res[0].substring(6, 8);
                    var m = moment().year(year).month(month).day(day).unix();
                    // console.log(row.id);
                    insertDate(row.id, m, i);
                }
            }
            // });
        } else {
            db.query(sql[index]).then((data) => {
                console.log(data.rows.length)
                console.log('Complete!')
            });
        }
    }
    callback(0);
})