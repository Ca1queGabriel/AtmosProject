module.exports = {
    PORTA_SERIAL: process.env.ARDUINO_PORT || 'COM3', // Windows: COM3, Linux/Mac: /dev/ttyUSB0
    BAUD_RATE: 9600,
    INTERVALO_LEITURA: 2000 // ms entre leituras
};