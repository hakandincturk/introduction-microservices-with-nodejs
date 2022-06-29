
import * as express from 'express'
import { Request, Response } from 'express';
import * as cors from 'cors'
import { createConnection } from 'typeorm'
import * as amqp from 'amqplib/callback_api'
import { Product } from './entity/Product';
import axios from 'axios';

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
        try {
          const eventProduct: Product = JSON.parse(msg.content.toString())

          const product = await productRepository.findOne({ admin_id: parseInt(eventProduct.id) });

          productRepository.merge(product, {
            title: eventProduct.title,
            image: eventProduct.image,
            likes: eventProduct.likes
          })

          await productRepository.save(product)
          consola.success({ message: `product updated, ${product.id}`, badge: true });

        } catch (dbError) {
          consola.error({ message: `product not updated, ${dbError.message}`, badge: true });
        }
      }, { noAck: true });

      channel.consume('product_deleted', async (msg) => {
        try {
          const admin_id = parseInt(msg.content.toString());
          await productRepository.deleteOne({ admin_id });

          consola.success({ message: `product deleted, ${admin_id}`, badge: true });

        } catch (dbError) {
          consola.error({ message: `product not deleted, ${dbError.message}`, badge: true });
        }
      }, { noAck: true })

      app.get('/api/products', async (req: Request, res: Response) => {
        const products = await productRepository.find();

        return res.send(products);
      })

      app.post('/api/products/:id/like', async (req: Request, res: Response) => {
        try {
          const product = await productRepository.findOne({ where: { id: req.params.id } })

          await axios.post(`http://localhost:8000/api/products/${product.admin_id}/like`, {})
          product.likes++;
          await productRepository.save(product)
          return res.json({ type: true, message: 'succesfull', data: product });

        } catch (dbError) {
          consola.error({ message: `product not deleted, ${dbError.message}`, badge: true });
        }
      })


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