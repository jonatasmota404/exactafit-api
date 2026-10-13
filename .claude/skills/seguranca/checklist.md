# Checklist de segurança (leia só a seção que se aplica)

Perguntas-guia em palavras próprias; os padrões abaixo são a fonte para aprofundar. Os exemplos de tecnologia entre parênteses são só ilustração.

## Fontes consultadas (consulta feita em 2026-10-13 em owasp.org e subdomínios)
| Lista | Edição vigente | Fonte | Observação |
|---|---|---|---|
| OWASP API Security Top 10 | 2023 | https://api-security.owasp.org/ | a página também traz a de 2019 |
| OWASP Top 10 (web) | 2025 | https://top10.owasp.org/2025 | página do projeto diz "most current released version is the OWASP Top 10 2025" |
| OWASP ASVS | 5.0.0 | https://owasp.org/www-project-application-security-verification-standard/ | a página a indica como estável; data de lançamento não consta na página (data não verificada) |
| OWASP MASVS | 2.1.0 (jan/2024) | https://mas.owasp.org/news/2024/01/18/masvs-v210-release--masvs-privacy/ | a página do projeto não informou a versão; se é a mais recente: versão não verificada |
| OWASP Mobile Top 10 | 2024 | https://owasp.github.io/www-project-mobile-top-10/2023-risks | título da página: "Mobile Top 10 2024 - Final Release" |
| OWASP Top 10 for LLM Applications | 2025 | https://genai.owasp.org/llm-top-10/ | |

Reconfira a edição antes de citar em um plano: as listas mudam.

## Em todo tipo de trabalho
- **Autorização por objeto:** quem pede este recurso pode mesmo ver ou alterar *este* registro? O filtro por dono vem da sessão, nunca do corpo da requisição?
- **Autorização por função:** a operação administrativa ou de maior privilégio checa o papel no servidor, não só escondendo o botão?
- **Autenticação e sessão:** como a identidade é provada? Há expiração, revogação e limite de tentativas? Reuso de biblioteca madura em vez de mecanismo próprio?
- **Entrada e atribuição em massa:** toda entrada externa é validada (tipo, tamanho, formato)? O objeto recebido pode preencher campos que o cliente não deveria definir (papel, dono, preço)?
- **Exposição de dados:** a resposta devolve só o que o consumidor precisa? Dado pessoal ou sensível sai em erro, log ou URL?
- **Segredos e configuração:** nenhum segredo no repositório, no log ou na imagem? Padrões inseguros (debug, CORS aberto, credencial default) ficaram para trás?
- **Dependências:** a dependência nova é necessária, mantida e travada em versão? Há auditoria no CI?
- **Logs:** registram quem fez o quê, sem senha, token nem dado pessoal?
- **Limites de uso:** há teto de requisições, tamanho de payload, paginação e tempo máximo?
- **SSRF:** o servidor busca URL informada por usuário? Se sim, há lista de destinos permitidos e bloqueio de rede interna?
- **Falha segura:** o que acontece quando um controle dá erro? Nega por padrão ou deixa passar?

## API (ref.: API Security Top 10 2023; ASVS)
- Todo endpoint de recurso por id checa o dono (objeto) e a propriedade que pode ser lida ou escrita?
- Fluxos de negócio sensíveis (cadastro, compra, recuperação de senha) resistem a automação em massa?
- Há inventário das versões e rotas expostas, inclusive antigas e de teste?
- A API consome outras APIs confiando na resposta sem validar?

## Aplicação web (ref.: OWASP Top 10 2025; ASVS)
- Controle de acesso aplicado no servidor em toda rota? Injeção (consulta, comando, template) evitada com parâmetros e codificação de saída?
- Cabeçalhos, cookies (flags de segurança), CSRF e política de origem estão decididos, não deixados no padrão?
- Cadeia de suprimentos: lockfile, origem dos pacotes e integridade do build?
- Tratamento de exceções não vaza detalhe interno nem deixa o sistema em estado inconsistente?

## Mobile (ref.: MASVS; Mobile Top 10 2024)
- **Armazenamento local:** credenciais e tokens ficam no cofre seguro da plataforma, não em preferências, arquivo ou log? Dado sensível em cache, backup ou captura de tela?
- **Tráfego:** só canal cifrado, com validação de certificado? Nada sensível em URL?
- Autorização decidida no servidor (o aplicativo é território do atacante)?
- O que o aplicativo pede de permissão e coleta é o mínimo e está declarado ao usuário (privacidade)?
- Segredo embutido no binário (chave de API, credencial)? Assuma que será extraído.

## Funcionalidade com LLM (ref.: Top 10 for LLM Applications 2025)
- Texto vindo de usuário ou de documento externo pode alterar as instruções do modelo (injeção de prompt)? O que o modelo consegue fazer se for enganado?
- A saída do modelo é tratada como entrada não confiável antes de ir para banco, shell, HTML ou outra API?
- O modelo tem ferramentas ou permissões além do necessário (agência excessiva)? Ações destrutivas pedem confirmação humana?
- Dado pessoal ou segredo entra no prompt, no log ou em dados de treino/recuperação? Prompt de sistema contém segredo?
- Há teto de custo, tamanho e frequência de chamadas?
- Fontes de recuperação e modelos de terceiros têm origem confiável?
