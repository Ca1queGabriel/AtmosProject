# API de Qualidade do Ar - AtmosSentinel

## Base URL
```
http://localhost:8001/api
```

## Endpoints Disponíveis

### 1. Obter Dados de Qualidade do Ar
**GET** `/api/qualidade-ar`

Retorna todas as recomendações e dados atuais de qualidade do ar.

**Resposta de Sucesso:**
```json
{
  "sucesso": true,
  "dados": {
    "timestamp": "2025-10-05T12:00:00.000Z",
    "nivel_alerta": "MODERADO",
    "mensagem": "Atenção: PM25 pode atingir nível crítico em 8 horas",
    "poluente_critico": "PM25",
    "tempo_ate_pico": {
      "horas": 8,
      "minutos": 30,
      "horario_estimado": "05/10/2025, 20:30"
    },
    "indice_qualidade_ar": {
      "valor": 45,
      "categoria": "REGULAR"
    },
    "valores_atuais": {
      "PM25": 12.5,
      "NO2": 45.3,
      "O3": 65.2,
      "CO": 2.1
    },
    "umidade_atual": 55,
    "previsoes_por_poluente": {
      "PM25": {
        "valor_atual": 12.5,
        "limite": 15,
        "tendencia": "crescente",
        "horas_para_limite": 8.5,
        "horario_pico": "05/10, 20:30",
        "valores_previstos": [...]
      }
    },
    "recomendacoes": {
      "fechar_janelas": false,
      "ativar_purificador": false,
      "usar_mascaras": false,
      "se_hidratar_Controlar_humidade": true
    },
    "localizacao": "São Paulo, SP, Brasil"
  }
}
```

---

### 2. Obter Localização Atual
**GET** `/api/qualidade-ar/localizacao`

Retorna a localização atualmente configurada no sistema.

**Resposta:**
```json
{
  "sucesso": true,
  "localizacao": {
    "nome": "São Paulo, SP, Brasil",
    "lat": "-23.5505",
    "lon": "-46.6333"
  }
}
```

---

### 3. Definir Nova Localização
**POST** `/api/qualidade-ar/localizacao`

Define uma nova localização e atualiza os dados automaticamente.

**Body (JSON):**
```json
{
  "local": "Rio de Janeiro, RJ"
}
```

**Resposta:**
```json
{
  "sucesso": true,
  "mensagem": "Localização atualizada com sucesso",
  "localizacao": {
    "nome": "Rio de Janeiro, RJ, Brasil",
    "lat": "-22.9068",
    "lon": "-43.1729"
  }
}
```

---

### 4. Obter Coordenadas de um Local
**GET** `/api/qualidade-ar/coordenadas?local=NomeDaCidade`

Converte um nome de cidade/endereço em coordenadas geográficas.

**Query Parameters:**
- `local` (obrigatório): Nome da cidade ou endereço

**Exemplo:**
```
GET /api/qualidade-ar/coordenadas?local=Curitiba
```

**Resposta:**
```json
{
  "sucesso": true,
  "coordenadas": {
    "nome": "Curitiba, Paraná, Brasil",
    "lat": "-25.4284",
    "lon": "-49.2733"
  }
}
```

---

### 5. Obter Limites de Segurança
**GET** `/api/qualidade-ar/limites`

Retorna os limites de segurança configurados para cada poluente.

**Resposta:**
```json
{
  "sucesso": true,
  "limites": {
    "PM25": 15,
    "NO2": 200,
    "O3": 180,
    "CO": 10,
    "UMIDADE_MIN": 40,
    "UMIDADE_MAX": 60
  }
}
```

---

### 6. Health Check
**GET** `/api/health`

Verifica se a API está online e funcionando.

**Resposta:**
```json
{
  "sucesso": true,
  "status": "online",
  "timestamp": "2025-10-05T12:00:00.000Z"
}
```

---

## Códigos de Erro

### 400 - Bad Request
Parâmetros inválidos ou ausentes.

### 500 - Internal Server Error
Erro no servidor ou na API externa (Meteomatics).

**Exemplo:**
```json
{
  "sucesso": false,
  "erro": "Parâmetro 'local' é obrigatório"
}
```

---

## Como Usar

### Exemplo com cURL:

```bash
# Obter dados atuais
curl http://localhost:8001/api/qualidade-ar

# Definir nova localização
curl -X POST http://localhost:8001/api/qualidade-ar/localizacao \
  -H "Content-Type: application/json" \
  -d '{"local": "Brasília, DF"}'

# Obter coordenadas
curl "http://localhost:8001/api/qualidade-ar/coordenadas?local=Salvador"
```

### Exemplo com JavaScript (Fetch):

```javascript
// Obter dados de qualidade do ar
fetch('http://localhost:8001/api/qualidade-ar')
  .then(res => res.json())
  .then(data => console.log(data));

// Definir nova localização
fetch('http://localhost:8001/api/qualidade-ar/localizacao', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ local: 'Porto Alegre, RS' })
})
  .then(res => res.json())
  .then(data => console.log(data));
```

---

## Notas

- Os dados são atualizados automaticamente a cada **10 minutos**
- A API usa dados do **Meteomatics** para previsão de poluentes
- A geocodificação usa **OpenStreetMap Nominatim** (gratuito)
- Todos os valores de poluentes estão em **µg/m³** (microgramas por metro cúbico)

