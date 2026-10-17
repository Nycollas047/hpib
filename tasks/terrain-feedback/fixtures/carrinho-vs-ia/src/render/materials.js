// Materiais compartilhados. Faróis e postes usam o mesmo material,
// então acender tudo à noite é uma única mudança.
import * as THREE from 'three';

export const lampMaterial = new THREE.MeshLambertMaterial({
  color: 0xfff1c4,
  emissive: 0xffc860,
  emissiveIntensity: 0.1,
});

export function setNightLights(on) {
  lampMaterial.emissiveIntensity = on ? 2.2 : 0.1;
}
