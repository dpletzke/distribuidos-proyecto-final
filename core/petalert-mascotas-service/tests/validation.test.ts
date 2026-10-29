import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSchema, idSchema } from '../src/validators/mascotas.validator.js';
const pet = { nombre: 'Max', raza: 'Labrador', color: 'Dorado' };
test('normaliza GPS y admite ausencia o null', () => {
  assert.equal(createSchema.parse({ ...pet, collar_gps: ' co-458 ' }).collar_gps, 'CO-458');
  assert.equal(createSchema.parse(pet).collar_gps, null);
});
test('rechaza campos vacíos, GPS inválido y campos desconocidos', () => {
  for (const collar_gps of ['', ' ', true, 'A--B', '-A', 'A-', 'A B', 'A'.repeat(51)]) assert.equal(createSchema.safeParse({ ...pet, collar_gps }).success, false);
  for (const nombre of ['', ' ', 'X'.repeat(101)]) assert.equal(createSchema.safeParse({ ...pet, nombre }).success, false);
  assert.equal(createSchema.safeParse({ ...pet, id: 1 }).success, false);
});
test('valida BIGINT y evita referencias arbitrarias a archivos locales', () => {
  for (const id of ['0', '-1', '1.5', '1 OR 1=1', '9223372036854775808']) assert.equal(idSchema.safeParse(id).success, false);
  assert.equal(idSchema.parse('9223372036854775807'), '9223372036854775807');
  for (const foto of ['/uploads/a.jpg', '../a.png', 'file:///etc/passwd', 'javascript:alert(1)']) assert.equal(createSchema.safeParse({ ...pet, foto }).success, false);
});
