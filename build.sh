#!/bin/bash

cd $HOME/ZooKeeperGUI

if [ $# -eq 1 ] && [[ $1 == *linux* ]] || [ $1 == "all" ];then
electron-packager . ZooKeeperGUI --platform linux --arch x64  --icon=./assets/icons/png/zk.png --out dist/ --overwrite --electron-version=1.7.9
electron-installer-redhat --src dist/ZooKeeperGUI-linux-x64/ --dest dist/installers/ --arch x86_64
fi

if [ $# -eq 1 ] && [[ $1 == *mac* ]] || [ $1 == "all" ];then
electron-packager . ZooKeeperGUI --platform darwin --arch x64 --icon=./assets/icons/mac/zk.icns --out dist/ --overwrite --electron-version=1.7.9
electron-installer-dmg dist/ZooKeeperGUI-darwin-x64/ZooKeeperGUI.app ZooKeeperGUI --window --background=./assets/images/dmg.png --out=dist/installers --overwrite
fi

if [ $# -eq 1 ] && [[ $1 == *win* ]] || [ $1 == "all" ];then
electron-packager . ZooKeeperGUI --platform win32 --arch x64  --icon=./assets/icons/win/zk.ico --out dist/ --overwrite --electron-version=1.7.9
node <<EOF
var electronInstaller = require('electron-winstaller');
resultPromise = electronInstaller.createWindowsInstaller({
    appDirectory: '/Users/marcos/ZooKeeperGUI/dist/ZooKeeperGUI-win32-x64',
    outputDirectory: '/Users/marcos/ZooKeeperGUI/dist/installers',
    authors: 'MVRPL Inc.',
    exe: 'ZooKeeperGUI.exe'
  });

resultPromise.then(() => console.log("It worked!"), (e) => console.log('No dice',e.message));
EOF
fi
