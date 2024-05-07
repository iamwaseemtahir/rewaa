const express = require('express');
const mongoose = require('mongoose');
const redis = require('redis'); 
const RabbitMQ = require('./messageQueue');

const rabbitMQ = new RabbitMQ('amqp://localhost:5672'); 

const app = express();
const port = process.env.PORT || 30000;
app.use(express.json()) 
app.use(express.urlencoded({ extended: true }))


const mongoUrl = 'mongodb://localhost:27017/rewaa_sensors_db';
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Error connecting to MongoDB:', err));

/*This is defined here for simplicity, in a real-world production app we'd define this inside a separate file
  inside models folder and reference it in a service/controller*/
const sensorDataSchema = new mongoose.Schema({
  requestId: {
    type: String,
    required: true,
    unique: true 
  },
  sensorId: {
    type: Number,
    required: true
  },
  data: {
    type: Object,
    required: true
  }
});

const SensorData = mongoose.model('SensorData', sensorDataSchema);
const cacheClient = redis.createClient('redis://localhost:6379');
cacheClient.connect()

cacheClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

// Handle successful connection
cacheClient.on('connect', () => {
  console.log('Connected to Redis server');
})

//In a real world system we'd defined routes in a separate routes file or multiple files.
app.post('/data', async (req, res) => {
  const { requestId, sensorId, data } = req.body;

  // Check for duplicate request in cache
  const cachedValue = await cacheClient.get(requestId);
  if (cachedValue) {
    return res.status(200).send('Data already received');
  }

  // Process and validate data (replace with your logic)
  const processedData = { requestId, sensorId, data }; 

  /*Rabbitmq is not used here extensively but in our real world system rabbitmq would be dealing 
    with all injestions from sensors. For simplicity we're using restful api here.
  */
  await rabbitMQ.sendMessageToQueue('rewaa-sensor-queue', processedData);

  // Persist data asynchronously using promises
  try {
    const newSensorData = new SensorData(processedData);
    await newSensorData.save();
    console.log('Data saved successfully:', newSensorData);
    await cacheClient.set(requestId, sensorId, 'EX', 60); // Cache for 1 minute to prevent duplicates
    res.status(201).send('Data received successfully');
  } catch (err) {
    console.error('Error saving data:', err);
    res.status(500).send('Error processing data');
  } finally {
    console.log('done')
  }
});

app.listen(port,async () => 
 {
    console.log(`Server listening on port ${port}`)
    await rabbitMQ.connect(); 

});

