import mongoose from "mongoose";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

export async function connectDb() {
  await mongoose.connect(process.env.DATABASE_URL!, {
    // options can be added here if needed
  });
  console.log("Connected to MongoDB");
  
  // Drop problematic indexes that might cause E11000 errors
  try {
    const ordersCollection = mongoose.connection.collection('orders');
    const indexes = await ordersCollection.getIndexes();
    console.log("Current Order indexes:", indexes);
    
    // Drop any unique index on 'id' field that might be causing E11000 errors
    for (const [name, spec] of Object.entries(indexes)) {
      if ((spec as any).unique && name !== '_id_') {
        console.log(`Dropping index: ${name}`);
        await ordersCollection.dropIndex(name);
      }
    }
  } catch (err: any) {
    console.log("No problematic indexes to drop or error checking indexes:", err.message);
  }
}

export default mongoose;
