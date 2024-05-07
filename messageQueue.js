const amqp = require('amqplib/callback_api');

class RabbitMQ {
  constructor(rabbitMQUrl) {
    this.url = rabbitMQUrl || 'amqp://localhost:5672'; 
    this.connection = null;
    this.channel = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      amqp.connect(this.url, (err, conn) => {
        if (err) {
          reject(err);
          return;
        }
        this.connection = conn;
        this.createChannel().then(resolve, reject);
      });
    });
  }

  async createChannel() {
    return new Promise((resolve, reject) => {
      this.connection.createChannel((err, ch) => {
        if (err) {
          reject(err);
          return;
        }
        this.channel = ch;
        resolve();
      });
    });
  }

  async sendMessageToQueue(queueName, data) {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not connected');
    }
    const message = JSON.stringify(data);
    await this.channel.sendToQueue(queueName, Buffer.from(message));
  }

  closeConnection() {
    if (this.connection) {
      this.connection.close();
      this.connection = null;
      this.channel = null;
    }
  }
}

module.exports = RabbitMQ;
