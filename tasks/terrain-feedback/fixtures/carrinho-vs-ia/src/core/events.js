// Barramento de eventos: quem emite não precisa conhecer quem escuta.
//
// Eventos usados no jogo:
//   'coin:collected'  { vehicle, value }
//   'vehicle:crash'   { vehicle }
//   'match:start'     { round }
//   'match:end'       { scores }
//   'weather:change'  { profile }

export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  // Retorna uma função que remove o listener (útil para limpeza ao reiniciar)
  on(name, fn) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(fn);
    return () => this.listeners.get(name)?.delete(fn);
  }

  emit(name, payload) {
    this.listeners.get(name)?.forEach((fn) => fn(payload));
  }

  clear() {
    this.listeners.clear();
  }
}
