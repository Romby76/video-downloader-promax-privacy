/**
 * Servidor de Licencias ProMax - API de Validación Remota
 * Node.js + Express
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Habilitar CORS para permitir peticiones desde la extensión de Chrome (chrome-extension://...)
app.use(cors());
app.use(express.json());

// ============================================================================
// BASE DE DATOS EN MEMORIA (SIMULADA)
// En producción, reemplaza esto con una base de datos real (MongoDB, Postgres, Firebase, etc.)
// ============================================================================
const MOCK_LICENSES = {
  // Clave de licencia -> { active: boolean, maxDevices: number, registeredUuids: string[] }
  'PROMAX-TEST-12345': { active: true, maxDevices: 2, registeredUuids: [] },
  'PROMAX-TEST-56789': { active: true, maxDevices: 2, registeredUuids: [] },
  'PROMAX-TEST-EXPIRED': { active: false, maxDevices: 1, registeredUuids: [] },
  'PROMAX-TEST-1DEVICE': { active: true, maxDevices: 1, registeredUuids: [] }
};

// JWT Token Secreto para firmar (simulado para este ejemplo simple)
const JWT_SECRET_MOCK = "promax-jwt-secret-token-1234";

// ============================================================================
// ENDPOINT: VALIDAR LICENCIA Y DISPOSITIVO
// POST /api/validate
// Body: { licenseKey: string, clientUuid: string }
// ============================================================================
app.post('/api/validate', async (req, res) => {
  const { licenseKey, clientUuid } = req.body;

  console.log(`[License API]: Recibida solicitud de validación. Key: ${licenseKey}, UUID: ${clientUuid}`);

  if (!licenseKey || !clientUuid) {
    return res.status(400).json({ error: "Faltan parámetros requeridos (licenseKey, clientUuid)." });
  }

  // MODO SIMULADO (Local Testing):
  const license = MOCK_LICENSES[licenseKey];

  if (!license) {
    return res.status(404).json({ error: "La clave de licencia introducida no existe." });
  }

  if (!license.active) {
    return res.status(400).json({ error: "Esta licencia ha expirado o ha sido cancelada." });
  }

  // Verificar si el dispositivo ya está registrado
  const isDeviceRegistered = license.registeredUuids.includes(clientUuid);

  if (!isDeviceRegistered) {
    // Si no está registrado, verificar si excede el límite
    if (license.registeredUuids.length >= license.maxDevices) {
      console.warn(`[License API]: Licencia ${licenseKey} excedió límite de dispositivos (${license.maxDevices}).`);
      return res.status(403).json({ 
        error: `Límite de dispositivos excedido. Esta licencia solo permite ${license.maxDevices} dispositivo(s) simultáneo(s).` 
      });
    }

    // Registrar nuevo dispositivo
    license.registeredUuids.push(clientUuid);
    console.log(`[License API]: Nuevo dispositivo registrado para la clave ${licenseKey}. Total: ${license.registeredUuids.length}`);
  }

  // Generar Token de sesión simulado
  const mockToken = Buffer.from(`${licenseKey}:${clientUuid}:${Date.now() + 24*60*60*1000}`).toString('base64');

  return res.status(200).json({
    success: true,
    token: mockToken,
    message: "Licencia validada correctamente."
  });
});

// Base de datos simulada para descargas gratuitas (Freemium)
// clientUuid -> count (número de descargas exitosas)
const MOCK_CLIENT_DOWNLOADS = {};

// ============================================================================
// ENDPOINT: VERIFICAR PERMISO DE DESCARGA (FREEMIUM/LICENCIA)
// POST /api/check-download
// Body: { clientUuid: string }
// ============================================================================
app.post('/api/check-download', (req, res) => {
  const { clientUuid } = req.body;
  if (!clientUuid) {
    return res.status(400).json({ error: "Falta clientUuid." });
  }

  // Verificamos si este UUID está asociado a alguna licencia válida
  let hasActiveLicense = false;
  for (const key in MOCK_LICENSES) {
    if (MOCK_LICENSES[key].active && MOCK_LICENSES[key].registeredUuids.includes(clientUuid)) {
      hasActiveLicense = true;
      break;
    }
  }

  if (hasActiveLicense) {
    return res.status(200).json({ success: true, licensed: true });
  }

  // Si no tiene licencia, verificamos sus créditos freemium
  const downloadCount = MOCK_CLIENT_DOWNLOADS[clientUuid] || 0;
  if (downloadCount < 3) {
    return res.status(200).json({ 
      success: true, 
      licensed: false, 
      remaining: 3 - downloadCount 
    });
  }

  return res.status(403).json({ 
    success: false, 
    licensed: false, 
    remaining: 0,
    error: "Límite de descargas de prueba alcanzado (Máximo 3 descargas)." 
  });
});

// ============================================================================
// ENDPOINT: REGISTRAR DESCARGA COMPLETADA
// POST /api/record-download
// Body: { clientUuid: string }
// ============================================================================
app.post('/api/record-download', (req, res) => {
  const { clientUuid } = req.body;
  if (!clientUuid) {
    return res.status(400).json({ error: "Falta clientUuid." });
  }

  // Si tiene licencia activa, no incrementamos contador
  let hasActiveLicense = false;
  for (const key in MOCK_LICENSES) {
    if (MOCK_LICENSES[key].active && MOCK_LICENSES[key].registeredUuids.includes(clientUuid)) {
      hasActiveLicense = true;
      break;
    }
  }

  if (hasActiveLicense) {
    return res.status(200).json({ success: true, licensed: true });
  }

  // Incrementar contador freemium
  const currentCount = MOCK_CLIENT_DOWNLOADS[clientUuid] || 0;
  const newCount = currentCount + 1;
  MOCK_CLIENT_DOWNLOADS[clientUuid] = newCount;

  console.log(`[License API]: Descarga completada para UUID ${clientUuid}. Total: ${newCount}/3`);

  return res.status(200).json({
    success: true,
    licensed: false,
    remaining: Math.max(0, 3 - newCount)
  });
});

// ============================================================================
// ENDPOINT: OBTENER ESTADO DEL SERVIDOR (HEALTH CHECK)
// GET /
// ============================================================================
app.get('/', (req, res) => {
  res.send('Servidor de Licencias de Video Downloader ProMax corriendo con éxito.');
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`================================================================`);
  console.log(` Servidor de Licencias ProMax corriendo en el puerto ${PORT}`);
  console.log(`================================================================`);
});
