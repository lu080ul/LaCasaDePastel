import { app, BrowserWindow, screen, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { autoUpdater } = require('electron-updater');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let tvWindow = null;
let despachoWindow = null;

// ──────────────────────────────────────────────
// Auto-Updater Configuration
// ──────────────────────────────────────────────
function configureAutoUpdater() {
  // Não mostrar caixa de diálogo nativa — gerenciamos via React UI
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    if (mainWindow) {
      mainWindow.webContents.send('update-available', info);
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    if (mainWindow) {
      mainWindow.webContents.send('update-not-available', info);
    }
  });

  autoUpdater.on('download-progress', (progressObj) => {
    if (mainWindow) {
      mainWindow.webContents.send('download-progress', progressObj);
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow) {
      mainWindow.webContents.send('update-downloaded', info);
    }
  });

  autoUpdater.on('error', (err) => {
    const msg = err ? err.message : 'Erro desconhecido na atualização';
    console.error('Auto-update error:', msg);
    if (mainWindow) {
      mainWindow.webContents.send('update-error', msg);
    }
  });
}

// ──────────────────────────────────────────────
// IPC Handlers — Auto-Update
// ──────────────────────────────────────────────
ipcMain.on('start-update-download', () => {
  autoUpdater.downloadUpdate();
});

ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.on('check-for-updates', () => {
  autoUpdater.checkForUpdates();
});

// ──────────────────────────────────────────────
// Window Management
// ──────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    title: "La Casa PDV",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Maximiza para ocupar toda a tela disponível em qualquer resolução/OS
  mainWindow.maximize();

  // Oculta a barra de menus nativa (estilo kiosk/app de produção)
  mainWindow.removeMenu();

  // Carrega o frontend estático compilado pelo Vite
  mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));

  // Tenta abrir a TV no segundo monitor 2 segundos depois de iniciar
  setTimeout(() => openTvDisplay(false), 2000);

  // Verifica atualizações 5 segundos após iniciar (dá tempo para a janela carregar)
  mainWindow.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      if (app.isPackaged) {
        autoUpdater.checkForUpdates();
      }
    }, 5000);
  });
}


function openTvDisplay(isManual = false, preferredDisplayId = null) {
  if (tvWindow) {
    tvWindow.close(); // Close existing to reopen on new selected display
    tvWindow = null;
  }

  const displays = screen.getAllDisplays();
  
  // Pega uma tela que não seja a principal (geralmente posição diferente de 0,0)
  const externalDisplay = displays.find((display) => {
    return display.bounds.x !== 0 || display.bounds.y !== 0;
  });

  const hasAnyExternal = !!externalDisplay;
  
  // O usuário solicitou que o painel NÃO inicie sozinho no monitor primário
  // Por isso, se for processo automático, só abre se detectar monitor avulso
  if (!isManual && !hasAnyExternal) {
    console.log("Abertura automática da TV abortada. Nenhum segundo display encontrado.");
    return;
  }

  let displayToUse = displays[0];
  if (preferredDisplayId) {
    displayToUse = displays.find(d => d.id === preferredDisplayId) || displayToUse;
  } else if (externalDisplay) {
    displayToUse = externalDisplay;
  }

  const isExternal = displayToUse.bounds.x !== 0 || displayToUse.bounds.y !== 0;

  if (displayToUse) {
    tvWindow = new BrowserWindow({
      x: displayToUse.bounds.x,
      y: displayToUse.bounds.y,
      width: displayToUse.bounds.width,
      height: displayToUse.bounds.height,
      fullscreen: true,
      title: "La Casa - Painel de Pedidos (TV)",
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    tvWindow.removeMenu();
    // Como estamos usando HashRouter, passamos o hash como opção para o loadFile
    tvWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: 'tv' });
    
    tvWindow.on('closed', () => {
      tvWindow = null;
    });
  }
}

// ──────────────────────────────────────────────
// Despacho Display (Painel do Entregador)
// ──────────────────────────────────────────────
function openDespachoDisplay(isManual = false, preferredDisplayId = null) {
  if (despachoWindow) {
    despachoWindow.close();
    despachoWindow = null;
  }

  const displays = screen.getAllDisplays();

  let displayToUse = displays[0]; // default: monitor principal
  if (preferredDisplayId) {
    displayToUse = displays.find(d => d.id === preferredDisplayId) || displayToUse;
  } else {
    // Tenta detectar monitor externo
    const externalDisplay = displays.find(d => d.bounds.x !== 0 || d.bounds.y !== 0);
    if (externalDisplay) {
      displayToUse = externalDisplay;
    }
  }

  // Se não é manual e não tem monitor externo, não abre
  if (!isManual) {
    const hasExternal = displays.some(d => d.bounds.x !== 0 || d.bounds.y !== 0);
    if (!hasExternal) {
      console.log("Abertura automática de Despacho abortada. Nenhum segundo display encontrado.");
      return;
    }
  }

  despachoWindow = new BrowserWindow({
    x: displayToUse.bounds.x,
    y: displayToUse.bounds.y,
    width: displayToUse.bounds.width,
    height: displayToUse.bounds.height,
    fullscreen: !isManual, // Fullscreen em monitor externo, janela normal se manual no primário
    title: "La Casa - Painel de Despacho",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  despachoWindow.removeMenu();
  despachoWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: 'despacho' });

  despachoWindow.on('closed', () => {
    despachoWindow = null;
  });
}

ipcMain.on('open-tv-display', (event, displayId) => {
  openTvDisplay(true, displayId); // Chamada manual
});

ipcMain.on('open-despacho-display', (event, displayId) => {
  openDespachoDisplay(true, displayId); // Chamada manual
});

ipcMain.handle('get-displays', () => {
  const displays = screen.getAllDisplays();
  return displays.map(d => ({
    id: d.id,
    bounds: d.bounds,
    isPrimary: d.bounds.x === 0 && d.bounds.y === 0,
    label: `Tela ${d.id} (${d.bounds.width}x${d.bounds.height})${d.bounds.x===0 && d.bounds.y===0 ? ' - Principal' : ''}`
  }));
});

// ──────────────────────────────────────────────
// App Lifecycle
// ──────────────────────────────────────────────

// Permite que áudio/vídeo toquem sozinhos sem precisar do primeiro clique do usuário
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

app.whenReady().then(() => {
  configureAutoUpdater();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
