/* =====================================================================
   DJ Rui Teixeira — biolink
   O que este ficheiro faz:
   1. Põe o ano no rodapé.
   2. Cria as barras do equalizador.
   3. Faz os discos de vinil rodarem (33 ou 45 rpm), com arranque e
      travagem suaves como num gira-discos a sério.
   4. Deixa "agarrar" o disco do topo e fazer scratch (com som, que se pode desligar).
   ===================================================================== */
(function () {
  'use strict';

  var reduzMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 1. Ano do rodapé ---------- */
  var ano = document.getElementById('ano');
  if (ano) ano.textContent = new Date().getFullYear();

  /* ---------- 2. Equalizador (só decoração) ---------- */
  var eq = document.getElementById('eq');
  if (eq) {
    for (var i = 0; i < 24; i++) {
      var barra = document.createElement('i');
      barra.style.setProperty('--t', (0.5 + Math.random() * 0.9).toFixed(2) + 's');   // velocidade
      barra.style.setProperty('--d', (-Math.random() * 1.5).toFixed(2) + 's');         // arranque desfasado
      barra.style.setProperty('--m', (0.3 + Math.random() * 0.7).toFixed(2));          // altura máxima
      eq.appendChild(barra);
    }
  }

  /* ---------- 3. Discos a rodar ---------- */
  // Cada "gira" é a camada que roda (etiqueta e riscos). O data-gira diz a que
  // fração da velocidade roda: o disco do topo a 100%, os do fundo mais devagar
  // para não distraírem de quem está a ler.
  var discos = Array.prototype.map.call(document.querySelectorAll('[data-gira]'), function (el) {
    return {
      el: el,
      angulo: Math.random() * 360,
      fator: parseFloat(el.getAttribute('data-gira')) || 1,
      hero: el.hasAttribute('data-hero')
    };
  });
  var hero = discos.filter(function (d) { return d.hero; })[0];

  var rpm = 33.333;        // 33 ou 45 rotações por minuto
  var aTocar = false;
  var velocidade = 0;      // graus por segundo (aumenta/diminui devagar)
  var aArrastar = false;
  var aCorrer = false;     // o ciclo de animação está ativo?
  var anterior = 0;

  function desenhar(d) {
    d.el.style.transform = 'rotate(' + d.angulo.toFixed(2) + 'deg)';
  }

  function ciclo(agora) {
    var dt = Math.min((agora - anterior) / 1000, 0.05);
    anterior = agora;

    var alvo = aTocar ? rpm * 6 : 0;                 // 1 rpm = 6 graus por segundo
    var tau = aTocar ? 0.7 : 1.7;                    // a travagem é mais lenta que o arranque
    velocidade += (alvo - velocidade) * (1 - Math.exp(-dt / tau));
    if (!aTocar && velocidade < 0.3) velocidade = 0;

    discos.forEach(function (d) {
      if (d.hero && aArrastar) return;               // com a mão no disco, ele não roda sozinho
      d.angulo += velocidade * d.fator * dt;
      desenhar(d);
    });

    if (velocidade === 0 && !aTocar && !aArrastar) { aCorrer = false; return; }   // parado: poupa bateria
    requestAnimationFrame(ciclo);
  }

  function acordar() {
    if (aCorrer) return;
    aCorrer = true;
    anterior = performance.now();
    requestAnimationFrame(ciclo);
  }

  discos.forEach(desenhar);

  /* ---------- Botões: tocar/parar e 33/45 ---------- */
  var deck = document.getElementById('deck');
  var btnTocar = document.getElementById('btnTocar');

  function definirTocar(valor) {
    aTocar = valor;
    deck.classList.toggle('is-a-tocar', valor);       // o braço poisa ou levanta
    document.body.classList.toggle('a-tocar', valor); // o equalizador mexe
    btnTocar.setAttribute('aria-pressed', valor ? 'true' : 'false');
    acordar();
  }
  btnTocar.addEventListener('click', function () { definirTocar(!aTocar); });

  var botoesRpm = document.querySelectorAll('[data-rpm]');
  Array.prototype.forEach.call(botoesRpm, function (b) {
    b.addEventListener('click', function () {
      rpm = parseFloat(b.getAttribute('data-rpm'));
      Array.prototype.forEach.call(botoesRpm, function (o) {
        o.setAttribute('aria-pressed', o === b ? 'true' : 'false');
      });
      if (!aTocar) definirTocar(true);                // escolher a velocidade põe o disco a tocar
      acordar();
    });
  });

  // Ao abrir, o braço poisa sozinho no disco (a menos que a pessoa prefira menos movimento)
  if (!reduzMovimento) setTimeout(function () { definirTocar(true); }, 900);

  /* ---------- 4. Scratch: agarrar e rodar o disco do topo ---------- */
  var discoHero = document.getElementById('discoHero');
  var idPonteiro = null;
  var ultimoAngulo = 0;

  /* ---------- Som do scratch (gerado no browser, não há ficheiros de áudio) ----------
     Um ruído + um tom que sobem de volume e de "agudo" quanto mais depressa se roda o disco.
     Só toca enquanto a pessoa está a mexer no disco. */
  var somLigado = true;
  var audio = null;

  function prepararAudio() {
    if (!somLigado) return null;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      if (!audio) {
        var ctx = new AC();
        var n = ctx.sampleRate * 2;
        var buf = ctx.createBuffer(1, n, ctx.sampleRate);
        var dados = buf.getChannelData(0);
        for (var k = 0; k < n; k++) dados[k] = Math.random() * 2 - 1;

        var ruido = ctx.createBufferSource();
        ruido.buffer = buf; ruido.loop = true;
        var filtroRuido = ctx.createBiquadFilter();
        filtroRuido.type = 'bandpass'; filtroRuido.Q.value = 0.9; filtroRuido.frequency.value = 2000;
        var gRuido = ctx.createGain(); gRuido.gain.value = 0.55;

        var osc = ctx.createOscillator();
        osc.type = 'sawtooth'; osc.frequency.value = 90;
        var filtroTom = ctx.createBiquadFilter();
        filtroTom.type = 'lowpass'; filtroTom.frequency.value = 1500;
        var gTom = ctx.createGain(); gTom.gain.value = 0.5;

        var mestre = ctx.createGain(); mestre.gain.value = 0;
        ruido.connect(filtroRuido); filtroRuido.connect(gRuido); gRuido.connect(mestre);
        osc.connect(filtroTom); filtroTom.connect(gTom); gTom.connect(mestre);
        mestre.connect(ctx.destination);
        ruido.start(); osc.start();
        audio = { ctx: ctx, mestre: mestre, filtroRuido: filtroRuido, osc: osc };
      }
      if (audio.ctx.state === 'suspended') audio.ctx.resume();   // tem de acontecer num toque/clique
    } catch (_) { audio = null; }
    return audio;
  }

  // v = velocidade do disco em graus por segundo (sempre positiva)
  function tocarSom(v) {
    if (!audio) return;
    var t = audio.ctx.currentTime;
    var f = Math.min(v / 700, 1);
    audio.mestre.gain.setTargetAtTime(f * 0.22, t, 0.02);
    audio.osc.frequency.setTargetAtTime(60 + v * 0.45, t, 0.03);
    audio.filtroRuido.frequency.setTargetAtTime(1200 + v * 3, t, 0.03);
  }

  var btnSom = document.getElementById('btnSom');
  btnSom.addEventListener('click', function () {
    somLigado = !somLigado;
    btnSom.setAttribute('aria-pressed', somLigado ? 'true' : 'false');
    if (!somLigado) tocarSom(0);
  });

  // Mede a velocidade a que se roda o disco, enquanto está agarrado
  var grausDesdeUltimo = 0;
  var tempoUltimo = 0;
  var velocidadeMao = 0;
  function medirMao(agora) {
    if (!aArrastar) { tocarSom(0); return; }
    var dt = Math.max((agora - tempoUltimo) / 1000, 0.001);
    var instantanea = grausDesdeUltimo / dt;
    velocidadeMao += (instantanea - velocidadeMao) * 0.35;   // suaviza
    grausDesdeUltimo = 0;
    tempoUltimo = agora;
    tocarSom(velocidadeMao);
    requestAnimationFrame(medirMao);
  }

  function anguloDoPonteiro(e) {
    var r = discoHero.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
  }

  discoHero.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    idPonteiro = e.pointerId;
    try { discoHero.setPointerCapture(idPonteiro); } catch (_) { /* sem captura: continua a funcionar */ }
    ultimoAngulo = anguloDoPonteiro(e);
    aArrastar = true;
    discoHero.classList.add('a-agarrar');
    document.body.classList.add('ja-agarrou');
    prepararAudio();
    grausDesdeUltimo = 0; velocidadeMao = 0; tempoUltimo = performance.now();
    requestAnimationFrame(medirMao);
    acordar();
  });

  discoHero.addEventListener('pointermove', function (e) {
    if (!aArrastar || e.pointerId !== idPonteiro) return;
    var a = anguloDoPonteiro(e);
    var delta = a - ultimoAngulo;
    if (delta > 180) delta -= 360;       // passou do -180 para o 180 (ou ao contrário)
    if (delta < -180) delta += 360;
    hero.angulo += delta;
    grausDesdeUltimo += Math.abs(delta);
    ultimoAngulo = a;
    desenhar(hero);
  });

  function largar(e) {
    if (e.pointerId !== idPonteiro) return;
    aArrastar = false;
    idPonteiro = null;
    discoHero.classList.remove('a-agarrar');
    acordar();
  }
  discoHero.addEventListener('pointerup', largar);
  discoHero.addEventListener('pointercancel', largar);
})();
