const keys = require('./keys');
const redis = require('redis');

const redisClient = redis.createClient({
    host: keys.redisHost,
    port: keys.redisPort,
    retry_strategy: () => 1000
});

const sub = redisClient.duplicate();

function fib(index) {
    if (index < 2) return 1;
    return fib(index - 1) + fib(index - 2);
};

// Every time we get a new message or new index value run the fib function and the callback function
sub.on('message', (channel, message) => {
    // every time we get a new index value calculate the fib sequence of that index with fib function and store into a hash object called values  
    // the message or index as key and the result as value. 
    redisClient.hset('values', message, fib(parseInt(message)));
});

// anytime we insert a new value into redis, calculate the fib sequence of that value and toss it back to redis instance 
sub.subscribe('insert');

// "pg": "8.0.3"