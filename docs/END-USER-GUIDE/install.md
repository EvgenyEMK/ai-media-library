# Download and install

## Windows build

1. Open the [Releases](https://github.com/EMK-solutions/ai-media-library/releases/latest) page.
2. Download the latest Windows installer (`AI Media Library-*-Windows-x64.exe`) or portable artifact.
3. Run the installer and complete setup.

## Linux build

1. Open the [Releases](https://github.com/EMK-solutions/ai-media-library/releases/latest) page.
2. Download one of:
   - **AppImage** (`AI Media Library-*-Linux-x86_64.AppImage`) — portable; no system install required.
   - **.deb package** (`AI Media Library-*-Linux-amd64.deb`) — for Debian/Ubuntu and derivatives.
3. Install or run:
   - **AppImage:** Make the file executable (`chmod +x "AI Media Library-*.AppImage"`), then run it from your file manager or terminal.
   - **.deb:** Install with your package manager, for example `sudo dpkg -i "AI Media Library-*-Linux-amd64.deb"` (resolve dependencies with `sudo apt-get install -f` if needed).
4. On first launch, grant execute permission if your desktop environment prompts you.

Linux builds target x86_64. For build instructions from source, see [desktop-wsl-linux-build.md](../desktop-wsl-linux-build.md) in the project docs.

## First run checklist

- Select one or more local media folders.
- Wait for initial indexing.
- Open Settings to review AI-related options.

## Notes about AI models

The application code is MIT licensed, but AI models and model weights are provided by third parties under their own licenses.

Always review model-specific license terms before commercial or redistributed usage.
