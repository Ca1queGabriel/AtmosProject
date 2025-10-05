# AtmosSentinel - API de Monitoramento de Qualidade do Ar

## 🚀 Como Funciona

Quando você inicia o servidor, ele automaticamente:

1. **Faz a primeira chamada imediatamente** para a API Meteomatics
2. **Configura chamadas periódicas** no intervalo que você definir
3. **Atualiza os dados automaticamente** em background
4. **Disponibiliza os dados** através da API REST

## ⚙️ Configurar Intervalo de Atualização

### Opção 1: Variável de Ambiente (Recomendado)

Crie um arquivo `.env` na raiz do projeto:

```env
INTERVALO_ATUALIZACAO=300000
```

**Exemplos de intervalos:**
- `60000` = 1 minuto
- `300000` = 5 minutos  
- `600000` = 10 minutos (padrão)
- `1800000` = 30 minutos
- `3600000` = 1 hora

### Opção 2: No Terminal (Windows)

```cmd
set INTERVALO_ATUALIZACAO=300000 && npm run dev
```

### Opção 3: No Terminal (PowerShell)

```powershell
$env:INTERVALO_ATUALIZACAO=300000; npm run dev
```

## 🎯 Iniciar o Servidor

```bash
npm run dev
```

O console mostrará:
```
Peixe 
Iniciando sistema de monitoramento de qualidade do ar...
Intervalo de atualização: 10000ms (10 segundos)
Buscando dados da API Meteomatics para: São Paulo, SP, Brasil...
[12:30:45] Recomendação atualizada: {...}
```

## 📡 Endpoints da API

### Obter dados atuais
```bash
GET http://localhost:8001/api/qualidade-ar
```

### Mudar localização
```bash
POST http://localhost:8001/api/qualidade-ar/localizacao
Content-Type: application/json

{
  "local": "Rio de Janeiro, RJ"
}
```

### Ver documentação completa
Veja o arquivo `API_DOCS.md` para todos os endpoints disponíveis.

## 🔄 Como as Chamadas Funcionam

```javascript
// O sistema faz isso automaticamente:
1. Inicialização → Chamada IMEDIATA à API Meteomatics
2. Aguarda X milissegundos (seu intervalo)
3. Nova chamada à API Meteomatics
4. Repete o passo 2-3 infinitamente
```

## 📊 Dados Coletados

A cada chamada, o sistema busca **12 horas de previsão** para:
- **PM2.5** (material particulado fino)
- **NO2** (dióxido de nitrogênio)
- **O3** (ozônio)
- **CO** (monóxido de carbono)
- **Umidade relativa**

## ⚠️ Importante

- **Não use intervalos muito curtos** (< 1 minuto) para não sobrecarregar a API Meteomatics
- O **intervalo padrão é 10 minutos**, que é ideal para monitoramento em tempo real
- Se a API falhar, o sistema **mantém os últimos dados válidos**

## 🧪 Testar

```bash
# Terminal 1: Iniciar servidor
npm run dev

# Terminal 2: Testar API
curl http://localhost:8001/api/qualidade-ar
```

