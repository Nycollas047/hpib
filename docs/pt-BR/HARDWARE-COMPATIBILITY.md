# HPIB — Compatibilidade de hardware (v0.2, rascunho)

A compatibilidade é medida **por recurso**, em cada combinação de hardware, sistema operacional, driver, biblioteca e interface. O suporte no kernel é uma vantagem de integração, não uma garantia de que um recurso avançado esteja acessível a qualquer aplicação.

## 1. Matriz inicial (requisitos de detecção, não garantia de disponibilidade)

Os itens marcados com H referem-se às [hipóteses técnicas](GCEB-SPEC.md#hipóteses-técnicas-a-verificar-fase-1) a verificar na Fase 1.

| Recurso | Gamepad genérico | DualSense | Steam Controller (2026) |
|---|---|---|---|
| Botões, analógicos, gatilhos analógicos | API padrão | Kernel/biblioteca (H3, H5) | Gamepad básico no sistema; completo pelo Steam Input (H4) |
| Vibração | Se suportada | Esperada no kernel (H3) | Reportados 4 motores LRA: 2 nos grips e 2 nos trackpads; acesso a verificar |
| Háptica dos trackpads | Não se aplica | Não se aplica | Reportada; acesso pelo Steam Input a verificar |
| Gatilhos adaptáveis | Não presumir | Existem no hardware; acesso em espaço de usuário (H3) | Não reportados |
| Sensores de movimento (IMU) | Não presumir | Kernel expõe sensores (H3) | IMU de 6 eixos reportado; acesso a verificar |
| Touchpad / trackpads como entrada | Não se aplica | Kernel expõe touchpad (H3) | Dois trackpads sensíveis à pressão; fora do Steam Input não funcionaram sob Proton/Wine (reportado) |
| Háptica de alta definição | Não se aplica | Por endpoint de áudio USB (H6) | Não se aplica |
| Transporte | USB, Bluetooth | USB, Bluetooth | USB-C, Bluetooth, dongle 2,4 GHz (reportado) |

Fonte para o Steam Controller: [GamingOnLinux, maio de 2026](https://www.gamingonlinux.com/2026/05/the-new-steam-controller-from-valve-is-out-now-some-early-thoughts/page=1), análise após cerca de 5 dias de uso. Nenhuma linha acima foi verificada pelo HPIB.

### Consequência para o adaptador do Steam Controller

Se os recursos completos dependem do Steam Input, o adaptador exige o cliente Steam em execução. O manifesto deve registrar a versão do cliente Steam e a do firmware. Sem isso, a execução é `INVÁLIDA` (G0).

## 2. Contrato do adaptador

O adaptador publica um descritor validado por [`capability-descriptor.schema.json`](../../schemas/capability-descriptor.schema.json):

| Campo | Conteúdo |
|---|---|
| `device_id`, `transport`, `os`, `firmware` | Identificação do ambiente |
| `adapter`, `libraries` | Nome e versão do adaptador; drivers e bibliotecas usados |
| `capabilities.<recurso>.state` | `supported`, `unsupported`, `unavailable` ou `unverified` ([regra de capacidade](GCEB-SPEC.md#4-regra-de-capacidade)) |
| `capabilities.<recurso>.access_path` | Por exemplo kernel evdev, SDL, Steam Input, WebHID, Gamepad API |
| `capabilities.<recurso>.verified_level` | Nível V0–V4 da verificação funcional |

## 3. Como acrescentar um dispositivo

1. Implemente um adaptador que publique o descritor.
2. Para cada recurso, escreva uma verificação funcional (comandar e observar o que for observável).
3. Execute T02, T03, T09 e T11 no dispositivo.
4. Registre diferenças de distribuição Linux, versão de kernel e biblioteca.
5. Abra um *pull request* com o descritor e as evidências.

## 4. Requisitos de compatibilidade

- Identificar corretamente o hardware e registrar os recursos efetivamente disponíveis.
- Separar entradas padronizadas de recursos proprietários.
- Documentar drivers, bibliotecas e permissões (por exemplo regras `udev`).
- Tratar USB e conexão sem fio, quando suportadas.
- Testar suspensão, reconexão e recuperação.
- Não presumir suporte universal a recursos avançados.
