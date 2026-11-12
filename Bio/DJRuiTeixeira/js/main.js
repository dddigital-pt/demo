/* =====================================================================
   DJ Rui Teixeira — biolink
   O que este ficheiro faz:
   1. Põe o ano no rodapé.
   2. Cria as barras do equalizador.
   3. Faz os discos de vinil rodarem (33 ou 45 rpm), com arranque e
      travagem suaves como num gira-discos a sério.
   4. Deixa "agarrar" o disco do topo e fazer scratch.
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
    acordar();
  });

  discoHero.addEventListener('pointermove', function (e) {
    if (!aArrastar || e.pointerId !== idPonteiro) return;
    var a = anguloDoPonteiro(e);
    var delta = a - ultimoAngulo;
    if (delta > 180) delta -= 360;       // passou do -180 para o 180 (ou ao contrário)
    if (delta < -180) delta += 360;
    hero.angulo += delta;
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
