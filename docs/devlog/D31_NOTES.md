# D31 - UI Cleanup + Tester Launcher

## UI cleanup

- Removed the persistent Squad State panel from the default battlefield UI.
- Kept the compact bottom unit roster.
- Kept the floating in-world command card for selected units.
- Unit dashboard selection still does not auto-center the camera.

## Tester launchers

Added:

- `install-and-run-linux.sh`
- `install-and-run-mac.command`
- `start-game.bat`
- `INSTALL.md`

Linux/macOS launchers attempt to install/use Node 22 through nvm, install dependencies on first run, start the dev server, and open the game in a browser.

Windows launcher starts the same flow after Node.js is installed.
