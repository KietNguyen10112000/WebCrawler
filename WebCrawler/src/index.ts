import * as amqp from 'amqplib/callback_api'

import * as env from 'dotenv'

import Axios from 'axios'

import { MongoClient, Collection, Document as MongoDocument, Db } from 'mongodb';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const config = env.config().parsed

const htmlparser: HTMLParser = require('../build/Release/HTMLParser')
console.log(htmlparser.Hello())

let mongodb: MongoClient = null
let mongodbCollection: Collection<MongoDocument> = null

async function InitMongodb() {
  mongodb = (await MongoClient.connect(config.MONGO_HOST))
  mongodbCollection = mongodb.db(config.MONGO_DB).collection('BaoMoiArticle')
}

async function MakeHttpsReq(url:string) {
  
  const ret = await mongodbCollection.findOne({ URL: url })

  //we has this article, don't need parse again
  if (ret) {
    console.log(ret)
    mongodb.close()
    return
  }

  const response = await Axios.get(url)

  if (response.status != 200) {
    throw `HTTP request error with code: ${response.status}`
  }

  const article: ParsedArticle = htmlparser.ParseArticle(response.data)

  const record = {
    URL: article.URL,
    title: article.title,
    content: article.content,
    author: article.author
  }

  const insertedDoc = await mongodbCollection.insertOne(record)

  console.log(insertedDoc)

  mongodb.close()

}

async function Main() {
  await InitMongodb()
  await MakeHttpsReq(
    'https://baomoi.com/bai-viet-cua-tong-bi-thu-la-dinh-huong-chien-luoc-mang-tinh-thoi-dai/c/40753813.epi'
    //'https://baomoi.com/tp-ho-chi-minh-thong-tin-co-ca-mac-covid-19-mang-bien-the-omicron-la-khong-chinh-xac/c/41326655.epi'
  )
}

Main()

/* amqp.connect('amqp://localhost', function(error0, connection) {
  connection.createChannel(function(error1, channel) {
    if (error1) {
      throw error1;
    }
    var queue = 'hello';
    var msg = 'Hello world';

    channel.assertQueue(queue, {
      durable: false
    });

    channel.sendToQueue(queue, Buffer.from(msg));
    console.log(" [x] Sent %s", msg);

    
  });
});

amqp.connect('amqp://localhost', function(error0, connection) {
  if (error0) {
    throw error0;
  }
  connection.createChannel(function(error1, channel) {
    if (error1) {
      throw error1;
    }

    var queue = 'hello';

    channel.assertQueue(queue, {
      durable: false
    });

    console.log(" [*] Waiting for messages in %s. To exit press CTRL+C", queue);

    channel.consume(queue, function(msg) {
      console.log(" [x] Received %s", msg.content.toString());
    }, {
      noAck: true
    });
  });
}); */