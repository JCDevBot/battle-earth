# Quick Start / Tester Install

This zip includes simple launchers for friends/testers.

## Linux

Open a terminal in the extracted folder and run:

```bash
chmod +x install-and-run-linux.sh
./install-and-run-linux.sh
```

The script will try to install/use Node 22 through nvm, run `npm install` if needed, start Vite, and open the game at `http://localhost:5173`.

## macOS

Double-click `install-and-run-mac.command`, or run:

```bash
chmod +x install-and-run-mac.command
./install-and-run-mac.command
```

## Windows

Double-click `start-game.bat`.

Windows users still need Node.js installed first. The launcher will tell them if Node/npm are missing.

## Notes

- Keep `node_modules` out of the zip.
- The first run may take a few minutes because dependencies are installed.
- After the first run, the launcher skips install unless `node_modules` is missing.
- Stop the dev server with `Ctrl+C` in the terminal.
