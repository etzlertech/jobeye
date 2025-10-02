@echo off
REM Windows batch file to run BrowserCat from Windows instead of WSL
REM This avoids WSL1 networking issues with WebSocket connections

echo 🪟 Running BrowserCat from Windows environment...
echo.

REM Change to the project directory
cd /d "C:\Users\tetzler.KWW\OneDrive - Kaspar Companies\Documents\GitHub\jobeye"

REM Set Node.js DNS order for better connectivity
set NODE_OPTIONS=--dns-result-order=ipv4first

echo 📂 Current directory: %CD%
echo 🔧 Node options: %NODE_OPTIONS%
echo.

REM Run the BrowserCat test
echo 🧪 Testing BrowserCat connection...
npx tsx scripts\ui-review\browsercat-working.ts

echo.
echo ✅ Test completed. Check output above for results.
pause