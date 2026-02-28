const { app, BrowserWindow, Menu, dialog, shell, ipcMain } = require('electron');
const path = require('path');
const axios = require('axios');
const pkg = require('./package.json');

// Flag for server.js
process.env.IS_ELECTRON = 'true';

let mainWindow;
const VERSION_URL = 'https://lacasadepastel.web.app/cliente/version.json'; // Remote version file

async function startServerIfNecessary() {
    try {
        const response = await axios.get('http://localhost:3000/status', { timeout: 800 });
        if (response.data && response.data.status === 'online') {
            console.log('[Electron] Servidor já está rodando (ex: Terminal). Ignorando start interno.');
            return;
        }
    } catch (e) {
        // Nada rodando na 3000, inicia servidor interno
        require('./server.js');
    }
}

async function createWindow() {
    await startServerIfNecessary();

    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        title: `La Casa de Pastel v${pkg.version}`,
        icon: path.join(__dirname, 'icons', 'LogoLaCasa.jpg'),
        backgroundColor: '#121212',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    setupMenu();
    loadWithRetry();

    mainWindow.on('closed', () => {
        mainWindow = null;
        app.quit();
    });
}

function setupMenu() {
    const template = [
        {
            label: 'Sistema',
            submenu: [
                {
                    label: 'Recarregar App',
                    accelerator: 'CmdOrCtrl+R',
                    click: () => mainWindow.reload()
                },
                {
                    label: 'Forçar Atualização (Limpar Cache)',
                    accelerator: 'CmdOrCtrl+Shift+R',
                    click: () => {
                        mainWindow.webContents.session.clearCache().then(() => {
                            mainWindow.reload();
                        });
                    }
                },
                { type: 'separator' },
                {
                    label: 'Verificar Atualizações',
                    click: () => checkUpdates(true)
                },
                {
                    label: 'Abrir Console de Desenvolvedor',
                    role: 'toggledevtools'
                },
                { type: 'separator' },
                { role: 'quit', label: 'Sair' }
            ]
        },
        {
            label: 'Editar',
            submenu: [
                { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
                { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectall' }
            ]
        },
        {
            label: 'Visualizar',
            submenu: [
                { role: 'togglefullscreen' },
                { role: 'toggledevtools' }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// Resilient loading logic
async function loadWithRetry(attempts = 0) {
    const maxAttempts = 10;
    try {
        const response = await axios.get('http://localhost:3000/status', { timeout: 1000 });
        if (response.data && response.data.status === 'online') {
            mainWindow.loadURL('http://localhost:3000/pdv/');
            checkUpdates(false); // Check for updates silently in background
            return;
        }
    } catch (e) {
        console.log(`[Electron] Server not ready (attempt ${attempts + 1}/${maxAttempts})...`);
    }

    if (attempts < maxAttempts) {
        setTimeout(() => loadWithRetry(attempts + 1), 1000);
    } else {
        dialog.showErrorBox(
            'Erro de Inicialização',
            'O servidor local não respondeu. Tente reiniciar o computador ou verifique se há outra instância aberta.'
        );
    }
}

async function checkUpdates(manual = false) {
    try {
        const response = await axios.get(VERSION_URL + '?t=' + Date.now());
        const remote = response.data;

        if (isNewer(remote.version, pkg.version)) {
            const { response: btnIdx } = await dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Nova Atualização Disponível',
                message: `Uma nova versão (${remote.version}) está disponível!`,
                detail: remote.notes || 'Melhorias de estabilidade e novas funcionalidades.',
                buttons: ['Baixar Agora', 'Mais Tarde'],
                defaultId: 0
            });

            if (btnIdx === 0) {
                shell.openExternal(remote.downloadUrl || 'https://lacasadepastel.web.app/');
            }
        } else if (manual) {
            dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Atualizado',
                message: 'Você já está usando a versão mais recente.',
                buttons: ['OK']
            });
        }
    } catch (e) {
        if (manual) console.error('Erro ao verificar atualizações:', e.message);
    }
}

function isNewer(remote, local) {
    const r = remote.split('.').map(Number);
    const l = local.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if (r[i] > l[i]) return true;
        if (r[i] < l[i]) return false;
    }
    return false;
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.on('check-for-updates-manual', () => {
    checkUpdates(true);
});
