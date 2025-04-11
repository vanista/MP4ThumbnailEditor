const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs'); // ファイルシステムモジュールを追加

let mainWindow;

app.on('ready', () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
});

ipcMain.handle('select-video', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    filters: [{ name: 'Videos', extensions: ['mp4'] }],
    properties: ['openFile']
  });

  if (canceled) return null;
  return filePaths[0];
});

ipcMain.handle('set-thumbnail', async (event, { videoPath, timestamp }) => {
  try {
    const decodedVideoPath = decodeURIComponent(videoPath);
    const normalizedVideoPath = path.normalize(decodedVideoPath);
    const sanitizedVideoPath = normalizedVideoPath.replace(/^file:\\?/, '');
    
    // 一時ファイルのパスを設定
    const tmpDir = path.join(app.getPath('temp'), 'mp4thumbnailchanger');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    const thumbnailPath = path.join(tmpDir, 'thumbnail.jpg');
    const tempVideoPath = path.join(tmpDir, 'temp.mp4');

    if (!fs.existsSync(sanitizedVideoPath)) {
      throw new Error(`指定されたファイルが存在しません: ${sanitizedVideoPath}`);
    }

    return new Promise((resolve, reject) => {
      // サムネイル画像を生成
      ffmpeg(sanitizedVideoPath)
        .screenshots({
          timestamps: [timestamp],
          filename: 'thumbnail.jpg',
          folder: tmpDir
        })
        .outputOptions(['-q:v', '2'])
        .on('start', (commandLine) => {
          console.log('サムネイル生成開始:', commandLine);
        })
        .on('end', () => {
          console.log('サムネイル画像の生成完了');
          
          // サムネイルを動画に埋め込み
          ffmpeg(sanitizedVideoPath)
            .input(thumbnailPath)
            .outputOptions([
              '-map', '0',
              '-map', '1',
              '-c', 'copy',
              '-disposition:v:1', 'attached_pic'
            ])
            .save(tempVideoPath)
            .on('start', (commandLine) => {
              console.log('サムネイル埋め込み開始:', commandLine);
            })
            .on('end', () => {
              console.log('サムネイル埋め込み完了、元のファイルを上書きします');
              
              // 一時ファイルで元のファイルを上書き
              try {
                fs.copyFileSync(tempVideoPath, sanitizedVideoPath);
                fs.unlinkSync(tempVideoPath); // 一時ファイルを削除
                
                // 一時ファイルの削除
                if (fs.existsSync(thumbnailPath)) {
                  fs.unlinkSync(thumbnailPath);
                }
                
                console.log('処理が完了しました');
                resolve({ success: true });
              } catch (error) {
                console.error('ファイル上書き時にエラーが発生しました:', error);
                reject(error);
              }
            })
            .on('error', (err) => {
              console.error('サムネイル埋め込みエラー:', err.message);
              reject(err);
            });
        })
        .on('error', (err) => {
          console.error('サムネイル生成エラー:', err.message);
          reject(err);
        });
    });
  } catch (error) {
    console.error('エラーが発生しました:', error.message);
    throw error;
  }
});
