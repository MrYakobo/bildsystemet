var conn;
var imagesperpage = 100;

//function for communication
function send(type, content) {
    conn.send(JSON.stringify({
        type: type,
        content: content
    }))
}
var getScope = function () {
    return angular.element($("body")).scope();
}

init();

//websockets!
function init() {
    conn = new WebSocket('ws://' + location.hostname + ":" + location.port + "/socket");
    // conn = new WebSocket('ws://192.168.0.108/socket')
    conn.onopen = function () {

        $('.datepicker').pickadate({
            selectMonths: true, // Creates a dropdown to control month
            selectYears: 15 // Creates a dropdown of 15 years to control year
        });
        $('.modal').modal({
            complete: function () {
                var scope = getScope();
                scope.showingModal = false;
                scope.$digest();
                cancel();
            }
        });

        function cancel() {
            send('cancel', 'cancel');
            getScope().res = "";
        }

        conn.onmessage = function (e) {
            var scope = getScope();
            scope.safeApply(function () {
                var msg = JSON.parse(e.data);
                if (msg.type === 'rowCount') {
                    var c = parseInt(msg.content);
                    scope.queryRows = c;
                    scope.totalPages = Math.ceil(c / imagesperpage)
                } else if (msg.type === 'html') {
                    scope.res += msg.content;
                }
            })
        }

        function album(time) {
            var scope = getScope();

            scope.safeApply(function () {
                var a = moment(time, 'X');
                var sql = "SELECT date, filepath, id FROM table2 WHERE to_char(date, 'YYYY-MM-DD') = '" + a.format('YYYY-MM-DD') + "'";
                scope.sql = sql;
                scope.query();
                console.log(`Album: ${sql}`);
            })
        }

        var app = angular.module('myApp', []);

        app.filter('unsafe', ['$sce', function ($sce) {
            return $sce.trustAsHtml;
        }]);

        Number.prototype.betweenI = function (low, high) {
            return this.valueOf() >= low && this.valueOf() <= high;
        }

        app.controller('myCtrl', function ($scope) {
            $scope.totalPages = 0;
            $scope.setCamera = function (id) {
                $scope.props.camera = id;
            }

            $scope.safeApply = function (fn) {
                var phase = this.$root.$$phase;
                if (phase == '$apply' || phase == '$digest') {
                    if (fn) {
                        fn();
                    }
                } else {
                    this.$apply(fn);
                }
            };
            //$scope.res holds the html
            $scope.res = "";
            //years: holds all the distinct years from the db
            $scope.years = [];

            $scope.imagesperpage = imagesperpage;

            //used for navigation
            $scope.deltaPage = function (delta) {
                if (($scope.props.page + delta).betweenI(0, $scope.totalPages)) {
                    $scope.props.page += delta;
                    $scope.res = "";
                    $scope.nav();
                }
            }


            $scope.setStar = function (id, i) {
                console.log(id);
                console.log(i);
            }

            $scope.seasons = ['Vinter', 'Vår', 'Sommar', 'Höst'];
            $scope.weekdays = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag']

            function rawquery(sql, cb) {
                $.get('/rawquery', {
                    sql: sql
                }, function (data) {
                    cb(data);
                })
            }

            rawquery('select model,amount from cameramodels order by amount desc;', function (data) {
                $scope.cameras = JSON.parse(data);
                $scope.$digest();
            })
            rawquery('select count(*) from table2;', function (data) {
                $scope.count = JSON.parse(data)[0].count.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
                $scope.$digest();
            })
            rawquery('SELECT DISTINCT EXTRACT(ISOYEAR FROM date) FROM table2 ORDER BY date_part ASC;', function (data) {
                $scope.years = JSON.parse(data).map((x) => {
                    return x.date_part
                });
                $scope.$digest();
            })

            $scope.query = function () {
                cancel();

                $scope.res = "";
                send('SQL', {
                    sql: $scope.sql
                });
            }
            $scope.nav = function () {
                $scope.res = "";
                send('nav', {
                    offset: ($scope.props.page - 1) * imagesperpage
                })
            }
            $scope.offsetNumber = function () {
                return $scope.props.page + 1;
            }

            $scope.props = {
                weekdays: [false, false, false, false, false, false, false],
                seasons: [false, false, false, false],
                camera: null,
                random: false,
                year0: 'Alla år',
                year1: 'Alla år',
                date0: "",
                date1: "",
                page: 1
            }

            var sqlGen = function () {
                var weekdays = function () {
                    var str = "";
                    for (var i = 0; i < $scope.props.weekdays.length; i++) {
                        if ($scope.props.weekdays[i]) {
                            str += "EXTRACT(dow FROM date)=" + i + " OR ";
                        }
                    }
                    return str.removeLastWord();
                }
                var seasons = function () {
                    var str = "";
                    for (var i = 0; i < $scope.props.seasons.length; i++) {
                        if ($scope.props.seasons[i]) {
                            str += "EXTRACT(QUARTER FROM date)=" + (i + 1) + " OR ";
                        }
                    }
                    return str.removeLastWord();
                }
                var randomize = function () {
                    if ($scope.props.random) {
                        return 'RANDOM()';
                    }
                    return '';
                }
                var limit = function () {
                    if ($scope.props.limitBoolean) {
                        return $scope.props.limitNumber;
                    }
                    return 0;
                }
                var camera = function () {
                    if ($scope.props.camera != null) {
                        return "cameramodel = '" + $scope.props.camera + "'";
                    }
                    return '';
                }
                var year = function () {
                    if ($scope.props.year0 === 'Alla år') {
                        if ($scope.props.year1 === 'Alla år')
                            return '';
                        //year1 set
                        return "EXTRACT(ISOYEAR FROM date)<=" + $scope.props.year1;
                    }
                    if ($scope.props.year1 === 'Alla år') {
                        //year0 set
                        return "EXTRACT(ISOYEAR FROM date)>=" + $scope.props.year0;
                    }
                    //both set to the same:
                    if ($scope.props.year0 === $scope.props.year1) {
                        return 'EXTRACT(ISOYEAR FROM date)=' + $scope.props.year0;
                    }
                    return "EXTRACT(ISOYEAR FROM date) BETWEEN " + $scope.props.year0 + " AND " + $scope.props.year1;
                }
                var date = function () {
                    var date0 = moment($scope.props.date0, 'D MMMM, YYYY').format('YYYY-MM-DD');
                    var date1 = moment($scope.props.date1, 'D MMMM, YYYY').format('YYYY-MM-DD');

                    if ($scope.props.date0 === '') {
                        if ($scope.props.date1 === '')
                            return '';
                        //date1 set
                        return "date <= '" + date1 + "'";
                    }
                    if ($scope.props.date1 === '') {
                        //date0 set
                        return "date >= '" + date0 + "'";
                    }
                    //both set to the same:
                    if ($scope.props.date0 === $scope.props.date1) {
                        return "to_char(date, 'YYYY-MM-DD') = '" + date0 + "'";
                    }
                    //both set to different dates, pick the duration between
                    return "date >= '" + date0 + "' AND date <='" + date1 + "'";
                }
                var star = function () {
                    var star = $scope.props.star;
                    console.log(star);
                    return star ? `rating >= ${star}` : "";
                }

                var s = squel.useFlavour('postgres').select().field('date').field('filepath').field('id').field('rating').from('table2').where(weekdays()).where(seasons()).where(camera()).where(year()).where(date()).where(star());

                console.log(s.toString());

                if ($scope.props.random) {
                    s.order('RANDOM()');
                } else {
                    s.order('id', true)
                }
                return s.toString();
            }
            $scope.$watch('props', function () {
                $scope.sql = sqlGen();
                send('count', {
                    sql: $scope.sql
                })
            }, true);

            $scope.starString = function(){
                var s = "Alla bilder.";
                var swe = ['ett','två','tre','fyra','fem'];
                if($scope.props.star == 1){
                    s = "Alla bilder som har minst en stjärna.";
                }
                else if($scope.props.star > 1){
                    s = "Alla bilder som har minst " + swe[$scope.props.star-1] + " stjärnor.";
                }
                return s;
            }   
        });

        String.prototype.removeLastWord = function () {
            return this.substring(0, this.substring(0, this.length - 1).lastIndexOf(" "));
        }

    }
}