const keys = require('./keys');

// Express app setup
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Postgres Client setup
const { Pool } = require('pg');
const pgClient = new Pool({
    user: keys.pgUser,
    host: keys.pgHost,
    database: keys.pgDatabase,
    password: keys.pgPassword,
    port: keys.pgPort
});

pgClient.on("connect", (client) => {
    client
      .query("CREATE TABLE IF NOT EXISTS values (number INT)")
      .catch((err) => console.error(err, 'Lost PG connection'));
  });

// Redis client setup
const redis = require('redis');
const redisClient = redis.createClient({
  host: keys.redisHost,
  port: keys.redisPort,
  retry_strategy: () => 1000
});

/* Make duplicate connections to redis b/c if we have a redis client that's listening or publishing information on retests, we have to make a duplicate connection b/c 
when a connection is turned into a connection that's going to listen or subscribe or publish information, it can't be used for other purposes
 */
const redisPublisher = redisClient.duplicate();

// Express route handlers
app.get('/', (req, res) => {
  res.send('Hi');
});

app.get('/values/all', async (req, res) => {
  const values = await pgClient.query('SELECT * FROM values');
  
  res.send(values.rows);
});

// Reach into redis and get all values submitted to redis with the indices and calculated values
app.get('/values/current', async (req, res) => {
  // Look at hash value inside redis instance and get all info. from it 
  redisClient.hgetall('values', (err, values) => {
    res.send(values);
  })
});

// Receive new values from React application
app.post('/values', async (req, res) => {
  const index = req.body.index;

  if(parseInt(index) > 40 ) {
    return res.status(422).send({ status: 'error', msg: 'Index too high'});
  }
  // We haven't yet calculated a value for this index yet
  redisClient.hset('values', index, 'Nothing yet!');

  // Look at redis publisher and publish a new insert event of that index.
  // this gets sent over to that worker process, wakes up the worker process & says hey it's time to pull a new value out of redis and start calculating the fibonacci value for it
  redisPublisher.publish('insert', index);

  // Add the new index submitted on to postgres
  pgClient.query('INSERT INTO values(number) VALUES($1)', [index]);

  res.send({ working: true });
});

app.listen(5000, err => {
  console.log('Listening');
});