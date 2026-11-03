import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { extractHtmlImprovements } from "./site-audit.ts";

describe("extractHtmlImprovements", () => {
  test("detecta imágenes sin alt, falta de H1, favicon y año de copyright viejo", () => {
    const html = `<html><head><title>x</title></head><body>
      <img src="a.jpg"><img src="b.jpg" alt="logo">
      <footer>© 2019 Mi Negocio</footer>
    </body></html>`;
    const improvements = extractHtmlImprovements(html);
    assert.ok(improvements.some((item) => item.title.includes("1 imagen")));
    assert.ok(improvements.some((item) => item.title.includes("H1")));
    assert.ok(improvements.some((item) => item.title.includes("favicon")));
    assert.ok(improvements.some((item) => item.title.includes("2019")));
  });

  test("no informa nada inventado cuando todo está presente", () => {
    const currentYear = new Date().getFullYear();
    const html = `<html><head><link rel="icon" href="/f.ico"></head><body>
      <h1>Título</h1>
      <img src="a.jpg" alt="descripción">
      <footer>© ${currentYear} Mi Negocio</footer>
    </body></html>`;
    assert.deepEqual(extractHtmlImprovements(html), []);
  });

  test("un año de copyright reciente no se marca como viejo", () => {
    const lastYear = new Date().getFullYear() - 1;
    const html = `<html><body><h1>x</h1><footer>© ${lastYear}</footer></body></html>`;
    assert.ok(!extractHtmlImprovements(html).some((item) => item.title.includes(String(lastYear))));
  });

  test("un atributo que sólo termina en '-alt' (ej. data-alt) no cuenta como alt real", () => {
    const html = `<html><body><h1>x</h1><img src="a.jpg" data-alt="foo"></body></html>`;
    assert.ok(extractHtmlImprovements(html).some((item) => item.title.includes("1 imagen")));
  });
});
