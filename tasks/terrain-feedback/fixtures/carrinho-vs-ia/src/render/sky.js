// Céu em gradiente (Three.js). Uma cúpula que acompanha a câmera.
// A cor do horizonte é a mesma da neblina, então o céu e o fundo se fundem sem emenda.
import * as THREE from 'three';

export class Sky {
  constructor(scene) {
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color() },
        horizon: { value: new THREE.Color() },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 top;
        uniform vec3 horizon;
        varying vec3 vDir;
        void main() {
          float t = smoothstep(0.0, 0.55, vDir.y);
          gl_FragColor = vec4(mix(horizon, top, t), 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(600, 24, 16), mat);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  setColors(top, horizon) {
    this.mesh.material.uniforms.top.value.setHex(top);
    this.mesh.material.uniforms.horizon.value.setHex(horizon);
  }

  follow(position) {
    this.mesh.position.copy(position);
  }
}
