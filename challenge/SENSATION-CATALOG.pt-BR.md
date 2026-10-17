# HPIB-S — Catálogo de sensações (v0.1, rascunho)

[English](SENSATION-CATALOG.md) · **Português (Brasil)**

Parte do [Desafio de Sensações](README.pt-BR.md). Cada entrada traz um **alvo perceptivo** (o que a pessoa deve sentir, em palavras simples), o **evento** que a dispara, a **capacidade mínima** necessária e o **teste humano** que a julga. As entradas são propostas para serem criticadas e calibradas em um piloto.

## Como ler uma entrada

| Campo | Significado |
|---|---|
| ID | `S-<nível><nn>`, estável entre versões |
| Alvo perceptivo | O que o avaliador deve reconhecer, e não como construir |
| Evento | O evento da simulação que a dispara (ver os [eventos da tarefa](../tasks/terrain-feedback/task.yaml)) |
| Exige | Capacidade da [lista de capacidades](../docs/pt-BR/HARDWARE-COMPATIBILITY.md): `rumble`, `adaptive_triggers`, `imu`, `touchpad`, `trackpad_haptics` |
| Teste | Identificação cega `H-ID`, critérios `C1`–`C7` e veredito da afirmação, de [HUMAN-EVALUATION](../docs/pt-BR/HUMAN-EVALUATION.md) |

## Nível 1 — Superfícies

Ids estáveis das superfícies, como na tarefa: `asphalt`, `grass`, `sand`, `gravel`, `metal`.

| ID | Sensação | Alvo perceptivo | Evento | Exige | Teste |
|---|---|---|---|---|---|
| S-101 | Asfalto | Firme, fina, constante e de baixa intensidade | `surface_entered` | rumble | H-ID, C2 |
| S-102 | Grama | Macia e amortecida, um pouco irregular | `surface_entered` | rumble | H-ID, C2 |
| S-103 | Areia | Fina e granulada, com sensação de arrasto | `surface_entered` | rumble | H-ID, C2 |
| S-104 | Cascalho | Grossa e áspera, com pequenos golpes separados | `surface_entered` | rumble | H-ID, C2 |
| S-105 | Metal | Dura e brilhante, de caráter mais agudo | `surface_entered` | rumble | H-ID, C2 |

## Nível 2 — Impactos e eventos pontuais

| ID | Sensação | Alvo perceptivo | Evento | Exige | Teste |
|---|---|---|---|---|---|
| S-201 | Batida leve | Curta e suave, claramente mais fraca que uma colisão | `collision` (baixa) | rumble | Afirmação, C1 |
| S-202 | Colisão forte | Um impulso forte que some rápido | `collision` (alta) | rumble | Afirmação, C1 |
| S-203 | Coleta / recompensa | Curta, brilhante e agradável, proporcional ao valor | coleta | rumble | Afirmação, C1, C5 |
| S-204 | Faixa de ruído | Pulsos regulares cuja taxa acompanha a velocidade | `surface_entered` | rumble | Afirmação, C1 |
| S-205 | Aterrissagem | Um único impacto depois de um instante sem nada | `surface_entered` após tempo no ar | rumble | Afirmação, C1 |
| S-206 | Parada brusca | Um pulso curto que encerra a sensação em curso | `vehicle_stopped` | rumble | Afirmação, C1 |

## Nível 3 — Estados contínuos

| ID | Sensação | Alvo perceptivo | Evento | Exige | Teste |
|---|---|---|---|---|---|
| S-301 | Motor | Sobe suavemente com a velocidade, sem saltos bruscos | `speed_changed` | rumble | C4, C5 |
| S-302 | Perda de aderência | Mudança de caráter que o jogador lê como derrapagem | estado de derrapagem | rumble | C1, C4 |
| S-303 | Pista molhada | Textura sutil e mais fina por cima da superfície | estado do clima | rumble | C4, C5 |
| S-304 | Pressão do freio | Resistência que cresce conforme o freio é pressionado | entrada de freio | adaptive_triggers | C1, C4 |
| S-305 | Alta velocidade | Zumbido leve e constante que cresce com a velocidade sem cansar | `speed_changed` | rumble | C4, C5 |

## Nível 4 — Cues narrativos

| ID | Sensação | Alvo perceptivo | Evento | Exige | Teste |
|---|---|---|---|---|---|
| S-401 | Perigo se aproximando | Urgência que sobe conforme o perigo chega perto | distância do perigo | rumble | C1 |
| S-402 | Sucesso | Padrão curto e crescente, satisfatório e sem susto | rodada vencida | rumble | C1, C5 |
| S-403 | Pulso de alerta | Claro, repetido e ainda confortável durante a sessão toda | estado de pouco recurso | rumble | C1, C5 |
| S-404 | Calma | Quase nada, para que os outros cues se destaquem | parado | rumble | C4 |

## Nível 5 — Portabilidade

| ID | Sensação | Alvo perceptivo | Exige | Teste |
|---|---|---|---|---|
| S-501 | As mesmas sensações em uma segunda classe de dispositivo | S-101 a S-203 continuam reconhecíveis em outro controle, ainda que reduzidas | as capacidades do segundo dispositivo | H-ID, afirmação |

## Notas de segurança

- Manter todo padrão dentro dos limites documentados do atuador e interrompível a qualquer momento.
- S-403 e S-401 se repetem de propósito. Mantê-los confortáveis durante a sessão toda e permitir que o avaliador sinalize desconforto (C5, `discomfort_flag`).
- Nunca depender só de uma sensação para transmitir informação de segurança; oferecer um aviso visual ou sonoro equivalente.
