const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.MONGO_URI;
const nodemailer = require("nodemailer");

// middleware
app.use(cors());
app.use(express.json());

// nodemailer transpoter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.NODE_MAILER_EMAIL,
    pass: process.env.NODE_MAILER_PASS,
  },
});

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

    // node mailer
    app.post("/api/send-email", async (req, res) => {
      const { name, email } = req.query;
      const currentYear = new Date().getFullYear();
      const info = await transporter.sendMail({
        from: process.env.NODE_MAILER_EMAIL,
        to: email,
        subject: "Welcome to LegalEase",
        text: `Hi ${name},

Thank you for creating your LegalEase account. We're happy to welcome you to our community.

Your account has been created successfully. You can now sign in and explore LegalEase.

Best regards,
The LegalEase Team`,
        html: `

  <div style="margin:0;padding:32px 16px;background-color:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">

  <div style="padding:28px 24px;background-color:#6d5ef5;text-align:center;">
    <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;">
      LegalEase
    </h1>
    <p style="margin:8px 0 0;color:#eeecff;font-size:14px;line-height:1.5;">
      Legal support, made simpler.
    </p>
  </div>

  <div style="padding:32px 28px;">
    <h2 style="margin:0 0 18px;color:#0f172a;font-size:22px;line-height:1.4;">
      Welcome to LegalEase, ${name}!
    </h2>

    <p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.8;">
      Hi ${name},
    </p>

    <p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.8;">
      Thank you for creating your LegalEase account. We're happy to welcome you to our community.
    </p>

    <p style="margin:0 0 22px;color:#475569;font-size:15px;line-height:1.8;">
      LegalEase helps people connect with legal professionals through an accessible online platform. You can now sign in to your account and explore the available features.
    </p>

    <div style="padding:16px;background-color:#f8fafc;border-left:4px solid #6d5ef5;border-radius:4px;">
      <p style="margin:0;color:#334155;font-size:14px;line-height:1.8;">
        <strong>Your account has been created successfully.</strong><br />
        You can sign in whenever you're ready to get started.
      </p>
    </div>

    <p style="margin:26px 0 0;color:#475569;font-size:15px;line-height:1.8;">
      Best regards,<br />
      <strong style="color:#0f172a;">The LegalEase Team</strong>
    </p>
  </div>

  <div style="padding:20px 24px;background-color:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
    <p style="margin:0 0 8px;color:#64748b;font-size:12px;line-height:1.7;">
      You received this email because an account was created using this email address.
    </p>
    <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">
      &copy; ${currentYear} LegalEase. All rights reserved.
    </p>
  </div>

</div>

  </div>
`,
      });
      transporter.sendMail(info);
    });

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
    // return result;
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
