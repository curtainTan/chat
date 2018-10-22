$(function(){
    $(window).on('resize', function(){
        var clientHeight = document.documentElement.clientHeight
        $('#app-user-list-body').height(clientHeight - 300)
        $('#app-chat-body').height(clientHeight - 200)
    }).resize();
    // 定义变量
    var nickName;
    var $appchatContent = $('.app-chat-content')
    var $elTemplate = $('#el-template')
    var $elInputMsg = $('#el-input-msg')
    var $btnSend = $('#btn-send')
    var $elUserList = $('#table-userList')
    var $elBtnFile = $('#send-file')
    var $elBtnSendFile = $('#el-btn-file-send')
    var $elBtnFileCancel = $('#el-btn-file-cancel')
    var $elmyModal = $('#myModal')
    //定义io连接
    // var client = io.connect('http://132.232.45.108:8000',{
    var client = io.connect('http://132.232.45.108:8000',{
        reconnectionAttempts: 3,
        reconnection : true,
        reconnectionDelay : 1000,
        reconnectionDelayMax : 5000,
        timeout : 2000,
        autoConnect : true
    })
    //写入消息到页面
    function writeMsg( type, msg, title, isSelf ){
        title = title || ( type === 'system'?'系统消息':'user' )
        var template = $elTemplate.html()
        .replace('${info}', title)
        .replace('${bgColor}', type === 'system' ? 'label-danger' : 'label-info' )
        .replace(/\${pullRight}/g, isSelf ? 'pull-right' : '' )
        .replace('${text-right}', isSelf ? 'text-right' : '' )
        .replace('${info-icon}', type === 'system' ? 'glyphicon-info-sign' : 'glyphicon-user'  )
        .replace('${time}', '00:00:00' )
        .replace('${msg}', msg)
        $appchatContent.append($(template))
    }
    //发送消息的方法
    function sendMsg( msg, type ){
        var msgObj = {
            type : type || 'text',
            data : msg,
            clientId : client.id
        }
        client.emit('server.newMsg', msgObj)
    }
    //获取昵称
    do{
        nickName = prompt('请输入你的昵称:')
    }while(!nickName)

    // 设置昵称
    $('#span-nickName').text(nickName)
    //发送消息
    $btnSend.on('click', function(){
        var value = $elInputMsg.val()
        if(value){
            sendMsg(value)
            $elInputMsg.val('')
        }
    })
    $elInputMsg.on('keyup', function(e){
        if( e.keyCode !== 13 ) return;
        var value = $elInputMsg.val()
        if(value){
            sendMsg(value)
            $elInputMsg.val('')
        }
    })


    client.on('usernameErr', function(data){
        alert(data)
        do{
            nickName = prompt('请输入你的昵称:')
        }while(!nickName)
        client.emit('server.online', nickName)
    })


    //上线并发送昵称
    client.emit('server.online', nickName)
    //监听上线，写入上线信息
    client.on('client.online',function(nickName){
        writeMsg('system', nickName + '上线了', )
    })
    client.on('client.offline',function(nickName){
        writeMsg('system', nickName + '下线了', )
    })
    //监听新信息
    client.on('client.newMsg', function( msgObj ){
        if(msgObj.type === 'image'){
            msgObj.data = '<img src="' + msgObj.data + '" alt="image" >'
        }
        writeMsg('user', msgObj.data, msgObj.nickName, msgObj.clientId ===client.id )
        $appchatContent[0].scrollTop = $appchatContent[0].scrollHeight
    })
    //监听返回的在线人列表
    client.on('client.getOnlineList', ( list )=> {
        $elUserList.find('tr').not(':eq(0)').remove()
        list.forEach( function( item ){
            var $tr = $( `<tr><td> ${item}<button class="btn btn-success pull-right ask" >加好友</button></td></tr>` )
            // var $tr = $( `<tr><td> ${item}<button data-toggle="modal" data-target="#myModal" class="btn btn-success pull-right ask" >加好友</button></td></tr>` )
            $elUserList.append($tr)
        })
        var $elAsk = document.getElementsByClassName('ask')
        var uslist = Array.from($elAsk)
        for( let i = 0; i < uslist.length; i++ ){
            uslist[i].onclick = function(){
                var node = uslist[i].parentNode.innerText
                var splitPoint = node.indexOf('加')
                var name = node.substring(0, splitPoint)
                uslist[i].classList.add("hide")
                var data = {}
                data.name = name
                client.emit('server.askChat', data)
            }
        }
    })

    //发送文件
    $elBtnFile.on('click', function(){
        $('.app-file-continer, .backup').show()
    })
    $elBtnFileCancel.on('click', function(){
        $('.app-file-continer, .backup').hide()
    })
    $elBtnSendFile.on('click',function(){
        var files = document.getElementById('el_file').files
        if(files.length === 0){
            return alert('请选择一个文件.....')
        }
        var file = files[0]
        client.emit('server.sendFile', {
            clientId : client.id,
            file : file,
            fileName : file.name
        })
        $('.app-file-continer, .backup').hide()
    })
    client.on('client.file', function(fileObj){
        var msg = '文件：<a href="/files/' + fileObj.data +'" >'+ fileObj.data +'</a>'
        writeMsg('user', msg , fileObj.nickName, fileObj.clientId === client.id )
    })

    //粘贴图片
    $(document).on('paste', function(e){
        var originEvent = e.originalEvent
        var items
        if(originEvent.clipboardData && originEvent.clipboardData.items){
            items = originEvent.clipboardData.items
        }
        if(items){
            for(var i = 0; i < items.length; i++){
                var item = items[i]
                if(item.kind === 'file'){
                    var pastFile = item.getAsFile()
                    if( pastFile > 1024 * 1024 ){
                        alert('图片过大，请重新复制')
                        return
                    }
                    var reader = new FileReader()
                    reader.onloadend = function(){
                        var imgBase64 = reader.result
                        sendMsg(imgBase64, 'image')
                    }
                    reader.readAsDataURL(pastFile)
                }
            }
        }
    })

    //私发消息
    client.on('client.askErr', function(data){
        alert(data)
    })

    client.on('client.askChat', function(data){
        if( data.name === nickName ){
            var str =  $elmyModal.html().replace('${name}', data.askName)
            $elmyModal.html(str)
            $elmyModal.modal('show');
            var allow = false
            $('#allow').on('click', function(){
                allow = true
                $elmyModal.modal('hide')
            })
            $elmyModal.on('hidden.bs.modal', function(){
                if(allow){
                    client.emit( 'server.allow', data)
                }else{
                    client.emit( 'server.rej', data)
                }
            })
        }
    })
    client.on('client.allow', function(data){
        alert(data)
    })
    client.on('client.allow2', function(data){
        if( data.name === nickName || data.askName === nickName ){
            client.emit( 'server.allow2', data )
        }
    })
    client.on('client.rej', function(data){
        if( data.askName === nickName ){
            alert(data.name + "拒绝了你的私聊请求....")
        }
    })
    client.on('client.siliao', function(data){
        var msg = ''
        if( data.toName !== nickName ){
            msg = "私人消息to#" + data.data
        }else{
            msg = "来自私人消息#" + data.data
        }
        writeMsg( 'user', msg,  data.nickName, data.clientId === client.id  )
    })
    // $('#myModal').on('hidden.bs.modal', function(e){
    //     console.log('此处是',e)
    // })





})





// var username = window.prompt('请输入你的昵称:')
// var username = '111'
// client.emit('server.online', username)
// client.on('client.online', data => {
//     console.log(data + '上线了')
// })
// client.on('client.offline', data => {
//     console.log(data + '离线了')
// })



// client.on( 'welcome', (data) => {
//     console.log(data)
// })
// client.on('online',data => {
//     console.log(data)
// })
// client.on('error', function(err){
//     console.log(err)
// })
// client.on('connect', function(){
//     console.log('connect')
// })
// client.on('disconnect', function(){
//     console.log('disconnect')
// })
// client.on('reconnect', function(count){
//     console.log('reconnect', count)
// })
// client.on('reconnect_attempt', function(count){
//     console.log('reconnect_attempt',count)
// })
// client.on('reconnect_failed', function(){
//     console.log('reconnect_failed')
// })












