/**
 * Gera GLBs procedurais (exceto articulado-verde, que usa asset Meshy).
 * Uso: node --input-type=module scripts/gerar-onibus-3d.mjs
 */
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Blob as NodeBlob } from 'buffer';

if (typeof globalThis.Blob === 'undefined') globalThis.Blob = NodeBlob;
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    result = null;
    onloadend = null;
    onerror = null;
    readAsArrayBuffer(blob) {
      Promise.resolve(blob.arrayBuffer())
        .then((buf) => {
          this.result = buf;
          this.onloadend?.({ target: this });
        })
        .catch((err) => this.onerror?.(err));
    }
  };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../public/3d');

const LARGURA = 2.55;
const MEIA_LARGURA = LARGURA / 2;
const Y_BASE = 0.7;
const Y_TETO = 3.05;
const ALTURA_CORPO = Y_TETO - Y_BASE;
const Y_CENTRO = (Y_BASE + Y_TETO) / 2;
const H_INF = 0.85;
const H_FAIXA = 0.35;
const H_SUP = ALTURA_CORPO - H_INF - H_FAIXA;
const RODA_RAIO = 0.42;
const RODA_ESPESSURA = 0.36;
const RAIO_FRENTE = 0.28;

const PALETAS = {
  verde: {
    superior: 0xb4d800,
    inferior: 0x1f4d2e,
    faixa: 0xb4d800,
    sanfona: 0xc8ccd0,
    janela: 0x2a3540,
    detalhe: 0x2b2f33,
    paraBrisa: 0x1e293b,
    farol: 0xfff6c8,
    roda: 0x1a1a1a,
    cubo: 0xb0b4b8,
  },
  azul: {
    superior: 0xf4f7fa,
    inferior: 0x0c2f6e,
    faixa: 0x4aa9e8,
    sanfona: 0xc8ccd0,
    janela: 0x2a3540,
    detalhe: 0x1a1f24,
    paraBrisa: 0x1e293b,
    farol: 0xfff6c8,
    roda: 0x1a1a1a,
    cubo: 0xb0b4b8,
  },
};

function mat(color, extras = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.45,
    metalness: 0.08,
    side: THREE.DoubleSide,
    ...extras,
  });
}

function meshBox(w, h, d, x, y, z, color, group) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  group.add(m);
}

function meiaCilindroFrente(raio, xFrente, y, color, group, { escalaY = 1, largura = LARGURA, extras = {} } = {}) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(raio, raio, largura, 32, 1, false, Math.PI, Math.PI),
    mat(color, extras),
  );
  m.rotation.x = Math.PI / 2;
  m.scale.z = escalaY;
  m.position.set(xFrente + raio, y, 0);
  group.add(m);
}

function wheel(x, lado, paleta, group) {
  const zRoda = lado * MEIA_LARGURA;
  const y = RODA_RAIO;
  const tire = new THREE.Mesh(
    new THREE.CylinderGeometry(RODA_RAIO, RODA_RAIO, RODA_ESPESSURA, 20),
    mat(paleta.roda, { roughness: 0.85, metalness: 0.15 }),
  );
  tire.rotation.x = Math.PI / 2;
  tire.position.set(x, y, zRoda);
  group.add(tire);
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.17, RODA_ESPESSURA + 0.02, 12),
    mat(paleta.cubo, { roughness: 0.35, metalness: 0.55 }),
  );
  hub.rotation.x = Math.PI / 2;
  hub.position.set(x, y, zRoda);
  group.add(hub);
  const zCola = lado * (MEIA_LARGURA - 0.04);
  meshBox(RODA_RAIO * 2.3, 0.32, 0.18, x, y + RODA_RAIO * 0.55, zCola, paleta.inferior, group);
  meshBox(RODA_RAIO * 2.3, 0.45, 0.1, x, y + RODA_RAIO * 0.95, zCola, paleta.inferior, group);
}

function frenteArredondada(xFrente, paleta, group) {
  const r = RAIO_FRENTE;
  meiaCilindroFrente(r, xFrente, Y_BASE + H_INF * 0.45, paleta.inferior, group, {
    escalaY: (H_INF * 0.95) / (r * 2),
  });
  meiaCilindroFrente(r, xFrente, Y_BASE + H_INF + H_FAIXA * 0.5, paleta.faixa, group, {
    escalaY: (H_FAIXA * 1.1) / (r * 2),
  });
  meiaCilindroFrente(r, xFrente, Y_BASE + H_INF + H_FAIXA + H_SUP * 0.5, paleta.superior, group, {
    escalaY: (H_SUP * 1.05) / (r * 2),
  });
  meiaCilindroFrente(r + 0.025, xFrente - 0.01, Y_BASE + H_INF + H_FAIXA + H_SUP * 0.48, paleta.paraBrisa, group, {
    escalaY: (H_SUP * 0.62) / ((r + 0.025) * 2),
    largura: LARGURA * 0.88,
    extras: { roughness: 0.22, metalness: 0.25 },
  });
  meshBox(0.14, 0.22, 1.45, xFrente + r * 0.55, Y_TETO - 0.12, 0, paleta.detalhe, group);
  for (const z of [0.75, -0.75]) {
    const farol = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 12, 10),
      mat(paleta.farol, { roughness: 0.2, metalness: 0.35, emissive: paleta.farol, emissiveIntensity: 0.12 }),
    );
    farol.position.set(xFrente + 0.06, Y_BASE + H_INF * 0.55, z);
    group.add(farol);
  }
}

function segmento(papel, cx, comprimento, paleta, group, { portasDireita = true } = {}) {
  const recuo = papel === 'frente' ? RAIO_FRENTE : 0;
  const comp = comprimento - recuo;
  const cxCaixa = cx + recuo / 2;
  meshBox(comp, H_INF, LARGURA, cxCaixa, Y_BASE + H_INF / 2, 0, paleta.inferior, group);
  meshBox(comp, H_FAIXA, LARGURA + 0.02, cxCaixa, Y_BASE + H_INF + H_FAIXA / 2, 0, paleta.faixa, group);
  meshBox(comp, H_SUP, LARGURA, cxCaixa, Y_BASE + H_INF + H_FAIXA + H_SUP / 2, 0, paleta.superior, group);
  meshBox(comp - 0.05, 0.12, LARGURA - 0.15, cxCaixa, Y_TETO, 0, paleta.detalhe, group);
  const janelaY = Y_BASE + H_INF + H_FAIXA + H_SUP * 0.45;
  meshBox(comp * 0.72, 0.85, 0.06, cxCaixa, janelaY, MEIA_LARGURA + 0.01, paleta.janela, group);
  meshBox(comp * 0.72, 0.85, 0.06, cxCaixa, janelaY, -(MEIA_LARGURA + 0.01), paleta.janela, group);
  if (portasDireita) {
    meshBox(1.05, 1.75, 0.08, cxCaixa - comp * 0.1, Y_BASE + 1.0, MEIA_LARGURA + 0.02, paleta.detalhe, group);
  }
  if (papel === 'frente') frenteArredondada(cx - comprimento / 2, paleta, group);
  if (papel === 'traseira') {
    const xTras = cx + comprimento / 2;
    meshBox(0.1, 0.9, 2.0, xTras + 0.02, janelaY, 0, paleta.janela, group);
  }
}

function sanfona(x, paleta, group) {
  meshBox(1.0, ALTURA_CORPO, LARGURA, x, Y_CENTRO, 0, paleta.sanfona, group);
  for (let i = -4; i <= 4; i++) {
    meshBox(0.08, ALTURA_CORPO - 0.06, LARGURA + 0.08, x + i * 0.1, Y_CENTRO, 0, 0xa8adb2, group);
  }
}

function parRodas(x, paleta, group) {
  wheel(x, 1, paleta, group);
  wheel(x, -1, paleta, group);
}

function montarOnibus(tipo, paleta) {
  const root = new THREE.Group();
  if (tipo === 'articulado') {
    segmento('frente', -4.2, 7.2, paleta, root);
    sanfona(-0.35, paleta, root);
    segmento('traseira', 3.7, 7.0, paleta, root);
    parRodas(-6.4, paleta, root);
    parRodas(2.2, paleta, root);
    parRodas(5.6, paleta, root);
  } else {
    segmento('frente', -8.4, 6.4, paleta, root);
    sanfona(-4.85, paleta, root);
    segmento('meio', -1.35, 6.2, paleta, root);
    sanfona(2.1, paleta, root);
    segmento('traseira', 5.55, 6.2, paleta, root);
    parRodas(-10.3, paleta, root);
    parRodas(-1.3, paleta, root);
    parRodas(3.8, paleta, root);
    parRodas(7.4, paleta, root);
  }
  return root;
}

async function exportarGlb(scene, fileName) {
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(scene, { binary: true });
  const buf = Buffer.from(result);
  fs.writeFileSync(path.join(outDir, fileName), buf);
  console.log(`OK ${fileName} (${buf.length} bytes)`);
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  // Não sobrescreve articulado-verde.glb (Meshy biometano ~3MB).
  for (const [tipo, cor] of [
    ['articulado', 'azul'],
    ['biarticulado', 'verde'],
    ['biarticulado', 'azul'],
  ]) {
    const scene = new THREE.Scene();
    scene.add(montarOnibus(tipo, PALETAS[cor]));
    await exportarGlb(scene, `${tipo}-${cor}.glb`);
  }
}

await main();
