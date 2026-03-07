import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI; // Thêm link MongoDB vào file .env
const options = {};

let client;
let clientPromise;

if (!process.env.MONGODB_URI) {
  throw new Error("Vui lòng thêm MONGODB_URI vào file .env");
}

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

// Add this to verify your connection is alive
clientPromise.then(() => {
  console.log("✅ Successfully connected to MongoDB Atlas. Caching is now ACTIVE.");
}).catch(err => {
  console.error("❌ MongoDB Connection failed. Billing risk remains high!", err);
});

export default clientPromise;