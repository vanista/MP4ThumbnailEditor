const { ipcRenderer } = require('electron');

document.getElementById('select-video').addEventListener('click', async () => {
  const videoPath = await ipcRenderer.invoke('select-video');
  if (videoPath) {
    document.getElementById('video').src = videoPath;
  }
});

document.getElementById('set-thumbnail').addEventListener('click', async () => {
  const video = document.getElementById('video');
  const timestamp = video.currentTime;
  const videoPath = video.src;
  // 元のファイルと同じパスを使用
  const outputPath = videoPath;

  try {
    const result = await ipcRenderer.invoke('set-thumbnail', { videoPath, timestamp, outputPath });
    if (result.success) {
      alert('サムネイルを設定しました');
    }
  } catch (error) {
    alert('エラーが発生しました: ' + error.message);
  }
});
