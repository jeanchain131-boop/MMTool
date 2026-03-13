import { app, BrowserWindow } from "electron";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const appIconPath = path.join(projectRoot, "windowsapp.ico");
let mainWindow = null;
let desktopUrl = "";

async function waitForServer(url, retries = 60, delayMs = 500) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return true;
      }
    } catch (_) {
      // Ignore and retry.
    }

    await new Promise((resolve) => {
      setTimeout(resolve, delayMs);
    });
  }

  throw new Error("Local desktop server did not start in time.");
}

async function startEmbeddedServer() {
  process.env.START_SERVER_ON_IMPORT = "false";
  process.env.APP_DATA_DIR = app.getPath("userData");
  process.env.DESKTOP_APP = "true";

  const serverModule = await import(pathToFileURL(path.join(projectRoot, "server.js")).href);
  const listener = await serverModule.startServer(0);
  const port = listener.address()?.port;
  desktopUrl = `http://127.0.0.1:${port}`;
  await waitForServer(`${desktopUrl}/health`);
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 920,
    minWidth: 1080,
    minHeight: 760,
    autoHideMenuBar: true,
    backgroundColor: "#f6f1e8",
    title: "M&M Toolkit",
    icon: appIconPath,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  try {
    await startEmbeddedServer();
    await mainWindow.loadURL(desktopUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await mainWindow.loadURL(
      `data:text/html,${encodeURIComponent(`
        <html>
          <body style="font-family: Segoe UI, sans-serif; background:#f6f1e8; color:#1f2a37; padding:32px;">
            <h2>Desktop app failed to start</h2>
            <p>${message}</p>
            <p>Please close the app and try again.</p>
          </body>
        </html>
      `)}`
    );
  }
}

app.whenReady().then(createMainWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createMainWindow();
  }
});
