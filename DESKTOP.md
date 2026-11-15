# Ophiuchus Desktop — Windows beta 2.11

The desktop shortcut opens the packaged Electron window and its own local backend. Node.js, Vite and an open terminal are not required to run the packaged application. The first build is a portable application directory, not a signed installer or automatic updater.

## Data and credentials

User state lives under `%APPDATA%\Ophiuchus\state`. The shortcut can import an existing `.ophiuchus-local` directory once. Existing destination files are never overwritten. Credentials remain encrypted; unlock the vault inside the desktop app. Passwords are never copied or stored by the migration. The original web-installation data is preserved; later changes in the desktop app and web app are independent.

Visual preferences persist in the desktop browser profile. The loopback UI normally uses port 4318, with nearby fallback ports if busy. The backend has a separate, automatically assigned loopback port. The application does not attach to the development servers on ports 4317/5173.

Closing the window shuts down its backend. An active project flow asks whether to keep working or cancel and close. Isolated tests, direct tasks and legacy operations must finish before closing, avoiding orphaned test processes. A second launch focuses the existing window. Runtime diagnostics are stored in `%APPDATA%\Ophiuchus\desktop.log`.

OAuth links open in the system browser; the local callback returns to the desktop window so the existing state/PKCE checks still apply. Google OAuth requires its configured client and an authorized callback URI matching the actual loopback origin. API-key connections are unchanged. Provider credentials/configuration are not bundled into the application.

## Build

```text
npm ci
node node_modules/electron/install.js
npm run build
npm run desktop:package
```

The icon is generated from `public/ophiuchus-logo.svg`. Packaging copies only the compiled UI, runtime modules and desktop entry point; source credentials, local projects and node_modules are excluded. Build output is ignored by Git. Keep the complete application directory together: the `.exe` needs its adjacent Electron resources.

Use `desktop/install-shortcut.ps1` with the build directory and installation root to create a new version directory and desktop shortcut. The script does not delete old versions. Windows builds are unsigned in this beta and have not yet been validated on a second computer.
