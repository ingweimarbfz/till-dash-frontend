// Instaladores del agente de impresión (TD-018). Se arman en el navegador con la dirección de este TillDash+,
// que el agente usa para descargarse y para aceptar solo los pedidos de esta página.
// Los dos dejan el agente corriendo en segundo plano y arrancando solo al encender el computador.

const PORT = 17321

export const windowsScript = (origin) => [
  '@echo off',
  'chcp 65001 >nul',
  'title TillDash+ - agente de impresion',
  `set "ORIGEN=${origin}"`,
  'set "DIR=%LOCALAPPDATA%\\TillDash"',
  'set "VBS=%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\TillDash-agente.vbs"',
  'echo.',
  'echo  TillDash+ - instalando el agente de impresion',
  'echo.',
  'set "NODE="',
  'for /f "delims=" %%i in (\'where node 2^>nul\') do if not defined NODE set "NODE=%%i"',
  'if not defined NODE (',
  '  echo  No se encontro Node.js. Instalalo desde https://nodejs.org y vuelve a abrir este archivo.',
  '  start "" https://nodejs.org/es/download',
  '  pause',
  '  exit /b 1',
  ')',
  'if not exist "%DIR%" mkdir "%DIR%"',
  'echo  Descargando el agente desde %ORIGEN% ...',
  'powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri \'%ORIGEN%/agente/tilldash-agente.cjs\' -OutFile \'%DIR%\\tilldash-agente.cjs\'"',
  'if errorlevel 1 (',
  '  echo  No se pudo descargar el agente. Revisa la conexion a internet.',
  '  pause',
  '  exit /b 1',
  ')',
  'rem Detiene una version anterior del agente, si estaba corriendo.',
  'powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq \'node.exe\' -and $_.CommandLine -like \'*tilldash-agente*\' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>nul',
  'rem Arranque automatico al iniciar sesion en Windows, sin ventana.',
  '> "%VBS%" echo CreateObject("WScript.Shell").Run """%NODE%"" ""%DIR%\\tilldash-agente.cjs"" --origen %ORIGEN%", 0, False',
  'wscript "%VBS%"',
  'timeout /t 3 /nobreak >nul',
  `powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing http://127.0.0.1:${PORT}/estado | Out-Null; exit 0 } catch { exit 1 }"`,
  'if errorlevel 1 (',
  '  echo  El agente no arranco. Se abre en esta ventana para ver el error:',
  '  "%NODE%" "%DIR%\\tilldash-agente.cjs" --origen %ORIGEN%',
  '  pause',
  '  exit /b 1',
  ')',
  'echo.',
  'echo  Listo: el agente quedo corriendo y arrancara solo al encender el computador.',
  'echo  Vuelve a TillDash+ y presiona "Detectar impresoras". Ya puedes cerrar esta ventana.',
  'echo.',
  'pause',
  ''
].join('\r\n')

export const macScript = (origin) => `#!/bin/bash
# TillDash+ · instalador del agente de impresión para Mac
ORIGEN='${origin}'
DIR="$HOME/Library/Application Support/TillDash"
PLIST="$HOME/Library/LaunchAgents/com.tilldash.agente.plist"
echo
echo " TillDash+ · instalando el agente de impresión"
echo
NODE="$(command -v node)"
for c in /opt/homebrew/bin/node /usr/local/bin/node; do
  if [ -z "$NODE" ] && [ -x "$c" ]; then NODE="$c"; fi
done
if [ -z "$NODE" ]; then
  echo " No se encontró Node.js. Instálalo desde https://nodejs.org y vuelve a abrir este archivo."
  open "https://nodejs.org/es/download"
  read -n 1 -s -r -p " Presiona una tecla para cerrar"
  exit 1
fi
mkdir -p "$DIR" "$HOME/Library/LaunchAgents"
echo " Descargando el agente desde $ORIGEN ..."
if ! curl -fsSL "$ORIGEN/agente/tilldash-agente.cjs" -o "$DIR/tilldash-agente.cjs"; then
  echo " No se pudo descargar el agente. Revisa la conexión a internet."
  read -n 1 -s -r -p " Presiona una tecla para cerrar"
  exit 1
fi
# Arranque automático al iniciar sesión (launchd). Se reinicia solo si se cae.
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.tilldash.agente</string>
  <key>ProgramArguments</key><array>
    <string>$NODE</string><string>$DIR/tilldash-agente.cjs</string><string>--origen</string><string>$ORIGEN</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
  <key>StandardOutPath</key><string>$DIR/agente.log</string>
  <key>StandardErrorPath</key><string>$DIR/agente.log</string>
</dict></plist>
EOF
launchctl unload "$PLIST" 2>/dev/null
pkill -f tilldash-agente.cjs 2>/dev/null
launchctl load -w "$PLIST"
sleep 2
if curl -fs http://127.0.0.1:${PORT}/estado >/dev/null; then
  echo
  echo " Listo: el agente quedó corriendo y arrancará solo al encender el Mac."
  echo " Vuelve a TillDash+ y presiona \\"Detectar impresoras\\". Ya puedes cerrar esta ventana."
else
  echo " El agente no arrancó. Últimas líneas del registro:"
  tail -n 20 "$DIR/agente.log"
fi
echo
read -n 1 -s -r -p " Presiona una tecla para cerrar"
echo
`

export const downloadText = (name, text, type = 'text/plain') => {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
