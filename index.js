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
    // await client.connect();
    const database = client.db("legalEaseDB");
    const usersCollection = database.collection("user");
    const paymentCollection = database.collection("payment");
    const hireRequestsCollection = database.collection("hiringRequest");

    //all user get api
    app.get("/api/users", async (req, res) => {
      const query = {};
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // update user info api
    app.patch("/api/update-users/:id", async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;
      const query = {
        _id: new ObjectId(id),
      };
      const updateData = {
        $set: updatedData,
      };
      const result = await usersCollection.updateOne(query, updateData);
      res.send(result);
    });

    // lawyers Api
    app.get("/api/lawyers", async (req, res) => {
      const query = {
        userType: "lawyer",
        completeProfile: true,
      };
      if (req.query.search) {
        const searchRegex = { $regex: req.query.search, $options: "i" };

        query.$or = [
          { name: searchRegex },
          { "specialization.name": searchRegex },
          { location: searchRegex },
        ];
      }
      if (
        req.query.specialization &&
        req.query.specialization !== "Select Specialization"
      ) {
        query["specialization.name"] = req.query.specialization;
      }
      if (req.query.maxFee) {
        const maxFeeValue = parseInt(req.query.maxFee);
        if (!isNaN(maxFeeValue)) {
          query["fee.amount"] = { $lte: maxFeeValue };
        }
      }
      if (req.query.availability) {
        const statuses = req.query.availability.split(",");
        query.status = { $in: statuses };
      }

      if (req.query.experience) {
        const ranges = req.query.experience.split(",");

        const experienceConditions = [];

        ranges.forEach((range) => {
          if (range === "0 - 2 Years") {
            experienceConditions.push({
              experience: { $gte: 0, $lte: 2 },
            });
          }

          if (range === "3 - 5 Years") {
            experienceConditions.push({
              experience: { $gte: 3, $lte: 5 },
            });
          }

          if (range === "5+ Years") {
            experienceConditions.push({
              experience: { $gt: 5 },
            });
          }
        });

        if (experienceConditions.length > 0) {
          query.$and = query.$and || [];
          query.$and.push({
            $or: experienceConditions,
          });
        }
      }

      let sortOptions = { createdAt: -1 };

      if (req.query.sortBy) {
        const sortVal = req.query.sortBy.trim();

        if (sortVal === "Rating") {
          sortOptions = { rating: -1 };
        } else if (sortVal === "PriceLow") {
          sortOptions = { "fee.amount": 1 };
        } else if (sortVal === "Newest") {
          sortOptions = { createdAt: -1 };
        }
      }
      const result = await usersCollection
        .find(query)
        .sort(sortOptions)
        .toArray();
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

    // updateLawyerProfile
    app.patch("/api/lawyers/:id", async (req, res) => {
      const id = req.params.id;
      const userData = req.body;

      const filter = { _id: new ObjectId(id) };
      const updateData = {
        $set: userData,
      };

      const result = await usersCollection.updateOne(filter, updateData);
      res.send(result);
    });
    // hiring request api
    app.post("/api/hire-request", async (req, res) => {
      const requestData = req.body;

      if (!requestData.lawyerId || !requestData.clientEmail) {
        return res.status(400).send({
          success: false,
          message: "Required fields (lawyerId, clientEmail) are missing!",
        });
      }

      const newHireRequest = {
        lawyerId: requestData.lawyerId,
        lawyerName: requestData.lawyerName,
        lawyerEmail: requestData.lawyerEmail,
        clientId: requestData.clientId,
        clientName: requestData.clientName,
        clientEmail: requestData.clientEmail,
        fee: Number(requestData.fee),
        specialization: requestData.specialization,

        status: "pending",
        paymentStatus: "unpaid",
        createdAt: new Date(),
      };

      const result = await hireRequestsCollection.insertOne(newHireRequest);

      res.send(result);
    });

    // request already exist
    app.get("/api/hiring", async (req, res) => {
      const query = {
        clientId: req.query.clientId,
        lawyerId: req.query.lawyerId,
      };

      const result = await hireRequestsCollection.findOne(query);
      res.json(result);
    });

    // update hiring request status
    app.patch("/api/update-hiring-status", async (req, res) => {
      const { status } = req.body;
      const query = {
        clientId: req.query.clientId,
        lawyerId: req.query.lawyerId,
      };
    
      const result = await hireRequestsCollection.updateOne(query, {
        $set: {
          status: status,
        },
      });
      console.log(result);
      res.send(result);
    });
    // get hiring request history
    app.get("/api/client/hiring-request", async (req, res) => {
      const query = {
        clientId: req.query.clientId,
      };

      const result = await hireRequestsCollection.find(query).toArray();
      res.json(result);
    });
    // get hiring request history
    app.get("/api/lawyer/hiring-request", async (req, res) => {
      const query = {
        lawyerId: req.query.lawyerId,
      };

      const result = await hireRequestsCollection.find(query).toArray();
      res.json(result);
    });

    // payment related api
    app.post("/api/payment", async (req, res) => {
      const { session_id, clientId, amount, lawyerId, lawyerName } = req.body;
      const isExist = await paymentCollection.findOne({ session_id });
      if (isExist) {
        return res.status(400).send({ message: "session already exist" });
      }
      const result = await paymentCollection.insertOne({
        session_id,
        lawyerId,
        lawyerName,
        amount,
        clientId,
      });

      // update payment status in request collection
      const query = {
        clientId: clientId,
        lawyerId: lawyerId,
      };

      const update = await hireRequestsCollection.updateOne(query, {
        $set: {
          paymentStatus: "paid",
        },
      });
      res.send(result);
    });

    // const result = await client.db("admin").command({ ping: 1 });
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
