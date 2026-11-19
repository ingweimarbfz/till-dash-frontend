# Impresora térmica (TD-018)

La impresora es de cada computador: se configura en **Operación → Impresora** (o en el menú del usuario → *Impresora de este equipo*) y se guarda en ese navegador.

| Modo | Qué necesita | Cómo imprime |
|---|---|---|
| Navegador | Nada | Abre el cuadro de impresión del sistema (cualquier impresora de Windows o Mac), tiquete a 58 u 80 mm. |
| USB local (agente) | Node.js + agente | Comandos ESC/POS directo a la impresora instalada (Windows: cola RAW con winspool; Mac: `lp -o raw`). |
| Por red (IP) | Node.js + agente | Comandos ESC/POS al puerto 9100 de la impresora. El navegador no puede abrir conexiones TCP a la red local, por eso también pasa por el agente. |

## Agente local

- Código: `public/agente/tilldash-agente.cjs` (Node 16+, sin dependencias). Escucha solo en `127.0.0.1:17321`.
- Rutas: `GET /estado`, `GET /impresoras`, `POST /imprimir` `{ mode: 'usb'|'red', printer?, ip?, port?, copies?, data: base64 }`.
- Solo acepta pedidos del origen con que se instaló (`--origen`) y de `localhost` (desarrollo).
- Instaladores generados en la página (`src/utils/agentScripts.js`):
  - Windows `.bat`: descarga el agente a `%LOCALAPPDATA%\TillDash`, lo deja en Inicio (`TillDash-agente.vbs`, sin ventana) y lo arranca.
  - Mac `.command` (`bash ~/Downloads/tilldash-agente.command`): descarga a `~/Library/Application Support/TillDash` y crea el LaunchAgent `com.tilldash.agente`.
- Desinstalar: Windows, borrar `TillDash-agente.vbs` de la carpeta Inicio; Mac, `launchctl unload ~/Library/LaunchAgents/com.tilldash.agente.plist` y borrar el archivo.

## Tiquete

`src/utils/ticket.js` arma la precuenta, el tiquete de cobro y los tiquetes por persona como bloques; `src/utils/printer.js` los pinta en HTML o ESC/POS (página de códigos PC850 para tildes y ñ, corte de papel y apertura del cajón monedero al cobrar en efectivo). Con *Imprimir automáticamente al cobrar*, el tiquete sale solo al terminar el cobro. Si la térmica falla, el aviso ofrece imprimirlo por el navegador.
