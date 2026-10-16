// Monta as malhas visuais em Node (sem navegador) e checa se não há valores inválidos.
// Atualizado para a API atual dos módulos render/*.
import { CONFIG } from '../src/core/config.js';
import { createRng } from '../src/core/random.js';
import { Terrain } from '../src/world/terrain.js';
import { Props } from '../src/world/props.js';
import { Train } from '../src/world/train.js';
import { CoinField } from '../src/world/coins.js';
import { buildTerrainMesh, buildApron } from '../src/render/terrainView.js';
import { buildRoadGroup, buildRailGroup } from '../src/render/trackView.js';
import { buildProps } from '../src/render/propsView.js';
import { buildVehicleMesh, syncVehicleMesh } from '../src/render/vehicleView.js';
import { buildTrainMeshes, syncTrainMeshes } from '../src/render/trainView.js';
import { buildDelineators, buildSignals } from '../src/render/roadsideView.js';
import { Vehicle } from '../src/vehicles/vehicle.js';

const t0 = Date.now();
const terrain = new Terrain(CONFIG.seed);
const props = new Props(terrain);
props.generate(createRng(CONFIG.seed + 1));
const train = new Train(terrain);

const bad = (obj) => {
  let n = 0;
  obj.traverse((o) => {
    const pos = o.geometry?.attributes?.position;
    if (pos) for (const v of pos.array) if (!Number.isFinite(v)) n++;
    if (o.isInstancedMesh) for (const v of o.instanceMatrix.array) if (!Number.isFinite(v)) n++;
  });
  return n;
};

const parts = {
  terreno: buildTerrainMesh(terrain),
  base: buildApron(),
  estrada: buildRoadGroup(terrain),
  trilho: buildRailGroup(terrain),
  props: buildProps(props, terrain),
  balizas: buildDelineators(terrain),
  sinais: buildSignals(terrain, train.crossings).group,
  carro: buildVehicleMesh(0xff0000),
};
const trainView = buildTrainMeshes();
syncTrainMeshes(trainView, train.getCars());
parts.trem = trainView.group;

// O carro posicionado também não pode gerar matriz inválida
const car = new Vehicle({ id: 'p', terrain, driver: { controls: () => ({ throttle: 1, brake: 0, steer: 0.3, handbrake: false }) } });
car.place(terrain.roadPoint(0).x, terrain.roadPoint(0).z, 0);
for (let i = 0; i < 120; i++) car.update(1 / 60, { grip: 1 });
syncVehicleMesh(parts.carro, car);

const invalid = Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, bad(v)]));
const report = {
  segundos: (Date.now() - t0) / 1000,
  vertices: parts.terreno.geometry.attributes.position.count,
  balizas: parts.balizas.children[0].count,
  sinais: train.crossings.length,
  vagoes: trainView.cars.length,
  invalidos: invalid,
};
console.log(JSON.stringify(report, null, 2));
if (Object.values(invalid).some((n) => n !== 0)) process.exit(1);
