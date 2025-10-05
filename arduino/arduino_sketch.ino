// Sketch Arduino para enviar dados de sensores e receber recomendações
// Sensores conectados nas portas A0-A4
// LEDs/Relés conectados nas portas digitais 8-12

// Pinos dos LEDs/Relés para as recomendações
#define LED_FECHAR_JANELAS 8
#define LED_ATIVAR_PURIFICADOR 9
#define LED_USAR_MASCARAS 10
#define LED_SE_HIDRATAR 11
#define LED_TEMPO_CATEGORIA 12  // LED indicador de urgência

String inputString = "";
boolean stringComplete = false;

void setup() {
    Serial.begin(9600);

    // Configura pinos dos sensores
    pinMode(A0, INPUT); // Sensor PM2.5
    pinMode(A1, INPUT); // Sensor NO2
    pinMode(A2, INPUT); // Sensor O3
    pinMode(A3, INPUT); // Sensor CO
    pinMode(A4, INPUT); // Sensor Umidade

    // Configura pinos dos LEDs/Relés como saída
    pinMode(LED_FECHAR_JANELAS, OUTPUT);
    pinMode(LED_ATIVAR_PURIFICADOR, OUTPUT);
    pinMode(LED_USAR_MASCARAS, OUTPUT);
    pinMode(LED_SE_HIDRATAR, OUTPUT);
    pinMode(LED_TEMPO_CATEGORIA, OUTPUT);

    // Inicia com todos os LEDs desligados
    digitalWrite(LED_FECHAR_JANELAS, LOW);
    digitalWrite(LED_ATIVAR_PURIFICADOR, LOW);
    digitalWrite(LED_USAR_MASCARAS, LOW);
    digitalWrite(LED_SE_HIDRATAR, LOW);
    digitalWrite(LED_TEMPO_CATEGORIA, LOW);

    inputString.reserve(200);
}

void loop() {
    // Lê valores dos sensores (adapte conforme seus sensores reais)
    float pm25 = analogRead(A0) * 0.1;     // PM2.5 em µg/m³
    float no2 = analogRead(A1) * 0.5;      // NO2 em µg/m³
    float o3 = analogRead(A2) * 0.3;       // O3 em µg/m³
    float co = analogRead(A3) * 0.2;       // CO em mg/m³
    float umidade = analogRead(A4) * 0.09; // Umidade em %

    // Envia JSON com dados dos sensores
    Serial.print("{\"pm25\":");
    Serial.print(pm25, 2);
    Serial.print(",\"no2\":");
    Serial.print(no2, 2);
    Serial.print(",\"o3\":");
    Serial.print(o3, 2);
    Serial.print(",\"co\":");
    Serial.print(co, 2);
    Serial.print(",\"umidade\":");
    Serial.print(umidade, 2);
    Serial.println("}");

    // Processa recomendações recebidas via serial
    if (stringComplete) {
        processarRecomendacoes(inputString);
        inputString = "";
        stringComplete = false;
    }

    delay(2000); // Aguarda 2 segundos
}

// Função chamada automaticamente quando chega dados na serial
void serialEvent() {
    while (Serial.available()) {
        char inChar = (char)Serial.read();
        inputString += inChar;
        if (inChar == '\n') {
            stringComplete = true;
        }
    }
}

// Processa JSON de recomendações recebido
void processarRecomendacoes(String json) {
    // Parse simples do JSON (ou use biblioteca ArduinoJson para JSON complexo)
    boolean fechar_janelas = json.indexOf("\"fechar_janelas\":true") > 0;
    boolean ativar_purificador = json.indexOf("\"ativar_purificador\":true") > 0;
    boolean usar_mascaras = json.indexOf("\"usar_mascaras\":true") > 0;
    boolean se_hidratar = json.indexOf("\"sehidratar_controlar_humidade\":true") > 0;

    // Extrai tempo_categoria (0, 1, 2 ou 3)
    int tempo_categoria = 0;
    int idx = json.indexOf("\"tempo_categoria\":");
    if (idx > 0) {
        tempo_categoria = json.substring(idx + 18, idx + 19).toInt();
    }

    // Aciona LEDs/Relés conforme as recomendações
    digitalWrite(LED_FECHAR_JANELAS, fechar_janelas ? HIGH : LOW);
    digitalWrite(LED_ATIVAR_PURIFICADOR, ativar_purificador ? HIGH : LOW);
    digitalWrite(LED_USAR_MASCARAS, usar_mascaras ? HIGH : LOW);
    digitalWrite(LED_SE_HIDRATAR, se_hidratar ? HIGH : LOW);

    // LED de urgência pisca conforme tempo_categoria
    // 0=Desligado, 1=Lento, 2=Médio, 3=Rápido
    if (tempo_categoria == 0) {
        digitalWrite(LED_TEMPO_CATEGORIA, LOW);
    } else if (tempo_categoria >= 2) {
        digitalWrite(LED_TEMPO_CATEGORIA, HIGH); // Urgente = sempre ligado
    } else {
        // Pisca lento para categoria 1
        digitalWrite(LED_TEMPO_CATEGORIA, millis() % 1000 < 500 ? HIGH : LOW);
    }

    // Debug: imprime status
    Serial.print(">> Janelas:");
    Serial.print(fechar_janelas);
    Serial.print(" Purif:");
    Serial.print(ativar_purificador);
    Serial.print(" Mask:");
    Serial.print(usar_mascaras);
    Serial.print(" Hidr:");
    Serial.print(se_hidratar);
    Serial.print(" Tempo:");
    Serial.println(tempo_categoria);
}
