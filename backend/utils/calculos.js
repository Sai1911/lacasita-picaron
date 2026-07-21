// backend/utils/calculos.js
//
// Cálculos monetarios del cobro, aislados para poder probarlos.
// Los precios del menú ya incluyen IGV (18%), como es habitual en Perú.

const IGV = 0.18;

// Redondeo a 2 decimales evitando errores de coma flotante
function redondear(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

// Monto que efectivamente cobra la caja:
//   consumo - descuento + propina
// Lanza si el descuento supera el consumo (no tendría sentido cobrar negativo).
function calcularMontoCobrado(subtotal, descuento = 0, propina = 0) {
  const s = Number(subtotal);
  const d = Number(descuento);
  const p = Number(propina);

  if ([s, d, p].some((v) => Number.isNaN(v))) {
    throw new Error("Valores no numéricos en el cálculo del cobro");
  }
  if (d < 0 || p < 0) {
    throw new Error("El descuento y la propina no pueden ser negativos");
  }
  if (d > s) {
    throw new Error("El descuento no puede superar el consumo");
  }

  return redondear(s - d + p);
}

// Desglose del IGV sobre una base que ya lo incluye.
//   base = 118  ->  { opGravada: 100, igv: 18 }
// La propina NO está afecta a IGV, por eso se descuenta antes de llamar aquí.
function desglosarIGV(base) {
  const b = Number(base);
  const opGravada = redondear(b / (1 + IGV));
  const igv = redondear(b - opGravada);
  return { opGravada, igv };
}

module.exports = { IGV, redondear, calcularMontoCobrado, desglosarIGV };
