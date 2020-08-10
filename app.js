var express = require('express');
var app = express();
var serv = require('http').Server(app);
var port = process.env.PORT || 8080;
serv.listen(process.env.PORT || 8080);
var PING = {};
var PLAYERS = {};
var DEBUG = true;
var CHAT = {};

objToArray = (array) => {
    var arry = array;
    var arr = [];
    for (var a in arry) arr.push(arry[a]);
    return arr;
};
console.logz = (params, paramsinit) => {
    if (DEBUG)
        console.log(paramsinit || "", params);
};
var io = require('socket.io')(serv, {path:'/app/server/socket.io'});

console.logz("Server started.");
console.logz(`beging mangalos server in:` + port);
userEmit = function (player, channel) {
    var todoenlasala = objToArray(PLAYERS).filter(d => {
        return d.sala === player.sala && d.name !== player.name
    });
    todoenlasala.forEach(d => {
        PING[d.id].emit(channel, player);
    });
    console.logz(channel, player);
};
quienTa = function (player, channel) {
    var todoenlasala = objToArray(PLAYERS).filter(d => {
        return d.sala === player.sala && d.name !== player.name
    });
    todoenlasala.forEach(d => {
        PING[player.id].emit(channel, d);
    });
    if (!CHAT[player.sala])
        CHAT[player.sala] = [];
    PING[player.id].emit("user_chat", CHAT[player.sala]);
    if (DEBUG)
        console.logz(channel, player);
};
updateChant = function (player) {
    var todoenlasala = objToArray(PLAYERS).filter(d => {
        return d.sala === player.sala
    });
    todoenlasala.forEach(d => {
        PING[d.id].emit('user_chat', CHAT[player.sala]);
    });
    if (DEBUG)
        console.logz('user_chat', CHAT[player.sala]);
};
request = function (player, name, pokemons) {
    var friend = objToArray(PLAYERS).filter(d => {
        return d.sala === player.sala && d.name === name
    });
    if (friend.length > 0) {
        player.pokemons = pokemons;
        PING[friend[0].id].emit('user_request', player);
    }
    console.logz('user_request', player);
};
cancelRequest = function (player, friendPlayer) {
    var friend = objToArray(PLAYERS).filter(d => {
        return d.sala === player.sala && d.name === friendPlayer.name
    });
    if (friend.length > 0) {
        console.logz(friend[0]);
        PING[friend[0].id].emit('user_cancel', player);
    }
    console.logz('user_cancel', player);
};
acceptRequest = function (player, friendPlayer, pokemons) {
    var friend = objToArray(PLAYERS).filter(d => {
        return d.sala === player.sala && d.name === friendPlayer.name
    });
    if (friend.length > 0) {
        console.logz(friend[0]);
        player.pokemons = pokemons;
        PLAYERS[friend[0].id].battlehost = true;
        PING[friend[0].id].emit('user_accept', player);
    }
    console.logz('user_accept', player);
};
io.sockets.on('connection', function (socket) {
    socket.id = Math.random() + "x" + new Date().getTime();
    PING[socket.id] = socket;
    //INTERACTIONS BEGIN
    socket.on('online', function (data) {
        try {
            data.id = socket.id;
            PLAYERS[socket.id] = data;
            userEmit(PLAYERS[socket.id], 'user_connect');
            quienTa(PLAYERS[socket.id], 'user_connect');
        } catch (e) {
            delete PING[socket.id];
            delete PLAYERS[socket.id];
        }
    });
    socket.on('disconnect', function (data) {
        try {
            userEmit(PLAYERS[socket.id], 'user_disconnect');
            delete PING[socket.id];
            delete PLAYERS[socket.id];
        } catch (e) {
            delete PING[socket.id];
            delete PLAYERS[socket.id];
        }
    });
    socket.on('update', function (position) {
        try {
            if (PLAYERS[socket.id]) {
                PLAYERS[socket.id].position = position;
                userEmit(PLAYERS[socket.id], 'user_update');
            } else {
                PING[socket.id].emit('user_disconnect', {});
            }
        } catch (e) {
            delete PING[socket.id];
            delete PLAYERS[socket.id];
        }
    });
    //INTERACTIONS END

    //CHAT BEGIN
    socket.on('chat', function (message) {
        try {
            if (!CHAT[PLAYERS[socket.id].sala])
                CHAT[PLAYERS[socket.id].sala] = [];
            CHAT[PLAYERS[socket.id].sala].push({name: PLAYERS[socket.id].name, message: message});
            updateChant(PLAYERS[socket.id]);
        } catch (e) {
            delete PING[socket.id];
            delete PLAYERS[socket.id];
        }
    });
    //CHAT END

    //REQUEST BEGIN
    socket.on('request', function (name) {
        try {
            request(PLAYERS[socket.id], name.name, name.pokemons);
        } catch (e) {
            delete PING[socket.id];
            delete PLAYERS[socket.id];
        }
    });
    socket.on('cancel_request', function (data) {
        try {
            cancelRequest(PLAYERS[socket.id], data.player);
        } catch (e) {
            delete PING[socket.id];
            delete PLAYERS[socket.id];
        }
    });
    socket.on('accept_request', function (data) {
        try {
            acceptRequest(PLAYERS[socket.id], data.player, data.pokemons);
        } catch (e) {
            delete PING[socket.id];
            delete PLAYERS[socket.id];
        }
    });
    //REQUEST END

    //ONLINE BATTLE
    socket.on('select_player', function (turn) {
        try {
            PLAYERS[socket.id].turn = turn;
            var enemy = objToArray(PLAYERS).filter(d => {
                return d.name === PLAYERS[socket.id].turn.enemy
            });
            if (enemy.length > 0) {
                if (enemy[0].turn) {
                    if (enemy[0].battlehost)
                        PING[enemy[0].id].emit('run_turns', {
                            mymove: enemy[0].turn.move,
                            mychange: enemy[0].turn.change,
                            theymove: PLAYERS[socket.id].turn.move,
                            theychange: PLAYERS[socket.id].turn.change
                        });
                    else
                        PING[socket.id].emit('run_turns', {
                            theymove: enemy[0].turn.move,
                            theychange: enemy[0].turn.change,
                            mymove: PLAYERS[socket.id].turn.move,
                            mychange: PLAYERS[socket.id].turn.change
                        });
                }
            }
            console.logz('select_player:' + PLAYERS[socket.id].name, turn);
        } catch (e) {
            delete PING[socket.id];
            delete PLAYERS[socket.id];
        }
    });

    socket.on('me_change', function (data) {
        try {
            if (PLAYERS[socket.id])
                if (data.enemy) {
                    var enemy = objToArray(PLAYERS).forEach(d => {
                        if (d.name === data.enemy) {
                            PING[d.id].emit('me_change', data);
                        }
                    });
                }
        } catch (e) {
            delete PING[socket.id];
            delete PLAYERS[socket.id];
        }
    });

    socket.on('him_change', function (data) {
        try {
            if (PLAYERS[socket.id])
                if (data.enemy) {
                    var enemy = objToArray(PLAYERS).forEach(d => {
                        if (d.name === data.enemy) {
                            PING[d.id].emit('him_change', data);
                        }
                    });
                }
        } catch (e) {
            delete PING[socket.id];
            delete PLAYERS[socket.id];
        }
    });

    socket.on('animations', function (data) {
        try {
            if (PLAYERS[socket.id])
                if (data.enemy) {
                    var enemy = objToArray(PLAYERS).forEach(d => {
                        if (d.name === data.enemy) {
                            PING[d.id].emit('animations', data);
                        }
                    });
                }
        } catch (e) {
            delete PING[socket.id];
            delete PLAYERS[socket.id];
        }
    });

    socket.on('end_battle', function () {
        try {
            if (PLAYERS[socket.id])
                if (PLAYERS[socket.id].turn)
                    if (PLAYERS[socket.id].turn.enemy) {
                        var enemy = objToArray(PLAYERS).forEach(d => {
                            if (d.name === PLAYERS[socket.id].turn.enemy) {
                                PING[d.id].emit('end_battle', {});
                            }
                        });
                    }
            console.logz('end_battle');
        } catch (e) {
            delete PING[socket.id];
            delete PLAYERS[socket.id];
        }
    });

    socket.on('end_turns', function (turn) {
        try {
            if (PLAYERS[socket.id])
                if (PLAYERS[socket.id].turn)
                    if (PLAYERS[socket.id].turn.enemy) {
                        var enemy = objToArray(PLAYERS).forEach(d => {
                            if (d.name === PLAYERS[socket.id].turn.enemy) {
                                var data = {
                                    mypokemons: turn.enemies,
                                    theypokemons: turn.pokemons
                                };
                                for (var i in turn) {
                                    if (["enemies", "pokemons"].indexOf(i) === -1)
                                        data[i] = turn[i];
                                }
                                PING[d.id].emit('user_end_turn', data);
                                PLAYERS[d.id].turn = undefined;
                            }
                        });
                        var datax = {
                            theypokemons: turn.enemies,
                            mypokemons: turn.pokemons
                        };
                        for (var i in turn) {
                            if (["enemies", "pokemons"].indexOf(i) === -1)
                                datax[i] = turn[i];
                        }
                        PING[socket.id].emit('user_end_turn', datax);
                        PLAYERS[socket.id].turn = undefined;
                        console.logz('end_turns');
                    }
        } catch (e) {
            delete PING[socket.id];
            delete PLAYERS[socket.id];
        }

    });
});
