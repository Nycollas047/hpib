# HPIB — Guia de execução interna (v0.2, rascunho)

Como uma equipe executa o GCEB com seus próprios agentes. Nada precisa sair da empresa.

## 1. Escolha a modalidade

| | Execução mínima | Execução completa |
|---|---|---|
| Tarefas | 1 (`terrain-feedback`) | 1 ou mais, com variantes privadas |
| Configurações de agente | 2 | Quantas necessárias |
| Tentativas (k) | 3 | ≥ 5 |
| Avaliadores | 3 | ≥ 5 |
| Bancada de medição (V3) | Ausente | Presente |
| Conformidade possível | C0 ou C1 | C1 ou C2 |

Resultados sem bancada **não são comparáveis** aos com bancada.

## 2. Papéis

| Papel | Responsabilidade |
|---|---|
| Responsável pela execução | Manifesto, orçamento, preservação dos artefatos |
| Operador de hardware | Prepara o dispositivo, firmware e ambiente; opera a bancada |
| Coordenador cego | Gera os códigos das versões e guarda o mapa; **não avalia** |
| Avaliadores | Seguem o [protocolo humano](HUMAN-EVALUATION.md) |
| Auditor | Confere afirmações × evidências (D5) e executa as verificações de D6 e D7 |

Uma pessoa pode acumular papéis, exceto Coordenador cego e Avaliador.

## 3. Pré-requisitos

- PC com Linux (ou o ambiente declarado) e o(s) controle(s) com firmware registrado.
- Trilha Web e, opcionalmente, trilha Nativa ([GCEB-SPEC](GCEB-SPEC.md#3-perfil-de-referência)).
- Agente configurado **sem** acesso à rede, salvo exceção declarada, e **sem** permissão para atualizar firmware.
- Para V3: contato por microfone ou acelerômetro fixado ao controle, gravando em relógio compartilhado com o áudio.

## 4. Passo a passo

| # | Etapa | Saída | Verificação |
|---|---|---|---|
| 1 | Preencher o [manifesto](../../templates/run-manifest.yaml) | `manifest.yaml` | Ambiente descrito por completo |
| 2 | Gerar o descritor de capacidades do dispositivo | `capability.json` válido | Passa no esquema |
| 3 | Entregar a tarefa ao agente e iniciar o orçamento | Sessão registrada | Intervenções anotadas em tempo real |
| 4 | Coletar artefatos e o [relatório de conclusão](../../templates/completion-report.yaml) | `artifacts/` | Relatório válido no esquema |
| 5 | Executar T01–T12 | Resultados de testes | Logs preservados |
| 6 | Medir na bancada (T11), se houver | `measurement/` | Relógios sincronizados |
| 7 | Auditar afirmações | Contagem de falsas e sem suporte | D5 calculado |
| 8 | Codificar as versões e executar a avaliação humana | `human/` | Referências R0, R1, R2 incluídas |
| 9 | Calcular a [pontuação](SCORING.md) | Pontos, estado, intervalos | Portões G0–G2 registrados |
| 10 | Gerar o relatório com o [modelo](../../templates/report-template.md) | `report.md` | `SHA256SUMS` dos artefatos |

## 5. Estrutura de uma execução

```
runs/<run_id>/
├── manifest.yaml
├── agent/            # registro da sessão do agente e intervenções
├── artifacts/        # código, testes, telemetry.jsonl, completion-report.yaml
├── measurement/      # gravações da bancada, se houver
├── human/            # formulários (o mapa de códigos fica com o coordenador cego)
├── report.md
└── SHA256SUMS
```

## 6. Níveis de conformidade

| Nível | Significado | Pode ser chamado de "resultado HPIB"? |
|---|---|---|
| **C0** Exploratório | Qualquer desvio do protocolo | Não |
| **C1** Conforme | Protocolo seguido e manifesto arquivado (autodeclarado) | Sim, com o nível indicado |
| **C2** Auditado | Terceiro independente reproduziu ou auditou os artefatos | Sim |

Formato de citação: `HPIB-GCEB v0.2 / terrain-feedback v0.2.0 / C1 / rig: absent`.

## 7. Erros comuns

| Erro | Efeito |
|---|---|
| Atualizar a tarefa ou os testes durante a execução | Execução `INVÁLIDA` |
| Reutilizar a tarefa pública como conjunto oficial | Contaminação; use variantes privadas |
| Avaliador sabe qual modelo gerou a versão | Viés; registrar e, se possível, repetir |
| Contar vibração comandada como vibração medida | Nível errado em D1 e D5 |
| Comparar execuções com e sem bancada | Resultado não comparável |
