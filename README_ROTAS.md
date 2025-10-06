
## 🌐 Rotas da API REST

Abaixo estão as rotas disponíveis para monitoramento e consulta de dados ambientais:

### GET /api/dados-completos
Retorna todos os dados de qualidade do ar, localização e limites, buscando dados frescos da API Meteomatics.

### GET /api/qualidade-ar
Retorna as recomendações atuais de qualidade do ar.

### GET /api/qualidade-ar/localizacao
Retorna a localização atual configurada.

### POST /api/qualidade-ar/localizacao
Define uma nova localização e atualiza os dados. Body: `{ "local": "Nome da cidade" }`

### GET /api/qualidade-ar/coordenadas?local=NomeDaCidade
Converte um nome de localização em coordenadas.

### GET /api/qualidade-ar/limites
Retorna os limites de segurança configurados.

### GET /api/health
Verifica se a API está funcionando.

### GET /api/dados-nasa
Retorna dados da NASA (airdust + wildfire) usando a localização atual.

### GET /api/localizacao-atual
Retorna a localização atual detectada pelo sistema.


