# FlashFix Toolkit

**Uncomplicated FlashFix Toolkit**

FlashFix Toolkit es una utilidad independiente de escritorio para recuperación y reinstalación controlada de firmware Samsung Galaxy usando Heimdall como backend externo.

## Aviso de uso

- Usa solo firmware oficial y adecuado para el modelo exacto del dispositivo.
- Flashear firmware puede borrar datos.
- Esta aplicación no incluye funciones de bypass de FRP, KG, Knox Guard, MDM, bloqueo de operador ni evasión de seguridad.
- FlashFix Toolkit es una utilidad independiente. No está afiliada ni respaldada por Samsung.

## Estado de la primera versión

Esta primera versión está pensada para ser funcional, no para automatizar el flujo de Odin.

Incluye:

- Detección de Heimdall.
- `heimdall detect`.
- `heimdall print-pit`.
- Logs persistentes por operación.
- Validación básica de archivos Samsung.
- Flasheo experto controlado por partición con archivos `.img`.
- Reinicio/cierre compatible con Heimdall cuando exista soporte.

No incluye todavía:

- Parsing automático de contenedores Samsung `.tar.md5`.
- Flasheo automático de BL/AP/CP/CSC/HOME_CSC como Odin.
- Reglas de mapeo firmware-a-partición para paquetes Samsung.

## Requisitos

- Windows.
- Node.js.
- Electron instalado por `npm install`.
- `heimdall.exe` colocado en `bin/heimdall.exe`.

## Instalación

```bash
npm install
```

## Ejecución en desarrollo

```bash
npm run dev
```

## Ubicación de Heimdall

Coloca el ejecutable en:

```txt
bin/heimdall.exe
```

La app también intenta resolver ubicaciones comunes adicionales, pero esa es la ruta esperada para la versión de desarrollo.

## Flujos principales

### Detectar dispositivo

Ejecuta `heimdall detect` y muestra la salida en tiempo real.

### Leer PIT

Ejecuta `heimdall print-pit` y guarda la salida en un archivo dentro de `logs/`.

### Flasheo experto

El flasheo inicial acepta solo particiones permitidas y archivos `.img`.

Particiones permitidas:

- BOOT
- RECOVERY
- SYSTEM
- VENDOR
- PRODUCT
- CACHE
- ODM
- MODEM
- HIDDEN

## Logs

La aplicación crea `logs/` automáticamente si no existe.

Cada operación guarda:

- Fecha y hora.
- Comando ejecutado.
- `stdout`.
- `stderr`.
- Código de salida.

La vista de logs en la interfaz también se actualiza en tiempo real.

## Licencia de Heimdall

FlashFix Toolkit uses Heimdall as an external flashing backend.  
Heimdall is licensed under the MIT License.  
Copyright (c) 2010-2017 Benjamin Dobell, Glass Echidna.

Consulta el archivo `licenses/HEIMDALL-MIT-LICENSE.txt`.
