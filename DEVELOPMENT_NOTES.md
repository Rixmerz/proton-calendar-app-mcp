# Calendar MCP - Development Notes

## Errores Encontrados y Soluciones

### 1. Estructura incorrecta de `registerAppResource`

**Error:** Claude Desktop se quedaba cargando infinitamente.

**Causa:** El orden de los argumentos en `registerAppResource` era incorrecto.

```typescript
// ❌ INCORRECTO (lo que generaba bloom-ui-mcp)
registerAppResource(
  server,
  resourceUri,
  "Calendar Dashboard UI",  // nombre descriptivo
  { mimeType: RESOURCE_MIME_TYPE },
  async () => { ... }
);

// ✅ CORRECTO (como lo hace calculator-mcp-v2)
registerAppResource(
  server,
  resourceUri,
  resourceUri,  // el URI se repite como nombre
  { mimeType: RESOURCE_MIME_TYPE },
  async () => { ... }
);
```

**Lección:** El segundo y tercer argumento deben ser el mismo URI, no un nombre descriptivo.

---

### 2. Orden de registro: Tool antes que Resource

**Error:** La UI no se mostraba correctamente.

**Causa:** El orden de registro importa. Calculator registra primero el tool, luego el resource.

```typescript
// ✅ CORRECTO
registerAppTool(server, ...);      // PRIMERO
registerAppResource(server, ...);  // DESPUÉS
```

---

### 3. Esquema de URI incorrecto

**Error:** Resource no encontrado.

**Causa:** Usábamos `calendar://ui/mcp-app.html` en vez de `ui://calendar/mcp-app.html`.

```typescript
// ❌ INCORRECTO
const resourceUri = "calendar://ui/mcp-app.html";

// ✅ CORRECTO
const resourceUri = "ui://calendar/mcp-app.html";
```

**Patrón correcto:** `ui://{nombre-proyecto}/mcp-app.html`

---

### 4. `callServerTool` desde la UI no funciona

**Error:** `Invalid JSON-RPC message received` con errores de Zod.

**Causa:** Intentamos llamar a `app.callServerTool("fetch_calendar_events", {})` desde la UI, pero el protocolo de MCP Apps no soporta esto correctamente (o requiere configuración adicional).

**Solución:** Embeber los datos directamente en el HTML al cargar el resource:

```typescript
registerAppResource(server, resourceUri, resourceUri, { mimeType: RESOURCE_MIME_TYPE },
  async (): Promise<ReadResourceResult> => {
    const events = await fetchCalendarEvents();
    let html = await fs.readFile(path.join(DIST_DIR, "mcp-app.html"), "utf-8");

    // Inyectar datos como variable global
    const eventsScript = `<script>window.__CALENDAR_EVENTS__ = ${JSON.stringify(events)};</script>`;
    html = html.replace("</head>", `${eventsScript}</head>`);

    return { contents: [{ uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html }] };
  },
);
```

---

### 5. Devolver JSON desde el tool oculta la UI

**Error:** Al retornar JSON con eventos desde el tool, Claude Desktop mostraba el JSON en texto pero no la UI.

**Causa:** Si el content del tool result es JSON estructurado, Claude interpreta que es data y no muestra la UI.

**Solución:** El tool debe retornar texto simple como "Calendar opened.". Los datos van en el HTML del resource.

```typescript
// ❌ INCORRECTO - oculta la UI
async (): Promise<CallToolResult> => {
  const events = await fetchCalendarEvents();
  return {
    content: [{ type: "text", text: JSON.stringify({ events }) }],
  };
}

// ✅ CORRECTO - muestra la UI
async (): Promise<CallToolResult> => {
  return {
    content: [{ type: "text", text: "Calendar opened." }],
  };
}
```

---

## Resumen de Patrones Correctos

### server.ts (estructura mínima que funciona)

```typescript
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs/promises";
import path from "node:path";

const DIST_DIR = import.meta.filename.endsWith(".ts")
  ? path.join(import.meta.dirname, "dist")
  : import.meta.dirname;

export function createServer(): McpServer {
  const server = new McpServer({
    name: "My MCP App",
    version: "1.0.0",
  });

  const resourceUri = "ui://my-app/mcp-app.html";

  // 1. PRIMERO: Registrar el tool
  registerAppTool(server,
    "my_tool",
    {
      title: "My Tool",
      description: "Description",
      inputSchema: {},
      _meta: { ui: { resourceUri } },
    },
    async (): Promise<CallToolResult> => {
      return {
        content: [{ type: "text", text: "Tool opened." }],  // Texto simple!
      };
    },
  );

  // 2. DESPUÉS: Registrar el resource
  registerAppResource(server,
    resourceUri,
    resourceUri,  // Repetir el URI como nombre!
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = await fs.readFile(path.join(DIST_DIR, "mcp-app.html"), "utf-8");
      return {
        contents: [{ uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html }],
      };
    },
  );

  return server;
}
```

### Para pasar datos del servidor a la UI

```typescript
registerAppResource(server, resourceUri, resourceUri, { mimeType: RESOURCE_MIME_TYPE },
  async (): Promise<ReadResourceResult> => {
    const data = await fetchMyData();
    let html = await fs.readFile(path.join(DIST_DIR, "mcp-app.html"), "utf-8");

    // Inyectar en el HTML
    html = html.replace("</head>", `<script>window.__MY_DATA__ = ${JSON.stringify(data)};</script></head>`);

    return { contents: [{ uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html }] };
  },
);
```

### En la UI (mcp-app.ts)

```typescript
declare global {
  interface Window {
    __MY_DATA__?: MyDataType[];
  }
}

// Usar los datos
const data = window.__MY_DATA__ || [];
```

---

## Cambios Requeridos en bloom-ui-mcp

1. **Corregir template de server.ts** - Usar el patrón correcto de argumentos
2. **Corregir esquema de URI** - Usar `ui://nombre/mcp-app.html`
3. **Documentar limitaciones** - No usar `callServerTool` desde UI
4. **Agregar ejemplo de data injection** - Para apps que necesitan datos del servidor
