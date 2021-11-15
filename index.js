const express = require('express')
const app = express()
const cors = require('cors');
const admin = require("firebase-admin");
require('dotenv').config();
const { MongoClient } = require('mongodb');
const ObjectId = require('mongodb').ObjectId;


const port = process.env.PORT || 5000;

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

app.use(cors());
app.use(express.json());

console.log(process.env.DB_PASS)

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.7xnb9.mongodb.net/myFirstDatabase`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });


async function verifyToken(req, res, next) {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const token = req.headers.authorization.split(' ')[1];

        try {
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        }
        catch {

        }

    }
    next();
}

async function run() {
    await client.connect();
    const database = client.db('paprii');
    // const appointmentsCollection = database.collection('appointments');
    const usersCollection = database.collection('users');
    const productsCollection = database.collection('products');
    const orderCollection = database.collection('orders');
    const reviewsCollection = database.collection('reviews');
    try {
        app.post('/products', async (req, res) => {
            const products = req.body;
            console.log('hit the post api', products);
            const result = await productsCollection.insertOne(products);
            console.log(result);
            res.json(result)
        });
        // GET API
        app.get('/products', async (req, res) => {
            const cursor = productsCollection.find({});
            const products = await cursor.toArray();
            res.send(products);
        });
        // GET Single Service
        app.get('/products/:id', async (req, res) => {
            console.log("hghghg");
            const id = req.params.id;
            console.log('getting specific service', id);
            const query = { _id: ObjectId(id) };
            const service = await productsCollection.findOne(query);
            res.json(service);
        });
        // DELETE API
        app.delete('/products/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await productsCollection.deleteOne(query);
            res.json(result);
        })
        //UPDATE API
        app.put('/products/:id', async (req, res) => {
            const id = req.params.id;
            const updatedProduct = req.body;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    productTitle: updatedProduct.productTitle,
                    price: updatedProduct.price,
                    quantity: updatedProduct.quantity,
                    description: updatedProduct.description,
                    img: updatedProduct.img,
                },
            };
            const result = await productsCollection.updateOne(filter, updateDoc, options)
            console.log('updating', id)
            res.json(result)
        });
        // reviews post api
        app.post('/reviews', async (req, res) => {
            console.log("sjdksk")
            const review = req.body;
            review.createdAt = new Date();
            const result = await reviewsCollection.insertOne(review);
            res.json(result);
        });
        // REVIEW GET  API
        app.get('/reviews', async (req, res) => {
            const cursor = reviewsCollection.find({});
            const reviews = await cursor.toArray();
            console.log(reviews)
            res.send(reviews);
        });
        // order post api
        app.post('/orders', async (req, res) => {
            console.log("sjdksk")
            const order = req.body;
            order.createdAt = new Date();
            const result = await orderCollection.insertOne(order);
            res.json(result);
        })
        // ORDER GET  API
        app.get('/orders', async (req, res) => {
            const cursor = orderCollection.find({});
            const orders = await cursor.toArray();
            console.log(orders)
            res.send(orders);
        });
        // ORDER DELETE API
        app.delete('/orders/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await orderCollection.deleteOne(query);

            console.log('deleting user with id ', result);

            res.json(result);
        })
        app.post('/orders/status', async (req, res) => {
            const status = req.body;
            console.log(status);
            let result;
            if (status.status === 0) {
                result = await orderCollection.updateOne({ _id: ObjectId(status._id) }, { $set: { status: 1 } });
            } else {
                result = await orderCollection.updateOne({ _id: ObjectId(status._id) }, { $set: { status: 0 } });
            }
            res.json(result);
        });
        app.post('/my-orders', async (req, res) => {
            console.log("hyfghfgh")
            const userEmail = req.body.email;
            const cursor = orderCollection.find({ email: userEmail });
            const orders = await cursor.toArray();
            res.send(orders);

        })
        app.get('/users/:email', async (req, res) => {
            console.log("jhjh", req.params.email);
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let isAdmin = false;
            if (user?.role === 'admin') {
                isAdmin = true;
            }
            res.json({ admin: isAdmin });
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            // console.log(result);
            res.json(result);
        });

        app.put('/users', async (req, res) => {
            const user = req.body;
            const filter = { email: user.email };
            const options = { upsert: true };
            const updateDoc = { $set: user };
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.json(result);
        });
        app.put('/users/admin', verifyToken, async (req, res) => {
            const user = req.body;

            const requester = req.decodedEmail;
            // console.log(requester)
            if (requester) {
                const requesterAccount = await usersCollection.findOne({ email: requester });
                if (requesterAccount.role === 'admin') {
                    const filter = { email: user.email };
                    const updateDoc = { $set: { role: 'admin' } };
                    const result = await usersCollection.updateOne(filter, updateDoc);
                    res.json(result);
                }
            }
            else {
                res.status(403).json({ message: 'you do not have access to make admin' })
            }
        })
    }
    finally {
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello Doctors portal!')
})

app.listen(port, () => {
    console.log(`listening at ${port}`)
})