# 📚 Documentação Técnica - AtmosProject

## 📋 Índice
- [Visão Geral](#visão-geral)
- [Funções do Sistema](#funções-do-sistema)
- [Sistema de Recomendações](#sistema-de-recomendações)
- [Tempo Categoria](#tempo-categoria)
- [Limites e Padrões](#limites-e-padrões)
- [Integração NASA](#integração-nasa)

---

## 🎯 Visão Geral

O **AtmosProject** é um sistema inteligente de monitoramento da qualidade do ar que coleta dados de sensores Arduino, processa informações ambientais e fornece recomendações em tempo real para proteção da saúde respiratória.

---

## 🔧 Funções do Sistema

### 1. `detectarLocalizacaoPorIP()`
**Descrição:** Detecta automaticamente a localização geográfica do usuário através do seu endereço IP.

**Como funciona:**
- Utiliza a API `ipapi.co` para obter dados de geolocalização
- Retorna cidade, região, país, coordenadas e IP
- Em caso de falha, usa São Paulo como localização padrão

**Retorno:**
```javascript
{
  nome: "São Paulo, SP, Brasil",
  cidade: "São Paulo",
  regiao: "SP",
  pais: "Brasil",
  codigo_pais: "BR",
}
```

**Por que é importante:**
A localização permite contextualizar as recomendações com dados ambientais da região específica e integrar informações de incêndios/poeira próximos.

---

### 2. `obterCoordenadas(local)`
**Descrição:** Converte o nome de uma cidade ou endereço em coordenadas geográficas (latitude e longitude).

**Como funciona:**
- Usa a API Nominatim do OpenStreetMap
- Busca de forma gratuita sem necessidade de API key
- Retorna as coordenadas do primeiro resultado encontrado

**Parâmetros:**
- `local` (string): Nome da cidade ou endereço (ex: "Rio de Janeiro, Brasil")

**Por que é importante:**
Permite que o usuário defina manualmente sua localização caso a detecção automática falhe ou queira monitorar outra região.

---

### 3. `calcularHoraPico(dadosPoluente)`
**Descrição:** Calcula a regressão linear dos dados de um poluente para prever quando atingirá níveis críticos.

**Como funciona:**
- Aplica algoritmo de regressão linear simples (mínimos quadrados)
- Calcula o coeficiente angular (slope) e intercepto
- Determina se o poluente está crescendo, decrescendo ou estável

**Matemática:**
```
slope = Σ[(xi - x̄)(yi - ȳ)] / Σ[(xi - x̄)²]
intercept = ȳ - slope × x̄
```

**Parâmetros:**
- `dadosPoluente` (array): Array com objetos `{timestamp, valor}`

**Retorno:**
```javascript
{
  slope: 2.5,      // Taxa de crescimento por hora
  intercept: 10.3  // Valor inicial da tendência
}
```

**Por que é importante:**
A previsão de tendências permite alertar o usuário **antes** que os níveis atinjam valores perigosos, possibilitando ações preventivas.

---

### 4. `calcularRecomendacoes(dados)`
**Descrição:** Função central que analisa todos os poluentes e gera recomendações personalizadas de saúde.

**Como funciona:**
1. Analisa cada poluente (PM2.5, NO2, O3, CO)
2. Calcula tendências usando regressão linear
3. Determina tempo até atingir limites críticos
4. Identifica o poluente mais crítico
5. Gera índice de qualidade do ar (0-100)
6. Cria recomendações booleanas específicas

**Análise por Poluente:**

#### **PM2.5 (Material Particulado Fino)**
- **Limite:** 15 µg/m³ (WHO 2021)
- **Perigo:** Partículas microscópicas que penetram profundamente nos pulmões
- **Efeitos:** Asma, bronquite, doenças cardiovasculares, câncer de pulmão

#### **NO2 (Dióxido de Nitrogênio)**
- **Limite:** 200 µg/m³
- **Perigo:** Gás tóxico produzido por veículos e indústrias
- **Efeitos:** Inflamação das vias aéreas, redução da função pulmonar

#### **O3 (Ozônio Troposférico)**
- **Limite:** 180 µg/m³
- **Perigo:** Ozônio ao nível do solo (diferente da camada de ozônio protetora)
- **Efeitos:** Irritação respiratória, tosse, dor no peito, piora de asma

#### **CO (Monóxido de Carbono)**
- **Limite:** 10 mg/m³
- **Perigo:** Gás invisível e inodoro que impede oxigenação do sangue
- **Efeitos:** Dores de cabeça, tonturas, náuseas, risco de morte em altas concentrações

**Retorno:**
```javascript
{
  timestamp: "2025-10-05T14:30:00.000Z",
  nivel_alerta: "CRÍTICO",
  tempo_categoria: 3,
  mensagem: "ATENÇÃO: PM25 atingirá nível crítico em menos de 3 horas!",
  poluente_critico: "PM25",
  tempo_ate_pico: {
    horas: 2,
    minutos: 30,
    horario_estimado: "05/10, 17:00"
  },
  indice_qualidade_ar: {
    valor: 75,
    categoria: "RUIM"
  },
  valores_atuais: {
    PM25: 12.5,
    NO2: 45.2,
    O3: 85.0,
    CO: 3.2
  },
  umidade_atual: 45,
  previsoes_por_poluente: {
    PM25: {
      valor_atual: 12.5,
      limite: 15,
      tendencia: "crescente",
      horas_para_limite: 2.5,
      horario_pico: "05/10, 17:00"
    }
    // ... outros poluentes
  },
  recomendacoes: {
    fechar_janelas: true,
    ativar_purificador: true,
    usar_mascaras: false,
    'se_hidratar-Controlar_humidade': true
  }
}
```

**Por que é importante:**
Centraliza toda a inteligência do sistema, transformando dados brutos em informações acionáveis e recomendações específicas.

---

### 5. `atualizarRecomendacoes()`
**Descrição:** Rotina principal que busca dados do Arduino, processa e atualiza as recomendações periodicamente.

**Como funciona:**
1. Detecta localização (se necessário)
2. Obtém dados dos sensores Arduino
3. Processa através de `calcularRecomendacoes()`
4. Envia recomendações de volta para o Arduino
5. Executa a cada 10 segundos

**Por que é importante:**
Mantém o sistema sempre atualizado com as condições mais recentes, permitindo respostas rápidas a mudanças ambientais.

---

### 6. `obterAirdustNASA(lat, lon)`
**Descrição:** Obtém dados de poeira atmosférica da NASA usando o satélite MODIS Terra.

**Como funciona:**
- Consulta a API GIBS (Global Imagery Browse Services) da NASA
- Busca dados de aerossóis em um raio de 0.5° das coordenadas
- Retorna intensidade da poeira atmosférica

**Por que é importante:**
Poeira atmosférica (airdust) pode agravar problemas respiratórios e é especialmente crítica em regiões com:
- Desertos próximos
- Queimadas
- Construções em larga escala
- Secas prolongadas

---

### 7. `obterWildfireNASA(lat, lon)`
**Descrição:** Detecta incêndios florestais próximos usando dados de satélite VIIRS NOAA-20.

**Como funciona:**
- Consulta a API FIRMS (Fire Information for Resource Management System)
- Detecta anomalias térmicas em um raio de 100km
- Classifica nível de risco baseado na quantidade de focos

**Classificação de Risco:**
- **BAIXO:** 0 incêndios detectados
- **MODERADO:** 1-2 incêndios
- **ALTO:** 3-5 incêndios
- **CRÍTICO:** 6+ incêndios

**Por que é importante:**
Incêndios florestais liberam:
- Partículas finas (PM2.5) em grandes quantidades
- Monóxido de carbono (CO)
- Gases tóxicos diversos
- Fumaça que pode viajar centenas de quilômetros

A fumaça de incêndios é extremamente prejudicial, causando:
- Crises de asma
- Problemas cardiovasculares
- Irritação nos olhos e garganta
- Redução da visibilidade

---

### 8. `obterDadosNASA(lat, lon)`
**Descrição:** Função agregadora que busca ambos os dados da NASA (airdust + wildfire) em paralelo.

**Por que é importante:**
Otimiza performance fazendo requisições simultâneas e fornece contexto ambiental completo para análise de qualidade do ar.

---

## 🎯 Sistema de Recomendações

### 1. **Fechar Janelas** (`fechar_janelas`)
**Quando ativar:**
- PM2.5 > 15 µg/m³ **OU**
- NO2 > 200 µg/m³

**Por que fechar as janelas:**
- Impede entrada de poluentes externos
- Especialmente importante em áreas urbanas com tráfego intenso
- Reduz exposição a partículas finas
- Protege ambientes internos de gases tóxicos

**Ação recomendada:**
1. Feche todas as janelas e portas
2. Mantenha cortinas/persianas fechadas
3. Evite ventilação natural
4. Use ventilação mecânica com filtros se disponível

---

### 2. **Ativar Purificador** (`ativar_purificador`)
**Quando ativar:**
- PM2.5 > 35 µg/m³ **OU**
- O3 > 70 µg/m³

**Por que ativar o purificador:**
- Filtra partículas finas do ar interno
- Reduz concentração de poluentes em ambientes fechados
- Especialmente crítico para:
    - Crianças
    - Idosos
    - Pessoas com asma/DPOC
    - Gestantes

**Ação recomendada:**
1. Ligue purificadores de ar com filtros HEPA
2. Mantenha portas de quartos fechadas para concentrar purificação
3. Priorize ambientes onde há mais permanência
4. Verifique se o filtro está limpo/novo

**Alternativas sem purificador:**
- Mantenha ambientes bem vedados
- Use panos úmidos para capturar poeira
- Evite atividades que levantam partículas (varrer)
- Aguarde melhora da qualidade externa

---

### 3. **Usar Máscaras** (`usar_mascaras`)
**Quando ativar:**
- PM2.5 > 55 µg/m³ **OU**
- CO > 10 mg/m³

**Por que usar máscaras:**
- Proteção direta das vias respiratórias
- Filtra partículas antes de inalá-las
- Reduz exposição a gases tóxicos
- Essencial para quem precisa sair

**Tipo de máscara recomendada:**
- **N95/PFF2:** Filtra 95% de partículas finas (ideal)
- **Cirúrgica:** Proteção parcial (melhor que nada)
- **Tecido com filtro:** Moderada proteção

**Quando usar:**
1. Ao sair de casa
2. Durante exercícios externos (evite se possível)
3. Em locais com muita circulação de pessoas
4. Próximo a vias com tráfego intenso

**NÃO use máscara se:**
- Tiver dificuldade respiratória severa
- For criança menor de 2 anos
- Estiver fazendo exercício intenso (prefira adiar)

---

### 4. **Se Hidratar / Controlar Umidade** (`se_hidratar-Controlar_humidade`)
**Quando ativar:**
- Umidade < 40% **OU**
- Umidade > 60% **OU**
- Nível de alerta CRÍTICO ou ALTO

**Por que se hidratar:**
- Mantém mucosas respiratórias úmidas
- Auxilia na eliminação de toxinas
- Reduz irritação da garganta
- Melhora capacidade de defesa do organismo

**Por que controlar umidade:**

#### **Umidade Baixa (<40%):**
- Resseca vias respiratórias
- Aumenta irritação por poluentes
- Facilita propagação de vírus
- Causa sangramento nasal
- Agrava alergias

**Ações:**
1. Use umidificadores
2. Coloque recipientes com água nos ambientes
3. Pendure toalhas molhadas
4. Regue plantas internas
5. Beba 2-3 litros de água/dia

#### **Umidade Alta (>60%):**
- Favorece crescimento de mofo
- Aumenta ácaros
- Agrava problemas respiratórios
- Sensação de abafamento

**Ações:**
1. Use desumidificadores
2. Aumente ventilação (se ar externo estiver bom)
3. Use ar condicionado (modo dry)
4. Evite secar roupas dentro de casa
5. Mantenha 1-2 litros de água/dia

#### **Em Alerta CRÍTICO/ALTO:**
Hidratação extra é fundamental porque:
- Organismo trabalha mais para eliminar toxinas
- Respiração fica mais ofegante
- Maior perda de água pelas vias aéreas
- Auxilia na recuperação

---

## ⏰ Tempo Categoria

### O que é `tempo_categoria`?

É um **indicador de urgência** que representa quão rápido um poluente atingirá níveis perigosos. Varia de **0 a 3**, sendo 3 o mais crítico.

### Classificação:

#### **Categoria 0 - SEGURO** 🟢
- **Tempo até limite:** > 12 horas
- **Significado:** Poluente em tendência de crescimento mas ainda muito distante de níveis perigosos
- **Ação:** Monitoramento normal, sem ações imediatas necessárias

#### **Categoria 1 - ATENÇÃO** 🟡
- **Tempo até limite:** 6-12 horas
- **Significado:** Poluente crescendo e pode atingir nível crítico dentro de meio dia
- **Ação:**
    - Comece a planejar reduzir atividades externas
    - Prepare máscaras e purificadores
    - Monitore mais frequentemente
    - Grupos de risco devem começar precauções

#### **Categoria 2 - ALERTA** 🟠
- **Tempo até limite:** 3-6 horas
- **Significado:** Situação se deteriorando rapidamente
- **Ação:**
    - Feche janelas se ainda não fez
    - Ligue purificadores
    - Cancele atividades externas não essenciais
    - Grupos de risco devem permanecer em ambientes internos
    - Tenha máscaras prontas para uso

#### **Categoria 3 - CRÍTICO** 🔴
- **Tempo até limite:** < 3 horas
- **Significado:** Emergência ambiental iminente
- **Ação IMEDIATA:**
    - Feche TODAS as janelas
    - Ative TODOS os purificadores disponíveis
    - Use máscaras para qualquer saída
    - Cancele toda atividade externa
    - Grupos de risco devem buscar ambientes controlados
    - Considere evacuar para área com melhor qualidade do ar
    - Contate serviços de saúde se tiver sintomas

### Por que é importante?

O `tempo_categoria` permite que você:
1. **Antecipe problemas:** Tome ações antes da crise
2. **Priorize ações:** Saiba o que fazer primeiro
3. **Proteja vulneráveis:** Idosos e crianças têm tempo para se proteger
4. **Planeje o dia:** Ajuste compromissos baseado na urgência
5. **Economize recursos:** Não ative tudo desnecessariamente

---

## 📊 Limites e Padrões

### Limites Configurados (Baseados em OMS/EPA):

```javascript
LIMITES = {
    PM25: 15,           // µg/m³ (WHO 2021 - mais rigoroso)
    NO2: 200,           // µg/m³ (limite horário)
    O3: 180,            // µg/m³ (limite de 8 horas)
    CO: 10,             // mg/m³ (limite de 8 horas)
    UMIDADE_MIN: 40,    // % (conforto e saúde)
    UMIDADE_MAX: 60     // % (evita mofo)
}
```

### Índice de Qualidade do Ar:

- **0-25:** BOM - Ar limpo, sem restrições
- **25-50:** REGULAR - Sensíveis podem sentir efeitos
- **50-75:** RUIM - População geral começa a sentir efeitos
- **75-100:** PÉSSIMO - Risco à saúde de todos

---

## 🚨 Grupos de Risco

**Pessoas que devem ter atenção redobrada:**

1. **Crianças (0-12 anos)**
    - Pulmões em desenvolvimento
    - Respiram mais ar por kg de peso
    - Mais tempo em atividades externas

2. **Idosos (60+ anos)**
    - Capacidade pulmonar reduzida
    - Maior risco cardiovascular
    - Sistema imune mais frágil

3. **Gestantes**
    - Impacto no desenvolvimento fetal
    - Maior risco de parto prematuro
    - Necessidade de mais oxigênio

4. **Asmáticos/DPOC**
    - Vias aéreas já comprometidas
    - Risco de crises graves
    - Podem precisar ajustar medicação

5. **Cardiopatas**
    - Poluição afeta sistema cardiovascular
    - Aumento de infartos em dias poluídos
    - Necessidade de reduzir esforço

---

## 🔄 Fluxo do Sistema

```
1. Arduino coleta dados dos sensores
   ↓
2. Dados são enviados via Serial Port
   ↓
3. Sistema detecta localização do usuário
   ↓
4. Processa dados de poluentes
   ↓
5. Calcula regressão linear e tendências
   ↓
6. Busca dados NASA (airdust/wildfire)
   ↓
7. Gera recomendações personalizadas
   ↓
8. Envia comandos de volta para Arduino
   ↓
9. Disponibiliza JSON via API
   ↓
10. Atualiza a cada 10 segundos
```

---

## 📱 Uso da API

### Endpoint: `/previsao-ar`

**Retorna JSON completo com:**
- Timestamp atual
- Nível de alerta
- Tempo categoria
- Mensagem explicativa
- Poluente crítico
- Tempo até pico
- Índice de qualidade do ar
- Valores atuais de todos os poluentes
- Previsões por poluente
- Recomendações booleanas
- Localização detectada
- Dados NASA (se disponíveis)

---

## 🛠️ Integração Arduino

O sistema envia para o Arduino apenas os **5 dados essenciais**:

```javascript
{
  fechar_janelas: boolean,
  ativar_purificador: boolean,
  usar_mascaras: boolean,
  'se_hidratar-Controlar_humidade': boolean,
  tempo_categoria: 0-3
}
```

Isso permite que o Arduino:
- Acione LEDs indicadores
- Ative relés para purificadores
- Mostre alertas em display
- Emita sons de alerta
- Tudo de forma eficiente e com baixo processamento

---

## 🌍 Fontes de Dados

### APIs Utilizadas:

1. **ipapi.co** - Geolocalização por IP (gratuita)
2. **OpenStreetMap Nominatim** - Geocodificação (gratuita)
3. **NASA GIBS** - Imagens de satélite e aerossóis
4. **NASA FIRMS** - Detecção de incêndios em tempo real
5. **Arduino (Serial)** - Sensores locais de qualidade do ar

### Sensores Arduino (recomendados):

- **PM2.5/PM10:** PMS5003, SDS011
- **CO:** MQ-7, MQ-9
- **NO2/O3:** MiCS-2714, MQ-131
- **Umidade:** DHT22, BME280

---

## 📖 Referências Científicas

1. **WHO (2021)** - Air Quality Guidelines
2. **EPA** - Air Quality Index
3. **CETESB** - Padrões de qualidade do ar
4. **NASA** - Earth Observing System
5. **NOAA** - Fire Weather Program

---

## ⚠️ Avisos Importantes

1. **Não é dispositivo médico:** Este sistema fornece orientações gerais, não substitui orientação médica
2. **Calibração:** Sensores devem ser calibrados periodicamente
3. **Manutenção:** Limpe sensores e troque filtros regularmente
4. **Emergências:** Em caso de sintomas graves, procure atendimento médico
5. **Precisão:** Dados de satélite têm resolução limitada, sensores locais são mais precisos

---

## 🤝 Contribuições

Sistema desenvolvido para proteção da saúde respiratória da população.

**Versão:** 1.0.0  
**Data:** Outubro 2025  
**Licença:** MIT

---

## 🧪 Testes sem Arduino

### Para quem não tem Arduino configurado

Se você ainda não possui um Arduino físico ou está em fase de desenvolvimento, o sistema oferece **rotas de teste** que simulam dados dos sensores.

#### Como usar as rotas de teste:

**1. Inicie o servidor normalmente:**
```bash
npm start
```

**2. Acesse as rotas de teste no navegador ou via API:**

##### **Rota principal de visualização:**
```
http://localhost:3000/
```
Página inicial com interface web.

##### **Rota de previsão do ar (dados simulados):**
```
http://localhost:3000/previsao-ar
```
Retorna JSON completo com todas as recomendações baseadas em dados simulados ou do Arduino (se conectado).

##### **Rota de clima:**
```
http://localhost:3000/clima
```
Retorna dados climáticos adicionais da região.

#### Testando com dados simulados:

Quando o Arduino não está conectado, o sistema automaticamente:
- ✅ Detecta sua localização via IP
- ✅ Usa valores padrão seguros para os sensores
- ✅ Aguarda dados reais do Arduino
- ✅ Exibe mensagem: "⏳ Aguardando dados do Arduino..."

#### Simulando dados manualmente:

Você pode modificar temporariamente os valores em `arduino/arduino.js` para testar diferentes cenários:

```javascript
// Exemplo de dados simulados para teste
const dadosSimulados = {
    pm25: 45.5,      // PM2.5 elevado
    no2: 150.0,      // NO2 moderado
    o3: 95.0,        // Ozônio alto
    co: 8.5,         // CO próximo ao limite
    umidade: 35,     // Umidade baixa
    temperatura: 28,
    timestamp: new Date().toISOString()
};
```

#### Cenários de teste recomendados:

**Cenário 1 - Qualidade BOA:**
```javascript
{ pm25: 8, no2: 50, o3: 40, co: 2, umidade: 50 }
```
Resultado esperado: Todas as recomendações = false, tempo_categoria = 0

**Cenário 2 - Qualidade MODERADA:**
```javascript
{ pm25: 25, no2: 120, o3: 100, co: 6, umidade: 35 }
```
Resultado esperado: fechar_janelas = true, controlar_umidade = true

**Cenário 3 - Qualidade RUIM:**
```javascript
{ pm25: 45, no2: 180, o3: 150, co: 9, umidade: 65 }
```
Resultado esperado: Múltiplas recomendações ativas, tempo_categoria = 1-2

**Cenário 4 - Qualidade CRÍTICA:**
```javascript
{ pm25: 60, no2: 220, o3: 190, co: 12, umidade: 30 }
```
Resultado esperado: Todas as recomendações = true, tempo_categoria = 3

#### Testando com ferramentas externas:

**Postman/Insomnia:**
```
GET http://localhost:3000/previsao-ar
Headers: Accept: application/json
```

**cURL (PowerShell/CMD):**
```bash
curl http://localhost:3000/previsao-ar
```

**JavaScript (Fetch API):**
```javascript
fetch('http://localhost:3000/previsao-ar')
  .then(res => res.json())
  .then(data => console.log(data));
```

#### Preparando para conexão Arduino real:

**1. Hardware necessário:**
- Arduino Uno/Mega/ESP32
- Sensor PM2.5 (PMS5003 ou SDS011)
- Sensor MQ-7 ou MQ-9 (CO)
- Sensor de gases MQ-131 ou similar (O3/NO2)
- Sensor DHT22 ou BME280 (Temperatura/Umidade)
- Cabo USB para conexão

**2. Upload do sketch:**
```bash
# Abra o Arduino IDE
# Carregue o arquivo: arduino/arduino_sketch.ino
# Selecione a porta COM correta
# Faça o upload
```

**3. Configuração da porta serial:**
Edite `config/arduino.config.js` com a porta correta:
```javascript
module.exports = {
    port: 'COM3',  // Windows: COM3, COM4, etc
                   // Linux/Mac: /dev/ttyUSB0, /dev/ttyACM0
    baudRate: 9600
};
```

**4. Reinicie o servidor:**
```bash
npm start
```

O sistema detectará automaticamente o Arduino e começará a usar dados reais!

#### Logs de debug:

Acompanhe o console para verificar o status:
```
🚀 Iniciando sistema via Arduino...
🌍 Detectando sua localização...
📍 Localização detectada: São Paulo, SP, Brasil
🔌 Conectando ao Arduino na porta COM3...
✅ Arduino conectado com sucesso!
📊 Dados recebidos: PM2.5=12.5 NO2=45.2 O3=85.0 CO=3.2
✅ Recomendação atualizada
```

#### Troubleshooting comum:

**Problema:** "⏳ Aguardando dados do Arduino..."  
**Solução:** Arduino não conectado, use rotas de teste ou verifique conexão USB.

**Problema:** "Erro ao conectar na porta COM3"  
**Solução:** Verifique a porta correta no Gerenciador de Dispositivos (Windows) ou com `ls /dev/tty*` (Linux/Mac).

**Problema:** Dados incorretos/instáveis  
**Solução:** Aguarde 2-3 minutos para estabilização dos sensores após ligar.

**Problema:** JSON vazio ou null  
**Solução:** Sistema ainda inicializando, aguarde 10-15 segundos após iniciar.

---

## 📞 Suporte

Para dúvidas sobre saúde respiratória:
- **SAMU:** 192
- **Bombeiros:** 193
- **CVV:** 188

Para alertas ambientais:
- **Defesa Civil:** 199
- **CETESB:** 0800-113560

---

**🌱 Respire melhor, viva melhor!**