var magick = require('imagemagick');
var moment = require('moment');
var fs = require('fs');

exports.getDate = (file, cb) => {
    im.identify(['-format', `"%[date:create],%[date:modify]"`, file], function (err, meta) {
        var create = moment(meta.replace(/"/g, '').split(',')[0]).milliseconds();
        var modify = moment(meta.replace(/"/g, '').split(',')[1]).milliseconds();

        var smallest = create < modify ? create : modify;
        cb(smallest);
    });
}