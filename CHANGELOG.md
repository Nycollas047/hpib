# Changelog · Histórico de mudanças

**English** · [Português](#português)

## English

### v0.2 (draft) — consolidation of the v0.1 concept documents

**Structure**
- Merged three overlapping documents (README, concept document, GCEB v0.1 spec) into one set. The scoring table appeared three times and the roadmap in two numbering schemes; each now has a single source.
- Unified phases (v0.1 had 6 phases in one place and 7 stages in another) in `ROADMAP.md`.

**Method**
- **Added the verification ladder V0–V4.** v0.1 stated "a command sent does not prove the physical response" but gave no way to evidence it.
- **Added gates G0–G2** and report states (with a new `UNSAFE` state), so a single score never hides a failure.
- **Scoring change (reversible):** "Development efficiency (10)" was replaced by "Claim accuracy (10)", which audits the agent's own claims against evidence. Efficiency moved to an unscored cost profile, because it depends on price and infrastructure and would make comparisons across organisations meaningless.
- Defined a formula for every dimension, capability-conditional scoring with reported coverage, and statistics (k ≥ 5, confidence intervals, no ranking over overlapping intervals).
- The unit under test is now the agent configuration (model + scaffold + budget), not the model alone.

**Human evaluation**
- Anchored 1–5 scales, a blind identification test (H-ID), hidden reference builds R0–R2 as a protocol validity check, a blind coordinator role and Krippendorff's α.

**Specification**
- Concrete requirements R01–R16 (+ X01–X02), each with a required verification level and fallback.
- New tests: T11 (physical measurement) and T12 (safe state on abnormal termination).
- Capability states now include `unverified`.
- Two technology tracks (Web, Native) and six technical hypotheses (H1–H6) to verify in Phase 1.
- Steam Controller (2026) entries updated from a public review; all flagged as reported, not verified.

**Governance**
- v0.1 open questions turned into proposed decisions D-01 to D-12.
- Anti-contamination measures (private variants, hidden tests, canary string) and conformance levels C0–C2.

**Added files:** `PROPOSAL`, `INTERNAL-RUN-GUIDE`, `SAFETY-AND-ETHICS`, `task.yaml`, schemas, templates, examples, `CONTRIBUTING`.

**Not carried over**
- The statement that the project originated from an experiment in which an AI integrated accelerometer, adaptive triggers and contextual vibration. It is unsupported in the repository. Re-add it with a demonstration (video or logs) under `examples/`.
- Robotics and medical research moved to *exploratory*, out of scope for v0.x.

## Português

### v0.2 (rascunho) — consolidação dos documentos de concepção da v0.1

**Estrutura**
- Três documentos sobrepostos (README, documento de concepção e especificação GCEB v0.1) viraram um conjunto. A tabela de pontuação aparecia três vezes e o roadmap em duas numerações; agora cada item tem uma única fonte.
- Fases unificadas (a v0.1 tinha 6 fases em um lugar e 7 etapas em outro) em `ROADMAP.md`.

**Método**
- **Adicionada a escada de verificação V0–V4.** A v0.1 dizia que "comando enviado não comprova a resposta física", mas não indicava como evidenciá-la.
- **Adicionados os portões G0–G2** e os estados do relatório (com o novo estado `INSEGURA`), para que uma nota única nunca esconda uma falha.
- **Mudança na pontuação (reversível):** "Eficiência de desenvolvimento (10)" foi substituída por "Acurácia das afirmações (10)", que audita as afirmações do próprio agente contra a evidência. A eficiência passou a um perfil de custo não pontuado, porque depende de preço e infraestrutura e tornaria as comparações entre organizações sem sentido.
- Fórmula para cada dimensão, pontuação condicionada às capacidades com cobertura reportada, e estatística (k ≥ 5, intervalos de confiança, sem ranking com intervalos sobrepostos).
- A unidade avaliada passou a ser a configuração do agente (modelo + ferramentas + orçamento), não o modelo isolado.

**Avaliação humana**
- Escalas de 1 a 5 com âncoras, teste de identificação às cegas (H-ID), versões de referência ocultas R0–R2 como verificação de validade, papel de coordenador cego e α de Krippendorff.

**Especificação**
- Requisitos concretos R01–R16 (+ X01–X02), cada um com nível de verificação exigido e contingência.
- Novos testes: T11 (medição física) e T12 (estado seguro em término anormal).
- Os estados de capacidade agora incluem `unverified`.
- Duas trilhas tecnológicas (Web e Nativa) e seis hipóteses técnicas (H1–H6) a verificar na Fase 1.
- Entradas do Steam Controller (2026) atualizadas a partir de uma análise pública; todas marcadas como reportadas, não verificadas.

**Governança**
- As questões em aberto da v0.1 viraram decisões propostas D-01 a D-12.
- Medidas contra memorização (variantes privadas, testes ocultos, *canary*) e níveis de conformidade C0–C2.

**Arquivos novos:** `PROPOSAL`, `INTERNAL-RUN-GUIDE`, `SAFETY-AND-ETHICS`, `task.yaml`, esquemas, modelos, exemplos, `CONTRIBUTING`.

**Não mantido**
- A afirmação de que o projeto nasceu de um experimento em que uma IA integrou acelerômetro, gatilhos adaptáveis e vibração contextual. Ela não tem comprovação no repositório. Reinclua com uma demonstração (vídeo ou logs) em `examples/`.
- Robótica e pesquisa médica passaram a *exploratório*, fora do escopo da v0.x.
