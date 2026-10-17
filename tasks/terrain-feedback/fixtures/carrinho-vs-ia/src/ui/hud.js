// Interface (DOM). LÃª o estado da partida e mostra. NÃ£o altera nada do jogo.
import { SURFACES } from '../core/config.js';

export class Hud {
  constructor(doc = document) {
    this.doc = doc;
    const $ = (id) => doc.getElementById(id);
    this.el = {
      time: $('time'),
      scorePlayer: $('score-player'),
      scoreAi: $('score-ai'),
      round: $('round'),
      weather: $('weather'),
      surface: $('surface'),
      speed: $('speed'),
      banner: $('banner-text'),
      start: $('start'),
      debug: $('debug'),
      help: $('help'),
      warn: $('warn'),
      arrow: $('arrow'),
      arrowIcon: $('arrow-icon'),
      arrowText: $('arrow-text'),
      reset: $('reset-hint'),
    };
  }

  update(match, player) {
    const secs = Math.max(0, Math.ceil(match.timeLeft));
    const mm = Math.floor(secs / 60);
    const ss = String(secs % 60).padStart(2, '0');

    this.el.time.textContent = `${mm}:${ss}`;
    this.el.scorePlayer.textContent = match.scores.player;
    this.el.scoreAi.textContent = match.scores.ai;
    this.el.round.textContent = match.round;
    this.el.weather.textContent = match.weather.label;
    this.el.surface.textContent = SURFACES[player.surface].label;
    this.el.speed.textContent = Math.round(Math.abs(player.speed) * 3.6);
    this.el.banner.textContent = this._bannerText(match);
    if (this.el.reset) {
      const cd = Math.ceil(player.resetCooldown);
      this.el.reset.textContent = cd > 0 ? `voltar Ã  pista: ${cd} s` : 'voltar Ã  pista: pronto (TriÃ¢ngulo / R)';
      this.el.reset.style.opacity = cd > 0 ? 0.5 : 0.9;
    }
  }

  // Aviso de trem: texto ou null para esconder
  setWarning(text, urgent = false) {
    if (!this.el.warn) return;
    this.el.warn.style.display = text ? 'block' : 'none';
    if (text) {
      this.el.warn.textContent = text;
      this.el.warn.style.background = urgent ? 'rgba(200,30,30,0.85)' : 'rgba(210,140,20,0.85)';
    }
  }

  // Seta para a melhor moeda. angle em radianos: 0 = em frente, positivo = direita.
  setArrow(info) {
    if (!this.el.arrow) return;
    if (!info) {
      this.el.arrow.style.display = 'none';
      return;
    }
    this.el.arrow.style.display = 'flex';
    this.el.arrowIcon.style.transform = `rotate(${info.angle}rad)`;
    this.el.arrowIcon.style.color = info.color;
    this.el.arrowText.textContent = `${Math.round(info.dist)} m Â· vale ${info.value}`;
  }

  _bannerText(match) {
    if (match.state === 'ready') return '';
    if (match.state === 'paused') return 'Pausado\nOptions, Enter ou P para continuar';
    if (match.state === 'ended') {
      const { player, ai } = match.scores;
      const result = player === ai ? 'Empate!' : player > ai ? 'VocÃª venceu!' : 'A IA venceu!';
      return `${result} ${player} Ã— ${ai}\nEnter ou Options para a prÃ³xima rodada`;
    }
    return '';
  }

  hideStart() {
    if (this.el.start) this.el.start.style.display = 'none';
  }

  showStart(buttonText = 'Começar') {
    if (!this.el.start) return;
    this.el.start.style.display = 'flex';
    const button = this.doc.getElementById('start-btn');
    if (button) button.textContent = buttonText;
  }

  toggleDebug() {
    if (!this.el.debug) return;
    this.el.debug.style.display = this.el.debug.style.display === 'block' ? 'none' : 'block';
  }

  setDebug(text) {
    if (this.el.debug && this.el.debug.style.display === 'block') this.el.debug.textContent = text;
  }
}


