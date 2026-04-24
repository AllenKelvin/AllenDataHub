import mongoose from 'mongoose';

async function getProducts() {
  try {
    const uri = process.env.DATABASE_URL;
    if (!uri) {
      console.error('DATABASE_URL not set');
      process.exit(1);
    }
    
    await mongoose.connect(uri);
    
    const schema = new mongoose.Schema({}, { strict: false });
    const Product = mongoose.model('Product', schema, 'products');
    
    const products = await Product.find({}).lean();
    
    console.log('\n=== AVAILABLE PRODUCTS ===\n');
    products.forEach((p, i) => {
      console.log(`${i + 1}. ${p.name} (${p.network})`);
      console.log(`   ID: ${p._id}`);
      console.log(`   Data: ${p.dataAmount}GB`);
      console.log(`   Price: GHS ${p.price}\n`);
    });
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

getProducts();
