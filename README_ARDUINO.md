# 🔌 Conexão Arduino via Serial Port

## 📋 Pré-requisitos

1. Arduino conectado via USB
2. Sensores de qualidade do ar conectados nas portas A0-A4
3. LEDs ou Relés conectados nas portas digitais 8-11 (para receber recomendações)
4. Driver USB-Serial instalado (normalmente já vem com o Arduino IDE)

## 🚀 Instalação

### 1. Instalar dependências
```bash
npm install serialport @serialport/parser-readline
```

### 2. Descobrir porta serial

**Windows (PowerShell):**
```powershell
Get-WmiObject Win32_SerialPort | Select-Object Name, DeviceID
```

Ou no **Gerenciador de Dispositivos** → Portas (COM e LPT)

**Linux/Mac:**
```bash
ls /dev/tty*
# Procure por /dev/ttyUSB0 ou /dev/ttyACM0
```

### 3. Configurar porta serial

Copie o arquivo `.env.example` para `.env`:
```bash
copy .env.example .env
```

Edite o `.env` e configure a porta:
```
ARDUINO_PORT=COM3
```

### 4. Upload do sketch no Arduino

1. Abra o Arduino IDE
2. Abra o arquivo `arduino/arduino_sketch.ino`
3. Selecione a placa e porta corretas
4. Clique em "Upload"

## 🎯 Como funciona

### 🔄 Comunicação Bidirecional

O sistema agora funciona em **duas direções**:

#### 📊 Arduino → Node.js (Dados dos sensores)
Formato JSON enviado pelo Arduino:
```json
{"pm25":12.5,"no2":50.3,"o3":100.2,"co":5.1,"umidade":55.5}
```

#### 📤 Node.js → Arduino (Recomendações)
Formato JSON enviado para o Arduino:
```json
{"fechar_janelas":true,"ativar_purificador":false,"usar_mascaras":false,"se_hidratar":true}
```

### Mapeamento de Hardware:

**Sensores (Entrada - Analógico):**
- **A0** → PM2.5 (µg/m³)
- **A1** → NO2 (µg/m³)
- **A2** → O3 (µg/m³)
- **A3** → CO (mg/m³)
- **A4** → Umidade (%)

**LEDs/Relés (Saída - Digital):**
- **Pino 8** → Fechar Janelas
- **Pino 9** → Ativar Purificador
- **Pino 10** → Usar Máscaras
- **Pino 11** → Se Hidratar/Controlar Umidade

## 📡 Rotas da API

### Verificar status do Arduino
```
GET http://localhost:3000/arduino-status
```

**Resposta:**
```json
{
  "conectado": true,
  "ultima_leitura": {
    "pm25": 12.5,
    "no2": 50.3,
    "o3": 100.2,
    "co": 5.1,
    "umidade": 55.5,
    "timestamp": "2025-01-05T14:30:00.000Z"
  }
}
```

### Obter recomendações baseadas nos dados do Arduino
```
GET http://localhost:3000/previsao-ar
```

## 🔧 Testando a conexão

Teste a conexão antes de iniciar o servidor:

**Windows:**
```bash
node -e "require('./arduino/arduino').conectar(); setTimeout(() => console.log(require('./arduino/arduino').obterDados()), 5000)"
```

**Linux/Mac:**
```bash
node -e "require('./arduino/arduino').conectar(); setTimeout(() => console.log(require('./arduino/arduino').obterDados()), 5000)"
```

## ▶️ Iniciar servidor

```bash
npm start
```

O servidor irá:
1. Conectar automaticamente ao Arduino
2. Aguardar 3 segundos para receber os primeiros dados
3. Atualizar as recomendações a cada 10 segundos

## 🔄 Fluxo de dados COMPLETO

```
┌─────────────┐       USB Serial      ┌─────────────┐
│   Arduino   │ ───── Dados ────────► │   Node.js   │
│  (Sensores) │                        │             │
│             │ ◄── Recomendações ──── │  (Processa) │
│  (LEDs/Relés)│                       └─────────────┘
└─────────────┘                               │
                                               ▼
                                         API JSON
```

### Passo a passo do fluxo:

1. **Arduino lê sensores** a cada 2 segundos
2. **Envia dados** via JSON para Node.js
3. **Node.js processa** e calcula recomendações
4. **Node.js envia** recomendações de volta para Arduino
5. **Arduino aciona** LEDs/Relés conforme recomendações
6. **API REST** disponibiliza dados para outros sistemas

## 📊 Logs esperados

```
🚀 Iniciando sistema via Arduino...
✅ Arduino conectado na porta COM3
📊 Dados recebidos: { pm25: 12.5, no2: 50.3, ... }
[14:30:00] ✅ Recomendação atualizada
📤 Recomendações enviadas: { fechar_janelas: true, ativar_purificador: false, ... }
```

No Serial Monitor do Arduino você verá:
```
{"pm25":12.5,"no2":50.3,"o3":100.2,"co":5.1,"umidade":55.5}
>> Janelas:1 Purif:0 Mask:0 Hidr:1
```

## ⚠️ Troubleshooting

### Erro: "Port not found"
- Verifique se o Arduino está conectado
- Confirme a porta serial no `.env`
- Verifique se outro programa está usando a porta (Arduino IDE, Serial Monitor)

### Erro: "Access denied"
- **Windows**: Execute como Administrador
- **Linux**: Adicione seu usuário ao grupo dialout: `sudo usermod -a -G dialout $USER`

### Dados não chegam
- Verifique se o sketch está carregado no Arduino
- Abra o Serial Monitor do Arduino IDE (115200 baud) e veja se os dados aparecem
- Feche o Serial Monitor antes de iniciar o servidor Node.js

### LEDs não acendem
- Verifique as conexões nos pinos 8-11
- Teste os LEDs diretamente com digitalWrite
- Adicione resistores de 220Ω em série com os LEDs
- Para relés, verifique se necessita driver (ULN2003 ou similar)

## 🔌 Esquema de Ligação

### LEDs (Simples):
```
Arduino Pino 8  ──[LED]──[220Ω]── GND
Arduino Pino 9  ──[LED]──[220Ω]── GND
Arduino Pino 10 ──[LED]──[220Ω]── GND
Arduino Pino 11 ──[LED]──[220Ω]── GND
```

### Relés (Cargas maiores):
```
Arduino Pino 8  ──► Módulo Relé Canal 1
Arduino Pino 9  ──► Módulo Relé Canal 2
Arduino Pino 10 ──► Módulo Relé Canal 3
Arduino Pino 11 ──► Módulo Relé Canal 4
GND ──► GND do Módulo
5V  ──► VCC do Módulo
```

## 📝 Adaptando para seus sensores

Edite `arduino/arduino_sketch.ino` e ajuste as fórmulas de conversão conforme a especificação dos seus sensores:

```cpp
// Exemplo para sensor MQ-135
float no2 = (analogRead(A1) * 5.0 / 1024.0) * 100; // Sua fórmula aqui
```

## 🎯 Próximos passos

- [ ] Calibrar sensores com valores reais
- [ ] Adicionar mais sensores se necessário
- [ ] Implementar histórico de leituras
- [ ] Adicionar alertas sonoros no Arduino
- [ ] Implementar display LCD para mostrar recomendações
- [ ] Adicionar botões físicos para controle manual
