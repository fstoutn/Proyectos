package com.example.facturacion.services;

import com.example.facturacion.dto.FacturaDetalleRequestDTO;
import com.example.facturacion.dto.FacturaRequestDTO;
import com.example.facturacion.entities.Articulo;
import com.example.facturacion.entities.CondicionIva;
import com.example.facturacion.entities.FacturaVenta;
import com.example.facturacion.entities.ListaPrecioArticulo;
import com.example.facturacion.entities.PuntoVenta;
import com.example.facturacion.entities.TipoMoneda;
import com.example.facturacion.entities.Usuario;
import com.example.facturacion.exceptions.RecursoNoEncontradoException;
import com.example.facturacion.repositories.ClienteRepository;
import com.example.facturacion.repositories.CondicionIvaRepository;
import com.example.facturacion.repositories.FacturaVentaRepository;
import com.example.facturacion.repositories.ListaPrecioArticuloRepository;
import com.example.facturacion.repositories.PuntoVentaRepository;
import com.example.facturacion.repositories.TipoMonedaRepository;
import com.example.facturacion.repositories.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FacturaServiceTest {

    @Mock
    private FacturaVentaRepository facturaVentaRepository;
    @Mock
    private ClienteRepository clienteRepository;
    @Mock
    private CondicionIvaRepository condicionIvaRepository;
    @Mock
    private PuntoVentaRepository puntoVentaRepository;
    @Mock
    private TipoMonedaRepository tipoMonedaRepository;
    @Mock
    private ListaPrecioArticuloRepository listaPrecioArticuloRepository;
    @Mock
    private UsuarioRepository usuarioRepository;

    @InjectMocks
    private FacturaService facturaService;

    @Test
    void crearFacturaCalculaImportesYGuardaLosDetalles() {
        when(puntoVentaRepository.findById(1L)).thenReturn(Optional.of(new PuntoVenta()));
        when(condicionIvaRepository.findById(1L)).thenReturn(Optional.of(new CondicionIva()));
        when(tipoMonedaRepository.findById(1L)).thenReturn(Optional.of(new TipoMoneda()));
        when(usuarioRepository.findByUsuario("admin")).thenReturn(Optional.of(new Usuario()));

        Articulo articulo = new Articulo();
        articulo.setDenominacion("Artículo de prueba");
        ListaPrecioArticulo precio = new ListaPrecioArticulo();
        precio.setArticulo(articulo);
        precio.setPrecioVenta(100);
        when(listaPrecioArticuloRepository.findFirstByArticulo_Id(7L)).thenReturn(Optional.of(precio));
        when(facturaVentaRepository.save(any(FacturaVenta.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        FacturaRequestDTO request = new FacturaRequestDTO();
        request.setNumero(1001L);
        request.setFechaEmision(LocalDate.of(2026, 10, 15));
        request.setPuntoVentaId(1L);
        request.setCondicionIvaId(1L);
        request.setTipoMonedaId(1L);
        request.setImporteCobrado(50);
        request.setDetalles(List.of(new FacturaDetalleRequestDTO(7L, null, 2, 10)));

        FacturaVenta creada = facturaService.crearFactura(request);

        assertEquals(217.8, creada.getImporteTotal(), 0.001);
        assertEquals(50, creada.getImporteCobrado(), 0.001);
        assertEquals(167.8, creada.getImporteSaldo(), 0.001);
        assertEquals(1, creada.getDetalles().size());
        assertEquals("Artículo de prueba", creada.getDetalles().get(0).getDescripcion());
        assertEquals(creada, creada.getDetalles().get(0).getFactura());
        verify(facturaVentaRepository).save(creada);
    }

    @Test
    void anularFacturaMarcaEstadoYFechaDeAnulacion() {
        FacturaVenta factura = new FacturaVenta();
        when(facturaVentaRepository.findById(3L)).thenReturn(Optional.of(factura));
        when(facturaVentaRepository.save(factura)).thenReturn(factura);

        FacturaVenta anulada = facturaService.anularFactura(3L);

        assertEquals("ANULADA", anulada.getEstado());
        assertNotNull(anulada.getFechaAnulacion());
    }

    @Test
    void eliminarFacturaInexistenteDevuelveNoEncontrado() {
        when(facturaVentaRepository.findById(404L)).thenReturn(Optional.empty());

        assertThrows(RecursoNoEncontradoException.class, () -> facturaService.eliminarFactura(404L));
    }
}
