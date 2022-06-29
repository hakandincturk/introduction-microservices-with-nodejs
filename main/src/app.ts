
import * as express from 'express'
import { Request, Response } from 'express';
import * as cors from 'cors'
import { createConnection } from 'typeorm'
import * as amqp from 'amqplib/callback_api'
import { Product } from './entity/Product';

const consola = require('consola');


createConnection().then(db => {

  const productRepository = db.getMongoRepository(Product);

  amqp.connect('amqps://nztaiger:Lun5OT9tHUlr2ZizcqsiTN_0bJ06qLgR@cow.rmq2.cloudamqp.com/nztaiger', (error0, connection) => {
    if (error0) throw error0

    connection.createChannel((error1, channel) => {
      if (error1) throw error1

      channel.assertQueue('product_created', { durable: false });
      channel.assertQueue('product_updated', { durable: false });
      channel.assertQueue('product_deleted', { durable: false });

      const app = express()

      app.use(cors({
        origin: ['http://localhost:3000', 'http://localhost:8080', 'http://localhost:4200',]
      }))

      app.use(express.json())

      channel.consume('product_created', async (msg) => {
        try {

          const eventProduct: Product = JSON.parse(msg.content.toString())

          const product = new Product();
          product.admin_id = parseInt(eventProduct.id);
          product.title = eventProduct.title;
          product.image = eventProduct.image;
          product.likes = eventProduct.likes;

          const result = await productRepository.save(product);

          consola.success({ message: `product created, ${product.id}`, badge: true });

        } catch (dbError) {
          consola.error({ message: `product not created, ${dbError.message}`, badge: true });
        }
      }, { noAck: true });

      channel.consume('product_updated', async (msg) => {

      });


      app.listen(8001, () => {
        consola.success({ message: 'SERVER LISTENING ON PORT 8001', badge: true })
      })

      process.on('beforeExit', () => {
        consola.info({ message: 'CONNECTION CLOSING', badge: true })
        connection.close();
      })
    })
  })
});