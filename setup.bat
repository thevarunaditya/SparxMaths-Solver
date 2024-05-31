@echo off

echo This will install chocolatey, npm, and dependencies for SparxSolver.

powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))" && SET PATH=%PATH%;%ALLUSERSPROFILE%\chocolatey\bin
choco feature enable -n=allowGlobalConfirmation

choco install nodejs

npm install -g body-parser@^1.20.2 discord-webhook-node@^1.1.8 ejs@^3.1.10 express@^4.19.2 express-fileupload@^1.5.0 express-session@^1.18.0 fs-extra@^11.2.0 multer@^1.4.5-lts.1 playwright@^1.44.1 sharp@^0.33.4 util@^0.12.5

pause