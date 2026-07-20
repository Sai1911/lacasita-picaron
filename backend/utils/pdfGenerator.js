const PDFDocument = require('pdfkit');

const IGV = 0.18; // Los precios del menú ya incluyen IGV

// ============================================================
// Genera el comprobante y lo escribe directamente en el stream
// destino (normalmente la respuesta HTTP).
//
// Se transmite en streaming en lugar de guardarlo en disco:
//   · evita la condición de carrera de leer el archivo antes de
//     que terminara de escribirse,
//   · y en Render el sistema de archivos es efímero.
// ============================================================
exports.streamOrderPDF = (order, stream) => {
  const doc = new PDFDocument({ margin: 40 });
  doc.pipe(stream);

  const esComprobante = Boolean(order.numero_comprobante);
  const titulo = esComprobante
    ? (order.tipo_comprobante === 'factura' ? 'FACTURA ELECTRÓNICA' : 'BOLETA DE VENTA')
    : 'COMANDA';

  // ---------------- Cabecera ----------------
  doc.fontSize(20).text('La Casita del Picarón', { align: 'center' });
  doc.fontSize(10).text('Av. Ejemplo 123 - Lima, Perú', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(14).text(titulo, { align: 'center' });

  if (esComprobante) {
    doc.fontSize(12).text(order.numero_comprobante, { align: 'center' });
  }

  doc.moveDown();

  // ---------------- Datos del pedido ----------------
  doc.fontSize(11);
  doc.text(`Pedido Nº: ${order.id_pedido}`);
  doc.text(`Mesa: ${order.nombre_mesa}`);
  doc.text(`Atendido por: ${order.mozo}`);
  doc.text(`Fecha: ${new Date(order.fecha_creacion).toLocaleString('es-PE')}`);

  if (order.metodo_pago) {
    doc.text(`Método de pago: ${order.metodo_pago}`);
  }

  // ---------------- Datos del cliente ----------------
  if (esComprobante) {
    doc.moveDown(0.5);
    const etiquetaDoc = order.tipo_comprobante === 'factura' ? 'RUC' : 'DNI';
    doc.text(`Cliente: ${order.nombre_cliente || 'Público general'}`);
    doc.text(`${etiquetaDoc}: ${order.doc_cliente || '-'}`);
  }

  doc.moveDown();
  doc.text('Detalle:', { underline: true });
  doc.moveDown(0.3);

  // ---------------- Detalle ----------------
  // Nota: PostgreSQL devuelve los NUMERIC como string, por eso los Number().
  order.items.forEach((item) => {
    const cantidad = Number(item.quantity || 0);
    const precio = Number(item.price || 0);
    doc.text(
      `${cantidad} x ${item.name} - S/ ${(cantidad * precio).toFixed(2)}`
    );

    // Indicación para cocina ("sin cebolla", "término medio"...)
    if (item.nota) {
      doc.fontSize(9).fillColor('gray').text(`     ↳ ${item.nota}`);
      doc.fontSize(11).fillColor('black');
    }
  });

  doc.moveDown();

  // ---------------- Totales ----------------
  const subtotal = Number(order.total || 0);
  const descuento = Number(order.descuento || 0);
  const propina = Number(order.propina || 0);
  const total = subtotal - descuento + propina;

  if (descuento > 0 || propina > 0) {
    doc.text(`Consumo: S/ ${subtotal.toFixed(2)}`, { align: 'right' });
    if (descuento > 0) {
      doc.text(`Descuento: -S/ ${descuento.toFixed(2)}`, { align: 'right' });
    }
    if (propina > 0) {
      doc.text(`Propina: S/ ${propina.toFixed(2)}`, { align: 'right' });
    }
  }

  if (esComprobante) {
    // La propina no está afecta a IGV; se descuenta antes de calcularlo.
    const baseImponible = subtotal - descuento;
    const opGravada = baseImponible / (1 + IGV);
    const igv = baseImponible - opGravada;

    doc.text(`Op. Gravada: S/ ${opGravada.toFixed(2)}`, { align: 'right' });
    doc.text(`IGV (18%): S/ ${igv.toFixed(2)}`, { align: 'right' });
  }

  doc.fontSize(13).text(`TOTAL: S/ ${total.toFixed(2)}`, { align: 'right' });

  doc.moveDown(2);
  doc.fontSize(9).text('¡Gracias por su preferencia!', { align: 'center' });

  doc.end();
};
