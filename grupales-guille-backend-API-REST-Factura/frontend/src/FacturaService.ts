import type {
  FacturaEstadoRequestDTO,
  FacturaFiltrosDTO,
  FacturaReporteDTO,
  FacturaRequestDTO
} from "./models/factura.dto";

const API_URL = "/api/facturas";
const DEMO_STORAGE_KEY = "facturacion-demo-facturas-v1";

const FACTURAS_DEMO_INICIALES: FacturaReporteDTO[] = [
  {
    id: 1,
    numeroFactura: 1001,
    fechaEmision: "2026-10-15",
    estado: "EMITIDA",
    clienteDenominacion: "Almacén Los Andes",
    condicionIva: "IVA Responsable Inscripto",
    puntoVentaDescripcion: "Casa Central",
    importeTotal: 14520,
    cantidadItems: 3
  },
  {
    id: 2,
    numeroFactura: 1002,
    fechaEmision: "2026-10-14",
    estado: "PENDIENTE",
    clienteDenominacion: "Consumidor Final",
    condicionIva: "Consumidor Final",
    puntoVentaDescripcion: "Sucursal 1",
    importeTotal: 8250.5,
    cantidadItems: 2
  },
  {
    id: 3,
    numeroFactura: 1003,
    fechaEmision: "2026-10-12",
    estado: "ANULADA",
    clienteDenominacion: "Distribuidora Centro",
    condicionIva: "IVA Responsable Inscripto",
    puntoVentaDescripcion: "Casa Central",
    importeTotal: 30100,
    cantidadItems: 5
  }
];

function esFacturaReporte(value: unknown): value is FacturaReporteDTO {
  if (typeof value !== "object" || value === null) return false;
  const factura = value as Record<string, unknown>;
  return typeof factura.id === "number" &&
    (typeof factura.numeroFactura === "number" || factura.numeroFactura === null) &&
    typeof factura.fechaEmision === "string" &&
    typeof factura.estado === "string" &&
    typeof factura.clienteDenominacion === "string" &&
    typeof factura.condicionIva === "string" &&
    typeof factura.puntoVentaDescripcion === "string" &&
    typeof factura.importeTotal === "number" &&
    typeof factura.cantidadItems === "number";
}

export class FacturaService {
  constructor(private readonly modoDemo: () => boolean = () => false) {}

  async obtenerFacturas(filtros: FacturaFiltrosDTO = {}): Promise<FacturaReporteDTO[]> {
    if (this.modoDemo()) {
      return this.leerDemo().filter((factura) =>
        (!filtros.fechaDesde || factura.fechaEmision >= filtros.fechaDesde) &&
        (!filtros.fechaHasta || factura.fechaEmision <= filtros.fechaHasta) &&
        (!filtros.estado || factura.estado.toLowerCase().includes(filtros.estado.toLowerCase())) &&
        (filtros.montoMinimo === undefined || factura.importeTotal >= filtros.montoMinimo)
      );
    }
    const parametros = new URLSearchParams();
    Object.entries(filtros).forEach(([clave, valor]) => {
      if (valor !== undefined && valor !== "") {
        parametros.set(clave, String(valor));
      }
    });
    const query = parametros.size > 0 ? `?${parametros.toString()}` : "";
    return this.solicitar<FacturaReporteDTO[]>(`${API_URL}${query}`);
  }

  async crearFactura(factura: FacturaRequestDTO): Promise<FacturaReporteDTO> {
    if (this.modoDemo()) {
      const facturas = this.leerDemo();
      const id = Math.max(0, ...facturas.map((item) => item.id)) + 1;
      const creada: FacturaReporteDTO = {
        id,
        numeroFactura: factura.numero ?? id,
        fechaEmision: factura.fechaEmision ?? new Date().toISOString().slice(0, 10),
        estado: factura.estado || "PENDIENTE",
        clienteDenominacion: factura.clienteId === null ? "Consumidor Final" : `Cliente #${factura.clienteId}`,
        condicionIva: `Condición IVA #${factura.condicionIvaId}`,
        puntoVentaDescripcion: `Punto de venta #${factura.puntoVentaId}`,
        importeTotal: factura.detalles.reduce(
          (total, detalle) => total + detalle.cantidad * 100 * (1 - detalle.porcentajeBonificacion / 100) * 1.21,
          0
        ),
        cantidadItems: factura.detalles.length
      };
      this.guardarDemo([creada, ...facturas]);
      return creada;
    }
    return this.solicitar<FacturaReporteDTO>(API_URL, {
      method: "POST",
      body: JSON.stringify(factura)
    });
  }

  async actualizarEstado(
    id: number,
    estado: string,
    observaciones?: string
  ): Promise<FacturaReporteDTO> {
    if (this.modoDemo()) {
      const facturas = this.leerDemo();
      const actualizada = facturas.find((factura) => factura.id === id);
      if (!actualizada) throw new Error(`No existe la factura con ID ${id}`);
      actualizada.estado = estado;
      this.guardarDemo(facturas);
      return actualizada;
    }
    const body: FacturaEstadoRequestDTO = { estado, observaciones };
    return this.solicitar<FacturaReporteDTO>(`${API_URL}/${id}/estado`, {
      method: "PUT",
      body: JSON.stringify(body)
    });
  }

  async eliminarFactura(id: number): Promise<void> {
    if (this.modoDemo()) {
      const facturas = this.leerDemo();
      if (!facturas.some((factura) => factura.id === id)) {
        throw new Error(`No existe la factura con ID ${id}`);
      }
      this.guardarDemo(facturas.filter((factura) => factura.id !== id));
      return;
    }
    await this.solicitar<void>(`${API_URL}/${id}`, { method: "DELETE" });
  }

  private leerDemo(): FacturaReporteDTO[] {
    try {
      const guardadas = localStorage.getItem(DEMO_STORAGE_KEY);
      if (guardadas === null) {
        this.guardarDemo(FACTURAS_DEMO_INICIALES);
        return [...FACTURAS_DEMO_INICIALES];
      }
      const datos: unknown = JSON.parse(guardadas);
      if (!Array.isArray(datos) || !datos.every(esFacturaReporte)) {
        throw new Error("El almacenamiento local de demostración no tiene el formato esperado.");
      }
      return datos;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error("No se pudieron leer las facturas de demostración almacenadas en el navegador.");
      }
      throw error;
    }
  }

  private guardarDemo(facturas: FacturaReporteDTO[]): void {
    try {
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(facturas));
    } catch {
      throw new Error("El navegador no pudo guardar los datos de demostración. Revisá el espacio disponible.");
    }
  }

  private async solicitar<T>(url: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers
      }
    });
    if (!response.ok) {
      const texto = await response.text();
      let mensaje = texto || `Error HTTP ${response.status}`;
      try {
        const detalle: unknown = JSON.parse(texto);
        if (typeof detalle === "object" && detalle !== null && "detail" in detalle) {
          const problem = detalle as { detail?: unknown };
          if (typeof problem.detail === "string") mensaje = problem.detail;
        }
      } catch {
        // La respuesta puede no ser JSON; se conserva el texto del servidor.
      }
      throw new Error(mensaje);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }
}
