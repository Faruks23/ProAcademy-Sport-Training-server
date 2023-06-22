const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;
var jwt = require("jsonwebtoken");

const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
app.use(express.static("public"));
console.log(process.env.PAYMENT_SECRET_KEY);


// middleware

app.use(cors())
app.use(express.json());
 





app.get("/", (req, res) => {
  res.send("Hello World!");
});




// verify Jwt token
const verifyJwt = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  // bearer token

  const token = authorization.split(" ")[1];

  // verify a token 
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(401).send({ error: true, message:"unauthorized access" });
    }
     req.decoded = decoded;
    
  });
  next();
}


// mongoDB serve 

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.USER_DB}:${process.env.USER_PASSWORD}@cluster0.mafpasm.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection


    // create JWT TOKE
 
    app.post('/jwt', (req, res) => { 
      const user = req.body;
      const token = jwt.sign(user,process.env.ACCESS_TOKEN_SECRET,{
          expiresIn: '1h',
      })
      res.send({token})
        
        
    })

    // db collection

    const ClassCollection = client.db("ProAcademy").collection("classes");
    const instructorCollection = client
      .db("ProAcademy")
      .collection("instructors");
    const userCollection = client.db("ProAcademy").collection("user");
    const EnrolCollection = client.db("ProAcademy").collection("SelectedClass");

    const PaymentCollection = client.db("ProAcademy").collection("payment");


// payments  methods
      app.post("/create-payment-intent",  async (req, res) => {
        const { prices } = req.body;
        console.log("taka", prices);
        const amounts = parseInt(prices * 100);
        console.log(prices);
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amounts,
          currency: "usd",

          payment_method_types: ["card"],
        });
        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      });

// payment api
 app.post("/payment", async (req, res) => {
   const payment = req.body;
   const classId = payment._id;

   try {

     const query = { _id: new ObjectId(classId) };
     const previousClass = await ClassCollection.findOne(query);

     if (!previousClass) {
       return res.status(404).json({ message: "Class not found" });
     }

     
     if (previousClass.availableSeats <= 0) {
       return res.status(400).json({ message: "No available seats" });
     }

     const updateDoc = {
       $set: {
         availableSeats: previousClass.availableSeats - 1,
         StudentEnroll: previousClass.StudentEnroll + 1,
       },
     };

    
     const result = await ClassCollection.updateOne(query, updateDoc);

     await PaymentCollection.insertOne(payment);

 
     const SelectedQuery = { $or: [{ _id: new ObjectId(classId) }, { _id: classId}] };
     await EnrolCollection.deleteMany(SelectedQuery);

     res.json(result);
   } catch (error) {
     console.error("Error processing payment:", error);
     res.status(500).json({ message: "Internal server error" });
   }
 });
    
    // get payment enrollment information

    app.get("/payment/enrol", async function (req, res) {
      const email = req.query.email;
      const query = { email: email };
      const result = await PaymentCollection.find(query).toArray();
      res.send(result);
    });
    // get payment  history

    app.get("/payment/history", async function (req, res) {
      const email = req.query.email;
      const query = { email: email };
      const result = await PaymentCollection.find(query).sort({data:-1}).toArray();
      res.send(result);
    });

    // get popular classes
    app.get('/popularClasses', async (req, res) => { 
      const result = await ClassCollection.find().sort({ StudentEnroll: -1 }).limit(6).toArray();
      res.send(result);


    })







// admin verification methods
    app.get('/users/admin/:email', verifyJwt,  async (req, res) => { 
      const email = req.params.email
      //  console.log(email);
      if (req.decoded.email !== email) { 
        res.send({admin: false})
      }
      const query = { email: email }
      const user = await userCollection.findOne(query);
      const result = { admin: user?.role== "admin" }
      res.send(result);
    })
    // instructor verification method

 app.get("/users/instructor/:email", verifyJwt, async (req, res) => {
   const email = req.params.email;
   console.log(email);
   if (req.decoded.email !== email) {
     res.send({ instructor: false });
   }
   const query = { email: email };
   const user = await userCollection.findOne(query);
   const result = { instructor: user?.role == "Instructor" };
   res.send(result);
 });
// student verification
    app.get("/users/student/:email", verifyJwt, async (req, res) => {
      const email = req.params.email;
      console.log(email);
      if (req.decoded.email !== email) {
        res.send({ student: false });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { student: user?.role == "student" };
      res.send(result);
    });


    
    app.get("/users/student/:email", verifyJwt, async (req, res) => {
      const email = req.params.email;
      console.log(email);
      if (req.decoded.email !== email) {
        res.send({ student: false });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { student: user?.role == "student" };
      res.send(result);
    });







    // get classes from the db

    app.get("/classes", async (req, res) => {
      const result = await ClassCollection.find().toArray();
      res.send(result);
    });

    // add classes
    app.post("/AddClasses", async (req, res) => {
      const NewItem = req.body;
      const result = await ClassCollection.insertOne(NewItem);
      res.send(result);
    });

    // get instructors from the db
    app.get("/instructor", async (req, res) => {
      const result = await instructorCollection.find().toArray();
      res.send(result);
    });

    // get the instructor class by email address
    app.get("/getClass", verifyJwt, async (req, res) => {
      const email = req.query.email;
      if (!email) {
            res.send({message:"cannot find email address"})
          }
      const decodedEmail = req.decoded.email;
      if (decodedEmail !== email) {
        return res.status(403).send({error:true, message:"forbidden access "})
   }

      const query = { instructorEmail: email };
      const result = await ClassCollection.find(query).toArray();
      res.send(result);
    });

    // update the class status
    app.patch("/updateStatus/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "Approved",
          disabled: true,
        },
      };
      const result = await ClassCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // deny with feedback
    app.put("/updateDeny/:id", async (req, res) => {
      const id = req.params.id;
      const { feedback } = req.body;
      console.log(feedback);
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "Deny",
          disabled: true,
          feedback: feedback,
        },
      };
      const result = await ClassCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // save user information
    app.post("/AddUsers", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: "user already exists" });
      }

      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // Get user collection 
    app.get("/GetUsers", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

  // make admin 
      app.patch("/users/admin/:id", async (req, res) => {
        const id = req.params.id;
        console.log(id);
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            role: "admin",
            disabled: true,
          },
        };

        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);
      });
    
    
    
    //make user to instructor
     app.patch("/users/instructor/:id", async (req, res) => {
       const id = req.params.id;
       console.log(id);
       const filter = { _id: new ObjectId(id) };
       const updateDoc = {
         $set: {
           role: "Instructor",
           Insdisabled: true,
         },
       };

       const result = await userCollection.updateOne(filter, updateDoc);
       res.send(result);
     });
    
    // Delete user from db
    app.delete('/users/DeleteUsers/:id', async (req, res) => { 
      const id = req.params.id;
      console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);


    })

    // Enroll  Classes

    app.post("/Student/Enrol", async (req, res) => {
      try {
        const EnrolClass = req.body;
        const query = { _id: new ObjectId(EnrolClass._id) };
        console.log(EnrolClass._id);
        const previousEnrollment = await EnrolCollection.findOne(query);
        if (previousEnrollment) {
          res.send({ message: " already enrolled" });
          return; 
        } else {
          const result = await EnrolCollection.insertOne(EnrolClass);
          return res.send(result);
        }
      } catch (error) {
        console.error(error);
        return res.status(500).send({ message: "Internal Server Error" });
      }
    });


    // get  students selected classes
    app.get("/MyClass", async (req, res) => { 
      const email = req.query.email;
      const query={StudentEmail: email}
      const result = await EnrolCollection.find(query).toArray();
      res.send(result);

    });

    // delete students selected classes

    app.delete("/DeleteMyClass/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { $or: [{ _id: new ObjectId(id) },{_id:id}] };
        const result = await EnrolCollection.deleteMany(query);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
      }
    });


    

    





    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);






app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
