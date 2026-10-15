# HPIB — Segurança e ética (v0.2, rascunho)

Segurança vale desde a concepção. Há quatro domínios de risco.

| Domínio | Risco | Controle mínimo |
|---|---|---|
| Hardware | Saída física excessiva ou presa; dano ao dispositivo | Limites documentados do fabricante; **estado seguro** (todas as saídas a zero) em desconexão, erro ou término; botão ou comando para desativar o feedback; nenhuma alteração de firmware |
| Código gerado | Código não confiável com acesso a dispositivos e ao sistema | Executar com usuário sem privilégios; permissões de dispositivo (`udev`) restritas ao controle de teste; sem rede por padrão; escrita HID bruta apenas em relatórios documentados; endpoints de atualização de firmware bloqueados |
| Participantes | Desconforto, fadiga, falta de consentimento | Consentimento informado; participação voluntária e retirada a qualquer momento; interrupção ao marcar desconforto; duração e amplitude dentro dos limites do dispositivo; alternativas para diferenças sensoriais e motoras |
| Dados | Coleta além do necessário | Minimizar e pseudonimizar; telemetria **local** por padrão; nenhum envio externo sem autorização; cumprir a legislação aplicável (por exemplo LGPD, GDPR) |

## Integridade das afirmações

- Uma pontuação no HPIB **não** certifica produto, fabricante ou modelo.
- Não se divulgam comparações que identifiquem terceiros sem o cumprimento do protocolo e do nível de conformidade indicado.
- Marcas pertencem aos seus titulares; o projeto não tem vínculo com eles.

## Aplicações médicas e robóticas

Fora do escopo da v0.x. O HPIB não certifica dispositivos médicos nem demonstra eficácia clínica; nota alta não autoriza uso clínico. Qualquer trabalho nessas áreas exige protocolo próprio, profissionais qualificados, análise de risco, proteção de dados, consentimento adequado, procedimentos de interrupção e validação independente. O nível de supervisão cresce com o risco da tarefa. Robôs físicos exigem limites operacionais e mecanismo de parada.

## Relato de problemas

Falhas de segurança no kit (por exemplo, um procedimento que possa danificar um dispositivo) devem ser reportadas ao autor de forma privada antes de divulgação pública: nycollas_augusto@hotmail.com.
