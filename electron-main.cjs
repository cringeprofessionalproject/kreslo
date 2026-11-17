// Готовая обёртка под Steam (Windows / macOS / Steam Deck) через Electron
// Запуск: npx electron electron-main.cjs (после npm run build)
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 420,
    minHeight: 720,
    backgroundColor: '#0b1413',
    title: 'Академия Эвристика: Расконсервация НИИ',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
