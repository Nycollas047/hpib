# HPIB — Roadmap e decisões (v0.2)

Unifica o plano em fases do documento de concepção e as etapas da especificação GCEB v0.1, que antes divergiam.

## Fases

| Fase | Foco | Entregas | Depende de |
|---|---|---|---|
| **0** | Especificação (este repositório) | Documentos, tarefa, esquemas, modelos | — |
| **1** | Fundação e *spike* | Verificar H1–H6; escolher trilha e dispositivo de referência; protótipo da bancada V3; ferramenta de diagnóstico | 0 |
| **2** | Aplicação de referência | App do Terrain Feedback Challenge; harness T01–T12; telemetria validada | 1 |
| **3** | Piloto humano | Executar o protocolo; calibrar pesos, limiares e tolerâncias | 2 |
| **4** | Primeiro experimento comparativo | Mesma tarefa em várias configurações; k ≥ 5; relatório C1 | 3 |
| **5** | *Modding* | Desafios com jogos existentes; comparar áudio reativo e eventos semânticos | 4 |
| **6** | Ecossistema Linux | Adaptadores para mais dispositivos; matriz de distribuições e bibliotecas | 4 |
| *Exploratório* | Robótica; pesquisa aplicada e médica | Grupos de trabalho com especialistas; protocolos próprios | 4 |

Para *modding* (fase 5), duas estratégias complementares e nenhuma presumida superior: **áudio reativo** (analisa o áudio do sistema, funciona sem acesso aos eventos do jogo) e **eventos semânticos** (colisão, terreno, derrapagem; mais preciso, exige interface de *mod*). O relatório identifica qual foi usada. Jogos candidatos com interface de *mod* aberta serão avaliados na fase 5.

## Decisões propostas

Respostas iniciais para as questões em aberto da v0.1. Status: **Proposta** (a confirmar pelo autor) ou **Aberta**.

| ID | Questão | Proposta | Status |
|---|---|---|---|
| D-01 | Licença | Apache-2.0 para código e esquemas; CC BY 4.0 para documentos e tarefas | Aberta |
| D-02 | Governança | Mantenedor único no início; mudanças por RFC em *issues*; comitê quando houver ≥ 3 mantenedores externos | Proposta |
| D-03 | Tecnologia | Trilha Web obrigatória + trilha Nativa opcional | Proposta; confirmar na Fase 1 |
| D-04 | Dispositivo de referência | Um gamepad genérico (Web) + um entre DualSense e Steam Controller 2026, escolhido na Fase 1 pelo critério de acesso documentado à háptica | Aberta |
| D-05 | Tolerâncias de latência e sincronização | Não fixar a priori; derivar de medições da bancada no piloto | Proposta |
| D-06 | Tentativas e avaliadores | k ≥ 5 tentativas; painel ≥ 5 | Proposta; calibrar |
| D-07 | Agregação humana | Média entre avaliadores; α de Krippendorff reportado | Proposta |
| D-08 | Memorização da tarefa | Conjunto público de desenvolvimento + variantes privadas paramétricas + testes ocultos + *canary* nos arquivos | Proposta |
| D-09 | Autenticidade dos resultados | Manifesto + SHA-256 dos artefatos + níveis C0–C2 | Proposta |
| D-10 | Modelos e ferramentas admitidos | Qualquer um; a unidade é a configuração de agente, declarada no manifesto | Proposta |
| D-11 | Limites de recursos | Dois perfis padrão (curto e longo), valores definidos no piloto | Proposta |
| D-12 | Robótica e medicina | Fora da v0.x; exigem grupos de trabalho com especialistas | Proposta |
