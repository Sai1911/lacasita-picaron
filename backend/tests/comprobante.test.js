// Pruebas de la numeración de comprobantes.
// Se ejecutan con:  npm test   (usa el runner nativo de Node, sin dependencias)

const { test } = require("node:test");
const assert = require("node:assert");
const { SERIES, siguienteNumero } = require("../utils/comprobante");

test("la primera boleta arranca en B001-00000001", () => {
  assert.strictEqual(siguienteNumero(null, "boleta"), "B001-00000001");
});

test("la primera factura arranca en F001-00000001", () => {
  assert.strictEqual(siguienteNumero(null, "factura"), "F001-00000001");
});

test("incrementa el correlativo respecto al último emitido", () => {
  assert.strictEqual(siguienteNumero("B001-00000009", "boleta"), "B001-00000010");
  assert.strictEqual(siguienteNumero("F001-00000041", "factura"), "F001-00000042");
});

test("mantiene el relleno de 8 dígitos al cruzar decenas y centenas", () => {
  assert.strictEqual(siguienteNumero("B001-00000099", "boleta"), "B001-00000100");
  assert.strictEqual(siguienteNumero("B001-00000999", "boleta"), "B001-00001000");
});

test("boletas y facturas llevan series independientes", () => {
  assert.ok(siguienteNumero(null, "boleta").startsWith(SERIES.boleta));
  assert.ok(siguienteNumero(null, "factura").startsWith(SERIES.factura));
});

test("un valor de entrada corrupto no rompe: reinicia en 1", () => {
  assert.strictEqual(siguienteNumero("basura-sin-numero", "boleta"), "B001-00000001");
});

test("un tipo desconocido cae a la serie de boleta", () => {
  assert.strictEqual(siguienteNumero(null, "otro"), "B001-00000001");
});
