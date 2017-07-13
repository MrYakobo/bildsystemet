var pg = require('pg');
var c = require('../setup/credentials')

var config = {
    user: c.username,
    database: c.db,
    password: c.password,
    host: c.host,
    port: 5432,
    max: 100,
    idleTimeoutMillis: 0,
};

process.setMaxListeners(0);

var pool = new pg.Pool(config);

exports.query = function (sql, data) {
    return new Promise((success,reject) => {
        pool.connect().then(client => {
            client.query(sql, data).then(res => {
                    client.release()
                    success(res);
                })
                .catch(e => {
                    client.release()
                    var str;
                    if (e.code === '23505') {
                        str = 'Warning: File exists already in db'
                    } else if (e.code === '22007') {
                        str = `Invalid date in data: ${data}`
                    } else {
                        str = `Query error:
                        ${e.message}
                        ${e.stack}`;
                    }
                    console.log(str)
                    reject(str)
                })
        })
    })
}
