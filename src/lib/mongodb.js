import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const options = {};

if (!uri && process.env.NODE_ENV === "production") {
  console.warn("Warning: MONGODB_URI is missing. Database features will be disabled.");
}

let clientPromise;

if (!uri) {
  // Trả về một Promise resolve ra null thay vì throw Error
  clientPromise = Promise.resolve(null);
} else {
  const client = new MongoClient(uri, options);
  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = client.connect();
    }
    clientPromise = global._mongoClientPromise;
  } else {
    clientPromise = client.connect();
  }
}

export default clientPromise;