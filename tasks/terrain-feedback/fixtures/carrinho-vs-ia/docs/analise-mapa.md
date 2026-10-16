# Análise do design do mapa

Medido com `npm run analise` (mapa de 600 m, 8 partidas de 210 s por motorista). Imagem: `mapa-analise.png`. Valores de antes: `analise-antes.json`.

## Como o mapa funciona (estrutura)

| Peça | Dado | Consequência para o jogo |
|---|---|---|
| Estrada | 934 m, volta em 36 s a 94 km/h, 7,6 m de largura | 2,1% da área do mapa |
| Trilho em "8" | 1233 m, cruza a estrada 4 vezes | cada cruzamento fica bloqueado ~5,8% do tempo (3,6 s por passagem, ~1 passagem/min) |
| Faixa de moedas antiga | ±18 m da estrada | 7,6% da área. Os outros 90% do mapa (interior 15%, exterior 75%) não tinham motivo para existir |
| Relevo | morros de até 27 m, estrada ≤ 9% de inclinação | bonito, mas jogado fora: ninguém precisava sair da pista |

## Problemas achados e o que mudou

| # | Achado | Evidência | Mudança |
|---|---|---|---|
| 1 | Moedas só perto da estrada | 100% a ≤18 m; só 19% na pista | Zonas por peso: estrada 50%, perto do trilho 20%, encosta 15%, campo aberto 15%. Agora 49% nascem a mais de 18 m |
| 2 | Risco não pagava | valor dependia só da superfície | Valor 1 a 4; perto do trilho e encosta valem +1. Cores: dourada 1, laranja 2, azul 3, roxa 4 |
| 3 | Trem sem aviso | "nenhum" | Sinais piscam 6 s antes, alerta no HUD, vibração por proximidade, IA freia antes do cruzamento |
| 4 | Trem não era constante | avançava ângulo: ~20 a 27 m/s | Anda por distância real: 20,0 m/s em todo o trilho |
| 5 | Poste na pista | folga −0,55 m: carro na borda do asfalto batia no poste | Postes 2,3 m mais afastados: folga +0,55 m |
| 6 | Batida travava | ×0,4 da velocidade a cada quadro | Desliza; só perde a velocidade que entra no obstáculo |
| 7 | Moeda nascia em cima do carro | sem regra | `minFromVehicle` 30 m; escolhe o melhor de 14 candidatos |
| 8 | IA ignorava obstáculos | travava em árvores | Desvia, abandona moeda que a prende, ré cada vez mais longa |

## IA antes e depois (3 min, jogador parado)

| | Antes | Depois |
|---|---|---|
| Quem só segue a estrada | 9,9 moedas | 19,5 moedas |
| IA | 58,6 moedas, 115 pontos | 29,1 moedas, 46 pontos |
| Moedas pegas fora da estrada | 82% | 28% |

A IA caiu de propósito: com as moedas espalhadas pelo mapa todo, uma moeda leva ~7 s em vez de ~3 s. **Não há dado de jogador humano**; o equilíbrio (nível `normal` = 0,85 e elástico) precisa ser ajustado jogando. `CONFIG.ai.levels` e `coinSight` são os botões.

## Limites da análise

- O jogador é simulado parado ou como "segue a estrada"; não há medida de gente jogando.
- Visibilidade medida pelo relevo e pelo feixe de luz, não por renderização.
- A vibração e o controle real não foram testados em hardware (só com um controle falso no navegador).
