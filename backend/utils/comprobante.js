// backend/utils/comprobante.js
//
// Lógica de numeración de comprobantes (boletas y facturas).
// Se aísla aquí para poder probarla sin tocar la base de datos.

// Serie por tipo de comprobante (convención SUNAT simplificada)
const SERIES = { boleta: "B001", factura: "F001" };

// Calcula el siguiente correlativo a partir del último emitido.
// Formato: B001-00000001 / F001-00000001
//   siguienteNumero(null, "boleta")           -> "B001-00000001"
//   siguienteNumero("B001-00000009", "boleta") -> "B001-00000010"
function siguienteNumero(ultimo, tipo) {
  const serie = SERIES[tipo] || SERIES.boleta;
  let correlativo = 1;

  if (ultimo) {
    const partes = String(ultimo).split("-");
    const n = parseInt(partes[partes.length - 1], 10);
    if (!Number.isNaN(n)) correlativo = n + 1;
  }

  return `${serie}-${String(correlativo).padStart(8, "0")}`;
}

module.exports = { SERIES, siguienteNumero };
