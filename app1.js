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


var onlineList = new Set()
var rooms = new Set()

//获取在线人数方法
var getUserList = () => {
    var userList = []
    for( let tan of onlineList.values() ){
        userList.push( tan )
    }
    return userList
}

io.on('connect', (socket) => {

    //把自己加入的房间号存起来，存到自己身上
    socket.joinRooms = new Set()


    socket.on('server.online', data => {
        if(onlineList.has(data)){
            socket.emit('usernameErr', '已有该用户名，请重新设置')
        }else{
            socket.nickName = data
            onlineList.add(data)
            io.emit('client.online', data)
            io.emit('client.getOnlineList', getUserList())
        }
    })


    //断开连接
    socket.on('disconnect', ()=>{
        onlineList.delete(socket.nickName)
        socket.broadcast.emit('client.offline', socket.nickName)
        io.emit('client.getOnlineList', getUserList())
        for( let item of socket.joinRooms.keys() ){
            console.log(item)
            rooms.delete(item)
        }
        console.log(rooms)
    })


    //接收并发送消息
    socket.on('server.newMsg', (data) => {
        data.time = Date.now()
        data.nickName = socket.nickName
        if( data.type === 'text' ){
            var splitPoint = data.data.indexOf(':')
            if( splitPoint > 0 ){
                data.toName = data.data.substring(0, splitPoint)
                var roomId = data.data.substring(0, splitPoint) + socket.nickName
                var roomId2 = socket.nickName + data.data.substring(0, splitPoint)
                console.log(roomId)
                if( rooms.has(roomId2) ){
                    io.to(roomId2).emit('client.siliao', data)
                    return
                }else if( rooms.has(roomId) ){
                    io.to(roomId).emit('client.siliao', data)
                    return
                }else{
                    socket.emit('client.askErr', '你们暂时还不是好友，不能发起聊天。。。。')
                    return
                }
            }
        }
        io.emit('client.newMsg', data)
    })


    //发起请求允许私聊
    socket.on('server.askChat', data => {
        var room = data.name + socket.nickName
        if( socket.joinRooms.has(room) ){
            socket.emit('client.askErr', '你们已经可以私聊。。。。')
            return
        }
        if( onlineList.has(data.name) ){
            if(data.name === socket.nickName){
                socket.emit('client.askErr', '你不能跟自己私聊。。。。')
                return
            }
            data.askName = socket.nickName
            console.log(data.askName)
            io.emit('client.askChat', data )
        }
    })


    socket.on('server.allow2', data => {
        console.log('允许聊天第二步')
        console.log(data)
        var room = data.askName + data.name
        rooms.add(room)
        socket.joinRooms.add(room)
        socket.join(room)
        var isMy = data.name === socket.nickName ? data.askName : data.name
        socket.emit('client.allow', "你已经和" + isMy +"成为好友，你们可以进行聊天了")
    })


    //允许私聊
    socket.on('server.allow', data => {
        io.emit('client.allow2', data)
    })
    //拒绝私聊
    socket.on('server.rej', data => {
        console.log(data)
        io.emit('client.rej', data)
    })
    //获取在线人数列表
    socket.on( 'server.getOnlineList', ()=> {
        socket.emit('client.getOnlineList', getUserList())
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
