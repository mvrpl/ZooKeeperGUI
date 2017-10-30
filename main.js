const {app, BrowserWindow, Menu} = require('electron')
const path = require('path')
const url = require('url')
const zookeeper = require('node-zookeeper-client')
const electron = require("electron")
const ipcMain = electron.ipcMain
const Store = require('electron-store')
const store = new Store()
const notifier = require('node-notifier')

var fs = require('fs')
var packageJsonPath = __dirname + '/package.json'
var packageJson = JSON.parse(fs.readFileSync(packageJsonPath))

var zkcli = null

global.ZKPath = '/'
global.aclData = new Array()

let win

global.winZNode = null;
winLoginACL = null;

function setMainMenu(windowName) {
  var template = [];
  if (windowName === 'mainZK') {
    var template = [
      {
        label: 'Znode',
        submenu: [
          {
            label: 'Editar',
            accelerator: 'CmdOrCtrl+E',
            click() {
              editarZNode()
            }
          },
          {
            label: 'Criar filho',
            accelerator: 'CmdOrCtrl+I',
            click() {
              criarZChild()
            }
          }
        ]
      }
    ];
  }
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        {role: 'about'},
        {type: 'separator'},
        {role: 'services', submenu: []},
        {type: 'separator'},
        {role: 'hide'},
        {role: 'hideothers'},
        {role: 'unhide'},
        {type: 'separator'},
        {role: 'quit'}
      ]
    })
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}


function listChildren(client, path, parent, callback) {
  client.getChildren(
      path,
      function (event) {
          makeMenu(client, path, "/")
      },
      function (error, children, stat) {
      if (error) {
          console.log(
              'Failed to list children of %s due to: %s.',
              path,
              error
          );
          return false;
      }
      if(callback) callback(children);
    }
  )
}

function upZdata(path){
  getZKdata(zkcli, path, function (result) {
    result = escape(result)
    win.webContents.executeJavaScript(`
    document.getElementById("znodeContent").textContent = unescape("${result}")
    `)
  });
}

function getZKdata(client, path, callback) {
  client.getData(
      path,
      function (event) {
        if (event.toString().indexOf("NODE_DATA_CHANGED") > -1) {
          upZdata(path)
        }
    },
    function (error, data, stat) {
        if (error) {
            console.log(error.stack);
            return;
        }
        if(callback && data != undefined) callback(data.toString('utf8'));
        if(callback && data == undefined) callback("");
    }
  )
}

function setZKdata(client, path, data, callback) {
  client.setData(path, data, -1, function (error, stat) {
    if (error) {
        console.log(error.stack);
        if(callback) callback(false);
        return;
    }
    if(callback) callback(true);
  });
}

function createZChild(client, path, data, callback) {
  client.create(
    path,
    data,
    function (error, path) {
        if (error) {
          if(callback) callback(false);
          return;
        }
        if(callback) callback(true);
    }
  );
}



function createWindow () {

  win = new BrowserWindow({
    width: 800,
    height: 600,
    resizable: false,
    icon: path.join(__dirname, 'assets/icons/png/zk.png')
  });

  win.loadURL('file://' + __dirname + '/index.html');
  win.setMenu(null);
  //win.webContents.openDevTools()

  win.on('closed', () => {
    if(zkcli != null) {
      zkcli.close()
    }
    win = null
  })

  var ZKHosts = store.get('hosts')
  ZKHosts = new Set(ZKHosts)
  ZKHosts = [...ZKHosts]
  if (ZKHosts.length > 0) {
    for(var key in ZKHosts){
      var host = ZKHosts[key]
      win.webContents.executeJavaScript(`
      document.getElementById("hosts").innerHTML += '<option value="${host}">${host}</option>'
      `)
    }
  } else {
    win.webContents.executeJavaScript(`
    document.getElementById("zkhost").value = '127.0.0.1:2181'
    `)
  }
}

app.on('ready', createWindow)





ipcMain.on('openURL', function(event, url) {
  if (url) electron.shell.openExternal(url)
})


function makeMenu(client, path, parent){
  var menu = '';
  listChildren(client, path, parent, function (result) {
    for (var key in result) {
      var caminho = path+'/'+result[key]
      if(caminho.startsWith("//")) caminho = caminho.substr(1)
      menu += '<li onclick="require(\\\'electron\\\').ipcRenderer.send(\\\'menuZK\\\', \\\''+caminho+'\\\');return false;"><a href="#">'+result[key]+'</a></li>'
    }

    var paths = path.split("/")
    var abs_path = ''
    if (path != '/') {
      abs_path += '/<a href="#" onclick="require(\\\'electron\\\').ipcRenderer.send(\\\'menuZK\\\', \\\'/\\\');return false;">ROOT</a>'
      var link = ''
      for(var key in paths){
        if (key > 0){
          link += '/'+paths[key]
          if(key != paths.length-1){
            abs_path += '/<a href="#" onclick="require(\\\'electron\\\').ipcRenderer.send(\\\'menuZK\\\', \\\''+link+'\\\');return false;">'+paths[key]+'</a>' 
          } else {
            abs_path += '/'+paths[key]
          }
        }
      }
    } else {
      abs_path += '/ROOT'
    }
    win.webContents.executeJavaScript(`
    document.getElementById("itens").innerHTML = '${menu}';
    if ('${path}' === '/') {document.getElementById("back").style.display = 'none';document.getElementById("titlemenu").style.display = 'block'};
    if ('${path}' !== '/') {document.getElementById("back").style.display = 'block';document.getElementById("titlemenu").style.display = 'none'};
    document.getElementById("back").onclick = function() { require('electron').ipcRenderer.send('menuZK', '${parent}'); };
    document.getElementById("searchZK").value = "";
    document.getElementById("absolute_path").innerHTML = '${abs_path}'
    `)
  });
}

ipcMain.on('sairEdit', function(event) {
  winZNode.close()
  winZNode = null
});

function editarZNode() {
  if (winZNode === null) {
    winZNode = new BrowserWindow({
        width: 600,
        height: 320,
        resizable: false,
        parent: win
    })
    winZNode.setMenu(null);
    winZNode.loadURL('file://' + __dirname + '/editZNode.html');
    winZNode.show()
    winZNode.on('close', function (event) {
      winZNode = null
    });
    getZKdata(zkcli, global.ZKPath, function (result) {
      result = escape(result)
      winZNode.webContents.executeJavaScript(`
      document.getElementById("znodeContent").textContent = unescape("${result}")
      `)
    });
  }
};

ipcMain.on('setACL', function(event) {
  if (winLoginACL === null) {
    winLoginACL = new BrowserWindow({
        width: 600,
        height: 378,
        resizable: false,
        parent: win
    })
    winLoginACL.loadURL('file://' + __dirname + '/loginACL.html');
    winLoginACL.show();
    winLoginACL.setMenu(null);
    winLoginACL.on('close', function (event) {
      winLoginACL = null
    });
  }
});

ipcMain.on('loginsACL', function(event, JSONData) {
  aclData = JSON.parse(JSONData);
  winLoginACL.close()
});

function criarZChild() {
  if (winZNode === null) {
    winZNode = new BrowserWindow({
        width: 600,
        height: 378,
        resizable: false,
        parent: win
    })
    winZNode.loadURL('file://' + __dirname + '/criarZChild.html');
    winZNode.show();
    winZNode.setMenu(null);
    winZNode.on('close', function (event) {
      winZNode = null
    });
  }
};

ipcMain.on('salvarZNode', function(event, data) {
  var bufData = new Buffer(data, "utf-8");
  setZKdata(zkcli, global.ZKPath, bufData, function (result) {
    if(result) {
      winZNode.close()
      winZNode = null
    }
  });
});

ipcMain.on('criarChildZNode', function(event, child, data) {
  if(global.ZKPath !== '/') {
    pathChild = global.ZKPath + '/' + child
  } else {
    pathChild = global.ZKPath + child
  }
  var bufData = new Buffer(data, "utf-8");
  createZChild(zkcli, pathChild, bufData, function (result) {
    if(result) {
      winZNode.close()
      winZNode = null
    }
  });
});

ipcMain.on('connZK', function(event, host) {
  if (host === '' || host == undefined) {
      notifier.notify({
        title: packageJson.name,
        message: 'Host invalido!',
        sound: true
      });
  } else {
    zkcli = zookeeper.createClient(host);

    zkcli.connect();

    for (var i = 0; i < aclData.length; i++) {
      if (aclData[i].tipo === "DIGEST") zkcli.addAuthInfo('digest', new Buffer(aclData[i].usuario+":"+aclData[i].senha));
      if (aclData[i].tipo === "IP") zkcli.addAuthInfo('ip', new Buffer(aclData[i].ip));
    }

    zkcli.once('connected', function () {
      if (! store.get('hosts')){
        var hosts = new Array(host)
      } else {
        var hosts = new Set(store.get('hosts'))
        hosts = [...hosts]
        hosts.push(host)
      }
      
      store.set('hosts', hosts);
      
      win.loadURL('file://' + __dirname + '/index2.html');
      win.setResizable(true)
      setMainMenu('mainZK');
      //win.webContents.openDevTools()

      win.webContents.on('did-finish-load', function() {
        var parent = '/'
        makeMenu(zkcli, "/", parent)
        upZdata("/")
        ipcMain.on('menuZK', function(event, path) {
          global.ZKPath = path
          parent = path.split('/').slice(0, -1).join('/')
          if(parent === '') parent = '/'
          if (path) makeMenu(zkcli, path, parent)
          upZdata(path)
        })
      });
    });

  }

})

app.on('window-all-closed', () => {
   app.quit()
})

app.on('activate', () => {
  if (win === null) {
    createWindow()
  }
})
