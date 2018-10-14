// var app = require('koa')()
//   , logger = require('koa-logger')
//   , json = require('koa-json')
//   , views = require('koa-views')
//   , onerror = require('koa-onerror');
// var socketIo = require('socket.io')



// var index = require('./routes/index');
// var users = require('./routes/users');

// app.use(require('koa-static')(__dirname + '/public'));

// // error handler
// onerror(app);

// // global middlewares
// app.use(views('views', {
//   root: __dirname + '/views',
//   default: 'jade'
// }));
// app.use(require('koa-bodyparser')());
// app.use(json());
// app.use(logger());

// app.use(function *(next){
//   var start = new Date;
//   yield next;
//   var ms = new Date - start;
//   console.log('%s %s - %s', this.method, this.url, ms);
// });




// const io = new socketIo(app,{
    // pingTimeout: 1000 * 10,
    // pingInterval: 1000 * 2.5,
    // transports : [ 'websocket', 'polling' ],
    // allowUpgrades : true,
    // httpCompression : true, 
// })
// io.attach(app)
// io.set('authorization', ( handshakeData, accept ) => {
//     console.log(handshakeData)
//     console.log(accept)
// })






// // routes definition
// app.use(index.routes(), index.allowedMethods());
// app.use(users.routes(), users.allowedMethods());

// // error-handling
// app.on('error', (err, ctx) => {
//   console.error('server error', err, ctx)
// });



// app.listen(8000, () => {
//   console.log('你正在监听8000端口.....')
// } )



var http = require('http')
var path = require('path')
var express = require('express')
var socketIo = require('socket.io')
var fs = require('fs')




var app = express()
app.use(express.static(path.join(__dirname, './public')))
var server = http.Server(app)

var io = new socketIo(server, {
    pingTimeout: 1000 * 10,
    pingInterval: 1000 * 2.5,
    transports : [ 'websocket', 'polling' ],
    allowUpgrades : true,
    httpCompression : true,
    path: '/socket.io',
    serveClient : false
})
//用户认证
io.set('authorization', ( handshakeData, accept ) => {
    if(handshakeData.headers.cookie){
        handshakeData.headers.useId = Date.now()
        accept(null, true)
    }else{
        accept('Error',false)
    }
})



//在线人数
var usersMap = new Map()
//获取在线人数方法
var getUserList = ( usersMap ) => {
    var userList = []
    for( let tan of usersMap.values() ){
        userList.push( tan.nickName )
    }
    return userList
}

io.on('connect', (socket) => {
    socket.on('server.online', data => {
        if(usersMap.has(data)){
            socket.emit('usernameErr', '已有该用户名，请重新设置')
        }else{
            socket.nickName = data
            usersMap.set( data, socket )
            io.emit('client.online', data)
            io.emit('client.getOnlineList', getUserList(usersMap))
        }
    })
    //断开连接
    socket.on('disconnect', ()=>{
        usersMap.delete( socket.nickName )
        socket.broadcast.emit('client.offline', socket.nickName)
        io.emit('client.getOnlineList', getUserList(usersMap))
    })
    //接收并发送消息
    socket.on('server.newMsg', (data) => {
        data.time = Date.now()
        data.nickName = socket.nickName
        if( data.type === 'text' ){
            var splitPoint = data.data.indexOf(':')
            if( splitPoint > 0 ){
                var userName = data.data.substring(0, splitPoint)
                if( userName === socket.nickName ){
                    socket.emit('noFind', '你不能对自己发送私聊。。。')
                    return
                }
                var asdf = usersMap.get(userName)
                if( asdf !== undefined ){
                    asdf.emit('selfMsg', data )
                    socket.emit('client.newMsg', data)
                    return
                }else{
                    socket.emit('noFind', '你要私聊的用户不存在。。。')
                    return
                }
            }
        }
        io.emit('client.newMsg', data)
    })
    //获取在线人数列表
    socket.on( 'server.getOnlineList', ()=> {
        socket.emit('client.getOnlineList', getUserList(usersMap))
    })
    //接收发送的文件
    socket.on('server.sendFile', ( fileObj  => {
        var filePath = path.resolve(__dirname, `./public/files/${ fileObj.fileName }`)
        fs.writeFileSync(filePath, fileObj.data, 'binary')
        io.emit('client.file', {
            nickName : socket.nickName,
            now : Date.now(),
            data : fileObj.fileName,
            clientId : fileObj.clientId
        })
    }))



})



server.listen(8000, (err) => {
    if(err){
        return console.error(err)
    }
    console.log('你正在监听8000端口')
})































        // socket.emit('client.joinRoom', {
        //     nickName : data,
        //     roomId : roomId
        // })

        // var roomId = getRoom(data)
        // socket.join(roomId)
        // console.log(`${data}加入了房间${roomId}`)
        // console.log(io.sockets.adapter)
        // console.log('此处是socket')
        // console.log(socket)



    //4种发送消息的形式
    // io.emit('online', socket.id)       //1
    // io.sockets.emit('online', socket.id)       //2
    // socket.broadcast.emit('online', socket.id)      //3
    // usersMap.set(socket.id, socket)         //4
    // for(let client of usersMap.values()){
    //     if(client.id !== socket.id)
    //     client.emit('online', socket.id)
    // }
    //上线，设置昵称,加入房间