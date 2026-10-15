# HPIB — Protocolo de avaliação humana (v0.2, proposta)

A avaliação humana mede a **experiência** (nível V4). Ela ocorre depois dos testes técnicos e antes da consolidação. Tamanhos de painel, durações e limiares são provisórios e serão calibrados no piloto.

## 1. Desenho

| Elemento | Proposta |
|---|---|
| Painel | ≥ 5 avaliadores, todos avaliam todas as versões |
| Ordem | Balanceada entre avaliadores (quadrado latino ou equivalente) |
| Repetições | 2 por cenário |
| Versões de referência | R0 sem háptica · R1 vibração constante · R2 implementação manual de referência, misturadas às versões testadas |
| Sessão | Pausas regulares; duração máxima definida no piloto |

## 2. Cegamento

- Versões identificadas por códigos aleatórios (`B-7F3A`); quem gera o mapa código→modelo (o **coordenador cego**) não avalia.
- Remover textos de interface que revelem o modelo.
- Avaliadores não veem conversas de desenvolvimento antes de concluir.
- Ao final, cada avaliador tenta adivinhar a origem de cada versão. A taxa de acerto é registrada como medida do vazamento de identidade.

## 3. Critérios (escala de 1 a 5, com âncoras)

| ID | Critério | 1 | 3 | 5 |
|---|---|---|---|---|
| C1 | Correspondência evento–sensação | Sensação sem relação ou contraditória | Reconhecível em alguns eventos | Todo evento tem a sensação que representa |
| C2 | Distinção entre padrões | Indistinguíveis | Alguns distinguíveis, com esforço | Todos distinguíveis sem esforço |
| C3 | Sincronização áudio–háptica | Claramente fora de sincronia | Perceptível, mas tolerável | Percebida como um único evento |
| C4 | Naturalidade | Artificial ou confusa | Aceitável | Parece parte do mundo simulado |
| C5 | Conforto | Desagradável ou incômoda | Confortável por pouco tempo | Confortável durante toda a sessão |
| C6 | Consistência entre repetições | Cada repetição diferente | Parcialmente consistente | Idêntica de forma perceptível |
| C7 | Facilidade de uso e configuração | Não consegue ajustar ou desativar | Consegue com ajuda | Ajusta e desativa sem esforço |

Cada resposta inclui o campo `discomfort_flag`. Marcar desconforto interrompe a sessão do avaliador (ver [SAFETY-AND-ETHICS](SAFETY-AND-ETHICS.md)).

## 4. Teste de identificação às cegas (H-ID)

Mede a distinção de padrões de forma objetiva.

1. O avaliador segura o controle com a tela desligada e o áudio mascarado.
2. Os padrões das cinco superfícies são reproduzidos em ordem aleatória, três vezes cada.
3. Para cada um, ele escolhe a superfície.

Acaso = 20%. Reporta-se a acurácia e a matriz de confusão por versão.

## 5. Confiabilidade e validade

| Verificação | Regra |
|---|---|
| Concordância | α de Krippendorff (ordinal) por critério. ≥ 0,800 confiável; entre 0,667 e 0,800 provisório; < 0,667 inconclusivo |
| Validade do protocolo | O painel deve ordenar R2 > R1 > R0. Se não conseguir, a sessão é inválida |
| Vazamento de identidade | Taxa de acerto de origem registrada (§2) |

## 6. Agregação

Média dos critérios por avaliador e repetição, depois média entre avaliadores. `s2 = (média − 1) / 4` ([SCORING](SCORING.md#d2--experiência-humana)). Reportar também a mediana e a dispersão por avaliador.

## 7. Registro

Use [`templates/human-eval-form.csv`](../../templates/human-eval-form.csv): `session_id`, `rater_id`, `build_code`, `scenario_id`, `repetition`, `criterion_id`, `score_1_5`, `discomfort_flag`, `comment`. Dados pessoais mínimos e pseudonimizados.
