const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.MONGO_URI;

// middleware
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    await client.connect();
    const database = client.db("legalEaseDB");
    const usersCollection = database.collection("user");

    //all user get api
    app.get("/api/users", async (req, res) => {
      const query = {};
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // lawyers Api
    app.get("/api/lawyers", async (req, res) => {
      const query = {
        userType: "lawyer",
        completeProfile: true,
      };
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });
    // signle lawyer get Api
    app.get("/api/lawyers/:id", async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id),
      };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });

    // update user type
    app.patch("/api/users/:id", async (req, res) => {
      const id = req.params.id;
      const { userType } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateData = {
        $set: {
          userType: userType,
        },
      };

      const result = await usersCollection.updateOne(filter, updateData);
      res.send(result);
    });

    const result = await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
    return result;
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
