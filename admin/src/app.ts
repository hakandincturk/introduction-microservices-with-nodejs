//C:\Users\hakan\OneDrive\Desktop\code\js\nodeJs\microservices\ex1\admin

import * as express from 'express'
import { Request, Response } from 'express';
import * as cors from 'cors'
import { createConnection } from 'typeorm'
import { Product } from './entity/Product';
import * as amqp from 'amqplib/callback_api'

const consola = require('consola');

createConnection().then(db => {

  const productRepository = db.getRepository(Product);

  amqp.connect('amqps://nztaiger:Lun5OT9tHUlr2ZizcqsiTN_0bJ06qLgR@cow.rmq2.cloudamqp.com/nztaiger', (error0, connection) => {
    if (error0) throw error0

    connection.createChannel((error1, channel) => {
      if (error1) throw error1

      const app = express()

      app.use(cors({
        origin: ['http://localhost:3000', 'http://localhost:8080', 'http://localhost:4200',]
      }))

      app.use(express.json())

      app.get('/api/products', async (req: Request, res: Response) => {
        try {
          const products = await productRepository.find();
          res.json({ type: true, data: products });
        } catch (error) {
          res.json({ type: false, data: error.message });
        }
      });

      app.post('/api/products', async (req: Request, res: Response) => {
        try {
          const product = await productRepository.create({
            title: req.body.title,
            image: req.body.image
          });

          const result = await productRepository.save(product);
          channel.sendToQueue('product_created', Buffer.from(JSON.stringify(result)));
          res.json({ type: true, data: result });
        } catch (error) {
          res.json({ type: false, data: error.message });
        }
      });

      app.get('/api/products/:id', async (req: Request, res: Response) => {
        try {
          const product = await productRepository.findOne({ where: { id: parseInt(req.params.id, 10) } });


          res.json({ type: true, data: product });
        } catch (error) {
          res.json({ type: false, data: error.message });
        }
      })

      app.put('/api/products/:id', async (req: Request, res: Response) => {
        try {
          const product = await productRepository.findOne({ where: { id: parseInt(req.params.id, 10) } });
          productRepository.merge(product, req.body)
          const result = await productRepository.save(product);

          channel.sendToQueue('product_updated', Buffer.from(JSON.stringify(result)));

          res.json({ type: true, data: result });
        } catch (error) {
          res.json({ type: false, data: error.message });
        }
      })

      app.delete('/api/products/:id', async (req: Request, res: Response) => {

        try {
          const result = await productRepository.delete(req.params.id);

          channel.sendToQueue('product_deleted', Buffer.from(req.params.id));

          res.json({ type: true, data: result });
        } catch (error) {
          res.json({ type: false, data: error.message });
        }
      })

      app.post('/api/products/:id/like', async (req: Request, res: Response) => {
        try {
          const product = await productRepository.findOne({ where: { id: parseInt(req.params.id, 10) } });
          product.likes++;
          const result = await productRepository.save(product);
          res.json({ type: true, data: result });
        } catch (error) {
          res.json({ type: false, data: error.message });
        }
      })


      app.listen(8000, () => {
        consola.success({ message: 'SERVER LISTENING ON PORT 8000', badge: true })
      })

      process.on('beforeExit', () => {
        consola.info({ message: 'CONNECTION CLOSING', badge: true })
        connection.close();
      })

    });
  });
});