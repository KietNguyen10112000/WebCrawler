import * as amqp from 'amqplib/callback_api'

import * as env from 'dotenv'

import Axios from 'axios'

import { MongoClient, Collection, Document as MongoDocument, Db } from 'mongodb';

import { Mutex, Semaphore, withTimeout } from 'async-mutex';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const config = env.config().parsed

const htmlparser: HTMLParser = require('../build/Release/HTMLParser')
console.log(htmlparser.Hello())

let mongodb: MongoClient = null
let mongodbCollection: Collection<MongoDocument> = null
let mongodbParsedCollection: Collection<MongoDocument> = null
let mongodbInQueueCollection: Collection<MongoDocument> = null

let amqpConn: any = null
let amqpChannel: any = null
let amqpOk: boolean = false
const amqpQueueName = 'BaoMoiURLs'


async function InitMongodb() {
  mongodb = (await MongoClient.connect(config.MONGO_HOST))
  mongodbCollection = mongodb.db(config.MONGO_DB).collection(config.MONGO_COLLECTION_ARTICLE)
  mongodbParsedCollection =  mongodb.db(config.MONGO_DB).collection(config.MONGO_COLLECTION_PARSED_URL)
  mongodbInQueueCollection = mongodb.db(config.MONGO_DB).collection(config.MONGO_COLLECTION_INQUEUE_URL)
}

async function InsertLinks(links: Array<String>) {
  for (let i = 0; i < links.length; i++) {
    const element = links[i];

    if (element.indexOf(config.ROOT_URL) == -1) continue

    //if (element.indexOf("https://baomoi.com/browse/fanned_pages") != -1) continue
    //if (element.indexOf('https://vnexpress.net/so-hoa/tech-awards-') != -1) continue

    const ret = await mongodbParsedCollection.findOne({ URL: element })
      //we has this article, don't need parse again
    if (ret) {
      continue
    }
    await mongodbParsedCollection.insertOne({ URL: element })

    amqpChannel.sendToQueue(amqpQueueName, Buffer.from(element))
  }
}

const AXIOS_TIME_OUT = parseInt(config.AXIOS_TIME_OUT)
Axios.defaults.timeout = AXIOS_TIME_OUT;

async function CrawlArticle(url:string) {
  const response = await Axios.get(url, { timeout: AXIOS_TIME_OUT })
  
  if (!response) {
    console.log('[AXIOS TIMEOUT]')
    return
  }

  if (response.status != 200) {
    //throw `HTTP request error with code: ${response.status}`
    return
  }

  const article: ParsedArticle = htmlparser.ParseArticle(response.data)

  if(article.content.length == 0) {
    console.log(`[SKIP URL]: ${url}`)
    return
  }

  const record = {
    tag: article.tag,
    URL: article.URL.length == 0 ? url : article.URL,
    title: article.title,
    content: article.content,
    author: article.author
  }

  await mongodbCollection.insertOne(record)

  console.log(`[CRAWLED URL]: ${article.URL}`)

  await InsertLinks(article.links)
}

async function CrawlLinks(url:string) {
  const response = await Axios.get(url, { timeout: AXIOS_TIME_OUT })

  if (response.status != 200) {
    return
  }

  const links = htmlparser.ParseExternalLinks(response.data)

  await InsertLinks(links)
}

async function BootstrapRabbitMQ() {
  if (config.RABBITMQ_ALLOW_BOOTSTRAP != 'allow') {
    return
  }

  const response = await Axios.get(config.ROOT_URL)

  const links = htmlparser.ParseExternalLinks(response.data)

  await InsertLinks(links)

  amqpOk = true

}

function InitRabbitMQ() {
  console.log(`${config.AMQP_HOST}`)
  amqp.connect(config.AMQP_HOST, function(error0, connection) {
    amqpConn = connection
    amqpChannel = amqpConn.createChannel()

    amqpChannel.assertQueue(amqpQueueName, {
      durable: false
    }, function(err, ok) {
      console.log(ok);

      if (ok.messageCount == 0) {
        BootstrapRabbitMQ()
      } else {
        amqpOk = true
      }

    });
  })
}

function CleanUp() {
  if (mongodb) mongodb.close()
  if (amqpConn) amqpConn.close()
}


const DELTA_TIME_WORK: number = parseInt(config.DELTA_TIME_WORK)
//const URL_REGEX: RegExp = /^https:\/\/baomoi.com\/+[a-zA-Z0-9\-]+\/c\/+[0-9]+\.epi+$/
const URL_REGEX: RegExp = /^https:\/\/vnexpress.net\/+[a-zA-Z0-9\-]+\.html+$/
let workingCount: number = 0
const mutex: Mutex = new Mutex();

function StartWorker() {
  console.log("[START WORKER]")

  amqpChannel.prefetch(1);

  amqpChannel.consume(amqpQueueName, async function(msg) {

    workingCount++;

    const url: string = msg.content.toString()

    if (url.indexOf(config.ROOT_URL) != -1 
      /* && url.indexOf('https://vnexpress.net/so-hoa/tech-awards-') == -1 */
      /* && url.indexOf("https://baomoi.com/browse/fanned_pages") == -1 */) {

      console.log("[RECEIVED FROM RABBITMQ]: %s", msg.content.toString());

      try {
        if (URL_REGEX.test(url)) {
          await CrawlArticle(url)
        } else {
          await CrawlLinks(url)
        }
      } catch (error) {
        console.log(`[SKIP ERROR]`)
      }
    }

    setTimeout(function() {
      amqpChannel.ack(msg);
    }, DELTA_TIME_WORK);

    //console.log(msg.fields.deliveryTag)
  }, {
    noAck: false
  });



}


const DELTA_TIME_CHECK: number = 1000//ms
const NUM_TIME_QUEUE_EMPTY: number = parseInt(config.NUM_TIME_QUEUE_EMPTY)
let numTimeCheckEmpty: number = 0

const NUM_TIME_WORKING_RPL_TIME: number = 2
let preWorkingCount: number = 0
let preWkCountRplTime: number= 0
function StartQueueChecker() {

  if (preWorkingCount == workingCount) {
    preWkCountRplTime++

    if (preWkCountRplTime > NUM_TIME_WORKING_RPL_TIME) {
      StartWorker()
    }
  } else {
    preWorkingCount = workingCount
    preWkCountRplTime = 0
  }

  amqpChannel.assertQueue(amqpQueueName, {
    durable: false
  }, function(err, ok) {
    if (err) { 
      CleanUp()
      process.exit(1)
    }

    if (ok.messageCount == 0) {
      numTimeCheckEmpty++

      if (numTimeCheckEmpty > NUM_TIME_QUEUE_EMPTY) {
        CleanUp()
        process.exit(1)
      }

      console.log(`[${numTimeCheckEmpty}]: Waiting new URL from RabbitMQ ...`)

    } else {
      numTimeCheckEmpty = 0
    }
    setTimeout(StartQueueChecker, DELTA_TIME_CHECK)
  });

  
}

async function ClearRabbitMQ() {
  amqpChannel.consume(amqpQueueName, async function(msg) {
  }, {
    noAck: true
  });

  const check = () => {
    amqpChannel.assertQueue(amqpQueueName, {
      durable: false
    }, function(err, ok) {
      if (err) { 
        CleanUp()
        process.exit(1)
      }
      if (ok.messageCount == 0) {
        CleanUp()
        process.exit(0)
      } else {
        setTimeout(check, DELTA_TIME_CHECK)
      }
    });
  }

  setTimeout(check, DELTA_TIME_CHECK)
}

async function Main() {
  InitRabbitMQ()

  console.log('[INFO]: Waiting to connect RabbitMQ ...')
  while (!amqpOk) {
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log('[INFO]: Waiting to connect MongoDB ...')
  await InitMongodb()

  /* await CrawlArticle(
    //'https://baomoi.com/bai-viet-cua-tong-bi-thu-la-dinh-huong-chien-luoc-mang-tinh-thoi-dai/c/40753813.epi'
    //'https://baomoi.com/tp-ho-chi-minh-thong-tin-co-ca-mac-covid-19-mang-bien-the-omicron-la-khong-chinh-xac/c/41326655.epi'
    //'https://baomoi.com/bai-viet-cua-tong-bi-thu-nguyen-phu-trong-tiep-them-niem-tin-ve-con-duong-di-len-chu-nghia-xa-hoi/c/40191247.epi'
    //'https://vnexpress.net/them-14-440-ca-nhiem-4409384.html'
    'https://vnexpress.net/bon-noi-dung-quoc-hoi-xem-xet-tai-ky-hop-bat-thuong-4409254.html'
  ) */

  if (config.RABBITMQ_CLEAR == 'true') {
    console.log('[INFO]: Waiting to clear RabbitMQ queue ...')
    ClearRabbitMQ()
  } else {
    StartWorker()
    StartQueueChecker()
  }

}

Main()

/* CrawlArticle(
  'https://vnexpress.net/them-14-440-ca-nhiem-4409384.html'
) */

//let reg: RegExp = /^https:\/\/baomoi.com\/[a-zA-Z0-9]\/c\/[0-9]\.epi/
//let reg: RegExp = /^https:\/\/baomoi.com\/+[a-zA-Z0-9\-]+\/c\/+[0-9]+\.epi+$/
//console.log(reg.test('https://baomoi.com/bai-viet-cua-tong-bi-thu-la-dinh-huong-chien-luoc-mang-tinh-thoi-dai/c/40753813.epi'))