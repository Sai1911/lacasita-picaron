// Pruebas de los cálculos monetarios del cobro.

const { test } = require("node:test");
const assert = require("node:assert");
const {
  calcularMontoCobrado,
  desglosarIGV,
  redondear,
} = require("../utils/calculos");

// ---------------- calcularMontoCobrado ----------------

test("sin ajustes, el cobro es igual al consumo", () => {
  assert.strictEqual(calcularMontoCobrado(58), 58);
});

test("aplica descuento y propina: 72 - 12 + 5 = 65", () => {
  assert.strictEqual(calcularMontoCobrado(72, 12, 5), 65);
});

test("solo descuento", () => {
  assert.strictEqual(calcularMontoCobrado(100, 15, 0), 85);
});

test("solo propina", () => {
  assert.strictEqual(calcularMontoCobrado(100, 0, 10), 110);
});

test("redondea correctamente los decimales", () => {
  assert.strictEqual(calcularMontoCobrado(24.9, 0, 0), 24.9);
  assert.strictEqual(calcularMontoCobrado(10.1, 0, 0.2), 10.3);
});

test("rechaza un descuento mayor que el consumo", () => {
  assert.throws(() => calcularMontoCobrado(50, 60, 0), /descuento no puede superar/i);
});

test("rechaza valores negativos", () => {
  assert.throws(() => calcularMontoCobrado(50, -5, 0));
  assert.throws(() => calcularMontoCobrado(50, 0, -5));
});

test("rechaza valores no numéricos", () => {
  assert.throws(() => calcularMontoCobrado("abc", 0, 0));
});

// ---------------- desglosarIGV ----------------

test("desglosa el IGV de una base que ya lo incluye (118 -> 100 + 18)", () => {
  const { opGravada, igv } = desglosarIGV(118);
  assert.strictEqual(opGravada, 100);
  assert.strictEqual(igv, 18);
});

test("la op. gravada más el IGV reconstruyen la base", () => {
  const base = 60;
  const { opGravada, igv } = desglosarIGV(base);
  assert.strictEqual(redondear(opGravada + igv), base);
});
