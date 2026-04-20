import mqtt from 'mqtt';

const BROKER_URL = process.env.MQTT_BROKER_URL ?? 'mqtt://localhost:1883';
const CLIENT_ID = process.env.MQTT_CLIENT_ID ?? 'flipper12-backend';
const INPUT_TOPIC = 'flipper/inputs/#';

export function startMqttClient(): mqtt.MqttClient {
  const client = mqtt.connect(BROKER_URL, { clientId: CLIENT_ID });

  client.on('connect', () => {
    console.log(`[mqtt] connected to ${BROKER_URL}`);
    client.subscribe(INPUT_TOPIC, (err) => {
      if (err) {
        console.error(`[mqtt] subscribe error on ${INPUT_TOPIC}:`, err);
        return;
      }
      console.log(`[mqtt] subscribed to ${INPUT_TOPIC}`);
    });
  });

  client.on('reconnect', () => {
    console.log('[mqtt] reconnecting...');
  });

  client.on('close', () => {
    console.log('[mqtt] disconnected');
  });

  client.on('error', (err) => {
    console.error('[mqtt] error:', err);
  });

  client.on('message', (topic, payload) => {
    console.log(`[mqtt] ${topic} ${payload.toString()}`);
  });

  return client;
}
